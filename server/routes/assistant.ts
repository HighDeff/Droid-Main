import { Router, type RequestHandler } from "express";
import type {
  AssistantExecution,
  AssistantPlan,
  CaptureSource,
  FrameAnalysis,
  PlannedStep,
  WaitCondition,
} from "../../shared/assistant";
import type { RecordedAction, RecordedSession } from "../../shared/recordings";
import { assistantStateRepository as defaultRepository, AssistantStateRepository } from "../assistant-state";
import { qwenVisionEngine } from "../ai-perception-engine";
import { adaptiveRetryEngine } from "../adaptive-retry-engine";
import { dispatchActionToPython } from "./dual-ai-pipeline";
import { AUTOMATION_BOUNDS, validateDeviceId, validateKey, validateText } from "../automation-adapters";
import { validatePoint } from "../../shared/coordinates";
import { createDiskFrameStore, type StoreFrame } from "../frame-store";
import { methodLearningSystem } from "../method-learning";

type ExecuteAction = (action: Record<string, unknown>) => Promise<Record<string, any>>;

export interface AssistantRouterOptions {
  repository?: AssistantStateRepository;
  getLatestFrame?: () => { imageData: string; timestamp: number } | null;
  executeAction?: ExecuteAction;
  storeFrame?: StoreFrame;
}

const now = () => new Date().toISOString();
const id = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function requireSession(repository: AssistantStateRepository, sessionId: unknown) {
  if (typeof sessionId !== "string" || !sessionId.trim()) {
    throw Object.assign(new Error("A sessionId is required"), { status: 400 });
  }
  const session = repository.getSession(sessionId);
  if (!session) {
    throw Object.assign(new Error("Assistant session not found"), { status: 404 });
  }
  return session;
}

function parseInstruction(instruction: string): PlannedStep[] {
  const clauses = instruction
    .split(
      /\n+|;|\bthen\b|\band\s+(?=(?:click|tap|select|open|press|key|wait|scroll)\b)/gi,
    )
    .map((part) => part.replace(/^\s*(?:\d+[.)-]?|[-*])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 25);

  return clauses.map((clause, index) => {
    const lower = clause.toLowerCase();
    const coords = clause.match(/(?:at|to|on)?\s*\(?\s*(\d{1,5})\s*[,x]\s*(\d{1,5})\s*\)?/i);
    const target = coords
      ? { x: Number(coords[1]), y: Number(coords[2]) }
      : undefined;
    const quoted = clause.match(/["']([^"']+)["']/)?.[1];
    const base: PlannedStep = {
      id: id("step"),
      order: index + 1,
      title: clause,
      description: `Complete: ${clause}`,
      action: "",
      confidence: 0.35,
      timing: "when_ready",
      status: "pending",
    };

    if (/\b(double[ -]?click)\b/.test(lower)) {
      return { ...base, action: "double_click", target, confidence: target ? 0.98 : 0.45 };
    }
    if (/\b(right[ -]?click)\b/.test(lower)) {
      return { ...base, action: "right_click", target, confidence: target ? 0.98 : 0.45 };
    }
    if (/\b(click|tap|select|open)\b/.test(lower)) {
      return {
        ...base,
        action: "click",
        target,
        selector: target ? undefined : clause.replace(/^(click|tap|select|open)\s+/i, ""),
        confidence: target ? 0.98 : 0.55,
      };
    }
    if (/\b(clear\s+(?:and|&)\s+type|replace)\b/.test(lower)) {
      return { ...base, action: "clear_and_type", target, text: quoted, confidence: quoted ? 0.9 : 0.45 };
    }
    if (/\b(type|enter|write|paste)\b/.test(lower) && quoted) {
      return { ...base, action: "type", target, text: quoted, confidence: 0.9 };
    }
    const key = lower.match(/\b(?:press|key)\s+(enter|escape|tab|space|backspace|delete|up|down|left|right|home|end)\b/)?.[1];
    if (key) return { ...base, action: "key", key, confidence: 0.95 };
    const wait = lower.match(/\bwait\s+(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|seconds?)?/);
    if (wait) {
      const amount = Number(wait[1]);
      const milliseconds = wait[2]?.startsWith("m") ? amount : amount * 1000;
      return { ...base, action: "wait", description: `Wait ${Math.min(milliseconds, 120_000)}ms`, confidence: 1 };
    }
    if (/\bscroll\b/.test(lower)) {
      return {
        ...base,
        action: "scroll",
        target,
        text: /\bup\b/.test(lower) ? "up" : "down",
        confidence: target ? 0.85 : 0.45,
      };
    }
    return base;
  });
}

function actionFromStep(step: PlannedStep): Record<string, unknown> {
  const type = String(step.action).toLowerCase();
  const target = step.target;
  const coordinateActions = new Set(["click", "double_click", "right_click", "scroll"]);
  if (coordinateActions.has(type)) {
    if (!target) throw new Error(`Step ${step.order} needs reviewed coordinates before it can run`);
    validatePoint(target, AUTOMATION_BOUNDS, `step ${step.order} coordinates`);
  }
  if ((type === "type" || type === "clear_and_type") && !step.text) {
    throw new Error(`Step ${step.order} needs reviewed text before it can run`);
  }
  if (step.text) validateText(step.text);
  if (type === "key") validateKey(step.key ?? "");
  if (step.deviceId) validateDeviceId(step.deviceId);
  if (step.targetDevice === "android" && !step.deviceId) {
    throw new Error(`Step ${step.order} needs an approved Android device ID`);
  }
  const supported = new Set([
    "click",
    "double_click",
    "right_click",
    "type",
    "clear_and_type",
    "key",
    "scroll",
    "wait",
  ]);
  if (!supported.has(type)) throw new Error(`Unsupported approved action: ${type}`);
  const waitMs = Number(step.description?.match(/Wait\s+(\d+)ms/i)?.[1] ?? 500);
  return {
    id: step.id,
    title: step.title,
    action: type,
    x: target?.x,
    y: target?.y,
    textPayload: step.text,
    keyPayload: step.key,
    ...(type === "scroll" ? { direction: step.text === "up" ? "up" : "down" } : {}),
    targetDevice: step.targetDevice ?? "desktop",
    deviceId: step.deviceId,
    delayMs: Math.min(Math.max(waitMs, 0), 120_000),
    driftPx: 0,
  };
}

function frameChanged(before?: string, after?: string) {
  if (!before || !after) return null;
  const left = before.includes(",") ? before.slice(before.indexOf(",") + 1) : before;
  const right = after.includes(",") ? after.slice(after.indexOf(",") + 1) : after;
  return left !== right;
}

function alternateAction(
  action: Record<string, unknown>,
  reason: "native_failure" | "unchanged_screen",
) {
  const alternate = { ...action };
  if (action.action === "click") {
    if (reason === "native_failure") alternate.action = "double_click";
    else {
      alternate.x = Math.min(Number(action.x) + 5, AUTOMATION_BOUNDS.width - 1);
      alternate.y = Math.min(Number(action.y) + 3, AUTOMATION_BOUNDS.height - 1);
    }
  } else if (action.action === "type") {
    alternate.action = "clear_and_type";
  } else if (action.action === "double_click") {
    alternate.action = "click";
  }
  alternate.delayMs = Math.min(Number(action.delayMs ?? 500) + 300, 2_000);
  return alternate;
}

async function verifyStepOutcome(
  step: PlannedStep,
  imageData?: string,
): Promise<{
  verified: boolean;
  reason: string;
  confidence?: number;
  analysis?: FrameAnalysis;
} | null> {
  const rule = step.adaptive?.verification;
  if (!rule) return null;
  if (!imageData) {
    return { verified: false, reason: "No fresh post-action frame was available for the approved success check." };
  }
  try {
    const report = await qwenVisionEngine.analyzeScreen(imageData);
    if (report.degraded) {
      return {
        verified: false,
        reason: report.error ?? "Vision/OCR was unavailable for the approved success check.",
        confidence: report.confidence,
      };
    }
    const normalized = [
      report.screenDescription,
      ...report.elements.flatMap((element) => [element.name, element.textValue ?? ""]),
    ].join(" ").toLowerCase();
    let verified = false;
    let expected = "the approved visual result";
    if (rule.kind === "text-present") {
      expected = rule.text?.trim() || "approved text";
      verified = Boolean(rule.text?.trim() && normalized.includes(rule.text.trim().toLowerCase()));
    } else if (rule.kind === "element-present") {
      expected = rule.elementLabel?.trim() || "approved element";
      verified = Boolean(
        rule.elementLabel?.trim() &&
        report.elements.some((element) =>
          `${element.name} ${element.textValue ?? ""}`
            .toLowerCase()
            .includes(rule.elementLabel!.trim().toLowerCase()),
        ),
      );
    } else if (rule.kind === "confidence-threshold") {
      const threshold = rule.minConfidence ?? 0.8;
      expected = `vision confidence of at least ${Math.round(threshold * 100)}%`;
      verified = report.confidence >= threshold;
    } else if (rule.kind === "region-present" && rule.region) {
      expected = rule.region.label || "an element in the approved region";
      const region = rule.region;
      verified = report.elements.some((element) => {
        const box = element.boundingBox;
        return (
          box.x < region.x + region.width &&
          box.x + box.width > region.x &&
          box.y < region.y + region.height &&
          box.y + box.height > region.y
        );
      });
    }
    return {
      verified,
      reason: verified
        ? `Fresh screen analysis confirmed ${expected}.`
        : `Fresh screen analysis did not confirm ${expected}.`,
      confidence: report.confidence,
      analysis: {
        id: id("analysis"),
        status: "completed",
        provider: "local-ocr",
        confidence: report.confidence,
        ocrText: report.elements
          .filter((element) => element.textValue?.trim())
          .map((element) => ({
            id: `${element.id}_ocr`,
            text: element.textValue!.trim(),
            confidence: element.confidence,
            region: { id: `${element.id}_region`, ...element.boundingBox },
          })),
        detectedElements: report.elements.map((element) => ({
          id: element.id,
          type: element.type,
          label: element.name,
          confidence: element.confidence,
          region: { id: `${element.id}_region`, ...element.boundingBox },
        })),
        regionsOfInterest: report.elements.map((element) => ({
          id: `${element.id}_region`,
          label: element.name,
          confidence: element.confidence,
          ...element.boundingBox,
        })),
        notes: [report.primarySuggestion],
        analyzedAt: now(),
      },
    };
  } catch (error) {
    return {
      verified: false,
      reason: `The approved success check could not run: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function createAssistantRouter(options: AssistantRouterOptions = {}) {
  const repository = options.repository ?? defaultRepository;
  const getLatestFrame = options.getLatestFrame ?? (() => null);
  const executeAction = options.executeAction ?? dispatchActionToPython;
  const storeFrame = options.storeFrame ?? createDiskFrameStore();
  const captureReference = (imageData: string) => {
    try {
      return storeFrame(imageData);
    } catch (error) {
      console.error("Could not store verification frame", error instanceof Error ? error.message : String(error));
      return undefined;
    }
  };
  const router = Router();
  const stableFrames = new Map<string, { frame: string; since: number }>();
  const runningExecutions = new Set<string>();
  const sources = new Map<string, CaptureSource>([
    [
      "desktop",
      {
        id: "desktop",
        name: "Desktop screen share",
        type: "desktop",
        kind: "desktop",
        detail: "Fresh frames synchronized by the Screen HUD",
        connected: false,
        connectionState: "disconnected",
      },
    ],
    [
      "android",
      {
        id: "android",
        name: "Android device",
        type: "android",
        kind: "android",
        detail: "ADB-connected phone or emulator",
        connected: false,
        connectionState: "disconnected",
      },
    ],
  ]);

  const getExecution = (executionId: string) => {
    const match = repository.findExecution(executionId);
    if (!match) throw Object.assign(new Error("Execution not found"), { status: 404 });
    return match;
  };

  const getSessionExecution = (executionId: string, sessionId: unknown) => {
    const session = requireSession(repository, sessionId);
    const execution = repository.getResource("executions", executionId, session.id);
    if (!execution) throw Object.assign(new Error("Execution not found"), { status: 404 });
    return execution;
  };

  const evaluateCondition = async (condition: WaitCondition) => {
    const details = condition as WaitCondition & {
      text?: string;
      durationMs?: number;
      stableForMs?: number;
      controlLabel?: string;
      region?: unknown;
    };
    const elapsed = Date.now() - Date.parse(condition.createdAt ?? now());
    let satisfied = false;
    let detail = "Condition not yet observed";
    if (condition.type === "timer") {
      satisfied = elapsed >= Math.max(0, Number(details.durationMs ?? 0));
      detail = satisfied ? "Timer elapsed" : `Timer has ${Math.max(0, Number(details.durationMs ?? 0) - elapsed)}ms remaining`;
    } else {
      const frame = getLatestFrame();
      if (!frame) return { satisfied: false, detail: "No fresh screen frame is available" };
      if (condition.type === "page_load_stable") {
        const previous = stableFrames.get(condition.id);
        if (!previous || previous.frame !== frame.imageData) {
          stableFrames.set(condition.id, { frame: frame.imageData, since: Date.now() });
          detail = "Stability timer restarted after a screen change";
        } else {
          satisfied = Date.now() - previous.since >= Number(details.stableForMs ?? 1_000);
          detail = satisfied ? "Screen remained stable for the required interval" : "Screen is still stabilizing";
        }
      } else if (condition.type === "region") {
        satisfied = Boolean(details.region);
        detail = satisfied ? "A fresh frame and reviewed region are available" : "The condition has no reviewed region";
      } else {
        const report = await qwenVisionEngine.analyzeScreen(frame.imageData);
        if (report.degraded) return { satisfied: false, detail: report.error ?? "Vision provider unavailable" };
        const needle = String(details.text ?? details.controlLabel ?? condition.value ?? "").toLowerCase();
        const candidates = [report.screenDescription, ...report.elements.flatMap((element) => [element.name, element.textValue ?? ""])]
          .join(" ")
          .toLowerCase();
        const typeNeedle = condition.type === "close_control" ? "close" : condition.type === "next_control" ? "next" : needle;
        satisfied = Boolean(typeNeedle && candidates.includes(typeNeedle));
        detail = satisfied ? `Observed ${typeNeedle} on the fresh screen` : `Did not observe ${typeNeedle || "the requested signal"}`;
      }
    }
    return { satisfied, detail };
  };

  const updateExecution = (execution: AssistantExecution, patch: Partial<AssistantExecution>) =>
    repository.updateResource("executions", execution.id, execution.sessionId, patch)!;

  const addTimeline = (execution: AssistantExecution, message: string, extra: Record<string, unknown> = {}) => {
    const current = getExecution(execution.id);
    return updateExecution(current, {
      timeline: [...(current.timeline ?? []), { id: id("event"), timestamp: now(), message, ...extra }],
    });
  };

  const learnFromSuccess = (plan: AssistantPlan) => {
    const existing = repository
      .listWorkflows(plan.sessionId)
      .find((workflow) => workflow.name.toLowerCase() === plan.title.toLowerCase());
    if (existing) {
      const executions = (existing.executionCount ?? 0) + 1;
      repository.updateWorkflow(existing.id, plan.sessionId, {
        steps: plan.steps,
        executionCount: executions,
        successRate: 1,
        status: "ready",
      });
      return;
    }
    repository.createWorkflow(plan.sessionId, {
      name: plan.title,
      description: `Learned from a confirmed successful run: ${plan.goal}`,
      status: "ready",
      repeatCount: 0,
      schedule: { enabled: false },
      checkpointIds: [],
      operationPackIds: [],
      pauseResumePolicy: { pauseOnError: true, allowResume: true, resumeMode: "manual" },
      goals: [{ goalId: plan.id, title: plan.goal, completed: plan.steps.length, total: plan.steps.length }],
      steps: plan.steps,
      executionCount: 1,
      successRate: 1,
    });
  };

  const continueExecution = async (executionId: string) => {
    let execution = getExecution(executionId);
    if (execution.status !== "running" || execution.pendingApproval) return;
    const plan = repository.getPlan(execution.planId, execution.sessionId);
    if (!plan) {
      updateExecution(execution, { status: "failed", error: "Approved plan no longer exists" });
      return;
    }

    while (execution.currentStepIndex < plan.steps.length) {
      execution = getExecution(executionId);
      if (execution.status !== "running" || execution.pendingApproval) return;
      const step = plan.steps[execution.currentStepIndex];
      const priorAttempts = (execution.evidence ?? []).filter(
        (entry) => entry.stepId === step.id,
      ).length;
      const attempt = priorAttempts + 1;
      const maxAttempts = Math.max(
        1,
        Math.min(step.adaptive?.retry?.maxAttempts ?? 1, 3),
      );
      if ((step.waitConditions ?? []).some((condition) => !condition.approved)) {
        updateExecution(execution, {
          status: "paused",
          pendingApproval: { reason: `Step ${step.order} has an unapproved wait condition` },
        });
        return;
      }
      for (const listedCondition of step.waitConditions ?? []) {
        const condition = repository.getWaitCondition(listedCondition.id, execution.sessionId) ?? listedCondition;
        const evaluation = await evaluateCondition(condition);
        repository.updateResource("waitConditions", condition.id, execution.sessionId, {
          status: evaluation.satisfied ? "satisfied" : "pending",
          ...(evaluation.satisfied ? { satisfiedAt: now() } : {}),
        });
        repository.addConditionEvent(execution.sessionId, {
          conditionId: condition.id,
          status: evaluation.satisfied ? "satisfied" : "pending",
          detail: evaluation.detail,
        });
        if (!evaluation.satisfied) {
          updateExecution(execution, {
            status: "paused",
            pendingApproval: { reason: `${condition.label}: ${evaluation.detail}` },
          });
          return;
        }
      }

      let action: Record<string, unknown>;
      try {
        action = actionFromStep(step);
      } catch (cause) {
        updateExecution(execution, {
          status: "paused",
          error: cause instanceof Error ? cause.message : String(cause),
          pendingApproval: { reason: cause instanceof Error ? cause.message : String(cause) },
        });
        return;
      }

      const before = getLatestFrame();
      if (
        action.action !== "wait" &&
        (!before || Date.now() - before.timestamp > 5_000)
      ) {
        updateExecution(execution, {
          status: "paused",
          pendingApproval: {
            reason:
              "A fresh screen frame is required before physical input. Start Screen HUD sharing, then continue.",
          },
        });
        return;
      }
      if (before?.imageData && step.selector && step.target) {
        const perception = await qwenVisionEngine.analyzeScreen(before.imageData);
        if (!perception.degraded) {
          const recalibration = adaptiveRetryEngine.recalibrateElementCoordinates(
            step.selector,
            step.target.x,
            step.target.y,
            perception.elements,
          );
          if (recalibration.recalibrated) {
            action.x = recalibration.newCoordinates.x;
            action.y = recalibration.newCoordinates.y;
            addTimeline(execution, `Re-aligned ${step.title} by ${recalibration.shiftDistance}px from the fresh screen`);
          }
        }
      }

      addTimeline(execution, `Running step ${step.order}: ${step.title}`);
      const result = await executeAction(action);
      execution = getExecution(executionId);
      if (execution.status !== "running") return;
      if (!result.success) {
        const failureEvidence = {
          id: id("evidence"),
          stepId: step.id,
          attempt,
          capturedAt: before ? new Date(before.timestamp).toISOString() : now(),
          capture: before ? captureReference(before.imageData) : undefined,
          verification: {
            status: "native_failed",
            reason: String(result.error ?? result.message ?? "Native action failed"),
          },
        };
        execution = updateExecution(execution, {
          evidence: [...(execution.evidence ?? []), failureEvidence].slice(-10),
        });
        if (attempt < maxAttempts) {
          addTimeline(
            execution,
            `Retrying step ${step.order} after native action failure (attempt ${attempt + 1}/${maxAttempts})`,
            { status: "retry", stepId: step.id },
          );
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.min(step.adaptive?.retry?.backoffMs ?? 500, 5_000),
            ),
          );
          continue;
        }
        updateExecution(execution, {
          status: "paused",
          error: result.error ?? result.message ?? "Action failed",
          pendingApproval: {
            reason: `Step ${step.order} failed. Review an alternate method before continuing.`,
            alternateStepId: step.id,
            alternateAction: alternateAction(action, "native_failure"),
          },
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, Math.min(Number(action.delayMs) || 500, 2_000)));
      const after = getLatestFrame();
      const changed = frameChanged(before?.imageData, after?.imageData);
      const outcome = await verifyStepOutcome(step, after?.imageData);
      const evidence = {
        id: id("evidence"),
        stepId: step.id,
        attempt,
        capturedAt: after ? new Date(after.timestamp).toISOString() : now(),
        capture: after ? captureReference(after.imageData) : undefined,
        ...(outcome?.analysis ? { analysis: outcome.analysis } : {}),
        verification: outcome
          ? {
              status: outcome.verified ? "verified" : "missed",
              reason: outcome.reason,
              confidence: outcome.confidence,
            }
          : {
              status: changed === true ? "changed" : changed === false ? "unchanged" : "unavailable",
              reason:
                changed === true
                  ? "A fresh post-action frame changed; the next step will re-analyze the current screen."
                  : changed === false
                    ? "The fresh frame did not change after the action."
                    : "No fresh screen frame was available for visual verification.",
            },
      };
      execution = updateExecution(execution, {
        evidence: [...(execution.evidence ?? []), evidence].slice(-10),
      });

      if ((outcome ? !outcome.verified : changed === false) && step.action !== "wait") {
        if (attempt < maxAttempts) {
          addTimeline(
            execution,
            `Retrying step ${step.order} after screen verification missed (attempt ${attempt + 1}/${maxAttempts})`,
            { status: "retry", stepId: step.id, evidenceId: evidence.id },
          );
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.min(step.adaptive?.retry?.backoffMs ?? 500, 5_000),
            ),
          );
          continue;
        }
        const alternate = alternateAction(action, "unchanged_screen");
        updateExecution(execution, {
          status: "paused",
          pendingApproval: {
            reason: outcome
              ? `Step ${step.order} did not satisfy its approved screen/OCR success check. Approve the adapted method or edit the plan.`
              : `Step ${step.order} produced no visible change. Approve the adapted method or edit the plan.`,
            alternateStepId: step.id,
            alternateAction: alternate,
          },
        });
        return;
      }

      const nextIndex = execution.currentStepIndex + 1;
      execution = updateExecution(execution, {
        currentStepIndex: nextIndex,
        currentStep: nextIndex,
      });
      addTimeline(execution, `Completed step ${step.order}: ${step.title}`, { result });
    }

    execution = getExecution(executionId);
    const suggestions = [
      "Review the evidence frames and confirm the goal is visibly complete.",
      "Save or schedule this learned workflow if you expect to repeat it.",
      "Add a screen wait condition for any asynchronous page or app transition.",
    ];
    execution = updateExecution(execution, {
      status: "completed",
      completedAt: now(),
      nextSuggestions: suggestions,
    });
    const learnedMethod = methodLearningSystem.learnFromExecution(execution, plan, {
      sessionId: plan.sessionId,
      applicationName: "screen automation",
      screenLayout: "fresh post-action frame",
      userIntent: plan.goal ?? plan.title ?? "Complete approved workflow",
      environmentalFactors: [],
      timeOfDay: now(),
      deviceType: plan.steps.some((step) => step.targetDevice === "android")
        ? "android"
        : "desktop",
    });
    repository.updatePlan(plan.id, plan.sessionId, {
      status: "completed",
      steps: plan.steps.map((step) => ({ ...step, status: "completed" })),
      metadata: {
        ...(plan.metadata ?? {}),
        totalSuccessfulRuns: Number(plan.metadata?.totalSuccessfulRuns ?? 0) + 1,
        learnedMethod: {
          successRate: learnedMethod.successRate,
          adaptationNotes: learnedMethod.adaptationNotes.join(" ") || "Successful reviewed route retained.",
          lastSuccessfulAt: now(),
        },
      },
    });
    repository.createResource("progress", plan.sessionId, {
      stepId: plan.id,
      message: `Completed goal: ${plan.goal}`,
      percentage: 100,
      timestamp: now(),
    });
    learnFromSuccess(plan);
  };

  const startContinuation = (executionId: string) => {
    if (runningExecutions.has(executionId)) return;
    runningExecutions.add(executionId);
    void continueExecution(executionId)
      .catch((cause) => {
        try {
          const execution = getExecution(executionId);
          updateExecution(execution, {
            status: "failed",
            error: cause instanceof Error ? cause.message : String(cause),
            completedAt: now(),
          });
        } catch (recoveryError) {
          console.error("Unable to persist failed execution state", recoveryError);
        }
      })
      .finally(() => runningExecutions.delete(executionId));
  };

  router.get("/sessions", (_req, res) => res.json({ success: true, sessions: repository.listSessions() }));
  router.get("/sessions/:id", (req, res) => {
    const session = repository.getSession(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: "Assistant session not found" });
    res.json({ success: true, session });
  });
  router.post("/sessions", (req, res) => {
    const project = req.body.project ?? { id: id("project"), name: "Automation project" };
    const session = repository.createSession({
      ...req.body,
      project: typeof project === "string" ? { id: id("project"), name: project } : project,
      status: req.body.status ?? "active",
      goals: Array.isArray(req.body.goals) ? req.body.goals : [],
      savedStateIds: Array.isArray(req.body.savedStateIds) ? req.body.savedStateIds : [],
    });
    res.status(201).json({ success: true, session });
  });

  router.post("/plans", (req, res) => {
    const session = requireSession(repository, req.body.sessionId);
    const instructionText = String(req.body.instructionText ?? "").trim();
    if (!instructionText) return res.status(400).json({ success: false, error: "Instruction text is required" });
    const instruction = repository.createResource("instructions", session.id, { text: instructionText, createdAt: now() });
    const steps = parseInstruction(instructionText);
    if (steps.length === 0) {
      return res.status(400).json({ success: false, error: "No actionable steps were parsed from the instruction" });
    }
    const plan = repository.createPlan(session.id, {
      title: instructionText.length > 72 ? `${instructionText.slice(0, 69)}…` : instructionText,
      goal: instructionText,
      instruction,
      timing: "when_ready",
      confidence: Math.min(...steps.map((step) => step.confidence ?? 0.5)),
      risks: [{ description: "Coordinates, text, target device, and wait gates must be reviewed before approval." }],
      prerequisites: ["Connect a fresh screen source before execution"],
      approvalState: "pending",
      status: "draft",
      sourceCaptureIds: [],
      steps,
    });
    res.status(201).json({ success: true, plan });
  });

  router.get("/plans/:id", (req, res) => {
    const session = requireSession(repository, req.query.sessionId);
    const plan = repository.getPlan(req.params.id, session.id);
    if (!plan) return res.status(404).json({ success: false, error: "Plan not found" });
    res.json({ success: true, plan });
  });

  router.put("/plans/:id", (req, res) => {
    const session = requireSession(repository, req.query.sessionId);
    const allowed = Object.fromEntries(
      (["steps", "timing", "confidence"] as const)
        .filter((field) => req.body[field] !== undefined)
        .map((field) => [field, req.body[field]]),
    );
    if (allowed.steps !== undefined && !Array.isArray(allowed.steps)) {
      return res.status(400).json({ success: false, error: "steps must be an array" });
    }
    const existing = repository.getPlan(req.params.id, session.id);
    if (!existing) return res.status(404).json({ success: false, error: "Plan not found" });
    const stepsChanged =
      allowed.steps !== undefined &&
      JSON.stringify(allowed.steps) !== JSON.stringify(existing.steps);
    const plan = repository.updatePlan(req.params.id, session.id, {
      ...allowed,
      ...(stepsChanged ? { approvalState: "pending", status: "draft" } : {}),
    });
    res.json({ success: true, plan });
  });

  router.post("/plans/:id/:decision", (req, res) => {
    if (!new Set(["approve", "reject"]).has(req.params.decision)) {
      return res.status(404).json({ success: false, error: "Unknown plan decision" });
    }
    const session = requireSession(repository, req.query.sessionId);
    const plan = repository.getPlan(req.params.id, session.id);
    if (!plan) return res.status(404).json({ success: false, error: "Plan not found" });
    if (req.params.decision === "approve") {
      try {
        plan.steps.forEach(actionFromStep);
      } catch (cause) {
        return res.status(400).json({ success: false, error: cause instanceof Error ? cause.message : String(cause) });
      }
    }
    const updated = repository.updatePlan(plan.id, session.id, {
      approvalState: req.params.decision === "approve" ? "approved" : "rejected",
      status: req.params.decision === "approve" ? "approved" : "failed",
    });
    res.json({ success: true, plan: updated });
  });

  router.post("/execution", (req, res) => {
    const session = requireSession(repository, req.body.sessionId);
    const plan = repository.getPlan(String(req.body.planId ?? ""), session.id);
    if (!plan) return res.status(404).json({ success: false, error: "Plan not found" });
    if (plan.approvalState !== "approved") return res.status(409).json({ success: false, error: "The exact plan must be approved first" });
    if (req.body.confirmation !== true) return res.status(400).json({ success: false, error: "Explicit run confirmation is required" });
    const existingId = typeof req.body.executionId === "string" ? req.body.executionId : undefined;
    let execution = existingId ? repository.getResource("executions", existingId, session.id) : undefined;
    if (existingId && !execution) {
      return res.status(404).json({ success: false, error: "Execution not found" });
    }
    if (execution && execution.planId !== plan.id) {
      return res.status(409).json({ success: false, error: "Execution does not belong to this plan" });
    }
    if (execution && execution.status !== "paused") {
      return res.status(409).json({
        success: false,
        error: `Execution is ${execution.status} and cannot be resumed`,
      });
    }
    if (execution) {
      execution = repository.updateResource("executions", execution.id, session.id, { status: "running", pendingApproval: undefined, error: undefined });
    } else {
      execution = repository.createResource("executions", session.id, {
        planId: plan.id,
        status: "running",
        currentStepIndex: 0,
        currentStep: 0,
        totalSteps: plan.steps.length,
        timeline: [{ id: id("event"), timestamp: now(), message: "Execution confirmed and started" }],
        evidence: [],
        startedAt: now(),
      });
    }
    repository.updatePlan(plan.id, session.id, { status: "executing" });
    startContinuation(execution.id);
    res.status(202).json({ success: true, execution });
  });

  router.get("/execution/:id", (req, res) => res.json({
    success: true,
    execution: getSessionExecution(req.params.id, req.query.sessionId),
  }));
  router.post("/execution/:id/pause", (req, res) => {
    const execution = getSessionExecution(req.params.id, req.body.sessionId ?? req.query.sessionId);
    res.json({ success: true, execution: updateExecution(execution, { status: "paused" }) });
  });
  router.post("/execution/:id/cancel", (req, res) => {
    const execution = getSessionExecution(req.params.id, req.body.sessionId ?? req.query.sessionId);
    res.json({ success: true, execution: updateExecution(execution, { status: "cancelled", completedAt: now() }) });
  });
  router.post("/execution/:id/approve", (req, res) => {
    const execution = getSessionExecution(req.params.id, req.body.sessionId ?? req.query.sessionId);
    if (req.body.confirmation !== true) return res.status(400).json({ success: false, error: "Explicit confirmation is required" });
    if (execution.status !== "paused" || !execution.pendingApproval) {
      return res.status(409).json({
        success: false,
        error: `Execution is ${execution.status} and has no pending approval`,
      });
    }
    const updated = updateExecution(execution, { status: "running", pendingApproval: undefined, error: undefined });
    startContinuation(updated.id);
    res.json({ success: true, execution: updated });
  });
  router.post("/execution/:id/approve-alternate", asyncRoute(async (req, res) => {
    let execution = getSessionExecution(
      String(req.params.id),
      req.body.sessionId ?? req.query.sessionId,
    );
    if (req.body.confirmation !== true) return res.status(400).json({ success: false, error: "Explicit alternate-action confirmation is required" });
    const alternate = execution.pendingApproval?.alternateAction;
    if (!alternate) return res.status(409).json({ success: false, error: "No alternate action is awaiting approval" });
    const before = getLatestFrame();
    if (
      alternate.action !== "wait" &&
      (!before || Date.now() - before.timestamp > 5_000)
    ) {
      return res.status(409).json({
        success: false,
        error:
          "A fresh screen frame is required before physical input. Start Screen HUD sharing, then approve the alternate again.",
      });
    }
    const result = await executeAction(alternate);
    if (!result.success) {
      execution = updateExecution(execution, { status: "failed", error: result.error ?? "Alternate action failed", pendingApproval: undefined });
      return res.json({ success: true, execution });
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(Number(alternate.delayMs) || 500, 2_000)));
    const after = getLatestFrame();
    const changed = frameChanged(before?.imageData, after?.imageData);
    const plan = repository.getPlan(execution.planId, execution.sessionId);
    const approvedStep = plan?.steps.find(
      (step) => step.id === execution.pendingApproval?.alternateStepId,
    );
    const outcome = approvedStep
      ? await verifyStepOutcome(approvedStep, after?.imageData)
      : null;
    const evidence = {
      id: id("evidence"),
      stepId: execution.pendingApproval?.alternateStepId,
      attempt:
        (execution.evidence ?? []).filter(
          (entry) => entry.stepId === execution.pendingApproval?.alternateStepId,
        ).length + 1,
      capturedAt: after ? new Date(after.timestamp).toISOString() : now(),
      capture: after ? captureReference(after.imageData) : undefined,
      ...(outcome?.analysis ? { analysis: outcome.analysis } : {}),
      verification: outcome
        ? {
            status: outcome.verified ? "verified" : "missed",
            reason: outcome.reason,
            confidence: outcome.confidence,
          }
        : {
            status: changed === true ? "changed" : changed === false ? "unchanged" : "unavailable",
            reason: changed === true ? "The approved alternate produced a fresh screen change." : "The approved alternate could not be visually confirmed.",
          },
    };
    if ((outcome ? !outcome.verified : changed !== true) && alternate.action !== "wait") {
      execution = updateExecution(execution, {
        status: "failed",
        error: "The alternate action did not produce a verifiable screen change. Edit the plan before retrying.",
        pendingApproval: undefined,
        evidence: [...(execution.evidence ?? []), evidence].slice(-10),
        completedAt: now(),
      });
      return res.json({ success: true, execution });
    }
    execution = updateExecution(execution, {
      status: "running",
      pendingApproval: undefined,
      error: undefined,
      currentStepIndex: execution.currentStepIndex + 1,
      currentStep: execution.currentStepIndex + 1,
      evidence: [...(execution.evidence ?? []), evidence].slice(-10),
    });
    addTimeline(execution, "Approved alternate action succeeded; continuing from the fresh screen");
    startContinuation(execution.id);
    res.json({ success: true, execution });
  }));

  router.get("/workflows", (req, res) => {
    const session = requireSession(repository, req.query.sessionId);
    res.json({ success: true, workflows: repository.listWorkflows(session.id) });
  });

  router.get("/conditions", (req, res) => {
    const session = requireSession(repository, req.query.sessionId);
    res.json({
      success: true,
      conditions: repository.listWaitConditions(session.id),
      events: repository.listConditionEvents(session.id),
    });
  });
  router.post("/conditions", (req, res) => {
    const session = requireSession(repository, req.body.sessionId);
    const raw = req.body.condition as WaitCondition;
    if (!raw?.type || !raw.label) return res.status(400).json({ success: false, error: "Condition type and label are required" });
    const condition = repository.createWaitCondition(session.id, { ...raw, sessionId: session.id, status: "pending", createdAt: now() });
    repository.addConditionEvent(session.id, { conditionId: condition.id, status: "pending", detail: condition.label });
    res.status(201).json({ success: true, condition });
  });
  router.post("/conditions/:id/evaluate", asyncRoute(async (req, res) => {
    const session = requireSession(repository, req.body.sessionId ?? req.query.sessionId);
    const condition = repository.getWaitCondition(String(req.params.id), session.id);
    if (!condition) return res.status(404).json({ success: false, error: "Wait condition not found" });
    const evaluation = await evaluateCondition(condition);
    const status = evaluation.satisfied ? "satisfied" : "pending";
    const updated = repository.updateResource("waitConditions", condition.id, session.id, {
      status,
      ...(evaluation.satisfied ? { satisfiedAt: now() } : {}),
    });
    const event = repository.addConditionEvent(session.id, {
      conditionId: condition.id,
      status,
      detail: evaluation.detail,
    });
    res.json({ success: true, condition: updated, event });
  }));

  router.get("/sources", (_req, res) => {
    const frame = getLatestFrame();
    const desktop = sources.get("desktop")!;
    if (frame) sources.set("desktop", { ...desktop, connected: true, connectionState: "connected", lastFrameAt: new Date(frame.timestamp).toISOString() });
    res.json({ success: true, sources: [...sources.values()] });
  });
  router.post("/sources/:id/:action", (req, res) => {
    if (!new Set(["connect", "disconnect", "capture"]).has(req.params.action)) {
      return res.status(404).json({ success: false, error: "Unknown source action" });
    }
    const source = sources.get(req.params.id);
    if (!source) return res.status(404).json({ success: false, error: "Capture source not found" });
    if (req.params.action === "disconnect") {
      const updated = { ...source, connected: false, connectionState: "disconnected" as const };
      sources.set(source.id, updated);
      return res.json({ success: true, source: updated });
    }
    const frame = getLatestFrame();
    if (source.id === "android") {
      return res.status(400).json({ success: false, error: "Select and connect a specific ADB device from the Dashboard first" });
    }
    if (!frame) return res.status(503).json({ success: false, error: "No fresh HUD frame is available; start screen sharing first" });
    const updated = { ...source, connected: true, connectionState: "connected" as const, lastFrameAt: frame ? new Date(frame.timestamp).toISOString() : source.lastFrameAt };
    sources.set(source.id, updated);
    res.json({ success: true, source: updated, ...(frame ? { capture: frame } : {}) });
  });

  router.post("/analysis", asyncRoute(async (req, res) => {
    const sessionId = typeof req.body.sessionId === "string" && req.body.sessionId
      ? requireSession(repository, req.body.sessionId).id
      : "analysis";
    const imageData = String(req.body.imageData ?? getLatestFrame()?.imageData ?? "");
    if (!imageData.startsWith("data:image/")) return res.status(400).json({ success: false, error: "Valid captured image data is required" });
    const report = await qwenVisionEngine.analyzeScreen(imageData);
    const analysis = repository.createResource("analyses", sessionId, {
      captureId: req.body.captureId,
      analyzedAt: now(),
      timestamp: now(),
      provider: report.degraded ? "deterministic-fallback" : "qwen-vision",
      status: report.degraded ? "fallback" : "complete",
      summary: report.screenDescription,
      confidence: report.degraded ? 0 : report.confidence,
      ocrText: report.elements
        .filter((element) => element.textValue?.trim())
        .map((element) => ({
          id: `${element.id}_ocr`,
          text: element.textValue!.trim(),
          confidence: element.confidence,
          region: { id: `${element.id}_region`, ...element.boundingBox },
        })),
      notes: report.degraded ? [report.error ?? "Vision provider unavailable; no screen contents were inferred."] : [report.primarySuggestion],
      regionsOfInterest: report.elements.map((element) => element.boundingBox),
      detectedElements: report.elements,
      uiElements: report.elements,
    }) as FrameAnalysis;
    res.status(201).json({ success: true, analysis });
  }));
  router.get("/analysis/history", (req, res) => {
    const sessionId = typeof req.query.sessionId === "string" && req.query.sessionId
      ? requireSession(repository, req.query.sessionId).id
      : "analysis";
    let analyses = repository.listResource("analyses", sessionId);
    if (req.query.captureId) analyses = analyses.filter((entry) => entry.captureId === req.query.captureId);
    res.json({
      success: true,
      analyses: analyses.sort((a, b) =>
        String(b.analyzedAt ?? b.timestamp ?? "").localeCompare(
          String(a.analyzedAt ?? a.timestamp ?? ""),
        ),
      ),
    });
  });

  const findRecording = (recordingId: string) => {
    const recording = repository
      .listSessions()
      .flatMap((session) => repository.listResource("recordings", session.id))
      .concat(repository.listResource("recordings", "browser"))
      .find((item) => item.id === recordingId);
    if (!recording) throw Object.assign(new Error("Recording not found"), { status: 404 });
    return recording;
  };
  router.post("/recordings/start", (req, res) => {
    const sessionId = req.body.sessionId === undefined
      ? "browser"
      : requireSession(repository, req.body.sessionId).id;
    const recording = repository.createResource("recordings", sessionId, {
      name: String(req.body.name ?? "Recorded workflow"),
      status: "recording",
      events: [],
      source: req.body.source,
      createdAt: now(),
    }) as RecordedSession;
    res.status(201).json({ success: true, recording });
  });
  router.post("/recordings/:id/stop", (req, res) => {
    const recording = findRecording(req.params.id);
    const updated = repository.updateResource("recordings", recording.id, recording.sessionId, { status: "stopped", stoppedAt: now() });
    res.json({ success: true, recording: updated });
  });
  router.post("/recordings/:id/events", (req, res) => {
    const recording = findRecording(req.params.id);
    if (recording.status !== "recording") return res.status(409).json({ success: false, error: "Recording is stopped" });
    const events = (Array.isArray(req.body.events) ? req.body.events : []) as RecordedAction[];
    if (events.some((event) => ("sensitive" in event && event.sensitive) || event.source?.sensitiveInputCaptured)) return res.status(400).json({ success: false, error: "Sensitive input cannot be recorded" });
    const updated = repository.updateResource("recordings", recording.id, recording.sessionId, { events: [...recording.events, ...events].slice(-10_000) });
    res.json({ success: true, recording: updated });
  });
  router.post("/recordings/:id/operation-pack", (req, res) => {
    const recording = findRecording(req.params.id);
    const operations = recording.events.filter((event) => ["mouse-click", "keyboard-key", "wait"].includes(event.type));
    const operationPack = repository.createResource("operationPacks", recording.sessionId, { title: `${recording.name} operations`, operations, createdAt: now() });
    res.json({ success: true, operationPack });
  });
  router.post("/recordings/:id/plan-draft", (req, res) => {
    const recording = findRecording(req.params.id);
    const steps = recording.events
      .filter((event) => ["mouse-click", "keyboard-key", "wait"].includes(event.type))
      .map((event, index): PlannedStep => ({
        id: id("step"),
        order: index + 1,
        title: `Replay ${event.type}`,
        action: event.type === "mouse-click" ? "click" : event.type === "keyboard-key" ? "key" : "wait",
        target: event.type === "mouse-click" ? { x: event.x, y: event.y } : undefined,
        key: event.type === "keyboard-key" ? event.key : undefined,
        status: "pending",
        timing: "when_ready",
        confidence: 1,
      }));
    res.json({ success: true, planDraft: { title: recording.name, steps, approvalState: "pending" } });
  });

  router.use((error: any, _req: any, res: any, _next: any) => {
    res.status(Number(error?.status) || 500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  });
  return router;
}
