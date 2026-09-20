import { RequestHandler } from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { centralLogHub } from "../log-hub";
import {
  ALLOWED_AUTOMATION_ACTIONS,
  AUTOMATION_BOUNDS,
  POSITIONAL_AUTOMATION_ACTIONS,
  validateDeviceId,
  validateHotkey,
  validateKey,
  validateText,
} from "../automation-adapters";
import { validatePoint } from "../../shared/coordinates";

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
  const deviceId = req.body.deviceId || rawTask.deviceId;
  const action = String(rawTask.action || rawTask.actionType || "").toLowerCase();
  const targetPos = rawTask.targetPosition || { x: rawTask.x, y: rawTask.y };
  const routePoints = rawTask.routePoints || rawTask.points || [];
  const textPayload = rawTask.textPayload || rawTask.text || "";
  const keyPayload = rawTask.keyPayload || rawTask.key || "";
  const hasCoordinates = POSITIONAL_AUTOMATION_ACTIONS.has(action);
  const hasOptionalCoordinates =
    ["type", "type_text", "clear_and_type"].includes(action) &&
    (targetPos.x !== undefined || targetPos.y !== undefined);
  if (targetDevice !== "desktop" && targetDevice !== "android") {
    return res.status(400).json({ success: false, error: "targetDevice must be desktop or android" });
  }

  if (!ALLOWED_AUTOMATION_ACTIONS.has(action)) {
    return res.status(400).json({ success: false, error: `Unsupported action: ${action || "missing"}` });
  }
  try {
    if (action === "wait") {
      const delayMs = rawTask.delayMs ?? rawTask.delay;
      if (typeof delayMs !== "number" || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 120_000) {
        throw new Error("Wait must be a finite number between 0 and 120000ms");
      }
    }
    if (hasCoordinates || hasOptionalCoordinates) {
      validatePoint(targetPos, AUTOMATION_BOUNDS, "task coordinates");
    }
    if (["drag", "drag_and_drop"].includes(action)) {
      if (!rawTask.dragEndPosition || typeof rawTask.dragEndPosition !== "object") {
        throw new Error("A drag end position is required");
      }
      validatePoint(rawTask.dragEndPosition, AUTOMATION_BOUNDS, "drag end coordinates");
    }
    if (["stream_mouse_route", "play_route", "replay_route"].includes(action)) {
      if (!Array.isArray(routePoints) || routePoints.length < 2 || routePoints.length > 10_000) {
        throw new Error("Mouse route requires between 2 and 10,000 points");
      }
      routePoints.forEach((point: unknown, index: number) =>
        validatePoint(
          point as { x: number; y: number },
          AUTOMATION_BOUNDS,
          `route point ${index + 1}`,
        ),
      );
    }
    if (["clear_and_type", "type", "type_text", "relative_type"].includes(action)) validateText(String(textPayload));
    if (["key", "press_key"].includes(action)) validateKey(String(keyPayload));
    if (action === "hotkey") {
      validateHotkey(String(textPayload || keyPayload));
    }
    if (targetDevice === "android") {
      if (!deviceId) throw new Error("An Android device ID is required");
      validateDeviceId(String(deviceId));
      if (["stream_mouse_route", "play_route", "replay_route", "right_click", "hotkey"].includes(action)) {
        throw new Error(`Android execution does not support ${action}`);
      }
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }

  const logDesc = routePoints.length > 0
    ? `Stream mouse trail (${routePoints.length} waypoints) on ${targetDevice}`
    : `${action.toUpperCase()}${hasCoordinates || hasOptionalCoordinates ? ` at (${targetPos.x}, ${targetPos.y})` : ""} ${textPayload ? `[text: "${textPayload}"]` : ""} on ${targetDevice}`;

  centralLogHub.addLog(
    targetDevice === "android" ? "Mobile-Automation" : "PC-PyAutoGUI",
    "INFO",
    `Executing: ${logDesc}`,
    { action, targetPos, pointsCount: routePoints.length, targetDevice }
  );

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

    // Send formatted execution payload to Python subprocess stdin
    const inputPayload = JSON.stringify({
      task: rawTask,
      targetDevice,
      action,
      targetPosition: targetPos,
      routePoints,
      textPayload,
      keyPayload,
    });
    python.stdin.write(inputPayload);
    python.stdin.end();

    let outputBuffer = "";
    let errorBuffer = "";
    let responseSent = false;
    let timeout: NodeJS.Timeout;

    python.stdout.on("data", (data) => {
      outputBuffer += data.toString();
    });

    python.stderr.on("data", (data) => {
      errorBuffer += data.toString();
    });

    let spawnError: string | null = null;
    python.on("error", (err) => {
      spawnError = `Failed to spawn python (${pythonCmd}): ${err.message}`;
    });

    python.on("close", (code) => {
      clearTimeout(timeout);
      if (responseSent) return;
      responseSent = true;
      const durationMs = Date.now() - startTime;

      if (spawnError) {
        centralLogHub.addLog(
          "PC-PyAutoGUI",
          "ERROR",
          `Execution Spawn Failure: ${spawnError}`,
          { durationMs, action }
        );
        interactionHistory.push({
          id: `int_${Date.now()}`,
          timestamp: Date.now(),
          device: targetDevice,
          action,
          coordinates: hasCoordinates || hasOptionalCoordinates ? targetPos : undefined,
          success: false,
          durationMs,
          details: spawnError,
        });
        return res.json({ success: false, error: spawnError });
      }

      let parsedResult: any = null;
      let parseError: string | null = null;
      try {
        if (outputBuffer.trim()) {
          parsedResult = JSON.parse(outputBuffer.trim());
        }
      } catch (parseErr) {
        parseError = parseErr instanceof Error ? parseErr.message : String(parseErr);
      }

      const isSuccess = code === 0 && parsedResult?.success === true;
      const protocolError = parseError
        ? `Native action returned invalid JSON: ${parseError}`
        : !outputBuffer.trim()
          ? "Native action process exited without a result"
          : !parsedResult || typeof parsedResult.success !== "boolean"
            ? "Native action returned an invalid result shape"
            : null;
      const explanation = parsedResult?.explanation || protocolError || outputBuffer.trim() || errorBuffer;

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
        coordinates: hasCoordinates || hasOptionalCoordinates ? targetPos : undefined,
        pointsCount: routePoints.length,
        textPayload: textPayload || undefined,
        keyPayload: keyPayload || undefined,
        success: isSuccess,
        durationMs,
        details: explanation,
      });

      if (parsedResult && typeof parsedResult.success === "boolean") {
        return res.json({
          ...parsedResult,
          success: isSuccess,
          ...(isSuccess
            ? {}
            : {
                error:
                  parsedResult.error ||
                  explanation ||
                  `Execution process failed (code ${code})`,
              }),
        });
      }
      res.json({
        success: false,
        error: protocolError || errorBuffer || `Execution process failed (code ${code})`,
        durationMs,
      });
    });

    try {
      python.stdin.write(JSON.stringify({
        ...req.body,
        targetDevice,
        ...(deviceId ? { deviceId } : {}),
      }));
      python.stdin.end();
    } catch (e) {
      if (!responseSent) {
        responseSent = true;
        res.json({ success: false, error: String(e) });
      }
    }

    const executionTimeoutMs = action === "wait"
      ? Number(rawTask.delayMs ?? rawTask.delay) + 5_000
      : 15_000;
    timeout = setTimeout(() => {
      if (!responseSent) {
        try {
          python.kill();
        } catch {}
        responseSent = true;
        const durationMs = Date.now() - startTime;
        centralLogHub.addLog("PC-PyAutoGUI", "ERROR", `Timeout after ${durationMs}ms for ${logDesc}`);
        res.json({ success: false, error: `Execute-task timeout (${executionTimeoutMs}ms)` });
      }
    }, executionTimeoutMs);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
};
