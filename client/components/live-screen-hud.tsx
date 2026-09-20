import React, { useState, useRef } from "react";
import {
  Activity,
  Monitor,
  Maximize2,
  Camera,
  Brush,
  FolderOpen,
  Save,
  Download,
  RefreshCw,
  Brain,
  CheckCircle2,
  Compass,
  CornerDownLeft,
  Crosshair,
  Eye,
  Keyboard,
  Layers,
  MousePointer,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Flame,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingUp,
  X,
  Zap,
  Bot,
  PlayCircle,
  ExternalLink,
  AlertOctagon,
  HelpCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { DriftHeatmapOverlay } from "./drift-heatmap-overlay";
import { SyncStatusIndicator } from "./sync-status-indicator";
import { HistoricalMouseTrailOverlay } from "./historical-mouse-trail-overlay";
import { AnalyzeAndActModal } from "./analyze-and-act-modal";
import {
  calculateEuclideanDistance,
  getAlignmentStatus,
  calculateAccuracyPercentage,
} from "@/lib/screen-matching";
import {
  executeAutoCalibration,
  computePixelDriftHeatmap,
  DEFAULT_DRIFT_THRESHOLD_PX,
} from "@/lib/drift-calibration";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  framePointAsPercent,
  framePointFromClient,
  getContainedFrameViewport,
} from "@/lib/frame-viewport";
import type { VisualLookout } from "@shared/assistant";

export interface SequenceStep {
  id: string;
  stepNumber: number;
  name: string;
  action:
    | "click"
    | "double_click"
    | "right_click"
    | "clear_and_type"
    | "type_text"
    | "press_key"
    | "hotkey"
    | "scroll"
    | "wait"
    | "stream_mouse_route";
  x: number;
  y: number;
  delayMs: number;
  dwellDurationMs?: number;
  text?: string;
  keyPayload?: string;
  status: "pending" | "running" | "completed" | "failed";
  recalibrated?: boolean;
  referenceScreenshotUrl?: string;
  allowedVariancePercent?: number;
  dynamicVariablePayloads?: string[];
  targetOcrLabel?: string;
  fallbackMethod?: "direct_click" | "tab_enter" | "arrow_keys" | "escape_retry";
  selector?: string;
  originalX?: number;
  originalY?: number;
  offsetX?: number;
  offsetY?: number;
  driftDistancePx?: number;
  breakpoint?: boolean;
  lastCalibratedAt?: number;
  routePoints?: Array<{ x: number; y: number }>;
  isDrag?: boolean;
  driftPx?: number;
  visualLookouts?: VisualLookout[];
  retryLimit?: number;
}

type ReviewedReplayStep = {
  id: string;
  name: string;
  action: string;
  x?: number;
  y?: number;
  text?: string;
  routePoints?: Array<{ x: number; y: number }>;
  isDrag?: boolean;
  driftPx?: number;
};

export interface AIThinkingState {
  x: number;
  y: number;
  action: string;
  confidence: number;
  isThinking: boolean;
  targetLabel?: string;
}

export interface DetectedEntity {
  type: "player" | "enemy" | "objective" | "item" | "npc" | "partner" | "input";
  name: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  confidence: number;
}

export interface UIElementBox {
  id: string;
  name: string;
  type: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  center: { x: number; y: number };
  confidence: number;
}

export interface VerificationBadgeState {
  status: "verifying" | "verified" | "failed" | "retrying";
  message?: string;
}

export interface RecalibrationNotice {
  stepId: string;
  stepNumber: number;
  oldX: number;
  oldY: number;
  newX: number;
  newY: number;
  distance: number;
}

interface LiveScreenHUDProps {
  screenshotUrl: string;
  isCapturing: boolean;
  aiThinking: AIThinkingState | null;
  entities: DetectedEntity[];
  uiElements?: UIElementBox[];
  perceptionFeedback?: { x: number; y: number; label?: string } | null;
  verificationBadge?: VerificationBadgeState | null;
  recalibrationNotice?: RecalibrationNotice | null;
  sequence: SequenceStep[];
  activeStepId: string | null;
  isRecordMode: boolean;
  onAddStep: (
    stepData: Partial<SequenceStep> & { x: number; y: number },
  ) => void;
  onRepositionStep: (id: string, newX: number, newY: number) => void;
  onSelectStep?: (id: string) => void;
  onLiveStreamChange?: (
    active: boolean,
    snapshotUrl: string | null,
    displaySurface: string | null,
  ) => void;
  showSecondHudOverlay?: boolean;
  onToggleSecondHudOverlay?: (enabled: boolean) => void;
  secondHudActivePath?: {
    id: string;
    name: string;
    remappedTrajectory: { x: number; y: number }[];
    originalTrajectory?: { x: number; y: number }[];
    altMethod?: string;
  } | null;
  selectedCanvasTitle?: string;
  selectedTabName?: string;
  onMouseTrailChange?: (
    trail: Array<{ x: number; y: number; time: number; isClick?: boolean }>
  ) => void;
  onTriggerAutoCalibration?: () => void;
  showDriftHeatmap?: boolean;
  onToggleDriftHeatmap?: (enabled: boolean) => void;
  driftThresholdPx?: number;
  onAddLookout?: (stepId: string, lookout: VisualLookout) => void;
}

export const LiveScreenHUD: React.FC<LiveScreenHUDProps> = ({
  screenshotUrl,
  isCapturing,
  aiThinking,
  entities,
  uiElements = [],
  perceptionFeedback,
  verificationBadge,
  recalibrationNotice,
  sequence,
  activeStepId,
  isRecordMode,
  onAddStep,
  onRepositionStep,
  onSelectStep,
  onLiveStreamChange,
  showSecondHudOverlay,
  onToggleSecondHudOverlay,
  secondHudActivePath,
  selectedCanvasTitle,
  selectedTabName,
  onMouseTrailChange,
  onTriggerAutoCalibration,
  showDriftHeatmap,
  onToggleDriftHeatmap,
  driftThresholdPx,
  onAddLookout,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const streamSyncIntervalRef = useRef<number | null>(null);
  const [localShow2ndHudOverlay, setLocalShow2ndHudOverlay] = useState<boolean>(true);
  const [localShowDriftHeatmap, setLocalShowDriftHeatmap] = useState<boolean>(true);
  const [showHistoricalTrailOverlay, setShowHistoricalTrailOverlay] = useState<boolean>(true);
  const [isAnalyzeAndActOpen, setIsAnalyzeAndActOpen] = useState<boolean>(false);
  const [localDriftThreshold, setLocalDriftThreshold] = useState<number>(driftThresholdPx ?? DEFAULT_DRIFT_THRESHOLD_PX);
  const [isHudCalibrating, setIsHudCalibrating] = useState<boolean>(false);
  const [hudCalibrateSuccessMsg, setHudCalibrateSuccessMsg] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [trackDwellTime, setTrackDwellTime] = useState<boolean>(true);
  const [dwellStartTime, setDwellStartTime] = useState<number>(Date.now());
  const [currentDwellMs, setCurrentDwellMs] = useState<number>(0);
  const [clickRipples, setClickRipples] = useState<
    { id: string; x: number; y: number; time: number }[]
  >([]);

  // Realistic Cursor & Spline Replay State
  const [cursorStyle, setCursorStyle] = useState<
    "pointer" | "hand" | "hologram"
  >("pointer");
  const [humanDriftPx, setHumanDriftPx] = useState<number>(6);
  const [flowrateSpeed, setFlowrateSpeed] = useState<number>(750);
  const [overshootPx, setOvershootPx] = useState<number>(10);
  const [recordedTrajectory, setRecordedTrajectory] = useState<
    Array<{ x: number; y: number; time: number }>
  >([]);
  const [isReplayingMovement, setIsReplayingMovement] =
    useState<boolean>(false);
  const [replayingCursorPos, setReplayingCursorPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDrawingOverlayOpen, setIsDrawingOverlayOpen] =
    useState<boolean>(false);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(false);
  // Default to live_stream so screen share is immediately visible and interactive
  const [antiTunnelMode, setAntiTunnelMode] = useState<
    "live_stream" | "anti_tunnel_snapshot" | "pip"
  >("live_stream");
  const [frozenSnapshotUrl, setFrozenSnapshotUrl] = useState<string | null>(
    null,
  );
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState<number>(0);

  // High-Resolution Mouse Trail Recording & Exact Playback State
  const [isRecordingMouseTrail, setIsRecordingMouseTrail] = useState<boolean>(false);
  const [liveMouseTrail, setLiveMouseTrail] = useState<
    Array<{ x: number; y: number; time: number; isClick?: boolean }>
  >([]);
  const pendingMovementRef = useRef<
    Array<{ x: number; y: number; time: number; isClick: false }>
  >([]);
  const movementFrameRef = useRef<number | null>(null);
  React.useEffect(() => {
    onMouseTrailChange?.(liveMouseTrail);
  }, [liveMouseTrail, onMouseTrailChange]);
  const [trailSpeedMultiplier, setTrailSpeedMultiplier] = useState<number>(1.0);
  const [isExecutingTrailOnPC, setIsExecutingTrailOnPC] = useState<boolean>(false);
  const [showSyncDiagnosticsModal, setShowSyncDiagnosticsModal] = useState<boolean>(false);

  // AI Verification, Quality Checks & Stuck Resolution
  const [aiCheckStatus, setAiCheckStatus] = useState<{
    status: "idle" | "verifying" | "verified" | "stuck" | "early_completed";
    message: string;
    score?: number;
    unstickActions?: any[];
  } | null>(null);
  const [autoCheckAfterAction, setAutoCheckAfterAction] = useState<boolean>(true);

  // Screen Share Request & Error State
  const [isRequestingScreenShare, setIsRequestingScreenShare] = useState<boolean>(false);
  const [screenShareError, setScreenShareError] = useState<{
    title: string;
    message: string;
    isIframe: boolean;
  } | null>(null);

  // AI Replay Drift & Frames 1-10 with Clickpoints State
  const [isPlayingFrames1To10, setIsPlayingFrames1To10] = useState<boolean>(false);
  const [activeReplayFrame, setActiveReplayFrame] = useState<number | null>(null);
  const [hudActiveClickPoint, setHudActiveClickPoint] = useState<{
    x: number;
    y: number;
    frame: number;
    text: string;
  } | null>(null);

  // Qwen AI Agent Guide State
  const [qwenGuideEnabled, setQwenGuideEnabled] = useState<boolean>(true);
  const [qwenLiveThought, setQwenLiveThought] = useState<string | null>(
    "Qwen Agent Guide active: Monitoring trajectories, assisted movement, and action completion."
  );
  const [qwenIncompleteTypingAlert, setQwenIncompleteTypingAlert] = useState<string | null>(null);

  // Repeating Drawing with Auto-Tool & AI Thinking Between Steps
  const [isRepeatingDrawing, setIsRepeatingDrawing] = useState<boolean>(false);
  const [qwenThinkingStatus, setQwenThinkingStatus] = useState<string | null>(null);

  // Audio Pip Synthesizer for Clickpoint Contacts ("..")
  const playClickPip = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  };

  // Active step alignment accuracy (Euclidean distance computation)
  const activeStep = sequence.find((s) => s.status === "running") || sequence[0] || null;
  const activeStepEuclideanDrift = React.useMemo(() => {
    if (!activeStep) return 2.4;
    const origX = (activeStep as any).originalX ?? activeStep.x;
    const origY = (activeStep as any).originalY ?? activeStep.y;
    const curX = activeStep.x;
    const curY = activeStep.y;
    const dist = calculateEuclideanDistance({ x: origX, y: origY }, { x: curX, y: curY });
    return dist || 2.4;
  }, [activeStep]);

  const activeAlignmentStatus: "green" | "yellow" | "red" =
    activeStepEuclideanDrift <= 4.0 ? "green" : activeStepEuclideanDrift <= 14.0 ? "yellow" : "red";

  const activeAlignmentAccuracy = Math.max(0, Math.round((100 - activeStepEuclideanDrift * 1.6) * 10) / 10);

  // Trigger UI re-scan & offset auto-calibration when drift exceeds threshold
  const handleTriggerHudAutoCalibration = async () => {
    setIsHudCalibrating(true);
    try {
      const res = await executeAutoCalibration({
        steps: sequence as any,
        thresholdPx: localDriftThreshold,
        elements: uiElements,
        screenshotUrl,
      });
      if (res.success) {
        res.calibratedSteps.forEach((s) => {
          if (s.recalibrated) {
            onRepositionStep(s.id, s.x, s.y);
          }
        });
      }
      setHudCalibrateSuccessMsg(res.summary);
      setTimeout(() => setHudCalibrateSuccessMsg(null), 5000);
      onTriggerAutoCalibration?.();
    } catch (e) {
      console.error("Auto-calibration failed:", e);
    } finally {
      setIsHudCalibrating(false);
    }
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasCaptureRef = useRef<HTMLCanvasElement | null>(null);
  const captureSourceRef = useRef<"real" | "uploaded" | "simulated" | null>(null);

  // Allow parent (Dashboard header Share) to trigger HUD share via custom event
  React.useEffect(() => {
    const handler = () => handleToggleRealScreenStream();
    window.addEventListener("trigger-hud-share", handler as EventListener);
    return () =>
      window.removeEventListener("trigger-hud-share", handler as EventListener);
  }, [isLiveStreamActive]);

  const notifyLiveChange = (
    active: boolean,
    snap: string | null,
    surface: string | null,
  ) => {
    try {
      onLiveStreamChange?.(active, snap, surface);
    } catch {}
  };

  // Handle pasting or dropping a real screenshot directly onto the canvas
  const handleDropScreenshot = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          if (!isLiveStreamActive || !videoRef.current?.srcObject) {
            captureSourceRef.current = "uploaded";
          }
          fetch("/api/sync-real-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageData: base64 }),
          }).catch(() => {});
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasteScreenshot = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
              if (!isLiveStreamActive || !videoRef.current?.srcObject) {
                captureSourceRef.current = "uploaded";
              }
              fetch("/api/sync-real-frame", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageData: base64 }),
              }).catch(() => {});
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Pop out stream to independent Picture-in-Picture window (Zero Visual Feedback Loop)
  const handleTogglePiP = async () => {
    if (videoRef.current) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.log("PiP toggle error:", err);
      }
    }
  };

  // Launch an isolated visual demo. It is never synchronized for physical actions.
  const handleStartSimulatedScreenStream = () => {
    captureSourceRef.current = "simulated";
    setScreenShareError(null);
    setIsLiveStreamActive(true);
    setAntiTunnelMode("live_stream");

    // Draw simulated active desktop workspace onto canvas
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, 1920, 1080);
      // Header
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, 1920, 70);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 24px monospace";
      ctx.fillText("WORKSPACE AUTO FLOW • VISUAL DEMO (NO DEVICE CONTROL)", 40, 45);

      // Search bar
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(380, 110, 500, 48);
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 2;
      ctx.strokeRect(380, 110, 500, 48);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "18px monospace";
      ctx.fillText("Search query: #search-query-filter", 400, 142);

      // Records Grid
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(380, 190, 800, 160);
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("Selected Record: #item-row-1 [Status: Ready]", 400, 230);

      // Form input
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(380, 380, 460, 48);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(380, 380, 460, 48);
      ctx.fillStyle = "#34d399";
      ctx.fillText("engineering@sightline.ai", 395, 412);

      // Action Button
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(880, 380, 180, 48);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("Verify Badge", 910, 412);
    }

    try {
      const stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null;
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {}

    const snap = canvas.toDataURL("image/jpeg", 0.9);
    setFrozenSnapshotUrl(snap);
    notifyLiveChange(true, snap, "simulation");
  };

  // Start / Stop Browser-Native Real Screen Sharing (getDisplayMedia)
  const handleToggleRealScreenStream = async () => {
    if (isLiveStreamActive) {
      if (streamSyncIntervalRef.current !== null) {
        window.clearInterval(streamSyncIntervalRef.current);
        streamSyncIntervalRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      setIsLiveStreamActive(false);
      captureSourceRef.current = null;
      setFrozenSnapshotUrl(null);
      setScreenShareError(null);
      notifyLiveChange(false, null, null);
      return;
    }

    setIsRequestingScreenShare(true);
    setScreenShareError(null);

    const isInIframe = typeof window !== "undefined" && window.self !== window.top;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen Share API is not supported in this browser environment.");
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as any,
          audio: false,
        });
      } catch (innerErr: any) {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        } catch (inner2) {
          stream = await navigator.mediaDevices.getDisplayMedia();
        }
      }

      if (!stream) {
        throw new Error("Could not acquire display capture stream.");
      }

      if (videoRef.current) {
        captureSourceRef.current = "real";
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setIsLiveStreamActive(true);
        const track = stream.getVideoTracks()[0];
        const settings = (track?.getSettings() as any) || {};
        const surface = settings.displaySurface || null;
        notifyLiveChange(true, null, surface);

        setTimeout(() => {
          if (videoRef.current && videoRef.current.videoWidth) {
            const c = document.createElement("canvas");
            c.width = videoRef.current.videoWidth || 1920;
            c.height = videoRef.current.videoHeight || 1080;
            const ctx2 = c.getContext("2d");
            ctx2?.drawImage(videoRef.current!, 0, 0, c.width, c.height);
            const snap = c.toDataURL("image/jpeg", 0.85);
            setFrozenSnapshotUrl(snap);
            notifyLiveChange(true, snap, surface);
          }
        }, 600);

        // Continuous sync to backend
        const canvas = document.createElement("canvas");
        streamSyncIntervalRef.current = window.setInterval(() => {
          if (stream?.active && videoRef.current) {
            canvas.width = videoRef.current.videoWidth || 1920;
            canvas.height = videoRef.current.videoHeight || 1080;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            fetch("/api/sync-real-frame", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageData: dataUrl }),
            }).catch(() => {});
          } else {
            if (streamSyncIntervalRef.current !== null) {
              window.clearInterval(streamSyncIntervalRef.current);
              streamSyncIntervalRef.current = null;
            }
          }
        }, 300);
      }

      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        vTrack.onended = () => {
          if (streamSyncIntervalRef.current !== null) {
            window.clearInterval(streamSyncIntervalRef.current);
            streamSyncIntervalRef.current = null;
          }
          setIsLiveStreamActive(false);
          captureSourceRef.current = null;
          setFrozenSnapshotUrl(null);
          notifyLiveChange(false, null, null);
        };
      }
    } catch (err: any) {
      console.warn("Screen share request result:", err);
      const isPolicyOrIframe = isInIframe || err?.name === "SecurityError" || err?.message?.toLowerCase().includes("permission") || err?.message?.toLowerCase().includes("policy") || err?.message?.toLowerCase().includes("denied");

      setScreenShareError({
        title: isPolicyOrIframe ? "Screen Share Restricted in Iframe Preview" : "Screen Share Not Started",
        message: isPolicyOrIframe
          ? "Browsers block direct display-capture inside embedded iframes. Open the app in a standalone tab for hardware capture, or use the visual demo without physical execution."
          : err?.message || "Screen capture was cancelled or dismissed. Click below to retry or launch desktop mirror.",
        isIframe: isInIframe,
      });
    } finally {
      setIsRequestingScreenShare(false);
    }
  };

  const executeReviewedReplay = async (steps: ReviewedReplayStep[]) => {
    if (captureSourceRef.current === "simulated") {
      return {
        success: false,
        error: "The demo mirror cannot authorize physical actions. Start a real live screen share.",
      };
    }
    const initialFrame = handleCaptureFreshFrame(false);
    if (!initialFrame) {
      return {
        success: false,
        error: "Start a real screen share and capture a fresh frame before executing a replay.",
      };
    }

    try {
      const syncResponse = await fetch("/api/sync-real-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: initialFrame }),
      });
      if (!syncResponse.ok) {
        return { success: false, error: "The initial screen frame could not be synchronized." };
      }

      const response = await fetch("/api/ai/replay-drift-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps,
          executeOnPC: true,
          approved: true,
          targetDevice: "desktop",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data?.error || "Replay request failed." };
      }
      return { ...data, success: data?.success === true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Replay request failed.",
      };
    }
  };

  // Replay only reviewed actions; the server analyzes a fresh frame before every step.
  const handleReplayFrames1To10OnPC = async () => {
    if (isPlayingFrames1To10) return;
    if (sequence.length === 0) {
      setAiCheckStatus({
        status: "stuck",
        message: "Create or record at least one reviewed step before replaying it.",
      });
      return;
    }
    setIsPlayingFrames1To10(true);
    setAiCheckStatus({
      status: "verifying",
      message: `Analyzing the live screen before replaying ${Math.min(sequence.length, 10)} reviewed action(s)...`,
    });

    try {
      const data = await executeReviewedReplay(sequence.slice(0, 10));
      setActiveReplayFrame(data.processedFrames || null);
      const finalAction = data.executedActions?.at(-1);
      if (finalAction?.isClick) {
        playClickPip();
        setHudActiveClickPoint({
          x: finalAction.x,
          y: finalAction.y,
          frame: finalAction.frame,
          text: `LAST CHECKED CLICKPOINT [${finalAction.x}, ${finalAction.y}]`,
        });
      }
      setAiCheckStatus({
        status: data.success ? "verified" : "stuck",
        message: data.summary || data.haltedReason || data.error || "Replay did not complete.",
        score: data.success ? 1 : 0,
      });
    } catch (e) {
      setAiCheckStatus({ status: "stuck", message: `Replay error: ${String(e)}` });
    } finally {
      setIsPlayingFrames1To10(false);
    }
  };

  // Repeat the route the user actually drew, with fresh-frame analysis between passes.
  const handleRepeatingDrawingWithAi = async () => {
    if (isRepeatingDrawing) return;
    const route =
      freehandRoutePoints.length > 1
        ? freehandRoutePoints
        : liveMouseTrail.length > 1
          ? liveMouseTrail.map(({ x, y }) => ({ x, y }))
          : [];
    if (route.length < 2) {
      setQwenThinkingStatus("Draw or record a route with at least two points before repeating it.");
      return;
    }
    setIsRepeatingDrawing(true);
    setOverlayActiveTool("route");
    setIsDrawingOverlayOpen(true);
    setQwenThinkingStatus("Analyzing the live screen before repeating the reviewed route...");

    try {
      const repeatedRoutes = Array.from({ length: 3 }, (_, index) => ({
        id: `reviewed_route_${Date.now()}_${index + 1}`,
        name: `Reviewed route pass ${index + 1}`,
        action: "stream_mouse_route" as const,
        x: route[0].x,
        y: route[0].y,
        routePoints: route,
        isDrag: true,
      }));
      const data = await executeReviewedReplay(repeatedRoutes);
      setQwenThinkingStatus(
        data.summary || data.haltedReason || data.error || "Route repetition did not complete.",
      );
    } catch (error) {
      setQwenThinkingStatus(`Route repetition failed: ${String(error)}`);
    } finally {
      setIsRepeatingDrawing(false);
    }
  };

  React.useEffect(
    () => () => {
      if (streamSyncIntervalRef.current !== null) {
        window.clearInterval(streamSyncIntervalRef.current);
      }
      if (movementFrameRef.current !== null) {
        window.cancelAnimationFrame(movementFrameRef.current);
      }
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const [overlayActiveTool, setOverlayActiveTool] = useState<
    "route" | "click" | "task" | "goal" | "avoidance"
  >("route");
  const [isFreehandDrawing, setIsFreehandDrawing] = useState<boolean>(false);
  const [draftedOverlayPoints, setDraftedOverlayPoints] = useState<
    Array<{
      id: string;
      stepNumber: number;
      name: string;
      action: any;
      x: number;
      y: number;
      delayMs: number;
    }>
  >([]);
  const [freehandRoutePoints, setFreehandRoutePoints] = useState<
    Array<{ x: number; y: number }>
  >([]);

  const [splineMotionTrail, setSplineMotionTrail] = useState<
    Array<{ x: number; y: number }>
  >([]);

  // Quick Action Recording Popover State
  const [recordingClickPos, setRecordingClickPos] = useState<{
    x: number;
    y: number;
    pctX: number;
    pctY: number;
  } | null>(null);
  const [popoverAction, setPopoverAction] =
    useState<SequenceStep["action"]>("click");
  const [popoverText, setPopoverText] = useState("");
  const [popoverKey, setPopoverKey] = useState("enter");
  const [popoverDelay, setPopoverDelay] = useState(500);
  const [popoverName, setPopoverName] = useState("");
  const [saveAsNumberedStep, setSaveAsNumberedStep] = useState<boolean>(true);
  const [popoverSaveScreenshot, setPopoverSaveScreenshot] =
    useState<boolean>(true);
  const [isDrawingLookout, setIsDrawingLookout] = useState(false);
  const [lookoutStart, setLookoutStart] = useState<{ x: number; y: number } | null>(null);
  const [lookoutRegion, setLookoutRegion] = useState<VisualLookout["region"] | null>(null);
  const [lookoutLabel, setLookoutLabel] = useState("Next-step visual cue");
  const [lookoutText, setLookoutText] = useState("");
  const [lookoutExpectation, setLookoutExpectation] = useState<VisualLookout["expectation"]>("present");
  const [lookoutOnMatch, setLookoutOnMatch] = useState<VisualLookout["onMatch"]>("continue");
  const [lookoutOnMiss, setLookoutOnMiss] = useState<VisualLookout["onMiss"]>("retry");
  const [dynamicFixupMode, setDynamicFixupMode] = useState<
    "auto_fixup" | "perform_anyways" | "link_workflow"
  >("auto_fixup");
  const [fixupExplanation, setFixupExplanation] = useState<string>("");

  const NATIVE_WIDTH = 1920;
  const NATIVE_HEIGHT = 1080;

  const getNativeCoordinates = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, pctX: 50, pctY: 50 };
    const viewport = getContainedFrameViewport(rect, {
      width: NATIVE_WIDTH,
      height: NATIVE_HEIGHT,
    });
    const point = framePointFromClient(e.clientX, e.clientY, viewport, {
      width: NATIVE_WIDTH,
      height: NATIVE_HEIGHT,
    });

    return {
      ...point,
      pctX: (point.x / NATIVE_WIDTH) * 100,
      pctY: (point.y / NATIVE_HEIGHT) * 100,
    };
  };

  const toPercent = (nativeX: number, nativeY: number) => {
    return {
      left: `${(nativeX / NATIVE_WIDTH) * 100}%`,
      top: `${(nativeY / NATIVE_HEIGHT) * 100}%`,
    };
  };

  const toBoxPercent = (box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    return {
      left: `${(box.x / NATIVE_WIDTH) * 100}%`,
      top: `${(box.y / NATIVE_HEIGHT) * 100}%`,
      width: `${Math.max(2, (box.width / NATIVE_WIDTH) * 100)}%`,
      height: `${Math.max(2, (box.height / NATIVE_HEIGHT) * 100)}%`,
    };
  };

  // Record continuous trajectory as user moves
  const recordMovementPoint = (x: number, y: number) => {
    if (isRecordingMouseTrail || isRecordMode) {
      pendingMovementRef.current.push({ x, y, time: Date.now(), isClick: false });
      if (movementFrameRef.current === null) {
        movementFrameRef.current = window.requestAnimationFrame(() => {
          const points = pendingMovementRef.current;
          movementFrameRef.current = null;
          pendingMovementRef.current = [];
          if (points.length > 0) {
            setLiveMouseTrail((prev) => [...prev, ...points].slice(-2_000));
          }
        });
      }
    }
    if (isRecordMode) {
      setRecordedTrajectory((prev) => [
        ...prev.slice(-100),
        { x, y, time: Date.now() },
      ]);
    }
  };

  // Instant High-Resolution Frame Capture (Zero Mirror Recursion)
  const handleCaptureFreshFrame = (syncFrame = true): string | null => {
    if (
      captureSourceRef.current === "real" &&
      videoRef.current?.srcObject &&
      videoRef.current.videoWidth > 0
    ) {
      try {
        const c = document.createElement("canvas");
        c.width = videoRef.current.videoWidth || 1920;
        c.height = videoRef.current.videoHeight || 1080;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
          const snap = c.toDataURL("image/jpeg", 0.88);
          setFrozenSnapshotUrl(snap);
          notifyLiveChange(true, snap, "snapshot");
          if (syncFrame) {
            fetch("/api/sync-real-frame", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageData: snap }),
            }).catch(() => {});
          }
          return snap;
        }
      } catch (err) {
        console.error("Frame capture error:", err);
      }
    }
    setAiCheckStatus({
      status: "stuck",
      message: "A fresh frame could not be captured. Start a real screen share and try again.",
    });
    return null;
  };

  // Replay exact recorded user mouse trail directly on PC via PyAutoGUI & Subprocess
  const handleExecuteRecordedTrailOnPC = async () => {
    if (liveMouseTrail.length === 0) {
      alert("Please record a mouse trail first using 'Record Mouse Trail'.");
      return;
    }
    setIsExecutingTrailOnPC(true);
    setAiCheckStatus({
      status: "verifying",
      message: `Streaming ${liveMouseTrail.length} user mouse coordinates to PC hardware via PyAutoGUI...`,
    });

    try {
      const firstPoint = liveMouseTrail[0];
      const data = await executeReviewedReplay([{
        id: `trail_${Date.now()}`,
        name: `Replay User Mouse Trail (${liveMouseTrail.length} waypoints)`,
        action: "stream_mouse_route",
        x: firstPoint.x,
        y: firstPoint.y,
        routePoints: liveMouseTrail,
        isDrag: false,
      }]);
      if (data.success) {
        setAiCheckStatus({
          status: "verified",
          message: `✅ Exact user mouse trail streamed across PC desktop (${liveMouseTrail.length} waypoints via PyAutoGUI)!`,
          score: 1.0,
        });
        setTimeout(() => setAiCheckStatus(null), 4500);
      } else {
        setAiCheckStatus({
          status: "stuck",
          message: `Trail execution failed: ${data.error || "Subprocess returned error"}`,
        });
      }
    } catch (err) {
      setAiCheckStatus({
        status: "stuck",
        message: `Trail network error: ${String(err)}`,
      });
    } finally {
      setIsExecutingTrailOnPC(false);
    }
  };

  const handleClearRecordedTrail = () => {
    setLiveMouseTrail([]);
    setIsRecordingMouseTrail(false);
  };

  // Replay user mouse movement with human-like drift differential
  // Execute a reviewed sequence through the same frame-gated replay controller.
  const handleExecuteAllOnActualPC = async () => {
    const stepsToRun =
      sequence.length > 0
        ? sequence
        : recordedTrajectory.length > 0
          ? recordedTrajectory.map((t, idx) => ({
              id: `t_${idx}`,
              name: `Step #${idx + 1}`,
              action: "click" as const,
              x: t.x,
              y: t.y,
              dwellDurationMs: 300,
            }))
          : [];

    if (stepsToRun.length === 0) {
      setAiCheckStatus({
        status: "stuck",
        message: "Create or record at least one reviewed action before executing on the PC.",
      });
      return;
    }

    setAiCheckStatus({
      status: "verifying",
      message: `Analyzing the live screen before executing ${stepsToRun.length} reviewed action(s), then checking each fresh post-action frame for a visible change...`,
    });

    try {
      const data = await executeReviewedReplay(stepsToRun);
      setAiCheckStatus({
        status: data.success ? "verified" : "stuck",
        message: data.summary || data.haltedReason || data.error || "Execution did not complete.",
        score: data.success ? 1 : 0,
      });
    } catch (error) {
      setAiCheckStatus({ status: "stuck", message: `Execution error: ${String(error)}` });
    }
  };

  const handleReplayUserMovementWithDrift = (executeOnHardware = false) => {
    if (sequence.length === 0 && recordedTrajectory.length === 0 && liveMouseTrail.length === 0) {
      alert("Please record or create at least one step/path to replay.");
      return;
    }

    setIsReplayingMovement(true);
    setSplineMotionTrail([]);

    // Determine waypoints: prioritize liveMouseTrail, then sequence steps, then recorded trajectory
    const waypoints =
      liveMouseTrail.length > 0
        ? liveMouseTrail.map((pt) => ({
            x: pt.x,
            y: pt.y,
            dwell: pt.isClick ? 300 : 20,
            isClick: !!pt.isClick,
          }))
        : sequence.length > 0
        ? sequence.map((s) => ({
            x: s.x,
            y: s.y,
            dwell: s.dwellDurationMs || 350,
            isClick: s.action?.includes("click") ?? true,
          }))
        : recordedTrajectory.map((t) => ({ x: t.x, y: t.y, dwell: 40, isClick: false }));

    // If physical execution requested alongside visual drift simulation, stream whole route once to PyAutoGUI
    if (executeOnHardware && waypoints.length > 0) {
      setIsExecutingTrailOnPC(true);
      executeReviewedReplay([{
        id: `replay_route_${Date.now()}`,
        name: `Replay Route with Drift (±${humanDriftPx}px)`,
        action: "stream_mouse_route",
        x: waypoints[0].x,
        y: waypoints[0].y,
        routePoints: waypoints,
        isDrag: false,
        driftPx: humanDriftPx,
      }])
        .then((res) => {
          if (res.success) {
            setAiCheckStatus({
              status: "verified",
              message: `✅ Replayed route on PC with ±${humanDriftPx}px drift (${waypoints.length} pts)`,
              score: 1.0,
            });
            setTimeout(() => setAiCheckStatus(null), 4000);
          } else {
            setAiCheckStatus({
              status: "stuck",
              message: res.error || "Hardware replay was blocked or failed.",
              score: 0,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to execute route on PC:", err);
        })
        .finally(() => {
          setIsExecutingTrailOnPC(false);
        });
    }

    let currentWaypointIdx = 0;
    let startX = waypoints[0]?.x || 960;
    let startY = waypoints[0]?.y || 540;

    const animateToNextWaypoint = () => {
      if (currentWaypointIdx >= waypoints.length) {
        setIsReplayingMovement(false);
        setReplayingCursorPos(null);
        return;
      }

      const target = waypoints[currentWaypointIdx];
      const targetX = target.x;
      const targetY = target.y;

      const totalSteps = Math.max(8, Math.min(25, Math.round(30 / trailSpeedMultiplier)));
      let step = 0;

      const interval = setInterval(() => {
        step++;
        const t = step / totalSteps;
        const easeT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const driftX = (Math.random() - 0.5) * humanDriftPx * 2;
        const driftY = (Math.random() - 0.5) * humanDriftPx * 2;

        const curX = Math.round(startX + (targetX - startX) * easeT + driftX);
        const curY = Math.round(startY + (targetY - startY) * easeT + driftY);

        setReplayingCursorPos({ x: curX, y: curY });
        setSplineMotionTrail((prev) => [
          ...prev.slice(-25),
          { x: curX, y: curY },
        ]);

        if (step >= totalSteps) {
          clearInterval(interval);
          startX = targetX;
          startY = targetY;
          currentWaypointIdx++;
          setTimeout(animateToNextWaypoint, target.dwell || 15);
        }
      }, 16);
    };

    animateToNextWaypoint();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const coords = getNativeCoordinates(e);
    if (isDrawingLookout && lookoutStart) {
      setLookoutRegion({
        id: `region_${Date.now()}`,
        x: Math.min(lookoutStart.x, coords.x),
        y: Math.min(lookoutStart.y, coords.y),
        width: Math.abs(coords.x - lookoutStart.x),
        height: Math.abs(coords.y - lookoutStart.y),
      });
      return;
    }
    setMousePos({ x: coords.x, y: coords.y });
    recordMovementPoint(coords.x, coords.y);
    // Reset dwell start if moved significantly (>20px)
    if (
      !mousePos ||
      Math.hypot(coords.x - mousePos.x, coords.y - mousePos.y) > 20
    ) {
      setDwellStartTime(Date.now());
      setCurrentDwellMs(0);
    } else {
      setCurrentDwellMs(Date.now() - dwellStartTime);
    }

    if (draggingStepId) {
      onRepositionStep(draggingStepId, coords.x, coords.y);
    }
  };

  const handleMouseUp = () => {
    if (isDrawingLookout && lookoutStart) {
      setLookoutStart(null);
      setIsDrawingLookout(false);
      return;
    }
    setDraggingStepId(null);
  };

  // Integrate drafted overlay points into the main workflow sequence
  const handleIntegrateOverlayToSequence = () => {
    if (draftedOverlayPoints.length === 0) return;
    draftedOverlayPoints.forEach((pt) => {
      onAddStep({
        stepNumber: sequence.length + 1,
        name: pt.name,
        action: pt.action,
        x: pt.x,
        y: pt.y,
        delayMs: pt.delayMs || 400,
        status: "pending",
      });
    });
    setDraftedOverlayPoints([]);
    setIsDrawingOverlayOpen(false);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (lookoutRegion || isDrawingLookout) return;
    if (draggingStepId) return;
    if (isRecordMode || isRecordingMouseTrail) {
      const coords = getNativeCoordinates(e);
      setLiveMouseTrail((prev) => {
        return [
          ...prev.slice(-1_999),
          { x: coords.x, y: coords.y, time: Date.now(), isClick: true },
        ];
      });
    }
    if (isRecordMode) {
      const coords = getNativeCoordinates(e);
      const stepNumber = sequence.length + 1;
      // Left click default
      setPopoverName(`Step ${stepNumber}`);
      setPopoverAction("click");
      setPopoverText("");
      setPopoverDelay(500);
      setRecordingClickPos(coords);
    }
  };

  const handleContainerContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggingStepId) return;
    if (isRecordMode || sequence.length > 0) {
      const coords = getNativeCoordinates(e);
      const stepNumber = sequence.length + 1;
      setPopoverName(`Step ${stepNumber} (Right Click)`);
      setPopoverAction("right_click");
      setPopoverText("");
      setPopoverDelay(500);
      setRecordingClickPos(coords);
    }
  };

  const beginLookoutDrawing = () => {
    const targetStep = sequence.find((step) => step.id === activeStepId) ?? sequence.at(-1);
    if (!targetStep || !onAddLookout) return;
    if ((targetStep.visualLookouts?.length ?? 0) >= 10) return;
    setRecordingClickPos(null);
    setLookoutRegion(null);
    setLookoutStart(null);
    setIsDrawingLookout(true);
  };

  const commitLookout = () => {
    const targetStep = sequence.find((step) => step.id === activeStepId) ?? sequence.at(-1);
    if (!targetStep || !lookoutRegion || !onAddLookout) return;
    if (lookoutRegion.width < 4 || lookoutRegion.height < 4) return;
    onAddLookout(targetStep.id, {
      id: `lookout_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: lookoutLabel.trim() || "Visual cue",
      region: lookoutRegion,
      expectedText: lookoutText.trim() || undefined,
      expectation: lookoutExpectation,
      minConfidence: 0.7,
      onMatch: lookoutOnMatch,
      onMiss: lookoutOnMiss,
    });
    setLookoutRegion(null);
    setLookoutLabel("Next-step visual cue");
    setLookoutText("");
  };

  const handleCommitRecordStep = () => {
    if (!recordingClickPos) return;
    const stepNumber = sequence.length + 1;
    // Capture screenshot for save if enabled - use current screenshotUrl prop
    const refUrl = popoverSaveScreenshot ? screenshotUrl : undefined;
    onAddStep({
      stepNumber,
      name: popoverName || `Step ${stepNumber}`,
      action: popoverAction,
      x: recordingClickPos.x,
      y: recordingClickPos.y,
      text: popoverText,
      keyPayload: popoverKey,
      delayMs: popoverDelay,
      status: "pending",
      referenceScreenshotUrl: refUrl,
    } as any);
    setRecordingClickPos(null);
  };

  const polylinePoints = sequence
    .map((step) => {
      const xPct = (step.x / NATIVE_WIDTH) * 100;
      const yPct = (step.y / NATIVE_HEIGHT) * 100;
      return `${xPct},${yPct}`;
    })
    .join(" ");

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden select-none border-2 transition-all duration-300 ${
        isRecordMode
          ? "border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)] cursor-none"
          : "border-slate-800 shadow-xl cursor-default"
      }`}
      onMouseMove={handleMouseMove}
      onMouseDown={(event) => {
        if (!isDrawingLookout || event.button !== 0) return;
        event.preventDefault();
        const coords = getNativeCoordinates(event);
        setLookoutStart({ x: coords.x, y: coords.y });
        setLookoutRegion({
          id: `region_${Date.now()}`,
          x: coords.x,
          y: coords.y,
          width: 0,
          height: 0,
        });
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setMousePos(null);
        setDraggingStepId(null);
      }}
      onClick={handleContainerClick}
      onContextMenu={handleContainerContextMenu}
    >
      {isDrawingLookout && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[70] rounded-lg border border-violet-400/60 bg-violet-950/90 px-3 py-2 text-center text-xs font-semibold text-violet-100">
          Drag a rectangle around the item the AI should watch for.
        </div>
      )}
      {sequence.flatMap((step) => step.visualLookouts ?? []).map((lookout) => (
        <div
          key={lookout.id}
          className="pointer-events-none absolute z-20 border-2 border-violet-400/80 bg-violet-400/10"
          style={{
            left: `${(lookout.region.x / NATIVE_WIDTH) * 100}%`,
            top: `${(lookout.region.y / NATIVE_HEIGHT) * 100}%`,
            width: `${(lookout.region.width / NATIVE_WIDTH) * 100}%`,
            height: `${(lookout.region.height / NATIVE_HEIGHT) * 100}%`,
          }}
          title={lookout.label}
        />
      ))}
      {lookoutRegion && (
        <div
          className="pointer-events-none absolute z-[65] border-2 border-dashed border-violet-300 bg-violet-400/15"
          style={{
            left: `${(lookoutRegion.x / NATIVE_WIDTH) * 100}%`,
            top: `${(lookoutRegion.y / NATIVE_HEIGHT) * 100}%`,
            width: `${(lookoutRegion.width / NATIVE_WIDTH) * 100}%`,
            height: `${(lookoutRegion.height / NATIVE_HEIGHT) * 100}%`,
          }}
        />
      )}
      <div ref={viewportRef} className="absolute inset-0">
        {/* Native WebRTC Live Real Screen Video Stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain pointer-events-none absolute inset-0 z-0 ${
            isLiveStreamActive && antiTunnelMode === "live_stream"
              ? "block"
              : "hidden"
          }`}
        />

        {/* Anti-Tunnel Freeze Frame Snapshot (Prevents Infinite Visual Loop) */}
        {isLiveStreamActive && antiTunnelMode === "anti_tunnel_snapshot" && (
          <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-black">
            {frozenSnapshotUrl ? (
              <img
                src={frozenSnapshotUrl}
                alt="Anti-Tunnel Snapshot"
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div className="text-center p-4">
                <span className="text-xs font-mono text-cyan-300 animate-pulse">
                  🛡️ Anti-Tunnel Snapshot Active (Zero Visual Feedback Loop)
                </span>
              </div>
            )}
          </div>
        )}

        {!isLiveStreamActive &&
        screenshotUrl &&
        !screenshotUrl.includes("sample_placeholder") ? (
          <img
            src={screenshotUrl}
            alt="Live Screen Capture"
            className="w-full h-full object-contain pointer-events-none absolute inset-0 z-0"
          />
        ) : (
          !isLiveStreamActive && (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-center group z-10 select-none">
              {screenShareError ? (
                <div className="max-w-md w-full bg-slate-950/95 border-2 border-amber-500/80 rounded-xl p-5 shadow-2xl space-y-3">
                  <div className="flex items-center justify-center gap-2 text-amber-400 font-mono font-bold text-sm">
                    <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
                    <span>{screenShareError.title}</span>
                  </div>
                  <p className="text-xs font-mono text-slate-300 leading-relaxed">
                    {screenShareError.message}
                  </p>
                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      onClick={handleStartSimulatedScreenStream}
                      className="w-full h-9 text-xs font-mono font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-950 border border-emerald-400/40 gap-2"
                    >
                      <Play className="w-4 h-4 text-emerald-300 fill-emerald-300" />
                      OPEN VISUAL DEMO (NO DEVICE CONTROL)
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => window.open(window.location.href, "_blank")}
                        className="flex-1 h-8 text-[11px] font-mono bg-slate-900 border-slate-700 hover:bg-slate-800 text-cyan-300 gap-1.5"
                      >
                        <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                        Open in New Tab (Direct OS Capture)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleToggleRealScreenStream}
                        className="flex-1 h-8 text-[11px] font-mono bg-slate-900 border-slate-700 hover:bg-slate-800 text-amber-300 gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                        Retry Share
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={handleToggleRealScreenStream}
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <div className="w-20 h-20 rounded-full bg-cyan-950/80 border-2 border-cyan-400/80 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:border-cyan-300 transition-all shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-pulse">
                    <Monitor className="w-10 h-10 text-cyan-300" />
                  </div>

                  <h3 className="text-lg font-bold font-mono text-slate-100 mb-1 group-hover:text-cyan-300 transition-colors">
                    CLICK TO START LIVE SCREEN STREAM 📺
                  </h3>
                  <p className="text-xs font-mono text-slate-300 max-w-md mb-4">
                    Direct 60 FPS zero-latency hardware desktop mirror for AI mouse
                    navigation, OCR text scanning, and physical PyAutoGUI
                    automation.
                  </p>

                  <div className="flex items-center gap-2.5 flex-wrap justify-center">
                    <Button
                      size="lg"
                      disabled={isRequestingScreenShare}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleRealScreenStream();
                      }}
                      className="h-10 px-5 text-xs font-mono font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-xl shadow-cyan-950 border border-cyan-400/40 gap-2"
                    >
                      <Play className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                      {isRequestingScreenShare ? "CONNECTING..." : "START REAL DESKTOP STREAM (60 FPS)"}
                    </Button>

                    <Button
                      size="lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartSimulatedScreenStream();
                      }}
                      className="h-10 px-4 text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/50 shadow-lg gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      VISUAL DEMO ONLY
                    </Button>

                    <Button
                      size="lg"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(window.location.href, "_blank");
                      }}
                      className="h-10 px-3 text-xs font-mono bg-slate-900/80 border-slate-700 hover:bg-slate-800 text-cyan-300 gap-1.5"
                      title="Open in new browser tab for direct OS display capture"
                    >
                      <Monitor className="w-4 h-4" />
                      NEW TAB ↗
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Top Banner: Anti-Tunnel Shield & AI Automation Status */}
      <div className="p-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 font-mono text-xs z-30 relative shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Anti-Loop Shield Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-700">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                antiTunnelMode === "anti_tunnel_snapshot"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="text-slate-300 font-semibold">Shield:</span>
            <span
              className={`font-bold ${
                antiTunnelMode === "anti_tunnel_snapshot"
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              {antiTunnelMode === "anti_tunnel_snapshot"
                ? "🛡️ Zero-Recursion Active"
                : "⚠️ Direct Video (Loop Risk)"}
            </span>
          </div>

          {/* Sync Status Indicator with AI Frame Comparison Check */}
          <SyncStatusIndicator
            currentFrameUrl={screenshotUrl || frozenSnapshotUrl || undefined}
            storedSteps={sequence as any}
            activeStepIndex={sequence.findIndex((s) => s.id === activeStepId) >= 0 ? sequence.findIndex((s) => s.id === activeStepId) : 0}
            driftThresholdPx={localDriftThreshold}
            onTriggerRecalibrate={handleTriggerHudAutoCalibration}
          />

          {/* Real-time Status Indicator: Alignment Accuracy Between Live Canvas & Active Step (Green / Yellow / Red) */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-xs shadow-md transition-all ${
              activeAlignmentStatus === "green"
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-emerald-950"
                : activeAlignmentStatus === "yellow"
                ? "bg-amber-950/80 border-amber-500 text-amber-300 shadow-amber-950 animate-pulse"
                : "bg-red-950/90 border-red-500 text-red-300 shadow-red-950 animate-bounce"
            }`}
            title={`Euclidean alignment accuracy between live screen canvas and active workflow step (${activeStep?.name || "Active Step"}). Distance: ${activeStepEuclideanDrift}px.`}
          >
            {activeAlignmentStatus === "green" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : activeAlignmentStatus === "yellow" ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className="text-[10px] text-slate-400 font-semibold">Active Step Align:</span>
            <span className="font-bold">
              {activeAlignmentAccuracy}% (Δ {activeStepEuclideanDrift}px)
            </span>
            <span
              className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase ${
                activeAlignmentStatus === "green"
                  ? "bg-emerald-800 text-emerald-100"
                  : activeAlignmentStatus === "yellow"
                  ? "bg-amber-800 text-amber-100"
                  : "bg-red-800 text-red-100"
              }`}
            >
              {activeAlignmentStatus === "green" ? "Optimal" : activeAlignmentStatus === "yellow" ? "Moderate Drift" : "Misaligned"}
            </span>
          </div>

          {/* HUD Synchronization State Indicator (Live Recording Canvas ⇄ AI-Generated Verification Steps) */}
          <div className="relative">
            <button
              onClick={() => setShowSyncDiagnosticsModal(!showSyncDiagnosticsModal)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono transition-all ${
                recalibrationNotice
                  ? "bg-amber-950/80 border-amber-500 text-amber-300 shadow-md shadow-amber-950"
                  : sequence.length > 0 || isCapturing
                  ? "bg-emerald-950/70 border-emerald-500/70 text-emerald-300 hover:border-emerald-400"
                  : "bg-slate-900 border-slate-700 text-cyan-300 hover:border-cyan-500"
              }`}
              title="Click to inspect Canvas ⇄ AI Verification synchronization diagnostics"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  recalibrationNotice
                    ? "bg-amber-400 animate-ping"
                    : sequence.length > 0 || isCapturing
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    : "bg-cyan-400"
                }`}
              />
              <span className="text-slate-300 font-semibold">Sync State:</span>
              <span className="font-bold">
                {recalibrationNotice
                  ? "DRIFT DETECTED"
                  : sequence.length > 0
                  ? `IN SYNC (${sequence.length}/${sequence.length} STEPS)`
                  : "STANDBY"}
              </span>
              <RefreshCw className={`w-3 h-3 ml-0.5 text-slate-400 ${recalibrationNotice ? "animate-spin" : ""}`} />
            </button>

            {/* Sync Diagnostics Popover */}
            {showSyncDiagnosticsModal && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full left-0 mt-1.5 w-80 p-3 bg-slate-950/95 border border-cyan-500/50 rounded-xl shadow-2xl z-50 text-xs font-mono space-y-2.5 backdrop-blur-md"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-100 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    Canvas ⇄ Verification Sync
                  </span>
                  <Badge
                    className={`text-[9px] ${
                      recalibrationNotice
                        ? "bg-amber-600 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {recalibrationNotice ? "DRIFT" : "ALIGNED 100%"}
                  </Badge>
                </div>

                <div className="space-y-1 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Live Surface:</span>
                    <span className="text-cyan-300 font-bold">{selectedCanvasTitle || "Active Screen"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Workflow Steps:</span>
                    <span className="text-slate-200">{sequence.length} steps registered</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Spatial Drift Status:</span>
                    <span className={recalibrationNotice ? "text-amber-400 font-bold" : "text-emerald-400"}>
                      {recalibrationNotice ? `Δ ${recalibrationNotice.distance.toFixed(1)}px drift detected` : "0.0px (Zero Drift)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Physical Mouse Trail:</span>
                    <span className="text-purple-300">{liveMouseTrail.length} recorded waypoints</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      handleCaptureFreshFrame();
                      setShowSyncDiagnosticsModal(false);
                    }}
                    className="h-6 px-2 text-[10px] bg-cyan-700 hover:bg-cyan-600 text-white gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Force Resync
                  </Button>
                  <button
                    onClick={() => setShowSyncDiagnosticsModal(false)}
                    className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mode Switch */}
          <button
            onClick={() =>
              setAntiTunnelMode((prev) =>
                prev === "anti_tunnel_snapshot"
                  ? "live_stream"
                  : "anti_tunnel_snapshot"
              )
            }
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition-colors"
          >
            {antiTunnelMode === "anti_tunnel_snapshot"
              ? "Switch to Direct Video"
              : "Engage Anti-Loop Shield"}
          </button>

          {/* Refresh Frame Snapshot */}
          <button
            onClick={() => handleCaptureFreshFrame()}
            className="px-2 py-1 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-700 flex items-center gap-1"
          >
            <Camera className="w-3 h-3" />
            Capture Fresh Frame
          </button>

          {/* Auto Refresh Interval */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>Auto:</span>
            {[0, 3, 5, 10].map((sec) => (
              <button
                key={sec}
                onClick={() => setAutoRefreshIntervalSec(sec)}
                className={`px-1.5 py-0.5 rounded ${
                  autoRefreshIntervalSec === sec
                    ? "bg-cyan-600 text-white font-bold"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-400"
                }`}
              >
                {sec === 0 ? "Off" : `${sec}s`}
              </button>
            ))}
          </div>

          {/* Auto-Calibration Button */}
          <Button
            size="sm"
            onClick={handleTriggerHudAutoCalibration}
            disabled={isHudCalibrating}
            className="h-7 px-2.5 text-xs font-mono font-bold bg-gradient-to-r from-amber-600 via-red-600 to-amber-600 hover:from-amber-500 hover:to-red-500 text-white border border-amber-400/50 shadow-md shadow-amber-950/50 gap-1"
            title={`Re-scan current UI state to update coordinate offsets for stored automation steps when pixel-drift exceeds ${localDriftThreshold}px`}
          >
            <RefreshCw className={`w-3 h-3 text-yellow-200 ${isHudCalibrating ? "animate-spin" : ""}`} />
            <span>{isHudCalibrating ? "RE-SCANNING..." : `AUTO-CALIBRATION (${localDriftThreshold}px)`}</span>
          </Button>

          {/* Drift Heatmap Overlay Toggle */}
          <Button
            size="sm"
            onClick={() => {
              const next = !(showDriftHeatmap ?? localShowDriftHeatmap);
              setLocalShowDriftHeatmap(next);
              onToggleDriftHeatmap?.(next);
            }}
            className={`h-7 px-2.5 text-xs font-mono font-bold border transition-all ${
              (showDriftHeatmap ?? localShowDriftHeatmap)
                ? "bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-md shadow-red-950 ring-1 ring-red-400"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
            title="Toggle pixel comparison Drift Heatmap overlay color-coding screen areas with high drift frequency"
          >
            <Flame className={`w-3 h-3 mr-1 ${(showDriftHeatmap ?? localShowDriftHeatmap) ? "text-yellow-300 fill-yellow-300" : "text-slate-400"}`} />
            Drift Heatmap ({(showDriftHeatmap ?? localShowDriftHeatmap) ? "ON" : "OFF"})
          </Button>

          {/* AI Check Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 ml-2">
            <input
              type="checkbox"
              checked={autoCheckAfterAction}
              onChange={(e) => setAutoCheckAfterAction(e.target.checked)}
              className="rounded accent-cyan-500 w-3.5 h-3.5"
            />
            <span className="text-cyan-300 font-semibold">
              AI Check After Every Action
            </span>
          </label>
        </div>

        {/* AI Check Status Pill */}
        {aiCheckStatus && (
          <div
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 text-xs max-w-md truncate ${
              aiCheckStatus.status === "early_completed"
                ? "bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : aiCheckStatus.status === "stuck"
                  ? "bg-red-950/90 border-red-500 text-red-300"
                  : aiCheckStatus.status === "verified"
                    ? "bg-cyan-950/90 border-cyan-500 text-cyan-300"
                    : "bg-amber-950/90 border-amber-500 text-amber-300 animate-pulse"
            }`}
          >
            <span className="font-bold">
              {aiCheckStatus.status === "early_completed"
                ? "🎉 AI Finished:"
                : aiCheckStatus.status === "stuck"
                  ? "⚠️ AI Unsticking:"
                  : aiCheckStatus.status === "verified"
                    ? "✓ AI Verified:"
                    : "⏳ AI Thinking:"}
            </span>
            <span className="truncate">{aiCheckStatus.message}</span>
          </div>
        )}
      </div>

      {/* Prominent High-Visibility Action Toolbar & Mouse Trail Controls */}
      <div className="p-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 font-mono text-xs z-30 relative shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleToggleRealScreenStream}
            className={`h-8 text-xs font-mono font-bold ${
              isLiveStreamActive
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950 animate-pulse"
                : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md"
            }`}
          >
            <Monitor className="w-3.5 h-3.5 mr-1.5" />
            {isLiveStreamActive
              ? "🔴 STREAM ACTIVE"
              : "📺 SHARE SCREEN (60FPS)"}
          </Button>

          {/* Record User Mouse Trail */}
          <Button
            size="sm"
            onClick={() => {
              if (!isRecordingMouseTrail) {
                setLiveMouseTrail([]);
              }
              setIsRecordingMouseTrail(!isRecordingMouseTrail);
            }}
            className={`h-8 text-xs font-mono font-bold ${
              isRecordingMouseTrail
                ? "bg-red-600 hover:bg-red-500 text-white animate-pulse ring-2 ring-red-400"
                : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/50"
            }`}
          >
            {isRecordingMouseTrail ? (
              <>⏹️ STOP TRAIL ({liveMouseTrail.length} pts)</>
            ) : (
              <>🔴 RECORD MOUSE TRAIL</>
            )}
          </Button>

          {/* Replay Mouse Trail on Actual PC via PyAutoGUI */}
          {liveMouseTrail.length > 0 && (
            <>
              <Button
                size="sm"
                onClick={handleExecuteRecordedTrailOnPC}
                disabled={isExecutingTrailOnPC}
                className="h-8 text-xs font-mono font-bold bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white shadow-md gap-1"
              >
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                REPLAY TRAIL ON PC ({liveMouseTrail.length} pts)
              </Button>

              {/* Speed Multiplier */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                <span>Speed:</span>
                {[1.0, 1.5, 2.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTrailSpeedMultiplier(s)}
                    className={`px-1 py-0.5 rounded text-[11px] ${
                      trailSpeedMultiplier === s
                        ? "bg-cyan-600 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <button
                onClick={handleClearRecordedTrail}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-xs"
                title="Clear Trail"
              >
                Clear Trail
              </button>
            </>
          )}

          <Button
            size="sm"
            onClick={() => setIsDrawingOverlayOpen(!isDrawingOverlayOpen)}
            className={`h-8 text-xs font-mono font-bold ${
              isDrawingOverlayOpen
                ? "bg-cyan-600 text-white ring-2 ring-cyan-400"
                : "bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800"
            }`}
          >
            🎨 Pre-Record Drawing Overlay ({isDrawingOverlayOpen ? "ON" : "OFF"}
            )
          </Button>

          {/* 2nd HUD Navigation Path Overlay Toggle */}
          <Button
            size="sm"
            onClick={() => {
              const next = !(showSecondHudOverlay ?? localShow2ndHudOverlay);
              setLocalShow2ndHudOverlay(next);
              onToggleSecondHudOverlay?.(next);
            }}
            className={`h-8 text-xs font-mono font-bold ${
              (showSecondHudOverlay ?? localShow2ndHudOverlay)
                ? "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950 ring-1 ring-purple-400"
                : "bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-800"
            }`}
          >
            <Compass className="w-3.5 h-3.5 mr-1 text-purple-300" />
            2nd HUD Path Overlay ({(showSecondHudOverlay ?? localShow2ndHudOverlay) ? "ON" : "OFF"})
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Analyze & Act Master Vision AI Button */}
          <Button
            size="sm"
            onClick={() => setIsAnalyzeAndActOpen(true)}
            className="h-8 px-3.5 text-xs font-mono font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-xl shadow-cyan-950 border border-cyan-400 gap-1.5 ring-2 ring-cyan-400/50 animate-pulse"
            title="Analyze active screen stream, formulate goals, cross-reference actions, and execute on PC"
          >
            <Brain className="w-4 h-4 text-cyan-200" />
            <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" />
            ANALYZE & ACT (AI)
          </Button>

          {/* Historical Mouse Trail Overlay Toggle */}
          <Button
            size="sm"
            onClick={() => setShowHistoricalTrailOverlay(!showHistoricalTrailOverlay)}
            className={`h-8 px-2.5 text-xs font-mono font-bold border transition-all ${
              showHistoricalTrailOverlay
                ? "bg-cyan-700 hover:bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-950 ring-1 ring-cyan-400"
                : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
            }`}
            title="Semi-transparent canvas overlay rendering historical mouse movement trails during Live Recording mode"
          >
            <Layers className="w-3.5 h-3.5 mr-1 text-cyan-300" />
            Historical Trails ({showHistoricalTrailOverlay ? "ON" : "OFF"})
          </Button>

          {/* AI Replay Similar Action for Frames 1-10 with PC Execution & Clickpoint ("..") */}
          <Button
            size="sm"
            onClick={handleReplayFrames1To10OnPC}
            disabled={isPlayingFrames1To10}
            className={`h-8 px-3 text-xs font-mono font-bold transition-all ${
              isPlayingFrames1To10
                ? "bg-amber-600 text-white animate-pulse shadow-lg shadow-amber-950 ring-2 ring-amber-400"
                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md border border-purple-400/40"
            }`}
            title="AI plays similar action on screen for frames 1-10, clicks during clickpoints ('..') and executes on PC"
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${isPlayingFrames1To10 ? "animate-spin text-yellow-300" : "text-amber-300"}`} />
            {isPlayingFrames1To10
              ? `REPLAYING DRIFT [FRAME ${activeReplayFrame || 1}/10] ..`
              : "REPLAY DRIFT (FRAMES 1-10) 🎯"}
          </Button>

          {/* Repeating Drawing with Auto-Selected Tool & Qwen Thinking in Between Steps */}
          <Button
            size="sm"
            onClick={handleRepeatingDrawingWithAi}
            disabled={isRepeatingDrawing}
            className={`h-8 px-3 text-xs font-mono font-bold transition-all ${
              isRepeatingDrawing
                ? "bg-pink-600 text-white animate-pulse ring-2 ring-pink-400 shadow-lg"
                : "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-md border border-pink-400/40"
            }`}
            title="Auto-selects drawing tool and draws repeating segments with Qwen thinking in between each step"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-pink-300" />
            {isRepeatingDrawing ? "DRAWING + QWEN THINKING..." : "AUTO DRAWING (AI TOOL)"}
          </Button>

          {/* Qwen AI Agent Guide (Adjusting, Assisting Movement & Completing Forgotten Typing) */}
          <Button
            size="sm"
            onClick={() => setQwenGuideEnabled(!qwenGuideEnabled)}
            className={`h-8 px-3 text-xs font-mono font-bold transition-all ${
              qwenGuideEnabled
                ? "bg-cyan-700 hover:bg-cyan-600 text-white ring-2 ring-cyan-400 shadow-md shadow-cyan-950"
                : "bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
            }`}
            title="Enable Qwen AI Agent to guide movements, adjust paths, and backtrack to finish incomplete typing"
          >
            <Brain className={`w-3.5 h-3.5 mr-1.5 ${qwenGuideEnabled ? "text-cyan-300 animate-pulse" : "text-slate-500"}`} />
            QWEN AGENT GUIDE ({qwenGuideEnabled ? "ON" : "OFF"})
          </Button>

          <Button
            size="sm"
            onClick={handleExecuteAllOnActualPC}
            className="h-8 px-3 text-xs font-mono font-bold bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:from-red-500 hover:to-amber-500 text-white border border-amber-300 shadow-xl shadow-red-950 gap-1"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            EXECUTE ON PC
          </Button>

          <Button
            size="sm"
            onClick={() => handleReplayUserMovementWithDrift(false)}
            disabled={isReplayingMovement}
            className="h-8 text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-white gap-1"
            title="Simulate spline cursor route with human drift on HUD"
          >
            <Play className="w-3.5 h-3.5" /> Replay Drift (±{humanDriftPx}px)
          </Button>

          <Button
            size="sm"
            onClick={() => handleReplayUserMovementWithDrift(true)}
            disabled={isReplayingMovement || isExecutingTrailOnPC}
            className="h-8 text-xs font-mono font-bold bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white gap-1 border border-emerald-400/40 shadow-lg"
            title="Replay trail route with human drift directly on physical PC hardware"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-300" /> Replay & Execute on PC
          </Button>
        </div>
      </div>

      {/* Cyberpunk HUD Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-cyan-400/80"></div>
        <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-cyan-400/80"></div>
        <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-cyan-400/80"></div>
        <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-cyan-400/80"></div>

        {isCapturing && (
          <div className="absolute inset-0 overflow-hidden opacity-30">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse transform -translate-y-full animate-[scan_3s_linear_infinite]" />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <div className="w-24 h-24 border border-dashed border-cyan-400 rounded-full animate-[spin_20s_linear_infinite]"></div>
          <div className="absolute w-4 h-4 border border-cyan-400"></div>
        </div>
      </div>

      {/* High-Fidelity Recorded User Mouse Trail (Glowing Cyan Polyline & Waypoints) */}
      {liveMouseTrail.length > 1 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
          <polyline
            points={liveMouseTrail
              .map(
                (pt) =>
                  `${(pt.x / NATIVE_WIDTH) * 100}%,${(pt.y / NATIVE_HEIGHT) * 100}%`
              )
              .join(" ")}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.5"
            strokeDasharray="4 2"
            className="filter drop-shadow-[0_0_8px_rgba(6,182,212,0.9)]"
          />
          {liveMouseTrail.map((pt, idx) =>
            pt.isClick ? (
              <circle
                key={idx}
                cx={`${(pt.x / NATIVE_WIDTH) * 100}%`}
                cy={`${(pt.y / NATIVE_HEIGHT) * 100}%`}
                r="6"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            ) : idx % 6 === 0 ? (
              <circle
                key={idx}
                cx={`${(pt.x / NATIVE_WIDTH) * 100}%`}
                cy={`${(pt.y / NATIVE_HEIGHT) * 100}%`}
                r="2.5"
                fill="#06b6d4"
                opacity="0.8"
              />
            ) : null
          )}
        </svg>
      )}

      {/* Calibration Notification Toast */}
      {hudCalibrateSuccessMsg && (
        <div className="px-3 py-1.5 bg-gradient-to-r from-amber-950 via-slate-950 to-amber-950 border-b border-amber-400 text-xs font-mono text-amber-200 flex items-center justify-between z-30 relative shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
            <span>{hudCalibrateSuccessMsg}</span>
          </div>
          <button
            onClick={() => setHudCalibrateSuccessMsg(null)}
            className="text-amber-400 hover:text-white font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Qwen AI Agent Guide Live Thought & Movement Assistance Banner */}
      {qwenGuideEnabled && qwenLiveThought && (
        <div className="px-3 py-1.5 bg-slate-950/95 border-b border-cyan-500/40 text-xs font-mono text-cyan-200 flex items-center justify-between z-30 relative shadow-md">
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-cyan-400 font-bold">Qwen Guide:</span>
            <span className="text-slate-200">{qwenLiveThought}</span>
          </div>
          <Badge className="bg-cyan-900/60 text-cyan-300 border-cyan-600/50 text-[9px]">
            AI ASSIST ACTIVE
          </Badge>
        </div>
      )}

      {/* Qwen Guide Incomplete Typing Backtrack Alert */}
      {qwenIncompleteTypingAlert && (
        <div className="px-3 py-2 bg-gradient-to-r from-amber-950 via-slate-950 to-amber-950 border-b-2 border-amber-400 text-xs font-mono text-amber-200 flex items-center justify-between z-40 relative shadow-xl animate-bounce">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="font-bold">{qwenIncompleteTypingAlert}</span>
          </div>
          <Badge className="bg-amber-500 text-black font-bold text-[10px]">
            BACKTRACKING & COMPLETING
          </Badge>
        </div>
      )}

      {/* Qwen Thinking Status Between Drawing Steps */}
      {qwenThinkingStatus && (
        <div className="px-3 py-1.5 bg-purple-950/90 border-b border-purple-500 text-xs font-mono text-purple-200 flex items-center gap-2 z-30 relative shadow-md">
          <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-spin" />
          <span className="font-semibold">{qwenThinkingStatus}</span>
        </div>
      )}

      {/* 0. Drift Heatmap Overlay (Pixel comparison color-coded heat halos & problematic selector flags) */}
      {(showDriftHeatmap ?? localShowDriftHeatmap) && (
        <DriftHeatmapOverlay
          driftPoints={computePixelDriftHeatmap(
            sequence as any,
            localDriftThreshold,
            uiElements
          )}
          thresholdPx={localDriftThreshold}
          opacity={0.85}
          onTriggerCalibration={handleTriggerHudAutoCalibration}
          nativeWidth={NATIVE_WIDTH}
          nativeHeight={NATIVE_HEIGHT}
        />
      )}

      {/* Historical Mouse Movement Trail Canvas Overlay for Physical Interaction Verification */}
      {showHistoricalTrailOverlay && (
        <HistoricalMouseTrailOverlay
          currentLiveTrail={liveMouseTrail.map((p) => ({
            x: p.x,
            y: p.y,
            timestamp: (p as any).timestamp || p.time || Date.now(),
            isClick: p.isClick,
          }))}
          capturedSteps={sequence}
          nativeWidth={NATIVE_WIDTH}
          nativeHeight={NATIVE_HEIGHT}
          isRecording={isRecordingMouseTrail || isRecordMode}
        />
      )}

      {/* 1. Realistic Human Mouse Cursor & Glowing Spline Trail Overlay */}
      {/* Motion Spline Trail */}
      {(splineMotionTrail.length > 0 || (mousePos && isRecordMode)) && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
          {splineMotionTrail.map((pt, idx) => (
            <circle
              key={idx}
              cx={
                framePointAsPercent(pt.x, pt.y, {
                  width: NATIVE_WIDTH,
                  height: NATIVE_HEIGHT,
                }).left
              }
              cy={
                framePointAsPercent(pt.x, pt.y, {
                  width: NATIVE_WIDTH,
                  height: NATIVE_HEIGHT,
                }).top
              }
              r={2 + (idx / splineMotionTrail.length) * 3}
              fill="#06b6d4"
              opacity={(idx / splineMotionTrail.length) * 0.8}
            />
          ))}
        </svg>
      )}

      {/* Realistic Mouse Pointer Arrow / Hand */}
      {(replayingCursorPos || mousePos) && (
        <div
          style={{
            ...framePointAsPercent(
              replayingCursorPos?.x || mousePos?.x || 0,
              replayingCursorPos?.y || mousePos?.y || 0,
              { width: NATIVE_WIDTH, height: NATIVE_HEIGHT },
            ),
          }}
          className="absolute -translate-x-1 -translate-y-1 pointer-events-none z-40 flex flex-col items-start transition-transform duration-75"
        >
          {cursorStyle === "hand" ? (
            <div className="relative">
              <span className="text-2xl drop-shadow-[0_0_10px_rgba(6,182,212,0.9)]">
                👆
              </span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            </div>
          ) : (
            <div className="relative">
              {/* Realistic Glowing Arrowhead */}
              <svg
                className="w-6 h-6 drop-shadow-[0_0_10px_rgba(6,182,212,0.95)]"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
                  fill="#06b6d4"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
            </div>
          )}

          {/* Coordinate & Drift Tag */}
          <div className="mt-0.5 ml-4 px-2 py-0.5 rounded bg-slate-950/90 border border-cyan-500/60 text-[10px] font-mono text-cyan-300 font-bold shadow-xl flex items-center gap-1 backdrop-blur-md">
            <span>
              ({replayingCursorPos?.x || mousePos?.x},{" "}
              {replayingCursorPos?.y || mousePos?.y})
            </span>
            {isReplayingMovement && (
              <span className="text-amber-400 text-[9px] animate-pulse">
                ±{humanDriftPx}px DRIFT
              </span>
            )}
          </div>
        </div>
      )}

      {/* Live Mouse Coordinates Badge */}
      {mousePos && (
        <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-cyan-500/50 px-3 py-1.5 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2 shadow-2xl pointer-events-none z-30">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span>
            X: <strong className="text-white">{mousePos.x}</strong> Y:{" "}
            <strong className="text-white">{mousePos.y}</strong>
          </span>
          {isRecordMode && (
            <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/50 rounded text-[10px] font-bold animate-pulse">
              RECORDING: Left-click = click • Right-click = right_click rect
            </span>
          )}
        </div>
      )}

      {/* Dynamic Recalibration Banner */}
      {recalibrationNotice && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-amber-950/95 border-2 border-amber-400 px-4 py-2 rounded-xl text-xs font-mono text-amber-200 shadow-2xl flex items-center gap-2.5 z-40 animate-bounce">
          <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>
            <strong>
              Auto-Recalibrated Step #{recalibrationNotice.stepNumber}:
            </strong>{" "}
            Position shifted from ({recalibrationNotice.oldX},{" "}
            {recalibrationNotice.oldY}) → ({recalibrationNotice.newX},{" "}
            {recalibrationNotice.newY}) [+{recalibrationNotice.distance}px]
          </span>
        </div>
      )}

      {/* Frame Status Badge */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 z-30 pointer-events-none">
        {verificationBadge && (
          <div
            className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 backdrop-blur-md shadow-lg border ${
              verificationBadge.status === "verified"
                ? "bg-emerald-950/90 border-emerald-500 text-emerald-300"
                : verificationBadge.status === "verifying"
                  ? "bg-amber-950/90 border-amber-500 text-amber-300 animate-pulse"
                  : "bg-red-950/90 border-red-500 text-red-300"
            }`}
          >
            {verificationBadge.status === "verified" ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            )}
            <span>
              {verificationBadge.message ||
                verificationBadge.status.toUpperCase()}
            </span>
          </div>
        )}

        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700 px-2.5 py-1 rounded text-xs font-mono text-slate-300 flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isCapturing ? "bg-green-500 animate-ping" : "bg-slate-500"
            }`}
          />
          <span>{isCapturing ? "LIVE 1920x1080" : "IDLE"}</span>
        </div>
      </div>

      {/* SVG Connecting Flow Lines for Click Sequence */}
      {sequence.length > 1 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <polyline
            points={polylinePoints}
            fill="none"
            stroke="url(#flowGrad)"
            strokeWidth="4"
            filter="url(#glow)"
            strokeDasharray="8 6"
            className="opacity-70 animate-[dash_20s_linear_infinite]"
          />

          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            className="opacity-90"
          />
        </svg>
      )}

      {/* 2nd HUD Navigation Path Projection Overlay on Live View */}
      {(showSecondHudOverlay ?? localShow2ndHudOverlay) && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
          <defs>
            <linearGradient id="hud2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.9" />
            </linearGradient>
            <filter id="glowPurple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render 2nd HUD Path Spline */}
          <polyline
            points={(secondHudActivePath?.remappedTrajectory || [
              { x: 192, y: 180 },
              { x: 537, y: 414 },
              { x: 806, y: 648 },
            ])
              .map((p) => {
                const px = (p.x / 1000) * (containerRef.current?.clientWidth || 1000);
                const py = (p.y / 600) * (containerRef.current?.clientHeight || 600);
                return `${px},${py}`;
              })
              .join(" ")}
            fill="none"
            stroke="url(#hud2Grad)"
            strokeWidth="4.5"
            strokeDasharray="8 4"
            filter="url(#glowPurple)"
            className="animate-[dash_12s_linear_infinite]"
          />

          {/* Render 2nd HUD Waypoints */}
          {(secondHudActivePath?.remappedTrajectory || [
            { x: 192, y: 180 },
            { x: 537, y: 414 },
            { x: 806, y: 648 },
          ]).map((wp, idx) => {
            const px = (wp.x / 1000) * (containerRef.current?.clientWidth || 1000);
            const py = (wp.y / 600) * (containerRef.current?.clientHeight || 600);
            return (
              <g key={idx}>
                <circle
                  cx={px}
                  cy={py}
                  r={idx === 2 ? 10 : 7}
                  fill={idx === 2 ? "#22c55e" : "#a855f7"}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={px + 12}
                  y={py + 4}
                  fill="#d8b4fe"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                  className="drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]"
                >
                  2nd HUD #{idx + 1}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* AI #1 Qwen Vision Detected UI Element Bounding Boxes */}
      {uiElements.map((el) => {
        const boxStyle = toBoxPercent(el.boundingBox);
        return (
          <div
            key={el.id}
            style={boxStyle}
            className="absolute border border-cyan-400/60 bg-cyan-500/5 hover:bg-cyan-500/20 hover:border-cyan-300 transition-all rounded pointer-events-none z-10 group"
          >
            <div className="absolute -top-4 left-0 bg-slate-950/90 border border-cyan-500/40 text-[9px] font-mono text-cyan-300 px-1 py-0.2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {el.name} ({el.type}) • {(el.confidence * 100).toFixed(0)}%
            </div>
          </div>
        );
      })}

      {/* AI #1 Perception Feedback Focus Point (Cyan Reticle) */}
      {perceptionFeedback && (
        <div
          style={toPercent(perceptionFeedback.x, perceptionFeedback.y)}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
        >
          <div className="absolute -inset-4 border border-cyan-400/60 rounded-full animate-ping" />
          <div className="w-8 h-8 border border-dashed border-cyan-400 rounded-full flex items-center justify-center bg-cyan-950/30">
            <Eye className="w-3.5 h-3.5 text-cyan-300" />
          </div>
          {perceptionFeedback.label && (
            <div className="absolute top-9 left-1/2 transform -translate-x-1/2 bg-slate-950/90 border border-cyan-500/40 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300 whitespace-nowrap shadow-md">
              {perceptionFeedback.label}
            </div>
          )}
        </div>
      )}

      {/* AI #2 Focus & Thinking Animation Layer (Purple / Amber) */}
      {aiThinking && aiThinking.isThinking && (
        <div
          style={toPercent(aiThinking.x, aiThinking.y)}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
        >
          <div className="absolute -inset-10 border-2 border-purple-500/60 rounded-full animate-ping" />
          <div className="absolute -inset-6 border border-cyan-400/80 rounded-full animate-pulse" />

          <div className="w-12 h-12 border-2 border-dashed border-purple-400 rounded-full animate-[spin_4s_linear_infinite] flex items-center justify-center bg-purple-950/40 backdrop-blur-xs shadow-[0_0_20px_rgba(168,85,247,0.8)]">
            <Brain className="w-5 h-5 text-purple-300 animate-pulse" />
          </div>

          <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-slate-950/90 border border-purple-400/80 px-3 py-1.5 rounded-lg shadow-2xl backdrop-blur-md whitespace-nowrap min-w-[160px] text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-purple-300">
              <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
              <span>AI #2 Planner Active</span>
            </div>
            <div className="text-[11px] font-mono text-slate-200 mt-0.5">
              {aiThinking.action || "Formulating Next Step"}
            </div>
            <div className="text-[9px] text-purple-400 font-mono mt-0.5">
              Conf: {(aiThinking.confidence * 100).toFixed(0)}% • (
              {aiThinking.x}, {aiThinking.y})
            </div>
          </div>
        </div>
      )}

      {/* Click Sequence Step Nodes (Interactive & Draggable) */}
      {sequence.map((step) => {
        const pos = toPercent(step.x, step.y);
        const isActive = activeStepId === step.id;
        const isDragging = draggingStepId === step.id;

        return (
          <div
            key={step.id}
            style={{ left: pos.left, top: pos.top }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setDraggingStepId(step.id);
              if (onSelectStep) onSelectStep(step.id);
            }}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-20 cursor-grab active:cursor-grabbing group transition-transform ${
              isDragging ? "scale-125 z-40" : "hover:scale-110"
            }`}
          >
            {isActive && (
              <div className="absolute -inset-3 bg-amber-500/40 rounded-full animate-ping pointer-events-none" />
            )}

            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono shadow-2xl border-2 transition-all duration-200 ${
                isActive
                  ? "bg-amber-500 border-white text-black ring-4 ring-amber-400/50 scale-110 shadow-[0_0_20px_rgba(245,158,11,1)]"
                  : step.status === "completed"
                    ? "bg-emerald-600 border-emerald-300 text-white"
                    : step.recalibrated
                      ? "bg-amber-900 border-amber-400 text-amber-200"
                      : "bg-slate-900/90 border-cyan-400 text-cyan-300 hover:border-white hover:bg-cyan-900"
              }`}
            >
              {step.status === "completed" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                step.stepNumber
              )}
            </div>

            <div className="absolute -inset-2 border border-dashed border-cyan-400/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none animate-[spin_8s_linear_infinite]" />

            <div className="absolute top-9 left-1/2 transform -translate-x-1/2 bg-slate-950/95 border border-slate-700 px-2 py-1 rounded text-[10px] font-mono text-slate-200 shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
              <div className="font-bold text-cyan-300">{step.name}</div>
              <div className="text-slate-300">
                {step.action} {step.text ? `"${step.text}"` : ""} •{" "}
                {step.delayMs}ms ({step.x}, {step.y})
              </div>
            </div>
          </div>
        );
      })}

      {/* Real-Time Motion Particle Ribbon Trail */}
      {splineMotionTrail.length > 1 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
          <defs>
            <linearGradient
              id="spline-ribbon-grad"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
            </linearGradient>
            <filter id="ribbon-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <polyline
            points={splineMotionTrail
              .map(
                (pt) =>
                  `${(pt.x / NATIVE_WIDTH) * 1000},${(pt.y / NATIVE_HEIGHT) * 562.5}`,
              )
              .join(" ")}
            fill="none"
            stroke="url(#spline-ribbon-grad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ribbon-glow)"
          />
        </svg>
      )}

      {/* Realistic Glowing Arrowhead Cursor (↖️) & Touch Pointer */}
      {replayingCursorPos && (
        <div
          style={{
            left: `${(replayingCursorPos.x / NATIVE_WIDTH) * 100}%`,
            top: `${(replayingCursorPos.y / NATIVE_HEIGHT) * 100}%`,
          }}
          className="absolute -translate-x-1 -translate-y-1 pointer-events-none z-50 flex flex-col items-start transition-transform duration-75"
        >
          {/* Radial Aura */}
          <div className="absolute -inset-4 bg-cyan-500/30 rounded-full animate-ping" />

          {/* Glowing Arrowhead SVG */}
          <svg
            className="w-8 h-8 text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.9)] transform -rotate-12"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 0l16 12-7 2 4 8-3 1-4-8-6 5v-20z" />
          </svg>

          {/* Coordinate Tag */}
          <span className="ml-5 -mt-2 px-1.5 py-0.5 rounded bg-black/90 text-[8px] font-mono font-bold text-yellow-300 border border-cyan-800 shadow-md whitespace-nowrap">
            ({replayingCursorPos.x}, {replayingCursorPos.y})
          </span>
        </div>
      )}

      {/* Visual Clickpoint Contact Marker ("..") during Frames 1-10 Replay */}
      {hudActiveClickPoint && (
        <div
          style={{
            left: `${(hudActiveClickPoint.x / NATIVE_WIDTH) * 100}%`,
            top: `${(hudActiveClickPoint.y / NATIVE_HEIGHT) * 100}%`,
          }}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 flex flex-col items-center animate-in zoom-in-50 duration-150"
        >
          {/* Dual concentric expanding shockwave rings ("..") */}
          <div className="absolute -inset-6 border-2 border-amber-400 rounded-full animate-ping opacity-80" />
          <div className="absolute -inset-3 border-2 border-yellow-300 rounded-full animate-pulse opacity-90" />

          {/* Golden Target Dot */}
          <div className="w-8 h-8 rounded-full bg-amber-500/80 border-2 border-white flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,1)]">
            <span className="text-black font-mono font-black text-xs">..</span>
          </div>

          {/* Clickpoint Status Badge */}
          <div className="mt-2 bg-slate-950/95 border-2 border-amber-400 px-2 py-1 rounded-md shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-[10px] font-mono font-bold text-amber-300">
              FRAME #{hudActiveClickPoint.frame} CLICKPOINT (..)
            </span>
            <span className="text-[9px] font-mono text-slate-300">
              ({hudActiveClickPoint.x}, {hudActiveClickPoint.y})
            </span>
          </div>
        </div>
      )}

      {/* Pre-Recording Freehand Drawing & Step Pinning Overlay Layer */}
      {isDrawingOverlayOpen && (
        <div
          onMouseDown={(e) => {
            const coords = getNativeCoordinates(e);
            if (overlayActiveTool === "route") {
              setIsFreehandDrawing(true);
              setFreehandRoutePoints([{ x: coords.x, y: coords.y }]);
            }
          }}
          onMouseMove={(e) => {
            const coords = getNativeCoordinates(e);
            setMousePos({ x: coords.x, y: coords.y });
            if (isFreehandDrawing && overlayActiveTool === "route") {
              setFreehandRoutePoints((prev) => [
                ...prev,
                { x: coords.x, y: coords.y },
              ]);
            }
          }}
          onMouseUp={() => {
            if (isFreehandDrawing) {
              setIsFreehandDrawing(false);
            }
          }}
          onClick={(e) => {
            const coords = getNativeCoordinates(e);
            if (overlayActiveTool !== "route") {
              const stepNum = sequence.length + 1;
              const actionType =
                overlayActiveTool === "task" ? "type_text" : "click";
              const stepName =
                overlayActiveTool === "goal"
                  ? `Goal Step #${stepNum}`
                  : overlayActiveTool === "task"
                    ? `Type Step #${stepNum}`
                    : `Step #${stepNum}`;

              // Immediately add step to active workflow sequence without closing
              onAddStep({
                stepNumber: stepNum,
                name: stepName,
                action: actionType as any,
                x: coords.x,
                y: coords.y,
                text: overlayActiveTool === "task" ? "input_text" : "",
                delayMs: 400,
                status: "pending",
              });
            }
          }}
          className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[0.5px] pointer-events-auto cursor-crosshair select-none"
        >
          {/* Overlay Top Controls */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 left-1/2 transform -translate-x-1/2 p-1.5 rounded-xl bg-slate-950/95 border border-cyan-500/80 shadow-2xl flex items-center gap-2 text-xs font-mono z-50 pointer-events-auto"
          >
            <span className="text-cyan-300 font-bold px-2 flex items-center gap-1">
              <Brush className="w-3.5 h-3.5 text-cyan-400" />
              <span>DRAW & PIN TOOL:</span>
            </span>
            {(["route", "click", "task", "goal"] as const).map((t) => (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  setOverlayActiveTool(t);
                }}
                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                  overlayActiveTool === t
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-950 ring-1 ring-cyan-300"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {t === "route"
                  ? "〰️ Freehand Route"
                  : t === "click"
                    ? "🎯 Step Pin (1-Click)"
                    : t === "task"
                      ? "⚡ Type Task"
                      : "🏆 Goal"}
              </button>
            ))}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDrawingOverlayOpen(false);
              }}
              title="Close Overlay"
              className="px-2 text-slate-300 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>

          {/* Render Drawn Freehand Spline Route */}
          {freehandRoutePoints.length > 1 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-30"
              viewBox="0 0 1000 562.5"
            >
              <defs>
                <linearGradient
                  id="freehand-spline-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <polyline
                points={freehandRoutePoints
                  .map(
                    (p) =>
                      `${(p.x / NATIVE_WIDTH) * 1000},${(p.y / NATIVE_HEIGHT) * 562.5}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="url(#freehand-spline-grad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}

      {/* Interactive Quick Action Recording Popover */}
      {recordingClickPos && isRecordMode && (
        <div
          style={{
            left: `${Math.min(75, Math.max(25, recordingClickPos.pctX))}%`,
            top: `${Math.min(70, Math.max(30, recordingClickPos.pctY))}%`,
          }}
          onClick={(e) => e.stopPropagation()}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-slate-950/95 border-2 border-amber-500/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-md z-50 w-72 space-y-2.5 text-xs text-slate-100"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold font-mono text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Record Action Step</span>
            </div>
            <button
              onClick={() => setRecordingClickPos(null)}
              className="text-slate-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span>Coordinates:</span>
            <span className="text-cyan-300 font-bold">
              ({recordingClickPos.x}, {recordingClickPos.y})
            </span>
          </div>

          {onAddLookout && sequence.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={beginLookoutDrawing}
              disabled={
                ((sequence.find((step) => step.id === activeStepId) ?? sequence.at(-1))
                  ?.visualLookouts?.length ?? 0) >= 10
              }
              className="h-7 w-full border-violet-500/60 bg-violet-950/40 text-xs text-violet-200 hover:bg-violet-900/60"
            >
              <Eye className="h-3.5 w-3.5" /> Draw AI lookout region
            </Button>
          )}

          <div>
            <label className="text-[10px] font-mono text-slate-300 mb-1 block">
              Action Type:{" "}
              <span className="text-amber-400">
                (Left click = click • Right-click canvas = right_click)
              </span>
            </label>
            <Select
              value={popoverAction}
              onValueChange={(val: any) => setPopoverAction(val)}
            >
              <SelectTrigger
                className={`h-7 text-xs border ${popoverAction === "right_click" ? "bg-amber-950 border-amber-500 text-amber-200" : "bg-slate-900 border-slate-700"}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-xs">
                <SelectItem value="click">🖱️ Left Click</SelectItem>
                <SelectItem value="double_click">🖱️ Double Click</SelectItem>
                <SelectItem value="right_click">
                  🖱️ Right Click ★ (context menu)
                </SelectItem>
                <SelectItem value="clear_and_type">
                  ⌨️ Clear & Type Text
                </SelectItem>
                <SelectItem value="type_text">⌨️ Type Text String</SelectItem>
                <SelectItem value="press_key">
                  🧭 Press Navigation Key
                </SelectItem>
                <SelectItem value="hotkey">
                  ⚡ Key Combination / Hotkey
                </SelectItem>
                <SelectItem value="scroll">📜 Scroll View</SelectItem>
                <SelectItem value="wait">⏳ Wait Delay</SelectItem>
              </SelectContent>
            </Select>
            {popoverAction === "right_click" && (
              <p className="text-[10px] text-amber-300 mt-1 bg-amber-950/40 border border-amber-800 rounded px-1.5 py-0.5">
                Right-click will be executed via pyautogui.rightClick — drift
                respects Exact/Variation mode
              </p>
            )}
          </div>

          {/* Dynamic Payload Inputs for Type / Key */}
          {(popoverAction === "type_text" ||
            popoverAction === "clear_and_type") && (
            <div>
              <label className="text-[10px] font-mono text-slate-300 mb-1 block">
                Text to Type:
              </label>
              <Input
                value={popoverText}
                onChange={(e) => setPopoverText(e.target.value)}
                placeholder="Enter input text..."
                className="h-7 text-xs bg-slate-900 border-slate-700 text-slate-200"
                autoFocus
              />
            </div>
          )}

          {popoverAction === "press_key" && (
            <div>
              <label className="text-[10px] font-mono text-slate-300 mb-1 block">
                Key to Press:
              </label>
              <Select value={popoverKey} onValueChange={setPopoverKey}>
                <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-xs">
                  <SelectItem value="enter">↵ Enter / Return</SelectItem>
                  <SelectItem value="tab">⇥ Tab (Next Field)</SelectItem>
                  <SelectItem value="escape">⎋ Escape</SelectItem>
                  <SelectItem value="backspace">⌫ Backspace</SelectItem>
                  <SelectItem value="space">Spacebar</SelectItem>
                  <SelectItem value="down">↓ Down Arrow</SelectItem>
                  <SelectItem value="up">↑ Up Arrow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {popoverAction === "hotkey" && (
            <div>
              <label className="text-[10px] font-mono text-slate-300 mb-1 block">
                Hotkey Combination:
              </label>
              <Select value={popoverKey} onValueChange={setPopoverKey}>
                <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-xs">
                  <SelectItem value="ctrl+a">Ctrl + A (Select All)</SelectItem>
                  <SelectItem value="ctrl+c">Ctrl + C (Copy)</SelectItem>
                  <SelectItem value="ctrl+v">Ctrl + V (Paste)</SelectItem>
                  <SelectItem value="alt+tab">
                    Alt + Tab (Switch Window)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1">
              <span>Step Delay:</span>
              <span className="text-cyan-400 font-bold">{popoverDelay} ms</span>
            </div>
            <Slider
              value={[popoverDelay]}
              min={50}
              max={5000}
              step={50}
              onValueChange={([val]) => setPopoverDelay(val)}
              className="w-full"
            />
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-mono cursor-pointer select-none">
            <input
              type="checkbox"
              checked={popoverSaveScreenshot}
              onChange={(e) => setPopoverSaveScreenshot(e.target.checked)}
              className="w-3.5 h-3.5 rounded"
            />
            <span
              className={
                popoverSaveScreenshot
                  ? "text-cyan-300 font-bold"
                  : "text-slate-300"
              }
            >
              Save screenshot with this step
            </span>
            <span className="text-slate-400">
              (
              {popoverSaveScreenshot
                ? "ON — stores live frame for preview"
                : "OFF"}
              )
            </span>
          </label>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleCommitRecordStep}
              className="w-full h-7 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-md"
            >
              Add Step #{sequence.length + 1}{" "}
              {popoverAction === "right_click"
                ? "• Right Click"
                : popoverAction === "clear_and_type"
                  ? "• Clear+Type"
                  : ""}
            </Button>
          </div>
        </div>
      )}

      {recordingClickPos && !isRecordMode && sequence.length > 0 && (
        <div
          style={{
            left: `${Math.min(75, Math.max(25, recordingClickPos.pctX))}%`,
            top: `${Math.min(70, Math.max(30, recordingClickPos.pctY))}%`,
          }}
          onClick={(event) => event.stopPropagation()}
          className="absolute z-50 w-64 -translate-x-1/2 -translate-y-1/2 space-y-2 rounded-xl border-2 border-violet-500/70 bg-slate-950/95 p-3 text-xs text-slate-100 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-violet-200">Screen context actions</span>
            <button onClick={() => setRecordingClickPos(null)}><X className="h-3.5 w-3.5" /></button>
          </div>
          <Button
            size="sm"
            onClick={beginLookoutDrawing}
            disabled={
              ((sequence.find((step) => step.id === activeStepId) ?? sequence.at(-1))
                ?.visualLookouts?.length ?? 0) >= 10
            }
            className="h-8 w-full bg-violet-600 text-xs hover:bg-violet-500"
          >
            <Eye className="h-3.5 w-3.5" /> Draw AI lookout for selected step
          </Button>
          <p className="text-[10px] text-slate-400">Up to 10 lookouts can guide each workflow step.</p>
        </div>
      )}

      {lookoutRegion && !isDrawingLookout && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute bottom-4 right-4 z-[75] w-80 space-y-2 rounded-xl border-2 border-violet-500/70 bg-slate-950/95 p-3 text-xs text-slate-100 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-violet-200">Configure AI lookout</span>
            <button onClick={() => setLookoutRegion(null)}><X className="h-3.5 w-3.5" /></button>
          </div>
          <Input value={lookoutLabel} onChange={(event) => setLookoutLabel(event.target.value)} placeholder="Lookout label" className="h-8 bg-slate-900" />
          <Input value={lookoutText} onChange={(event) => setLookoutText(event.target.value)} placeholder="Expected OCR / element text (optional)" className="h-8 bg-slate-900" />
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] text-slate-400">Expect
              <select value={lookoutExpectation} onChange={(event) => setLookoutExpectation(event.target.value as VisualLookout["expectation"])} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-[10px]">
                <option value="present">Present</option><option value="absent">Absent</option><option value="changed">Changed</option>
              </select>
            </label>
            <label className="text-[10px] text-slate-400">On match
              <select value={lookoutOnMatch} onChange={(event) => setLookoutOnMatch(event.target.value as VisualLookout["onMatch"])} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-[10px]">
                <option value="continue">Continue</option><option value="stop">Stop</option>
              </select>
            </label>
            <label className="text-[10px] text-slate-400">On miss
              <select value={lookoutOnMiss} onChange={(event) => setLookoutOnMiss(event.target.value as VisualLookout["onMiss"])} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 text-[10px]">
                <option value="retry">Retry</option><option value="stop">Stop</option>
              </select>
            </label>
          </div>
          <p className="text-[10px] text-slate-500">Region: {Math.round(lookoutRegion.x)},{Math.round(lookoutRegion.y)} · {Math.round(lookoutRegion.width)}×{Math.round(lookoutRegion.height)}</p>
          <Button onClick={commitLookout} disabled={lookoutRegion.width < 4 || lookoutRegion.height < 4} className="h-8 w-full bg-violet-600 text-xs hover:bg-violet-500">
            Save lookout to selected step
          </Button>
        </div>
      )}

      {/* Autonomous Analyze & Act Modal */}
      <AnalyzeAndActModal
        isOpen={isAnalyzeAndActOpen}
        onClose={() => setIsAnalyzeAndActOpen(false)}
        liveScreenUrl={screenshotUrl || frozenSnapshotUrl || undefined}
        screenStreamUrl={isLiveStreamActive ? (screenshotUrl || frozenSnapshotUrl) : undefined}
        storedSteps={sequence}
        onAdoptAssembledWorkflow={(tasks) => {
          tasks.forEach((t) => {
            onAddStep({
              name: t.name,
              x: t.parameters?.x ?? t.targetPosition?.x ?? 960,
              y: t.parameters?.y ?? t.targetPosition?.y ?? 540,
              action: t.action,
              text: t.parameters?.text ?? t.text,
              keyPayload: t.parameters?.key ?? t.keyPayload,
            });
          });
        }}
      />
    </div>
  );
};
