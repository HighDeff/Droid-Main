import { Request, Response } from "express";
import { executePyAutoGUIActions } from "./pyautogui-bridge";

export interface ScheduledJob {
  id: string;
  name: string;
  description?: string;
  workflowId?: string;
  workflowName: string;
  steps: Array<{
    id: string;
    name?: string;
    action: string;
    x?: number;
    y?: number;
    text?: string;
    keyPayload?: string;
    delayMs?: number;
  }>;
  triggerType: "cron" | "delayed" | "interval" | "daily";
  cronExpression?: string; // e.g. "*/5 * * * *"
  delayMinutes?: number;
  intervalMinutes?: number;
  dailyTime?: string; // "HH:MM" e.g. "09:30"
  targetDevice: "desktop" | "android";
  enabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
  executionCount: number;
  status: "idle" | "running" | "completed" | "failed" | "paused";
  lastError?: string;
  lastExecutionDurationMs?: number;
}

export interface JobExecutionLog {
  id: string;
  jobId: string;
  jobName: string;
  timestamp: number;
  triggerType: string;
  stepsExecuted: number;
  success: boolean;
  durationMs: number;
  outputSummary: string;
  error?: string;
}

// In-memory job registry and logs
const jobsStore: Map<string, ScheduledJob> = new Map();
const executionLogsStore: JobExecutionLog[] = [];

// Seed with default initial schedules
const defaultJobs: ScheduledJob[] = [
  {
    id: "job-health-check",
    name: "Automated Screen Drift & App Health Check",
    description: "Every 15 minutes, checks UI elements and recalibrates target positions",
    workflowName: "Periodic Screen Alignment",
    steps: [
      { id: "s1", name: "Focus Workspace", action: "click", x: 960, y: 120, delayMs: 300 },
      { id: "s2", name: "Trigger Recalibration", action: "hotkey", keyPayload: "ctrl+r", delayMs: 400 },
    ],
    triggerType: "cron",
    cronExpression: "*/15 * * * *",
    targetDevice: "desktop",
    enabled: true,
    createdAt: Date.now() - 3600000,
    lastRunAt: Date.now() - 900000,
    nextRunAt: Date.now() + 300000,
    executionCount: 8,
    status: "idle",
  },
  {
    id: "job-daily-sync",
    name: "Daily Workflow Routine Sync",
    description: "Runs every morning at 09:00 AM to process pending automation queue",
    workflowName: "Morning Routine",
    steps: [
      { id: "m1", name: "Launch Task Manager", action: "click", x: 450, y: 880, delayMs: 500 },
      { id: "m2", name: "Input Search Query", action: "type_text", text: "Daily Sync Report", delayMs: 400 },
      { id: "m3", name: "Confirm Enter", action: "press_key", keyPayload: "enter", delayMs: 300 },
    ],
    triggerType: "daily",
    dailyTime: "09:00",
    targetDevice: "desktop",
    enabled: true,
    createdAt: Date.now() - 86400000,
    lastRunAt: Date.now() - 14400000,
    nextRunAt: Date.now() + 18000000,
    executionCount: 3,
    status: "idle",
  },
];

defaultJobs.forEach((job) => jobsStore.set(job.id, job));

/**
 * Calculates next run timestamp from schedule configuration
 */
function calculateNextRun(job: ScheduledJob): number {
  const now = Date.now();
  if (!job.enabled) return now + 86400000;

  if (job.triggerType === "delayed") {
    return now + (job.delayMinutes || 5) * 60 * 1000;
  }

  if (job.triggerType === "interval") {
    return now + (job.intervalMinutes || 10) * 60 * 1000;
  }

  if (job.triggerType === "daily" && job.dailyTime) {
    const [hours, minutes] = job.dailyTime.split(":").map(Number);
    const target = new Date();
    target.setHours(hours || 0, minutes || 0, 0, 0);
    if (target.getTime() <= now) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }

  if (job.triggerType === "cron") {
    // Parse simple cron expression like */N * * * * or standard cron minutes
    const expr = job.cronExpression || "*/5 * * * *";
    const parts = expr.trim().split(/\s+/);
    if (parts[0].startsWith("*/")) {
      const minutesInterval = parseInt(parts[0].replace("*/", ""), 10) || 5;
      return now + minutesInterval * 60 * 1000;
    }
    if (parts[0] === "*") {
      return now + 60 * 1000; // Every minute
    }
    const minuteVal = parseInt(parts[0], 10);
    if (!isNaN(minuteVal)) {
      const target = new Date();
      if (target.getMinutes() >= minuteVal) {
        target.setHours(target.getHours() + 1);
      }
      target.setMinutes(minuteVal, 0, 0);
      return target.getTime();
    }
    return now + 5 * 60 * 1000;
  }

  return now + 10 * 60 * 1000;
}

/**
 * Execute a job asynchronously
 */
async function executeScheduledJob(job: ScheduledJob, isManual = false) {
  const startTime = Date.now();
  job.status = "running";
  job.lastRunAt = startTime;

  try {
    const actionsToRun = job.steps.map((s) => ({
      action: s.action || "click",
      x: s.x,
      y: s.y,
      text: s.text,
      keyPayload: s.keyPayload,
      delayMs: s.delayMs,
    }));

    // Trigger PyAutoGUI execution bridge
    await executePyAutoGUIActions(actionsToRun);

    const duration = Date.now() - startTime;
    job.status = "idle";
    job.executionCount += 1;
    job.lastExecutionDurationMs = duration;
    job.nextRunAt = job.triggerType === "delayed" && !isManual ? undefined : calculateNextRun(job);
    if (job.triggerType === "delayed" && !isManual) {
      job.enabled = false;
    }

    // Record log
    executionLogsStore.unshift({
      id: `exec-${Date.now()}`,
      jobId: job.id,
      jobName: job.name,
      timestamp: startTime,
      triggerType: isManual ? "manual" : job.triggerType,
      stepsExecuted: job.steps.length,
      success: true,
      durationMs: duration,
      outputSummary: `Successfully dispatched ${job.steps.length} actions via PyAutoGUI bridge.`,
    });

    // Keep logs store within 100 items
    if (executionLogsStore.length > 100) executionLogsStore.length = 100;
  } catch (err: any) {
    const duration = Date.now() - startTime;
    job.status = "failed";
    job.lastError = err.message;
    job.nextRunAt = calculateNextRun(job);

    executionLogsStore.unshift({
      id: `exec-${Date.now()}`,
      jobId: job.id,
      jobName: job.name,
      timestamp: startTime,
      triggerType: isManual ? "manual" : job.triggerType,
      stepsExecuted: job.steps.length,
      success: false,
      durationMs: duration,
      outputSummary: `Execution failed: ${err.message}`,
      error: err.message,
    });
  }
}

// Background scheduler tick loop (checks every 5 seconds)
let schedulerInterval: NodeJS.Timeout | null = null;

function startSchedulerDaemon() {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(() => {
    const now = Date.now();
    for (const job of jobsStore.values()) {
      if (job.enabled && job.nextRunAt && job.nextRunAt <= now && job.status !== "running") {
        executeScheduledJob(job, false);
      }
    }
  }, 5000);
  schedulerInterval.unref?.();
}

startSchedulerDaemon();

export async function handleGetScheduledJobs(_req: Request, res: Response) {
  try {
    const jobs = Array.from(jobsStore.values());
    res.json({
      success: true,
      jobs,
      total: jobs.length,
      activeCount: jobs.filter((j) => j.enabled).length,
      recentLogs: executionLogsStore.slice(0, 20),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function handleCreateScheduledJob(req: Request, res: Response) {
  try {
    const {
      name,
      description,
      workflowName = "Custom Automation Routine",
      steps = [],
      triggerType = "cron",
      cronExpression = "*/5 * * * *",
      delayMinutes = 5,
      intervalMinutes = 15,
      dailyTime = "09:00",
      targetDevice = "desktop",
      enabled = true,
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: "Job name is required" });
    }

    const newJob: ScheduledJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      description,
      workflowName,
      steps: Array.isArray(steps) ? steps : [],
      triggerType,
      cronExpression,
      delayMinutes: Number(delayMinutes) || 5,
      intervalMinutes: Number(intervalMinutes) || 15,
      dailyTime,
      targetDevice,
      enabled: Boolean(enabled),
      createdAt: Date.now(),
      executionCount: 0,
      status: "idle",
    };

    newJob.nextRunAt = calculateNextRun(newJob);
    jobsStore.set(newJob.id, newJob);

    res.json({
      success: true,
      job: newJob,
      message: `Workflow "${newJob.name}" scheduled successfully with trigger [${newJob.triggerType}].`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function handleToggleScheduledJob(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const job = jobsStore.get(id);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    job.enabled = !job.enabled;
    job.status = job.enabled ? "idle" : "paused";
    if (job.enabled) {
      job.nextRunAt = calculateNextRun(job);
    } else {
      job.nextRunAt = undefined;
    }

    res.json({
      success: true,
      job,
      message: `Job "${job.name}" is now ${job.enabled ? "ACTIVE" : "PAUSED"}.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function handleRunJobNow(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const job = jobsStore.get(id);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    // Trigger run immediately
    executeScheduledJob(job, true);

    res.json({
      success: true,
      job,
      message: `Job "${job.name}" triggered immediately.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function handleDeleteScheduledJob(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existed = jobsStore.delete(id);
    if (!existed) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    res.json({ success: true, message: "Job removed from schedule." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
