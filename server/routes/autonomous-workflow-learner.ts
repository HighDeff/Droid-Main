import { RequestHandler } from "express";
import { GoogleGenAI } from "@google/genai";
import { DurableStore } from "../durable-store";
import {
  LEARNABLE_AUTOMATION_ACTIONS,
  REPLAY_POSITIONAL_ACTIONS,
  validateHotkey,
  validateKey,
} from "../automation-adapters";

interface WorkflowAction {
  id: string;
  action: string;
  name?: string;
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  timestamp?: number;
  dwellMs?: number;
  dragEndPosition?: { x: number; y: number };
}

interface LearnedWorkflow {
  id: string;
  name: string;
  description: string;
  confidenceScore: number;
  triggerCondition: string;
  patternType: "repetition" | "navigation_sequence" | "form_filler" | "media_control" | "custom";
  steps: WorkflowAction[];
  createdAt: number;
  executionCount: number;
}

const workflowStore = new DurableStore();
const MAX_LEARNED_WORKFLOWS = 200;
const readLearnedWorkflows = () =>
  workflowStore
    .readCollection<LearnedWorkflow>("learned-workflows")
    .slice(0, MAX_LEARNED_WORKFLOWS);
const saveLearnedWorkflows = (workflows: LearnedWorkflow[]) => {
  workflows.splice(MAX_LEARNED_WORKFLOWS);
  workflowStore.writeCollection("learned-workflows", workflows);
};
let workflowMutationQueue: Promise<void> = Promise.resolve();
const withWorkflowLock = <T>(operation: () => Promise<T> | T): Promise<T> => {
  const result = workflowMutationQueue.then(operation, operation);
  workflowMutationQueue = result.then(() => undefined, () => undefined);
  return result;
};

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

function normalizeLearnedSteps(rawSteps: unknown[]): WorkflowAction[] {
  return rawSteps.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const source = raw as Record<string, any>;
    if (source.success === false) return [];
    const action = String(source.action || source.actionType || "").toLowerCase();
    if (!LEARNABLE_AUTOMATION_ACTIONS.has(action)) return [];

    const x = Number(source.x ?? source.coordinates?.x ?? source.targetPosition?.x);
    const y = Number(source.y ?? source.coordinates?.y ?? source.targetPosition?.y);
    if (REPLAY_POSITIONAL_ACTIONS.has(action) && (!Number.isFinite(x) || !Number.isFinite(y))) {
      return [];
    }

    const endX = Number(source.toX ?? source.dragEndPosition?.x);
    const endY = Number(source.toY ?? source.dragEndPosition?.y);
    if (["drag", "drag_and_drop"].includes(action) && (!Number.isFinite(endX) || !Number.isFinite(endY))) {
      return [];
    }

    const rawText = String(source.text ?? source.textPayload ?? "");
    const rawKey = String(source.key ?? source.keyPayload ?? "");
    if (["type", "type_text", "clear_and_type", "relative_type"].includes(action) && !rawText) {
      return [];
    }
    let key = rawKey;
    try {
      if (["key", "press_key"].includes(action)) key = validateKey(rawKey);
      if (action === "hotkey") key = validateHotkey(rawKey || rawText).join("+");
    } catch {
      return [];
    }

    return [{
      id: String(source.id || `step_${index + 1}`),
      action,
      name: String(source.name || `Action #${index + 1}`),
      ...(Number.isFinite(x) && Number.isFinite(y) ? { x, y } : {}),
      text: String(source.text ?? source.textPayload ?? ""),
      key,
      dwellMs: Number.isFinite(Number(source.dwellMs)) ? Number(source.dwellMs) : 500,
      ...(["drag", "drag_and_drop"].includes(action)
        ? { dragEndPosition: { x: endX, y: endY } }
        : {}),
    }];
  });
}

/**
 * Detect similar actions from workflow history, save them, and create new automatic workflows
 */
export const handleLearnWorkflows: RequestHandler = async (req, res) => {
  try {
    const { historySteps = [], mouseTrails = [], liveContext = "" } = req.body;
    const inputHistorySteps = Array.isArray(historySteps) ? historySteps : [];
    const inputMouseTrails = Array.isArray(mouseTrails) ? mouseTrails : [];
    const existingWorkflows = readLearnedWorkflows();

    if (!inputHistorySteps.length && !inputMouseTrails.length) {
      return res.json({
        success: true,
        allLearnedWorkflows: existingWorkflows,
        message: "No new trace data provided; returned existing learned workflow library."
      });
    }

    let synthesizedWorkflow: LearnedWorkflow | null = null;

    if (ai) {
      try {
        const prompt = `You are an Autonomous AI Workflow Learning Engine.
Analyze the following recorded user actions and mouse trails:
History steps: ${JSON.stringify(inputHistorySteps.slice(0, 25))}
Live context: ${liveContext}

Task:
1. Detect patterns or repeating sub-sequences of actions (e.g. click -> type -> submit, or navigation sequences).
2. Extract common intent and cluster similar spatial coordinates.
3. Formulate a clean, reusable, parameterized automatic workflow.

Return ONLY a JSON object:
{
  "name": "Concise workflow name",
  "description": "What this workflow accomplishes based on user patterns",
  "confidenceScore": 0.92,
  "patternType": "navigation_sequence",
  "triggerCondition": "Condition under which this workflow should auto-run",
  "steps": [
    { "action": "click|type|key|move", "name": "Step description", "x": 500, "y": 300, "text": "", "key": "" }
  ]
}`;

        const model = "gemini-2.5-flash";
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { responseMimeType: "application/json" }
        });

        const raw = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const parsed = JSON.parse(raw);

        const normalizedSteps = Array.isArray(parsed.steps)
          ? normalizeLearnedSteps(parsed.steps)
          : [];
        if (parsed.name && normalizedSteps.length > 0) {
          synthesizedWorkflow = {
            id: `lw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: parsed.name,
            description: parsed.description || "Autonomously learned from recent user trace history",
            confidenceScore: parsed.confidenceScore || 0.91,
            triggerCondition: parsed.triggerCondition || "Manual or contextual auto-trigger",
            patternType: parsed.patternType || "custom",
            steps: normalizedSteps,
            createdAt: Date.now(),
            executionCount: 0
          };
        }
      } catch (geminiErr) {
        console.warn("Gemini pattern learning error, falling back to heuristic clustering:", geminiErr);
      }
    }

    // Heuristic fallback if Gemini not available or failed
    const successfulHistorySteps = normalizeLearnedSteps(inputHistorySteps);
    if (!synthesizedWorkflow && successfulHistorySteps.length >= 2) {
      synthesizedWorkflow = {
        id: `lw_heur_${Date.now()}`,
        name: `Auto-Learned Action Sequence (${successfulHistorySteps.length} steps)`,
        description: `Pattern assembled from ${successfulHistorySteps.length} successful, complete user actions`,
        confidenceScore: 0.88,
        triggerCondition: "Recorded UI interaction sequence replay",
        patternType: "custom",
        steps: successfulHistorySteps,
        createdAt: Date.now(),
        executionCount: 0
      };
    }

    const learnedWorkflowsStore = await withWorkflowLock(() => {
      const current = readLearnedWorkflows();
      if (synthesizedWorkflow) {
        current.unshift(synthesizedWorkflow);
        saveLearnedWorkflows(current);
      }
      return current;
    });

    return res.json({
      success: true,
      newlyLearnedWorkflow: synthesizedWorkflow,
      allLearnedWorkflows: learnedWorkflowsStore,
      message: synthesizedWorkflow
        ? `Successfully learned new workflow "${synthesizedWorkflow.name}" with ${synthesizedWorkflow.steps.length} steps.`
        : "Workflow pattern library updated."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
};

/**
 * Get all learned workflows
 */
export const handleGetLearnedWorkflows: RequestHandler = async (_req, res) => {
  res.json({
    success: true,
    learnedWorkflows: readLearnedWorkflows()
  });
};

/**
 * Delete a learned workflow
 */
export const handleDeleteLearnedWorkflow: RequestHandler = async (req, res) => {
  return withWorkflowLock(async () => {
    try {
      const { id } = req.params;
      const learnedWorkflowsStore = readLearnedWorkflows();
      const idx = learnedWorkflowsStore.findIndex((w) => w.id === id);
      if (idx !== -1) {
        learnedWorkflowsStore.splice(idx, 1);
        saveLearnedWorkflows(learnedWorkflowsStore);
        return res.json({ success: true, message: `Learned workflow ${id} deleted.` });
      }
      return res.status(404).json({ success: false, error: "Workflow not found." });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
