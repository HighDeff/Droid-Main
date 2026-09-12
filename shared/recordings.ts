export interface RecordedActionSource {
  source: string;
  appId: string;
  pagePath: string;
  userAgent: string;
  sensitiveInputCaptured: boolean;
}

export interface RecordedAction {
  id: string;
  timestamp: string;
  source: RecordedActionSource;
  type:
    | "note"
    | "screenshot-checkpoint"
    | "keyboard-key"
    | "wait"
    | "mouse-click"
    | "mouse-move";
  text?: string;
  label?: string;
  key?: string;
  code?: string;
  modifiers?: string[];
  sensitive?: boolean;
  button?: number | string;
  target?: any;
  durationMs?: number;
  x?: number;
  y?: number;
}

export interface RecordedSession {
  id: string;
  sessionId: string;
  name: string;
  status: "recording" | "stopped" | "idle";
  events: RecordedAction[];
  source?: RecordedActionSource;
  createdAt?: string;
  stoppedAt?: string;
}
