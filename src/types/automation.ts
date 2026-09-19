import { DriveFile } from './drive';

export type StepActionType =
  | 'click'
  | 'swipe_up'
  | 'swipe_down'
  | 'swipe_left'
  | 'swipe_right'
  | 'input_text'
  | 'switch_tab'
  | 'dismiss_overlay'
  | 'select_item'
  | 'verify_anchor'
  | 'auto_recover';

export type StepExecutionStatus =
  | 'pending'
  | 'analyzing_frame'
  | 'validating_surroundings'
  | 'executing'
  | 'completed'
  | 'drift_corrected'
  | 'failed'
  | 'skipped';

export interface SurroundingElementAnchor {
  selectorOrTag: string;
  expectedLabel?: string;
  relativePosition: 'above' | 'below' | 'left' | 'right' | 'parent' | 'adjacent';
  present: boolean;
  confidence: number;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  actionType: StepActionType;
  targetCoords: { x: number; y: number };
  targetTab?: 'my-drive' | 'starred' | 'trash' | 'analytics' | 'execution-analytics';
  inputPayload?: string;
  swipeOffset?: { dx: number; dy: number };
  status: StepExecutionStatus;
  reasoning?: string;
  surroundingAnchors?: SurroundingElementAnchor[];
  addedBy: 'user' | 'ai' | 'overseer' | 'auto_rule';
  learnedRuleId?: string;
  screenshotDiffBeforeAfter?: {
    diffPercent: number;
    visualChangeDetected: boolean;
  };
}

export interface AutoDeployConditionRule {
  id: string;
  name: string;
  conditionType: 'element_present' | 'text_match' | 'modal_opened' | 'emergency_error' | 'tab_mismatch' | 'close_x_appeared';
  pattern: string; // e.g., 'modal-close-x', 'error-alert', 'target_tab_mismatch'
  actionToDeploy: StepActionType;
  targetCoords?: { x: number; y: number };
  targetTab?: 'my-drive' | 'starred' | 'trash' | 'analytics' | 'execution-analytics';
  enabled: boolean;
  confidenceThreshold: number; // 0 to 100
  isEmergency: boolean;
  description: string;
  timesTriggered: number;
}

export interface AutoDeploySettings {
  autoContinueEnabled: boolean;
  autoContinueDelayMs: number;
  freeRoamMode: boolean;
  autoDeployEnabled: boolean;
  minConfidenceToAutoDeploy: number;
  requireReasoningForAiStepAddition: boolean; // if false or in Free Roam, adds without waiting
  analyzeSurroundingsBeforeStep: boolean;
  surroundingConsistencyThreshold: number; // 0 to 100
  emergencyAutoRecover: boolean;
  closeXAutoDismiss: boolean;
  autoTabRectification: boolean;
  overseerMonitoring: boolean;
  overseerAutoNudge: boolean;
  enableBackgroundUiObserver: boolean;
  expectedElementTimeoutMs: number;
  onElementTimeoutAction: 'alert_overseer' | 'pause_workflow' | 'auto_switch_tab' | 'auto_recover';
  trackMouseMovementInVideo: boolean;
  renderMouseTrailInVideo: boolean;
  mouseAnomalyDetectionEnabled: boolean;
  mouseSpeedThresholdMultiplier: number; // e.g. 2.0x baseline speed
  customRules: AutoDeployConditionRule[];
}

export interface OverseerLearnedNote {
  id: string;
  timestamp: string;
  category: 'ui_pattern' | 'drift_correction' | 'modal_dismiss' | 'tab_navigation' | 'element_anchor' | 'emergency';
  title: string;
  observation: string;
  confidence: number;
  actionTaken?: string;
  frameDifferenceScore?: number;
}

export interface CorrectedTrajectoryWaypoint {
  x: number;
  y: number;
  speed: number;
  timestampOffsetMs: number;
  label: string;
}

export interface OverseerNudge {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'emergency' | 'tip';
  suggestedAction?: {
    label: string;
    step: Partial<WorkflowStep>;
  };
  targetTab?: 'my-drive' | 'starred' | 'trash' | 'analytics' | 'execution-analytics';
  dismissed?: boolean;
  elementTimeoutDetails?: {
    expectedSelector: string;
    stepId?: string;
    stepTitle?: string;
    timeoutMs: number;
    timeElapsed: number;
    currentTab?: string;
    targetTab?: string;
    potentialReason?: string;
  };
  pathAnomalyDetails?: {
    currentSpeed: number;
    baselineSpeed: number;
    deviationPercentage: number;
    anomalyType: 'too_fast' | 'too_slow';
    stepTitle?: string;
    targetSelector?: string;
    originalCoords?: { x: number; y: number };
    correctedWaypoints: CorrectedTrajectoryWaypoint[];
    correctionMethod: 'cubic_bezier_smoothing' | 'historical_cluster_realign';
    applied?: boolean;
  };
}
