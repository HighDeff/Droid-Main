/**
 * Dual-AI Pipeline Express Route Handlers
 * Endpoints for AI #1 Qwen Perception, AI #2 Reasoning Planner, Coordinate Recalibration & Adaptive Retry
 */

import { RequestHandler } from "express";
import { qwenVisionEngine } from "../ai-perception-engine";
import { aiPlannerEngine } from "../ai-planner-engine";
import { adaptiveRetryEngine } from "../adaptive-retry-engine";
import { verifyStepAccuracy, resolveStuckState } from "../ai-gemini-service";
import {
  ALLOWED_AUTOMATION_ACTIONS,
  AUTOMATION_BOUNDS,
  OPTIONAL_POSITIONAL_AUTOMATION_ACTIONS,
  POSITIONAL_AUTOMATION_ACTIONS,
  REPLAY_ALLOWED_ACTIONS,
  REPLAY_POSITIONAL_ACTIONS,
  validateDeviceId,
  validateHotkey,
  validateKey,
  validateText,
} from "../automation-adapters";
import { validatePoint } from "../../shared/coordinates";
import { assistantStateRepository } from "../assistant-state";
import type { AssistantPlan } from "../../shared/assistant";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { aiMonitorStore } from "../ai-monitor-store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let latestFrameProvider: () => { imageData: string; timestamp: number } | null = () => null;
type ReplayPlanProvider = (sessionId: string, planId: string) => AssistantPlan | undefined;
const defaultReplayPlanProvider: ReplayPlanProvider = (sessionId, planId) =>
  assistantStateRepository.getPlan(planId, sessionId);
let replayPlanProvider: ReplayPlanProvider = defaultReplayPlanProvider;
const MAX_FRAME_AGE_MS = 5_000;
const POST_ACTION_FRAME_TIMEOUT_MS = 3_000;
const MAX_REPLAY_DURATION_MS = 120_000;

export function configureLatestFrameProvider(
  provider: () => { imageData: string; timestamp: number } | null,
) {
  latestFrameProvider = provider;
}

export function configureReplayPlanProvider(provider?: ReplayPlanProvider) {
  replayPlanProvider = provider ?? defaultReplayPlanProvider;
}

function getFreshFrame() {
  const frame = latestFrameProvider();
  if (
    !frame?.imageData ||
    !Number.isFinite(frame.timestamp) ||
    Date.now() - frame.timestamp > MAX_FRAME_AGE_MS
  ) {
    return null;
  }
  return frame;
}

async function waitForFrameAfter(timestamp: number, signal?: AbortSignal) {
  const deadline = Date.now() + POST_ACTION_FRAME_TIMEOUT_MS;
  while (Date.now() < deadline && !signal?.aborted) {
    const frame = getFreshFrame();
    if (frame && frame.timestamp > timestamp) return frame;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

// 1. AI #1 Screen Auto-Description & Feedback Positioning
export const handleDescribeScreen: RequestHandler = async (req, res) => {
  try {
    const { imageData, endpoint, model, browserContext } = req.body;
    if (!imageData) {
      return res
        .status(400)
        .json({ success: false, error: "Missing imageData" });
    }

    const context = browserContext || aiMonitorStore.getBrowserContext();
    aiMonitorStore.setStatus({
      status: "perceiving",
      currentAction: "Analyzing the current screen",
    });
    const report = await qwenVisionEngine.analyzeScreen(
      imageData,
      endpoint,
      model,
      context,
    );
    if (report.degraded) {
      aiMonitorStore.record({
        phase: "perception",
        title: "Screen perception unavailable",
        detail: report.error || "Screen perception is unavailable",
        status: "failed",
        confidence: report.confidence,
        source: "AI #1 Vision",
      });
      aiMonitorStore.setStatus({ status: "idle", currentAction: null });
      return res.status(503).json({
        success: false,
        error: report.error || "Screen perception is unavailable",
        report,
      });
    }
    aiMonitorStore.record({
      phase: "perception",
      title: "Screen perceived",
      detail: report.screenDescription,
      status: "completed",
      confidence: report.confidence,
      source: "AI #1 Vision",
    });
    aiMonitorStore.setStatus({ status: "idle", currentAction: null });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// 2. AI #2 Reasoning Planner, Thinking, Goal Reorganization & Action Formulation
export const handlePlanAndAct: RequestHandler = async (req, res) => {
  try {
    const {
      perceptionReport,
      userObjective,
      endpoint,
      model,
      executeImmediately = false,
      approved = false,
    } = req.body;

    if (!perceptionReport) {
      return res
        .status(400)
        .json({ success: false, error: "Missing perceptionReport" });
    }
    if (perceptionReport.degraded) {
      return res.status(422).json({
        success: false,
        error: perceptionReport.error || "A verified perception report is required before planning",
      });
    }

    aiMonitorStore.setStatus({
      status: "planning",
      objective: userObjective || "Automated desktop task",
      currentAction: "Formulating the next action",
    });
    const decision = await aiPlannerEngine.planAndFormulateAction(
      perceptionReport,
      userObjective,
      endpoint,
      model,
    );
    aiMonitorStore.record({
      phase: "planning",
      title: decision.statusSummary || "Plan formulated",
      detail: decision.thinking?.reasoning || "",
      status: "completed",
      confidence: decision.thinking?.confidence,
      source: "AI #2 Planner",
    });
    aiMonitorStore.setStatus({
      status: "idle",
      currentAction: null,
      activeGoals: (decision.goals || []).map((g: any) => ({
        title: g.title,
        status: g.status,
      })),
    });

    let executionResult: any = null;
    let verification: any = null;
    let stuckResolution: any = null;

    if (executeImmediately && approved === true && decision.nextAction) {
      const beforeFrame = getFreshFrame();
      if (!beforeFrame) {
        executionResult = {
          success: false,
          error: "A fresh synchronized frame is required before device control",
        };
      } else {
        executionResult = await dispatchActionToPython(decision.nextAction);
      }
      const afterFrame = executionResult?.success
        ? await waitForFrameAfter(beforeFrame!.timestamp)
        : null;
      const snap = afterFrame?.imageData;
      if (snap && executionResult?.success && snap !== beforeFrame!.imageData) {
        const nextAct: any = decision.nextAction;
        verification = await verifyStepAccuracy({
          imageData: snap,
          step: {
            id: nextAct.id,
            name: nextAct.title || "Step",
            action: nextAct.actionType || "click",
            x: nextAct.x ?? 960,
            y: nextAct.y ?? 540,
            text: nextAct.textPayload,
          },
          userObjective: userObjective || "Automate desktop task",
        });
        if (verification?.status === "obstructed" || verification?.status === "missed") {
          stuckResolution = await resolveStuckState({
            imageData: snap,
            currentStep: nextAct,
            lastError: verification.analysis,
          });
        }
      } else if (executionResult?.success) {
        verification = {
          verified: false,
          accuracyScore: 0,
          status: "missed",
          analysis: afterFrame
            ? "The fresh post-action frame did not change."
            : "No fresh post-action frame was available.",
          goalFinished: false,
        };
      }
      if (verification) {
        aiMonitorStore.record({
          phase: "verification",
          title: `Verification: ${verification.status || "completed"}`,
          detail: verification.analysis || "",
          status: verification.verified === false ? "failed" : "completed",
          source: "AI Verifier",
        });
      }
    }

    res.json({
      success: true,
      decision,
      executionResult,
      verification,
      stuckResolution,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// 3. Post-Execution Coordinate Recalibration
export const handleRecalibrateStep: RequestHandler = async (req, res) => {
  try {
    const { targetName, currentX, currentY, newElements } = req.body;
    const result = adaptiveRetryEngine.recalibrateElementCoordinates(
      targetName || "",
      currentX || 960,
      currentY || 540,
      newElements || [],
    );
    res.json({ success: true, recalibration: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// 3b. Batch Auto-Calibration for Workflow Steps with Pixel-Drift Threshold Evaluation
export const handleAutoCalibrateWorkflow: RequestHandler = async (req, res) => {
  try {
    const { steps = [], thresholdPx = 8, elements = [] } = req.body;
    const threshold = Number(thresholdPx) || 8;
    let recalibratedCount = 0;
    const logs: string[] = [];
    const driftPoints: Array<{
      x: number;
      y: number;
      driftPx: number;
      intensity: number;
      frequency: number;
      selectorName: string;
      isProblematic: boolean;
      status: "critical" | "moderate" | "stable";
    }> = [];

    const calibratedSteps = steps.map((step: any, idx: number) => {
      const stepNum = step.stepNumber || idx + 1;
      const baseX = step.originalX ?? step.x ?? 960;
      const baseY = step.originalY ?? step.y ?? 540;
      const currentOffsetX = step.offsetX ?? 0;
      const currentOffsetY = step.offsetY ?? 0;
      const currentTargetX = baseX + currentOffsetX;
      const currentTargetY = baseY + currentOffsetY;
      const targetName = step.selector || step.targetOcrLabel || step.name || `Step #${stepNum}`;

      // Use adaptive retry engine to find target in elements
      const recal = adaptiveRetryEngine.recalibrateElementCoordinates(
        targetName,
        currentTargetX,
        currentTargetY,
        elements,
      );

      let detectedX = recal.newCoordinates.x;
      let detectedY = recal.newCoordinates.y;

      const dx = detectedX - currentTargetX;
      const dy = detectedY - currentTargetY;
      const driftPx = Math.round(Math.hypot(dx, dy) * 10) / 10;
      const exceeds = driftPx > threshold;

      let newOffsetX = currentOffsetX;
      let newOffsetY = currentOffsetY;
      let recalibrated = false;

      if (exceeds) {
        newOffsetX = currentOffsetX + dx;
        newOffsetY = currentOffsetY + dy;
        recalibrated = true;
        recalibratedCount++;
        logs.push(
          `[AUTO-CALIBRATION] Step #${stepNum} "${targetName}": Drift of ${driftPx}px exceeded threshold (${threshold}px). Offset updated to [ΔX:${newOffsetX > 0 ? "+" : ""}${newOffsetX}px, ΔY:${newOffsetY > 0 ? "+" : ""}${newOffsetY}px].`
        );
      } else {
        logs.push(
          elements.length === 0
            ? `[AUTO-CALIBRATION] Step #${stepNum} "${targetName}": No detected elements were supplied; coordinates were left unchanged.`
            : `[AUTO-CALIBRATION] Step #${stepNum} "${targetName}": Drift of ${driftPx}px is within threshold (${threshold}px). Alignment intact.`
        );
      }

      const pointStatus = driftPx > threshold ? "critical" : driftPx > threshold / 2 ? "moderate" : "stable";
      const intensity = Math.min(1, Math.max(0.1, driftPx / (threshold * 1.5)));

      driftPoints.push({
        x: detectedX,
        y: detectedY,
        driftPx,
        intensity,
        frequency: exceeds ? Math.min(10, Math.floor(driftPx / 2)) : 1,
        selectorName: targetName,
        isProblematic: exceeds,
        status: pointStatus,
      });

      return {
        ...step,
        originalX: baseX,
        originalY: baseY,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
        x: baseX + newOffsetX,
        y: baseY + newOffsetY,
        driftDistancePx: driftPx,
        recalibrated: exceeds || step.recalibrated || false,
        lastCalibratedAt: Date.now(),
      };
    });

    res.json({
      success: true,
      calibratedSteps,
      recalibratedCount,
      thresholdPx: threshold,
      driftPoints,
      logs,
      summary: recalibratedCount > 0
        ? `Auto-Calibration updated ${recalibratedCount} step(s) with pixel-drift exceeding ${threshold}px.`
        : elements.length === 0
          ? `No verified screen elements were supplied; ${steps.length} step(s) were left unchanged.`
          : `All ${steps.length} step(s) aligned within ${threshold}px threshold (Zero drift corrections needed).`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// 4. Adaptive Retry Calculation with Learning from Past Methods
export const handleAdaptiveRetry: RequestHandler = async (req, res) => {
  try {
    const {
      stepId,
      actionType,
      targetName,
      currentX,
      currentY,
      textPayload,
      perception,
      approved = false,
    } = req.body;
    const retryPlan = adaptiveRetryEngine.computeAdaptiveRetry(
      stepId || `step_${Date.now()}`,
      actionType || "click",
      targetName || "Target",
      currentX || 960,
      currentY || 540,
      textPayload,
      perception || {
        elements: [],
        feedbackPosition: { x: 960, y: 540 },
        screenDescription: "",
      },
    );

    let executionResult: any = null;
    if (retryPlan.retryNeeded && approved === true) {
      executionResult = await dispatchActionToPython({
        id: stepId,
        title: `Retry (${retryPlan.attemptNumber}): ${targetName}`,
        actionType: retryPlan.adaptedActionType,
        x: retryPlan.newCoordinates.x,
        y: retryPlan.newCoordinates.y,
        textPayload: retryPlan.textPayload,
        delayMs: retryPlan.delayMs,
      });
    }

    res.json({ success: true, retryPlan, executionResult });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// 5. Unified Autonomous Co-Pilot Step (Perceive -> Plan -> Act -> Verify -> Recalibrate)
export const handleAutonomousStep: RequestHandler = async (req, res) => {
  try {
    const {
      imageData,
      userObjective,
      endpoint,
      model,
      browserContext,
      approved = false,
    } = req.body;
    if (!imageData) {
      return res
        .status(400)
        .json({ success: false, error: "Missing imageData" });
    }

    aiMonitorStore.setStatus({
      status: "perceiving",
      objective: userObjective || "Autonomous co-pilot step",
      currentAction: "Analyzing the current screen",
    });
    const perception = await qwenVisionEngine.analyzeScreen(
      imageData,
      endpoint,
      model,
      browserContext || aiMonitorStore.getBrowserContext(),
    );
    if (perception.degraded) {
      aiMonitorStore.record({
        phase: "perception",
        title: "Screen perception unavailable",
        detail: perception.error || "Screen perception is unavailable",
        status: "failed",
        confidence: perception.confidence,
        source: "AI #1 Vision",
      });
      aiMonitorStore.setStatus({ status: "idle", currentAction: null });
      return res.status(503).json({
        success: false,
        error: perception.error || "Screen perception is unavailable",
        perception,
      });
    }
    aiMonitorStore.record({
      phase: "perception",
      title: "Screen perceived",
      detail: perception.screenDescription,
      status: "completed",
      confidence: perception.confidence,
      source: "AI #1 Vision",
    });
    aiMonitorStore.setStatus({
      status: "planning",
      currentAction: "Formulating the next action",
    });
    const decision = await aiPlannerEngine.planAndFormulateAction(
      perception,
      userObjective,
      endpoint,
      model,
    );
    aiMonitorStore.record({
      phase: "planning",
      title: decision.statusSummary || "Plan formulated",
      detail: decision.thinking?.reasoning || "",
      status: "completed",
      confidence: decision.thinking?.confidence,
      source: "AI #2 Planner",
    });
    aiMonitorStore.setStatus({
      status: "idle",
      currentAction: null,
      activeGoals: (decision.goals || []).map((g: any) => ({
        title: g.title,
        status: g.status,
      })),
    });

    let executionResult: any = null;
    let verification: any = null;
    let stuckResolution: any = null;

    if (decision.nextAction && approved === true) {
      const nextAct: any = decision.nextAction;
      const beforeFrame = getFreshFrame();
      if (!beforeFrame) {
        executionResult = {
          success: false,
          error: "A fresh synchronized frame is required before device control",
        };
      } else {
        executionResult = await dispatchActionToPython(decision.nextAction);
      }
      const afterFrame = executionResult?.success
        ? await waitForFrameAfter(beforeFrame!.timestamp)
        : null;
      const postActionImage = afterFrame?.imageData;
      if (postActionImage && postActionImage !== beforeFrame!.imageData && executionResult?.success) {
        verification = await verifyStepAccuracy({
          imageData: postActionImage,
          step: {
            id: nextAct.id,
            name: nextAct.title || "Autonomous Action",
            action: nextAct.actionType || "click",
            x: nextAct.x ?? 960,
            y: nextAct.y ?? 540,
            text: nextAct.textPayload,
          },
          userObjective: userObjective || "Automate desktop task",
        });
        if (verification?.status === "obstructed" || verification?.status === "missed") {
          stuckResolution = await resolveStuckState({
            imageData,
            currentStep: nextAct,
            lastError: verification.analysis,
          });
        }
      } else if (executionResult?.success) {
        verification = {
          verified: false,
          accuracyScore: 0,
          status: "missed",
          analysis: afterFrame
            ? "The fresh post-action frame did not change."
            : "No fresh post-action frame was available.",
          goalFinished: false,
        };
      } else if (imageData && !executionResult?.success) {
        stuckResolution = await resolveStuckState({
          imageData,
          currentStep: nextAct,
          lastError: executionResult?.error || "Action execution failed",
        });
      }
    }

    res.json({
      success: true,
      perception,
      decision,
      executionResult,
      verification,
      stuckResolution,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// Helper to resolve python command robustly (windows: python, py, python3)
function getPythonCmd(): string {
  // Prefer env override, else try platform-appropriate
  if (process.env.PYTHON_CMD) return process.env.PYTHON_CMD;
  return process.platform === "win32" ? "python" : "python3";
}

// Dispatch action to Python PyAutoGUI service
export async function dispatchActionToPython(action: any, signal?: AbortSignal): Promise<any> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val: any) => {
      if (!resolved) {
        resolved = true;
        aiMonitorStore.record({
          phase: "execution",
          title: action.title || action.name || "Automated action",
          detail:
            typeof val?.result === "string"
              ? val.result
              : val?.message || val?.error || "Action dispatched",
          status: val?.success === false ? "failed" : "completed",
          target: { name: action.targetName, x: action.x, y: action.y },
          source: "PyAutoGUI",
        });
        aiMonitorStore.setStatus({ status: "idle", currentAction: null });
        resolve(val);
      }
    };
    try {
      if (signal?.aborted) throw new Error("Action dispatch was cancelled");
      const actType = String(action.actionType ?? action.action ?? "").toLowerCase();
      if (!ALLOWED_AUTOMATION_ACTIONS.has(actType)) {
        throw new Error(`Unsupported action: ${actType || "missing"}`);
      }
      const relativeAction = actType.startsWith("relative_");
      const rawX = relativeAction
        ? action.relU ?? action.x ?? action.targetPosition?.x
        : action.x ?? action.targetPosition?.x;
      const rawY = relativeAction
        ? action.relV ?? action.y ?? action.targetPosition?.y
        : action.y ?? action.targetPosition?.y;
      const hasAnyTargetCoordinate = rawX !== undefined || rawY !== undefined;
      const hasTargetCoordinates = rawX !== undefined && rawY !== undefined;
      if (
        POSITIONAL_AUTOMATION_ACTIONS.has(actType) ||
        (OPTIONAL_POSITIONAL_AUTOMATION_ACTIONS.has(actType) && hasAnyTargetCoordinate)
      ) {
        validatePoint({ x: rawX, y: rawY }, AUTOMATION_BOUNDS, "dispatch coordinates");
      }
      const relativeX = Number(rawX ?? 0);
      const relativeY = Number(rawY ?? 0);
      if (
        relativeAction &&
        (!Number.isFinite(relativeX) ||
          !Number.isFinite(relativeY) ||
          Math.abs(relativeX) >= AUTOMATION_BOUNDS.width ||
          Math.abs(relativeY) >= AUTOMATION_BOUNDS.height)
      ) {
        throw new Error("Relative action offsets must be finite and within automation bounds");
      }
      const actionX = POSITIONAL_AUTOMATION_ACTIONS.has(actType) || hasTargetCoordinates
        ? rawX
        : relativeAction
          ? relativeX
          : 960;
      const actionY = POSITIONAL_AUTOMATION_ACTIONS.has(actType) || hasTargetCoordinates
        ? rawY
        : relativeAction
          ? relativeY
          : 540;
      let textPayload = String(action.textPayload ?? action.text ?? "");
      let keyPayload = String(action.keyPayload ?? action.key ?? "");
      if (["clear_and_type", "type", "type_text", "relative_type"].includes(actType)) {
        textPayload = validateText(textPayload);
      }
      if (["key", "press_key"].includes(actType)) {
        keyPayload = validateKey(keyPayload);
      }
      if (actType === "hotkey") {
        textPayload = validateHotkey(textPayload || keyPayload).join("+");
      }
      const requestedDelayMs = action.delayMs ?? action.delay ?? 500;
      if (typeof requestedDelayMs !== "number" || !Number.isFinite(requestedDelayMs)) {
        throw new Error("Action delay must be a finite number");
      }
      const normalizedDelayMs = Math.min(Math.max(requestedDelayMs, 0), 120_000);
      const requestedDriftPx = action.driftPx ?? 0;
      if (typeof requestedDriftPx !== "number" || !Number.isFinite(requestedDriftPx)) {
        throw new Error("Action drift must be a finite number");
      }
      const normalizedDriftPx = Math.min(Math.max(requestedDriftPx, 0), 12);
      const routePoints = action.routePoints ?? action.points ?? [];
      if (["stream_mouse_route", "play_route", "replay_route"].includes(actType)) {
        if (!Array.isArray(routePoints) || routePoints.length < 2 || routePoints.length > 10_000) {
          throw new Error("Mouse route requires between 2 and 10,000 points");
        }
        routePoints.forEach((point: unknown, index: number) =>
          validatePoint(point as { x: number; y: number }, AUTOMATION_BOUNDS, `route point ${index + 1}`),
        );
      }
      if (["drag", "drag_and_drop"].includes(actType)) {
        if (!action.dragEndPosition || typeof action.dragEndPosition !== "object") {
          throw new Error("A drag end position is required");
        }
        validatePoint(action.dragEndPosition, AUTOMATION_BOUNDS, "drag end coordinates");
      }

      const pythonScript = path.join(
        __dirname,
        "../../python-service/execute-task.py",
      );
      const pythonCmd = getPythonCmd();

      const python = spawn(pythonCmd, [pythonScript], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let output = "";
      let errorOutput = "";
      const abortHandler = () => {
        try {
          python.kill();
        } catch {}
        safeResolve({ success: false, executed: false, error: "Action dispatch was cancelled" });
      };
      signal?.addEventListener("abort", abortHandler, { once: true });

      let taskDesc = `Click at ${actionX}, ${actionY}`;
      if (actType === "double_click") {
        taskDesc = `Double click at ${actionX}, ${actionY}`;
      } else if (actType === "right_click") {
        taskDesc = `Right click at ${actionX}, ${actionY}`;
      } else if (actType === "clear_and_type") {
        taskDesc = `Clear and type "${textPayload}" at ${actionX}, ${actionY}`;
      } else if (actType === "type_text" || actType === "type") {
        taskDesc = `Type "${textPayload}" at ${actionX}, ${actionY}`;
      } else if (actType === "press_key") {
        taskDesc = `Press key: ${keyPayload}`;
      } else if (actType === "hotkey") {
        taskDesc = `Hotkey: ${textPayload}`;
      } else if (actType === "scroll") {
        taskDesc = `Scroll at ${actionX}, ${actionY}`;
      } else if (actType === "stream_mouse_route") {
        taskDesc = `Stream mouse trail with ${routePoints.length} waypoints`;
      } else if (actType === "wait") {
        taskDesc = `Wait for ${normalizedDelayMs}ms`;
      }

      const taskPayload = {
        id: action.id || `act_${Date.now()}`,
        name: action.title || action.name || "Dual AI Automated Action",
        description: taskDesc,
        status: "running",
        priority: 1,
        createdAt: new Date(),
        action: actType,
        actionType: actType,
        x: actionX,
        y: actionY,
        targetPosition: { x: actionX, y: actionY },
        hasTargetCoordinates,
        relU: relativeAction ? actionX : undefined,
        relV: relativeAction ? actionY : undefined,
        appOrigin: relativeAction ? action.appOrigin : undefined,
        subAction: relativeAction ? action.subAction : undefined,
        textPayload,
        keyPayload: keyPayload || "enter",
        delayMs: normalizedDelayMs,
        text: textPayload || undefined,
        routePoints,
        isDrag: action.isDrag === true,
        dragEndPosition: action.dragEndPosition,
        direction: action.direction ?? action.scrollDirection,
        speedMultiplier: action.speedMultiplier || 1.0,
        driftPx: normalizedDriftPx,
      };

      // Wrap in {task: ...} envelope expected by python-service
      const envelope = {
        task: taskPayload,
        targetDevice: action.targetDevice || "desktop",
        deviceId: action.deviceId,
      };

      aiMonitorStore.setStatus({
        status: "executing",
        currentAction: taskPayload.name,
      });
      aiMonitorStore.record({
        phase: "execution",
        title: taskPayload.name,
        detail: taskDesc,
        status: "started",
        target: {
          name: action.targetName,
          x: action.x || 960,
          y: action.y || 540,
        },
        source: "PyAutoGUI",
      });

      python.stdin.write(JSON.stringify(envelope));
      python.stdin.end();

      python.stdout.on("data", (d) => {
        output += d.toString();
      });
      python.stderr.on("data", (d) => {
        errorOutput += d.toString();
      });

      python.on("error", (err) => {
        safeResolve({
          success: false,
          error: `Failed to spawn python (${pythonCmd}): ${err.message}`,
        });
      });

      let timeout: NodeJS.Timeout;
      python.on("close", (code) => {
        signal?.removeEventListener("abort", abortHandler);
        clearTimeout(timeout);
        if (code === 0) {
          try {
            if (!output.trim()) {
              safeResolve({
                success: false,
                error: "Native action process exited without a result",
              });
              return;
            }
            const parsed = JSON.parse(output);
            safeResolve(
              parsed && typeof parsed.success === "boolean"
                ? parsed
                : {
                    success: false,
                    error: "Native action returned an invalid result shape",
                  },
            );
          } catch (error) {
            safeResolve({
              success: false,
              error: `Native action returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        } else {
          try {
            const parsed = output.trim() ? JSON.parse(output) : null;
            safeResolve(
              parsed?.success === false
                ? parsed
                : {
                    success: false,
                    error: errorOutput || `Python dispatch failed (code ${code})`,
                  },
            );
          } catch {
            safeResolve({
              success: false,
              error: errorOutput || `Python dispatch failed (code ${code})`,
            });
          }
        }
      });

      const processTimeoutMs = actType === "wait" ? normalizedDelayMs + 5_000 : 15_000;
      timeout = setTimeout(() => {
        try {
          python.kill();
        } catch {}
        safeResolve({
          success: false,
          error: `Action execution timeout (${processTimeoutMs}ms)`,
        });
      }, processTimeoutMs);
    } catch (e) {
      safeResolve({
        success: false,
        error: e instanceof Error ? e.message : "Dispatch error",
      });
    }
  });
}

// 7. AI Play Similar Action (Frames 1-10) with Clickpoint Execution on PC
export const handleReplayDriftActions: RequestHandler = async (req, res) => {
  try {
    const {
      steps = [],
      executeOnPC = false,
      approved = false,
      targetDevice = "desktop",
      deviceId,
      sessionId,
      planId,
    } = req.body;

    let replaySteps = steps;
    let approvedPlan: AssistantPlan | undefined;
    if (executeOnPC) {
      if (approved !== true) {
        return res.status(403).json({
          success: false,
          error: "Explicit run confirmation is required before replay can control a device",
        });
      }
      if (typeof sessionId !== "string" || typeof planId !== "string") {
        return res.status(403).json({
          success: false,
          error: "A server-approved persisted plan is required for physical replay",
        });
      }
      approvedPlan = replayPlanProvider(sessionId, planId);
      if (!approvedPlan || approvedPlan.approvalState !== "approved") {
        return res.status(403).json({
          success: false,
          error: "The persisted replay plan is missing or has not been approved",
        });
      }
      replaySteps = approvedPlan.steps;
      const planDevices = new Set(
        approvedPlan.steps.map((step) => step.targetDevice ?? "desktop"),
      );
      if (planDevices.size !== 1 || !planDevices.has(targetDevice)) {
        return res.status(400).json({
          success: false,
          error: "Replay target must match the single device approved in the persisted plan",
        });
      }
    }

    if (!Array.isArray(replaySteps) || replaySteps.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Replay requires at least one user-recorded or reviewed step",
      });
    }
    if (replaySteps.length > 100) {
      return res.status(400).json({
        success: false,
        error: "Replay is limited to 100 reviewed steps per request",
      });
    }
    if (targetDevice !== "desktop" && targetDevice !== "android") {
      return res.status(400).json({
        success: false,
        error: "targetDevice must be desktop or android",
      });
    }
    if (targetDevice === "android") {
      try {
        const normalizedDeviceId = validateDeviceId(String(deviceId || ""));
        if (executeOnPC) {
          const approvedDeviceIds = new Set(
            approvedPlan!.steps.map((step) => step.deviceId).filter(Boolean),
          );
          if (approvedDeviceIds.size !== 1 || !approvedDeviceIds.has(normalizedDeviceId)) {
            return res.status(403).json({
              success: false,
              error: "Android replay device must match the device approved in the persisted plan",
            });
          }
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const actionsToReplay = replaySteps.map((s: any, idx: number) => ({
          frame: idx + 1,
          name: s.name || `Frame ${idx + 1}: ${s.action || "click"} on ${s.selector || "target"}`,
          action: s.action || "click",
          x: Number(s.originalX ?? s.x ?? s.target?.x) + Number(s.offsetX ?? 0),
          y: Number(s.originalY ?? s.y ?? s.target?.y) + Number(s.offsetY ?? 0),
          selector: s.selector || `#step-${idx + 1}`,
          text: s.textPayload ?? s.text,
          keyPayload: s.keyPayload ?? s.key,
          delayMs: s.delayMs ?? s.dwellDurationMs,
          routePoints: s.routePoints ?? s.points,
          isDrag: s.isDrag === true,
          driftPx: s.driftPx,
          dragEndPosition:
            s.dragEndPosition ??
            (Number.isFinite(Number(s.toX)) && Number.isFinite(Number(s.toY))
              ? { x: Number(s.toX), y: Number(s.toY) }
              : undefined),
          isClick: s.action === "click" || !s.action || s.action === "double_click",
        }));

    const unsupportedAction = actionsToReplay.find(
      (action) => !REPLAY_ALLOWED_ACTIONS.has(action.action),
    );
    if (unsupportedAction) {
      return res.status(400).json({
        success: false,
        error: `Replay step ${unsupportedAction.frame} uses unsupported action "${unsupportedAction.action}"`,
      });
    }
    const invalidAction = actionsToReplay.find(
      (action) =>
        REPLAY_POSITIONAL_ACTIONS.has(action.action) &&
        (!Number.isFinite(action.x) || !Number.isFinite(action.y)),
    );
    if (invalidAction) {
      return res.status(400).json({
        success: false,
        error: `Replay step ${invalidAction.frame} requires finite coordinates`,
      });
    }
    const invalidRoute = actionsToReplay.find(
      (action) =>
        action.action === "stream_mouse_route" &&
        (!Array.isArray(action.routePoints) ||
          action.routePoints.length < 2 ||
          action.routePoints.some(
            (point: any) =>
              !Number.isFinite(Number(point?.x)) ||
              !Number.isFinite(Number(point?.y)),
          )),
    );
    if (invalidRoute) {
      return res.status(400).json({
        success: false,
        error: `Replay step ${invalidRoute.frame} requires at least two finite route points`,
      });
    }

    const executedActions: any[] = [];
    let haltedReason: string | null = null;
    const replayDeadline = Date.now() + MAX_REPLAY_DURATION_MS;
    const replayController = new AbortController();
    const cancelReplay = () => replayController.abort("Replay client disconnected");
    const cancelOnClosedResponse = () => {
      if (!res.writableEnded) cancelReplay();
    };
    req.once("aborted", cancelReplay);
    res.once("close", cancelOnClosedResponse);
    const assertReplayActive = () => {
      if (Date.now() >= replayDeadline && !replayController.signal.aborted) {
        replayController.abort("Replay wall-clock deadline expired");
      }
      if (replayController.signal.aborted) {
        throw new Error(String(replayController.signal.reason || "Replay was cancelled"));
      }
    };

    let beforeFrame = executeOnPC ? getFreshFrame() : null;
    if (executeOnPC && !beforeFrame) {
      return res.status(409).json({
        success: false,
        error: "A fresh synchronized screen frame is required before replay",
      });
    }

    for (const act of actionsToReplay) {
      let pcResult: any = {
        executed: false,
        preview: !executeOnPC,
      };
      let perception: any = null;
      let verification: any = null;

      try {
        assertReplayActive();
      } catch (error) {
        haltedReason = `Replay stopped before step ${act.frame}: ${error instanceof Error ? error.message : String(error)}`;
        pcResult = { success: false, executed: false, error: haltedReason };
        executedActions.push({ ...act, pcResult, perception, verification, timestamp: Date.now() });
        break;
      }

      if (executeOnPC && beforeFrame) {
        try {
          const currentFrame = getFreshFrame();
          if (!currentFrame) {
            haltedReason = `Replay paused before step ${act.frame}: no fresh screen frame is available`;
            verification = { status: "missing", verified: false };
            executedActions.push({ ...act, pcResult, perception, verification, timestamp: Date.now() });
            break;
          }
          beforeFrame = currentFrame;
          const perceptionReport = await qwenVisionEngine.analyzeScreen(
            beforeFrame.imageData,
            undefined,
            undefined,
            null,
            replayController.signal,
          );
          assertReplayActive();
          perception = {
            degraded: perceptionReport.degraded === true,
            error: perceptionReport.error,
            screenDescription: perceptionReport.screenDescription,
            confidence: perceptionReport.confidence,
            primarySuggestion: perceptionReport.primarySuggestion,
          };
          if (perceptionReport.degraded) {
            haltedReason = `Replay paused before step ${act.frame}: screen analysis was unavailable (${perceptionReport.error || "unknown vision error"})`;
            executedActions.push({
              ...act,
              pcResult,
              perception,
              verification,
              clickPoint: act.isClick
                ? { x: act.x, y: act.y, verified: false }
                : null,
              timestamp: Date.now(),
            });
            break;
          }

          assertReplayActive();
          pcResult = await dispatchActionToPython({
            title: act.name,
            action: act.action,
            x: Number.isFinite(act.x) ? act.x : 960,
            y: Number.isFinite(act.y) ? act.y : 540,
            textPayload: act.text,
            keyPayload: act.keyPayload,
            delayMs: act.delayMs,
            routePoints: act.routePoints,
            isDrag: act.isDrag,
            driftPx: act.driftPx,
            dragEndPosition: act.dragEndPosition,
            targetDevice,
            deviceId,
          }, replayController.signal);
          assertReplayActive();
          if (!pcResult?.success) {
            haltedReason = `Replay paused at step ${act.frame}: ${pcResult?.error || "native action failed"}`;
          } else {
            const afterFrame = await waitForFrameAfter(
              beforeFrame.timestamp,
              replayController.signal,
            );
            assertReplayActive();
            if (!afterFrame) {
              haltedReason = `Replay paused after step ${act.frame}: no fresh post-action frame arrived`;
              verification = { status: "missing", verified: false };
            } else {
              const changed = afterFrame.imageData !== beforeFrame.imageData;
              verification = {
                status: changed || act.action === "wait" ? "changed" : "unchanged",
                verified: changed || act.action === "wait",
                beforeTimestamp: beforeFrame.timestamp,
                afterTimestamp: afterFrame.timestamp,
              };
              beforeFrame = afterFrame;
              if (!verification.verified) {
                haltedReason = `Replay paused after step ${act.frame}: the fresh screen frame did not visibly change; review or approve an alternate action`;
              }
            }
          }
        } catch (dispatchErr) {
          pcResult = { success: false, executed: false, error: String(dispatchErr) };
          haltedReason = `Replay paused at step ${act.frame}: ${String(dispatchErr)}`;
        }
      }

      executedActions.push({
        ...act,
        pcResult,
        perception,
        verification,
        clickPoint: act.isClick
          ? { x: act.x, y: act.y, verified: verification?.verified === true }
          : null,
        timestamp: Date.now(),
      });
      if (haltedReason) break;
    }

    const completed = !haltedReason && executedActions.length === actionsToReplay.length;

    req.removeListener("aborted", cancelReplay);
    res.removeListener("close", cancelOnClosedResponse);

    res.json({
      success: executeOnPC ? completed : true,
      status: executeOnPC ? (completed ? "completed" : "paused") : "preview",
      totalFrames: actionsToReplay.length,
      processedFrames: executedActions.length,
      executedActions,
      haltedReason,
      summary:
        executeOnPC && completed
          ? `Replayed and visually checked ${executedActions.length} approved actions on the device.`
          : executeOnPC
            ? haltedReason
            : `Prepared ${executedActions.length} frame actions for review; nothing was executed.`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// 8. Qwen Guided AI Agent (Movement Assistance, Error Correction & Backtracking)
export const handleQwenGuideStep: RequestHandler = async (req, res) => {
  try {
    const {
      imageData,
      currentStep,
      stepIndex = 0,
      driftDetected = false,
      driftPx = 0,
      isTypingIncomplete = false,
      incompleteFieldName = null,
      expectedValue,
      currentValue,
      endpoint,
      model,
    } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: "A fresh screen frame is required for Qwen guidance",
      });
    }

    const perception = await qwenVisionEngine.analyzeScreen(
      imageData,
      endpoint,
      model,
    );
    if (perception.degraded) {
      return res.status(503).json({
        success: false,
        error: perception.error || "Qwen could not analyze the supplied screen frame",
        perception,
      });
    }

    let guideDecision: "proceed" | "adjust_movement" | "backtrack_and_finish" | "pause" = "proceed";
    let reasoning = "";
    const currentX = Number(currentStep?.x ?? 960);
    const currentY = Number(currentStep?.y ?? 540);
    const targetLabel = String(
      currentStep?.selector || currentStep?.targetOcrLabel || currentStep?.name || "",
    ).toLowerCase();
    const detectedTarget = targetLabel
      ? perception.elements.find((element) => {
          const name = `${element.name} ${element.textValue || ""}`.trim().toLowerCase();
          return name.length > 0 && (name.includes(targetLabel) || targetLabel.includes(name));
        })
      : undefined;
    let adjustment = { deltaX: 0, deltaY: 0, targetX: currentX, targetY: currentY };
    let backtrackAction: any = null;

    if (isTypingIncomplete) {
      if (typeof expectedValue !== "string" || typeof currentValue !== "string") {
        guideDecision = "pause";
        reasoning = "Typing appears incomplete, but no reviewed expected and current values were supplied. Pausing instead of inventing text.";
      } else {
        guideDecision = "backtrack_and_finish";
        const field = incompleteFieldName || targetLabel || "the reviewed input field";
        reasoning = `The supplied value for ${field} is incomplete. Re-focus the visually detected field and replace it with the reviewed expected value.`;
        backtrackAction = {
          type: "clear_and_type",
          targetSelector: field,
          x: detectedTarget?.center.x ?? currentX,
          y: detectedTarget?.center.y ?? currentY,
          fullText: expectedValue,
          currentText: currentValue,
        };
      }
    } else if (driftDetected || driftPx > 6) {
      if (!detectedTarget) {
        guideDecision = "pause";
        reasoning = "Drift was reported, but the target was not found in the fresh screen analysis. Pausing for review.";
      } else {
        guideDecision = "adjust_movement";
        const deltaX = Math.round(detectedTarget.center.x - currentX);
        const deltaY = Math.round(detectedTarget.center.y - currentY);
        adjustment = {
          deltaX,
          deltaY,
          targetX: detectedTarget.center.x,
          targetY: detectedTarget.center.y,
        };
        reasoning = `Fresh screen analysis located '${detectedTarget.name}' at (${detectedTarget.center.x}, ${detectedTarget.center.y}); use that reviewed target instead of the stale coordinates.`;
      }
    } else {
      reasoning = detectedTarget
        ? `Fresh screen analysis found '${detectedTarget.name}' for Step #${stepIndex + 1}; the reviewed action can proceed.`
        : `The screen was analyzed, but no named target was confidently matched for Step #${stepIndex + 1}. Use the reviewed coordinates only.`;
    }

    res.json({
      success: true,
      guideDecision,
      reasoning,
      adjustment,
      backtrackAction,
      qwenConfidence: perception.confidence,
      perception,
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
