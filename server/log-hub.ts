/**
 * Central Logging & Event Telemetry Hub
 * Collects, buffers, and streams events across Vision, Planner, Mouse Tracker, and Native Executors.
 */

export interface SystemLogEntry {
  id: string;
  timestamp: number;
  timeStr: string;
  source:
    | "Qwen Vision"
    | "Planner AI"
    | "Mouse Tracker"
    | "PyAutoGUI"
    | "Verifier"
    | "Goals Hub"
    | "AI-Verifier"
    | "AI-StuckResolver"
    | "AI-Checkup"
    | "AI-AutoActor"
    | "AI-VisualDiff"
    | "Screen-Detection"
    | "Mobile-Automation"
    | "PC-PyAutoGUI"
    | "System";
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  message: string;
  metadata?: Record<string, any>;
}

/** In-memory ring buffer that collects and serves system log entries. */
class CentralLogHub {
  private logs: SystemLogEntry[] = [];
  private maxLogs = 500;

  /** Creates the hub and records its own initialization as a log entry. */
  constructor() {
    this.addLog(
      "System",
      "INFO",
      "Central Logging & Event Telemetry Hub initialized",
    );
  }

  /** Appends a new log entry to the front of the buffer, trimming to `maxLogs`. */
  addLog(
    source: SystemLogEntry["source"],
    level: SystemLogEntry["level"],
    message: string,
    metadata?: Record<string, any>,
  ): SystemLogEntry {
    const entry: SystemLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      timeStr: new Date().toLocaleTimeString(),
      source,
      level,
      message,
      metadata,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    return entry;
  }

  /** Returns up to `limit` log entries, optionally filtered by source and level. */
  getLogs(limit = 100, source?: string, level?: string): SystemLogEntry[] {
    let filtered = this.logs;
    if (source && source !== "all") {
      filtered = filtered.filter((l) =>
        l.source.toLowerCase().includes(source.toLowerCase()),
      );
    }
    if (level && level !== "all") {
      filtered = filtered.filter((l) => l.level === level);
    }
    return filtered.slice(0, limit);
  }

  /** Clears all buffered log entries and records a reset notice. */
  clearLogs() {
    this.logs = [];
    this.addLog("System", "INFO", "Log buffer cleared");
  }
}

export const centralLogHub = new CentralLogHub();
