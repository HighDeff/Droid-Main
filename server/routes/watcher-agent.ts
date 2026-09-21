import { RequestHandler } from "express";

export interface WatcherEvent {
  id: string;
  timestamp: number;
  type: "window_focus" | "file_change" | "input_event" | "app_launch" | "screen_change";
  source: string;
  details: string;
  coordinates?: { x: number; y: number };
  data?: any;
}

export interface AssembledTask {
  id: string;
  name: string;
  action: "click" | "type" | "hotkey" | "launch" | "companion_command" | "wait";
  targetApp?: string;
  parameters: {
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    command?: string;
    appName?: string;
  };
  confidence: number;
  status: "pending" | "executing" | "completed";
  assembledAt: number;
}

interface WatcherAgentState {
  isActive: boolean;
  monitoredPrograms: string[];
  monitoredFiles: string[];
  eventsLog: WatcherEvent[];
  assembledTasks: AssembledTask[];
  activeTaskQueue: AssembledTask[];
  lastPingTime: number;
}

// In-memory state for Watcher Agent
const watcherState: WatcherAgentState = {
  isActive: true,
  monitoredPrograms: ["notepad.exe", "calc.exe", "chrome.exe", "code.exe", "terminal"],
  monitoredFiles: ["/workspace/tasks.json", "/workspace/input.txt", "/workspace/output.csv"],
  eventsLog: [
    {
      id: "ev_init_01",
      timestamp: Date.now() - 120000,
      type: "app_launch",
      source: "System Process Watcher",
      details: "Desktop shell and active display surface monitored at 1920x1080."
    },
    {
      id: "ev_init_02",
      timestamp: Date.now() - 60000,
      type: "window_focus",
      source: "Window Monitor",
      details: "Target window foreground verification active."
    }
  ],
  assembledTasks: [
    {
      id: "task_auto_01",
      name: "Auto-Focus Search Field",
      action: "click",
      parameters: { x: 960, y: 120 },
      confidence: 0.95,
      status: "completed",
      assembledAt: Date.now() - 45000
    }
  ],
  activeTaskQueue: [],
  lastPingTime: Date.now()
};

/**
 * Get current status of Watcher Agent, monitored resources, events and assembled tasks
 */
export const handleGetWatcherStatus: RequestHandler = async (_req, res) => {
  watcherState.lastPingTime = Date.now();
  res.json({
    success: true,
    state: watcherState
  });
};

/**
 * Start or configure Watcher Agent
 */
export const handleStartWatcher: RequestHandler = async (req, res) => {
  const { monitoredPrograms, monitoredFiles } = req.body;
  watcherState.isActive = true;
  if (Array.isArray(monitoredPrograms)) {
    watcherState.monitoredPrograms = Array.from(new Set([...watcherState.monitoredPrograms, ...monitoredPrograms]));
  }
  if (Array.isArray(monitoredFiles)) {
    watcherState.monitoredFiles = Array.from(new Set([...watcherState.monitoredFiles, ...monitoredFiles]));
  }

  const startEv: WatcherEvent = {
    id: `ev_${Date.now()}`,
    timestamp: Date.now(),
    type: "app_launch",
    source: "Watcher Agent Controller",
    details: `Watcher Agent activated. Monitoring ${watcherState.monitoredPrograms.length} program(s) and ${watcherState.monitoredFiles.length} file target(s).`
  };
  watcherState.eventsLog.unshift(startEv);

  res.json({
    success: true,
    message: "Watcher Agent active and assembling live tasks.",
    state: watcherState
  });
};

/**
 * Stop Watcher Agent
 */
export const handleStopWatcher: RequestHandler = async (_req, res) => {
  watcherState.isActive = false;
  const stopEv: WatcherEvent = {
    id: `ev_${Date.now()}`,
    timestamp: Date.now(),
    type: "window_focus",
    source: "Watcher Agent Controller",
    details: "Watcher Agent paused by user."
  };
  watcherState.eventsLog.unshift(stopEv);
  res.json({ success: true, message: "Watcher Agent paused.", state: watcherState });
};

/**
 * Real-time task assembly: Assembles raw events or user prompts into executable workflow tasks
 */
export const handleAssembleTask: RequestHandler = async (req, res) => {
  try {
    const { actionType, prompt, appToOpen, companionCommand, x, y, text } = req.body;

    const newTask: AssembledTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: prompt || (appToOpen ? `Launch & Intercept: ${appToOpen}` : `Live Assembled Action: ${actionType || "click"}`),
      action: companionCommand ? "companion_command" : appToOpen ? "launch" : (actionType as any) || "click",
      targetApp: appToOpen,
      parameters: {
        x: x ?? 960,
        y: y ?? 540,
        text: text || "",
        command: companionCommand,
        appName: appToOpen
      },
      confidence: 0.94,
      status: "pending",
      assembledAt: Date.now()
    };

    watcherState.assembledTasks.unshift(newTask);
    watcherState.activeTaskQueue.push(newTask);

    const event: WatcherEvent = {
      id: `ev_${Date.now()}`,
      timestamp: Date.now(),
      type: appToOpen ? "app_launch" : "input_event",
      source: "Live Task Assembler",
      details: `Assembled task: "${newTask.name}" (${newTask.action}). Queued for native execution.`,
      coordinates: x && y ? { x, y } : undefined
    };
    watcherState.eventsLog.unshift(event);

    return res.json({
      success: true,
      assembledTask: newTask,
      queueLength: watcherState.activeTaskQueue.length,
      message: `Task "${newTask.name}" successfully assembled and registered in live execution queue.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
};
