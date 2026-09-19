import { RequestHandler } from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { centralLogHub } from "../log-hub";

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
          coordinates: targetPos,
          success: false,
          durationMs,
          details: spawnError,
        });
        return res.json({ success: false, error: spawnError });
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
        return res.json(parsedResult);
      }

      if (isSuccess) {
        res.json({
          success: true,
          result: "Task executed successfully",
          details: outputBuffer,
          durationMs,
        });
      } else {
        res.json({
          success: false,
          error: errorBuffer || `Execution process failed (code ${code})`,
          durationMs,
        });
      }
    });

    try {
      python.stdin.write(JSON.stringify(req.body));
      python.stdin.end();
    } catch (e) {
      if (!responseSent) {
        responseSent = true;
        res.json({ success: false, error: String(e) });
      }
    }

    setTimeout(() => {
      if (!responseSent) {
        try {
          python.kill();
        } catch {}
        responseSent = true;
        const durationMs = Date.now() - startTime;
        centralLogHub.addLog("PC-PyAutoGUI", "ERROR", `Timeout after ${durationMs}ms for ${logDesc}`);
        res.json({ success: false, error: "Execute-task timeout (15s)" });
      }
    }, 15000);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
};

