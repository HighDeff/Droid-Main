export type TimingHint = "now" | "soon" | "scheduled" | "when_ready";

export type WaitConditionType =
  | "visible_text"
  | "region"
  | "close_control"
  | "next_control"
  | "timer"
  | "page_load_stable";

export interface WaitCondition {
  id: string;
  sessionId: string;
  type: WaitConditionType;
  label: string;
  value?: string;
  timeoutMs?: number;
  threshold?: number;
  pollIntervalMs?: number;
  confidenceThreshold?: number;
  approved?: boolean;
  status?: "pending" | "satisfied" | "failed" | "timed_out";
  createdAt?: string;
  satisfiedAt?: string;
}

export interface WaitConditionStatusEvent {
  id: string;
  conditionId: string;
  status: "pending" | "satisfied" | "failed" | "timed_out";
  timestamp: string;
  detail?: string;
  message?: string;
  suggestion?: string;
}

export interface PlannedStep {
  id: string;
  order: number;
  title: string;
  description?: string;
  action: string;
  confidence?: number;
  target?: { x: number; y: number };
  selector?: string;
  timing?: TimingHint;
  status?: "pending" | "in_progress" | "completed" | "failed" | "edited" | string;
  waitConditions?: WaitCondition[];
}

export interface AssistantPlan {
  id: string;
  sessionId: string;
  title: string;
  goal: string;
  instruction?: string | { id: string; sessionId: string; text: string; createdAt: string; [key: string]: any };
  timing?: TimingHint;
  confidence?: number;
  risks?: any[];
  approvalState?: "pending" | "approved" | "rejected" | string;
  steps: PlannedStep[];
  sourceCaptureIds?: string[];
  status: "draft" | "approved" | "executing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface AssistantExecution {
  id: string;
  planId: string;
  sessionId: string;
  status: "running" | "paused" | "completed" | "cancelled" | "failed";
  currentStepIndex: number;
  currentStep?: number;
  totalSteps?: number;
  pendingApproval?: any;
  timeline?: any[];
  evidence?: any[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  logs?: string[];
}

export interface AssistantWorkflow {
  id: string;
  sessionId: string;
  name: string;
  description?: string;
  status?: string;
  repeatCount?: number;
  schedule?: any;
  checkpointIds?: string[];
  operationPackIds?: string[];
  pauseResumePolicy?: any;
  goals?: any;
  steps: PlannedStep[];
  createdAt: string;
  updatedAt: string;
  executionCount?: number;
  successRate?: number;
}

export interface AssistantSession {
  id: string;
  name?: string;
  project?: string | { id: string; name: string; createdAt?: string; updatedAt?: string; [key: string]: any };
  status?: string;
  goals?: string[];
  savedStateIds?: string[];
  createdAt: string;
  updatedAt: string;
  source?: any;
}

export interface CaptureSource {
  id: string;
  name: string;
  type: "desktop" | "android" | "browser" | "window";
  kind?: string;
  detail?: string;
  connected: boolean;
  connectionState?: "connected" | "connecting" | "disconnected" | "failed" | string;
  lastFrameAt?: string;
  error?: string;
  resolution?: { width: number; height: number };
  lastActive?: string;
}

export interface FrameAnalysis {
  id: string;
  captureId?: string;
  sessionId?: string;
  timestamp: string;
  analyzedAt?: string;
  provider?: string;
  status?: string;
  summary: string;
  confidence: number;
  ocrText?: string | string[];
  notes?: string | string[];
  regionsOfInterest?: any[];
  uiElements?: Array<{
    id: string;
    name: string;
    type: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
  detectedElements?: any[];
  textExtracted?: string[];
  suggestedActions?: Array<{
    id: string;
    action: string;
    target?: { x: number; y: number };
    confidence: number;
  }>;
}

export interface UserInstruction {
  id: string;
  sessionId: string;
  text: string;
  createdAt: string;
  timing?: TimingHint;
}

export interface OperationPack {
  id: string;
  sessionId: string;
  title: string;
  operations: any[];
  createdAt: string;
}

export interface ProgressEntry {
  id: string;
  sessionId: string;
  stepId?: string;
  message: string;
  timestamp: string;
  percentage?: number;
}

export interface SavedState {
  id: string;
  sessionId: string;
  data: any;
  timestamp: string;
}

export interface ScreenshotCapture {
  id: string;
  sessionId: string;
  imageData: string;
  capturedAt: string;
  dimensions?: { width: number; height: number };
  annotations?: Annotation[];
}

export interface Annotation {
  id: string;
  captureId: string;
  x: number;
  y: number;
  label: string;
  confidence?: number;
}

export type AllowlistedAction =
  | { type: "click"; x: number; y: number; button?: number | string; [key: string]: any }
  | { type: "tap"; x: number; y: number; [key: string]: any }
  | { type: "type"; text: string; [key: string]: any }
  | { type: "key"; key: string; [key: string]: any }
  | { type: "scroll"; deltaX?: number; deltaY?: number; [key: string]: any }
  | { type: "swipe"; fromX: number; fromY: number; toX: number; toY: number; durationMs?: number; [key: string]: any };

export interface ActionExecutionResult {
  success: boolean;
  actionId?: string;
  actionType?: string;
  message?: string;
  error?: string;
  timestamp?: string;
}
