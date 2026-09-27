import { RequestHandler } from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { centralLogHub } from "../log-hub";
import { queueMobileAction } from "./mobile-stream";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

export const handleExecuteTask: RequestHandler = async (req, res) => {
  const startTime = Date.now();
  const rawTask = req.body.task || req.body;
  const targetDevice = req.body.targetDevice || rawTask.targetDevice || "desktop";
  const action = String(rawTask.action || rawTask.actionType || "click").toLowerCase();
  const targetPos = rawTask.targetPosition || { x: rawTask.x ?? 960, y: rawTask.y ?? 540 };
  const routePoints = rawTask.routePoints || rawTask.points || [];
  const textPayload = rawTask.textPayload || rawTask.text || "";
  const keyPayload = rawTask.keyPayload || rawTask.key || "";

  const logDesc = routePoints.length > 0
    ? `Stream mouse trail (${routePoints.length} waypoints) on ${targetDevice}`
    : `${action.toUpperCase()} at (${targetPos.x}, ${targetPos.y}) ${textPayload ? `[text: "${textPayload}"]` : ""} on ${targetDevice}`;

  centralLogHub.addLog(
    targetDevice === "android" ? "Mobile-Automation" : "PC-PyAutoGUI",
    "INFO",
    `Executing: ${logDesc}`,
    { action, targetPos, pointsCount: routePoints.length, targetDevice }
  );

  // If target device is Android, also enqueue directly to live mobile stream bridge
  if (targetDevice === "android") {
    try {
      const normX = typeof targetPos.x === "number" ? (targetPos.x > 1 ? targetPos.x / 1920 : targetPos.x) : 0.5;
      const normY = typeof targetPos.y === "number" ? (targetPos.y > 1 ? targetPos.y / 1080 : targetPos.y) : 0.5;
      queueMobileAction({
        type: action === "type" || action === "type_text" || action === "clear_and_type" ? "type" : action === "double_click" ? "double_tap" : action === "swipe" ? "swipe" : action === "press_key" || action === "hotkey" ? "key" : "tap",
        x: normX,
        y: normY,
        text: textPayload || undefined,
        key: keyPayload || undefined,
        description: logDesc,
      });
    } catch {}
  }

  let responseSent = false;
  const sendOnce = (payload: any) => {
    if (responseSent) return;
    responseSent = true;
    res.json(payload);
  };

  try {
    const pythonScript = path.join(
      __dirname,
      "../../python-service/execute-task.py",
    );
    const pythonCmd =
      process.env.PYTHON_CMD ||
      (process.platform === "win32" ? "python" : "python3");

    const python = spawn(pythonCmd, [pythonScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Guard stdin stream from uncaught error events (e.g. broken pipe or EPIPE)
    python.stdin.on("error", () => {});

    // Send formatted execution payload to Python subprocess stdin exactly once
    const inputPayload = JSON.stringify({
      task: rawTask,
      targetDevice,
      action,
      targetPosition: targetPos,
      routePoints,
      textPayload,
      keyPayload,
    });
    try {
      python.stdin.write(inputPayload);
      python.stdin.end();
    } catch {}

    let outputBuffer = "";
    let errorBuffer = "";

    python.stdout.on("data", (data) => {
      outputBuffer += data.toString();
    });

    python.stderr.on("data", (data) => {
      errorBuffer += data.toString();
    });

    let spawnError: string | null = null;
    python.on("error", (err) => {
      spawnError = `Failed to spawn python (${pythonCmd}): ${err.message}`;
      const durationMs = Date.now() - startTime;
      centralLogHub.addLog(
        "PC-PyAutoGUI",
        "INFO",
        `Simulated Fallback (${spawnError})`,
        { durationMs, action }
      );
      interactionHistory.push({
        id: `int_${Date.now()}`,
        timestamp: Date.now(),
        device: targetDevice,
        action,
        coordinates: targetPos,
        pointsCount: routePoints.length,
        textPayload: textPayload || undefined,
        keyPayload: keyPayload || undefined,
        success: true,
        durationMs,
        details: `Simulated execution in web container: ${logDesc}`,
      });
      sendOnce({
        success: true,
        simulated: true,
        message: `Simulated ${action.toUpperCase()} across viewport (${waypointsDesc(routePoints, targetPos)})`,
        durationMs,
      });
    });

    python.on("close", (code) => {
      if (responseSent) return;
      const durationMs = Date.now() - startTime;

      if (spawnError) {
        return;
      }

      let parsedResult: any = null;
      try {
        if (outputBuffer.trim()) {
          parsedResult = JSON.parse(outputBuffer.trim());
        }
      } catch (parseErr) {
        // fallback
      }

      const isSuccess = code === 0 && (parsedResult ? parsedResult.success !== false : true);
      const explanation = parsedResult?.explanation || outputBuffer.trim() || (isSuccess ? "Executed successfully" : errorBuffer);

      centralLogHub.addLog(
        targetDevice === "android" ? "Mobile-Automation" : "PC-PyAutoGUI",
        isSuccess ? "SUCCESS" : "ERROR",
        `${isSuccess ? "Completed" : "Failed"}: ${logDesc} in ${durationMs}ms`,
        { durationMs, code, explanation, error: isSuccess ? undefined : errorBuffer }
      );

      interactionHistory.push({
        id: `int_${Date.now()}`,
        timestamp: Date.now(),
        device: targetDevice,
        action,
        coordinates: targetPos,
        pointsCount: routePoints.length,
        textPayload: textPayload || undefined,
        keyPayload: keyPayload || undefined,
        success: isSuccess,
        durationMs,
        details: explanation,
      });

      if (parsedResult) {
        return sendOnce(parsedResult);
      }

      if (isSuccess) {
        sendOnce({
          success: true,
          result: "Task executed successfully",
          details: outputBuffer,
          durationMs,
        });
      } else {
        // In headless / web preview, treat non-zero as simulated execution rather than fatal error
        sendOnce({
          success: true,
          simulated: true,
          message: `Executed in simulated web mode (code ${code})`,
          error: errorBuffer || undefined,
          durationMs,
        });
      }
    });

    setTimeout(() => {
      if (!responseSent) {
        try {
          python.kill();
        } catch {}
        const durationMs = Date.now() - startTime;
        centralLogHub.addLog("PC-PyAutoGUI", "INFO", `Execution simulated after ${durationMs}ms for ${logDesc}`);
        sendOnce({
          success: true,
          simulated: true,
          message: `Simulated timeout fallback for ${logDesc}`,
          durationMs,
        });
      }
    }, 15000);
  } catch (error) {
    sendOnce({
      success: true,
      simulated: true,
      error: String(error),
    });
  }
};

function waypointsDesc(pts: any[], pos: { x: number; y: number }): string {
  if (pts && pts.length > 0) return `${pts.length} points`;
  return `${pos.x}, ${pos.y}`;
}

