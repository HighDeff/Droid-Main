/**
 * AI Monitor Store
 * Tracks the live status of the AI pipeline and keeps a bounded history of every
 * action the AI takes, so the AI Monitor screen can show current status, ongoing
 * actions and recent tasks, and the history can be exported to CSV (importable
 * into Google Sheets).
 */

export type AiPipelinePhase =
  | "perception"
  | "planning"
  | "execution"
  | "verification"
  | "recovery"
  | "browser"
  | "system";

export type AiActionStatus = "started" | "completed" | "failed" | "info";

export type AiMonitorStatus =
  | "idle"
  | "perceiving"
  | "planning"
  | "executing"
  | "verifying"
  | "recovering";

export interface AiActionRecord {
  id: string;
  timestamp: number;
  timeStr: string;
  phase: AiPipelinePhase;
  title: string;
  detail: string;
  status: AiActionStatus;
  target?: { name?: string; x?: number; y?: number };
  confidence?: number;
  source?: string;
}

export interface AiMonitorBrowserElement {
  id: string;
  name: string;
  type: string;
  selector?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  interactive: boolean;
  textValue?: string;
}

export interface AiMonitorBrowserTab {
  id?: string;
  title?: string;
  url?: string;
  active?: boolean;
}

export interface AiMonitorBrowserContext {
  updatedAt: number;
  source: "cdp" | "extension";
  activeTab?: AiMonitorBrowserTab;
  tabs: AiMonitorBrowserTab[];
  page?: {
    title?: string;
    url?: string;
    viewport?: { width: number; height: number };
  };
  elements: AiMonitorBrowserElement[];
}

export interface AiMonitorState {
  status: AiMonitorStatus;
  objective: string;
  currentAction: string | null;
  activeGoals: Array<{ title: string; status: string }>;
  browser: AiMonitorBrowserContext | null;
  lastUpdate: number;
}

class AiMonitorStore {
  private history: AiActionRecord[] = [];
  private maxRecords = 1000;
  private browserContext: AiMonitorBrowserContext | null = null;
  private state: AiMonitorState = {
    status: "idle",
    objective: "No active objective",
    currentAction: null,
    activeGoals: [],
    browser: null,
    lastUpdate: Date.now(),
  };

  record(
    entry: Omit<AiActionRecord, "id" | "timestamp" | "timeStr">,
  ): AiActionRecord {
    const now = Date.now();
    const record: AiActionRecord = {
      ...entry,
      id: `act_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      timeStr: new Date(now).toLocaleTimeString(),
    };
    this.history.unshift(record);
    if (this.history.length > this.maxRecords) {
      this.history.length = this.maxRecords;
    }
    this.state.lastUpdate = now;
    return record;
  }

  setStatus(
    patch: Partial<
      Pick<AiMonitorState, "status" | "objective" | "currentAction" | "activeGoals">
    >,
  ) {
    this.state = { ...this.state, ...patch, lastUpdate: Date.now() };
    return this.state;
  }

  setBrowserContext(context: AiMonitorBrowserContext) {
    this.browserContext = context;
    this.state.browser = context;
    this.state.lastUpdate = Date.now();
    return context;
  }

  getBrowserContext(): AiMonitorBrowserContext | null {
    return this.browserContext;
  }

  getState(): AiMonitorState {
    return { ...this.state, browser: this.browserContext };
  }

  getHistory(limit = 100): AiActionRecord[] {
    return this.history.slice(0, Math.max(0, limit));
  }

  clearHistory() {
    this.history = [];
  }

  toCsv(): string {
    const headers = [
      "Timestamp",
      "Time",
      "Phase",
      "Action",
      "Detail",
      "Status",
      "Target",
      "X",
      "Y",
      "Confidence",
      "Source",
    ];
    const rows = this.history.map((r) => [
      new Date(r.timestamp).toISOString(),
      r.timeStr,
      r.phase,
      r.title,
      r.detail,
      r.status,
      r.target?.name ?? "",
      r.target?.x ?? "",
      r.target?.y ?? "",
      r.confidence ?? "",
      r.source ?? "",
    ]);
    return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  }
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export const aiMonitorStore = new AiMonitorStore();
