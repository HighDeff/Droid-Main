import type { RequestHandler } from "express";
import { qwenVisionEngine } from "../ai-perception-engine";
import { aiPlannerEngine } from "../ai-planner-engine";

export interface AnalyzeAndActResponse {
  success: boolean;
  visualSummary: string;
  crossReferenceAnalysis: {
    previousActionSummary: string;
    currentScreenState: string;
    identifiedChanges: string[];
    driftOrShiftDetected: boolean;
    recommendedAdjustments: string[];
  };
  generatedGoals: Array<{
    id: string;
    title: string;
    priority: "high" | "medium" | "low";
    category: "automation" | "verification" | "recalibration" | "research";
  }>;
  autoAssembledTasks: Array<{
    id: string;
    stepNumber: number;
    name: string;
    action: "click" | "type" | "live_write" | "paste" | "watcher_agent" | "media_play" | "internet_search" | "calc" | "review_update";
    targetPosition: { x: number; y: number };
    selector?: string;
    text?: string;
    confidence: number;
  }>;
  suggestedTools: {
    watcherAgentAssigned: boolean;
    mediaPlayTrigger: boolean;
    internetSearchQuery?: string;
    calcExpression?: string;
    liveWriteText?: string;
    reviewUpdateMode: boolean;
  };
  taskPreferences: {
    aggressiveRetry: boolean;
    autoCalibrationThresholdPx: number;
    interceptOnDrift: boolean;
    syncWithNativePC: boolean;
  };
  nextSchedule: {
    scheduledTime: string;
    recheckIntervalSeconds: number;
    notes: string;
  };
}

export const handleAnalyzeAndAct: RequestHandler = async (req, res) => {
  try {
    const {
      screenStreamUrl,
      liveScreenUrl,
      previousTasks = [],
      userInstructions = "",
      endpoint,
      model,
    } = req.body;
    const activeImage = liveScreenUrl || screenStreamUrl;
    if (typeof activeImage !== "string" || !activeImage.startsWith("data:image/")) {
      return res.status(400).json({ success: false, error: "A current screen image is required" });
    }

    const perception = await qwenVisionEngine.analyzeScreen(activeImage, endpoint, model);
    if (perception.degraded) {
      return res.status(503).json({
        success: false,
        error: perception.error ?? "The current screen could not be analyzed",
        visualSummary: perception.screenDescription,
        generatedGoals: [],
        autoAssembledTasks: [],
      });
    }
    const decision = await aiPlannerEngine.planAndFormulateAction(
      perception,
      String(userInstructions || "Complete the current on-screen goal"),
      endpoint,
      model,
    );
    const priorTasks = Array.isArray(previousTasks) ? previousTasks : [];
    const lastAction = priorTasks.at(-1);
    const next = decision.nextAction;
    const actionMap = { click: "click", type_text: "type" } as const;
    const mappedAction = next
      ? actionMap[next.actionType as keyof typeof actionMap]
      : undefined;
    const driftDetected = /shift|drift|moved|reflow/i.test(perception.visualStateChange);
    const payload: AnalyzeAndActResponse = {
      success: true,
      visualSummary: perception.screenDescription,
      crossReferenceAnalysis: {
        previousActionSummary: lastAction
          ? `Last action: ${lastAction.name ?? lastAction.action ?? "interaction"}`
          : "No prior action was supplied.",
        currentScreenState: `${perception.activeWindow}: ${perception.visualStateChange}`,
        identifiedChanges: perception.visualStateChange ? [perception.visualStateChange] : [],
        driftOrShiftDetected: driftDetected,
        recommendedAdjustments: driftDetected
          ? ["Re-ground the named target on this fresh frame before execution."]
          : ["Keep exact reviewed coordinates and verify a fresh post-action frame."],
      },
      generatedGoals: decision.goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        priority: goal.priority <= 2 ? "high" : goal.priority <= 4 ? "medium" : "low",
        category: goal.category === "verification" ? "verification" : driftDetected ? "recalibration" : "automation",
      })),
      autoAssembledTasks:
        next &&
        mappedAction &&
        Number.isFinite(next.x) &&
        Number.isFinite(next.y)
        ? [
            {
              id: next.id,
              stepNumber: 1,
              name: next.title,
              action: mappedAction,
              targetPosition: { x: next.x!, y: next.y! },
              selector: next.targetName,
              text: next.textPayload,
              confidence: decision.thinking.confidence,
            },
          ]
        : [],
      suggestedTools: {
        watcherAgentAssigned: false,
        mediaPlayTrigger: false,
        liveWriteText: mappedAction === "type" ? next?.textPayload : undefined,
        reviewUpdateMode: true,
      },
      taskPreferences: {
        aggressiveRetry: false,
        autoCalibrationThresholdPx: 8,
        interceptOnDrift: true,
        syncWithNativePC: true,
      },
      nextSchedule: {
        scheduledTime: new Date(Date.now() + 5_000).toISOString(),
        recheckIntervalSeconds: 5,
        notes: next && mappedAction
          ? "Capture and analyze a fresh frame before approving the proposed action."
          : next
            ? `The planner proposed unsupported action "${next.actionType}"; user review is required.`
          : "No safe next action was formulated; request user review.",
      },
    };
    res.json(payload);
  } catch (cause) {
    res.status(500).json({ success: false, error: cause instanceof Error ? cause.message : String(cause) });
  }
};
