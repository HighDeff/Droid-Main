import { deviceLocks } from "../device-locks";
import type { RequestHandler } from "express";
import { replayStepSchema } from "../../shared/replay";
import { createReplayAdapter } from "../replay-adapter";
import { replayEngine } from "../replay-engine";
export interface InteractionRecord {
  id: string;
  timestamp: number;
  device: "desktop" | "android";
  action: string;
  coordinates?: { x: number; y: number };
  pointsCount?: number;
  textPayload?: string;
  keyPayload?: string;
  success: boolean;
  durationMs: number;
  details?: string;
}

const interactionHistory: InteractionRecord[] = [];

export const handleGetInteractions: RequestHandler = (_req, res) => {
  res.json({
    success: true,
    total: interactionHistory.length,
    interactions: interactionHistory.slice(-150).reverse(),
  });
};

export const handleClearInteractions: RequestHandler = (_req, res) => {
  interactionHistory.length = 0;
  res.json({ success: true, message: "Interaction history cleared" });
};

export async function executeDeviceTask(body: any) {
  const raw = body.task || body;
  const targetDevice = body.targetDevice || raw.targetDevice || "desktop";
  if (!["desktop", "android"].includes(targetDevice))
    throw new Error("Unsupported target device");
  const deviceId = body.deviceId || raw.deviceId;
  if (targetDevice === "android" && !deviceId)
    throw new Error("Select a connected Android device");
  const target = targetDevice === "desktop" ? "desktop" : `android:${deviceId}`;
  if (replayEngine.busy(target) || manualLocks.has(target))
    throw new Error("Device is busy");
  const step = replayStepSchema.parse({
    ...raw,
    id: raw.id || "manual",
    name: raw.name || raw.title || "Manual action",
    action: raw.action || raw.actionType,
    x: raw.targetPosition?.x ?? raw.x,
    y: raw.targetPosition?.y ?? raw.y,
    text: raw.textPayload ?? raw.text,
    keyPayload: raw.keyPayload ?? raw.key,
  });
  const adapter = createReplayAdapter({ targetDevice, deviceId });
  manualLocks.add(target);
  try {
    const frame = await adapter.capture();
    if (step.x >= frame.width || step.y >= frame.height)
      throw new Error("Coordinates outside device screen");
    await adapter.execute(step, frame);
    return {
      success: true,
      verified: false,
      explanation:
        "Device acknowledged execution; visual outcome has not been verified",
    };
  } finally {
    manualLocks.delete(target);
  }
}
const manualLocks = deviceLocks;
export const handleExecuteTask: RequestHandler = async (req, res) => {
  const started = Date.now();
  try {
    const result = await executeDeviceTask(req.body);
    interactionHistory.push({
      id: `int_${started}`,
      timestamp: started,
      device: req.body.targetDevice || "desktop",
      action: (req.body.task || req.body).action,
      success: true,
      durationMs: Date.now() - started,
      details: result.explanation,
    });
    if (interactionHistory.length > 150) interactionHistory.shift();
    res.json(result);
  } catch (error) {
    res
      .status(422)
      .json({
        success: false,
        error: error instanceof Error ? error.message : "Execution failed",
      });
  }
};
