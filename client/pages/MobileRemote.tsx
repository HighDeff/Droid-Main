import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Smartphone,
  Camera,
  Video,
  Radio,
  Wifi,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Zap,
  MousePointer,
  Layers,
  Upload,
  SwitchCamera,
  Image as ImageIcon,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  Home,
  Check,
  Minimize2,
  Maximize2,
  ShieldCheck,
  Eye,
  Lock,
  Sliders,
  Sparkles,
  Tv,
  Square,
  Play,
  Pause,
  Gauge,
  Activity,
  ChevronRight,
  ExternalLink,
  Calculator,
  FileText,
  Music,
  Folder,
  Terminal,
  Settings,
  X,
  Globe,
  Monitor,
  Copy,
  Info,
  Laptop,
  ClipboardCopy,
  Plus,
  Trash2,
  Share2,
  CameraOff,
  Flame,
  Wand2,
  Save,
  Download,
  Clock,
  RotateCcw,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  SkipForward,
  Shield,
  Scan,
  Users,
  Grid,
  ZoomIn,
  ZoomOut,
  Target,
  Crosshair,
  Volume2,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { InteractivePhoneVirtualOS } from "@/components/interactive-phone-virtual-os";
import { ApkAndPwaModal } from "@/components/ApkAndPwaModal";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export type StreamMode =
  | "interactive_phone"
  | "live_view"
  | "mirror_pc"
  | "screen"
  | "camera_back"
  | "camera_front"
  | "dual";

interface ExecutedActionIndicator {
  id: string;
  type: string;
  x: number;
  y: number;
  toX?: number;
  toY?: number;
  text?: string;
  appName?: string;
  appUrl?: string;
  package?: string;
  key?: string;
  description?: string;
  timestamp: number;
}

interface SyncedWorkflow {
  id: string;
  name: string;
  description: string;
  notes?: string;
  tags: string[];
  actions: Array<{
    id: string;
    type: string;
    x?: number;
    y?: number;
    toX?: number;
    toY?: number;
    text?: string;
    key?: string;
    description?: string;
    durationMs?: number;
  }>;
  autoSave?: boolean;
  sourceSnapshot?: string;
  executionCount?: number;
  createdAt: number;
}

interface ScheduledDeviceWorkflow {
  id: string;
  workflowId: string;
  name: string;
  description: string;
  targetDevice: string;
  scheduleType: "interval" | "cron" | "once" | "continuous";
  cronExpression?: string;
  intervalMinutes?: number;
  nextRunTime: number;
  lastRunTime?: number;
  status: "idle" | "running" | "paused" | "completed" | "error";
  currentStepIndex: number;
  totalSteps: number;
  steps: Array<{
    id: string;
    type: string;
    description: string;
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    status?: "pending" | "running" | "completed" | "failed";
  }>;
  autoHeal: boolean;
  history?: Array<{ runTime: number; status: "success" | "failed"; durationMs: number; stepsExecuted: number }>;
}

interface LinkedTemplateApp {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  isolatedAutomation: boolean;
  capabilities: string[];
  sampleWorkflows: string[];
  appCode?: string;
  targetUrl?: string;
}

interface DifferentialFrame {
  id: string;
  stepNumber: number;
  imageData: string;
  actionType: string;
  x: number;
  y: number;
  description: string;
  timestamp: number;
}

export default function MobileRemote() {
  const [isStreaming, setIsStreaming] = useState(true);
  const [streamMode, setStreamMode] = useState<StreamMode>("interactive_phone");
  const [activeTab, setActiveTab] = useState<"stream" | "workflows" | "scheduled" | "pack10" | "actions">("stream");
  const [fps, setFps] = useState(15);
  const [targetFps, setTargetFps] = useState<number>(15);
  const [framesSent, setFramesSent] = useState(0);
  const [status, setStatus] = useState<string>("● LIVE: 📱 Interactive Phone OS Active");
  const [lastTouch, setLastTouch] = useState<{ x: number; y: number } | null>(null);
  const [connected, setConnected] = useState(true);
  const [activeActionIndicator, setActiveActionIndicator] = useState<ExecutedActionIndicator | null>(null);
  const [incomingClipboardText, setIncomingClipboardText] = useState<string | null>(null);
  const [incomingAppPrompt, setIncomingAppPrompt] = useState<{ name: string; url?: string; pkg?: string } | null>(null);
  const [actionHistory, setActionHistory] = useState<Array<{ id: string; desc: string; time: string }>>([]);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [dualCameraPos, setDualCameraPos] = useState<"bottom-right" | "top-right" | "bottom-left">("bottom-right");
  const [streamQuality, setStreamQuality] = useState<"fast" | "balanced" | "hd">("balanced");
  const [lastLatencyMs, setLastLatencyMs] = useState<number>(12);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [activeLinkedApp, setActiveLinkedApp] = useState<LinkedTemplateApp | null>(null);

  // Live View Telemetry State
  const [liveViewZoom, setLiveViewZoom] = useState<number>(1);
  const [showAiBoundingBoxes, setShowAiBoundingBoxes] = useState<boolean>(true);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [liveViewNotice, setLiveViewNotice] = useState<boolean>(false);

  // Workflow Recording inside Interactive Phone
  const [isRecordingWorkflow, setIsRecordingWorkflow] = useState<boolean>(false);
  const [recordedSteps, setRecordedSteps] = useState<
    Array<{ id: string; type: string; description: string; x?: number; y?: number; text?: string; time: string }>
  >([]);

  // Synced Workflows state
  const [workflows, setWorkflows] = useState<SyncedWorkflow[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [executingWorkflowId, setExecutingWorkflowId] = useState<string | null>(null);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [isCreateWfModalOpen, setIsCreateWfModalOpen] = useState(false);
  const [newWfName, setNewWfName] = useState("");
  const [newWfDesc, setNewWfDesc] = useState("");

  // Scheduled Workflows state
  const [scheduledWorkflows, setScheduledWorkflows] = useState<ScheduledDeviceWorkflow[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);
  const [activeScheduledActionId, setActiveScheduledActionId] = useState<string | null>(null);

  // 10-Screenshot Pack Recorder state
  const [tenFramesPack, setTenFramesPack] = useState<DifferentialFrame[]>([]);
  const [isRecording10Pack, setIsRecording10Pack] = useState(false);
  const [packProgress, setPackProgress] = useState(0);

  // In-Browser Phone OS state
  const [virtualOsActiveApp, setVirtualOsActiveApp] = useState<string>("home");
  const [virtualOsAppUrl, setVirtualOsAppUrl] = useState<string>("https://google.com");
  const [virtualOsCalc, setVirtualOsCalc] = useState<string>("0");
  const [virtualOsNotes, setVirtualOsNotes] = useState<string>("Live interactive notes on mobile bridge");
  const [pcMirrorFrame, setPcMirrorFrame] = useState<string | null>(null);

  // Simulated live UI detection boxes for Live View mode
  const detectedLiveElements = [
    { id: "e1", label: "Search Bar", x: 0.1, y: 0.08, w: 0.8, h: 0.06, type: "input", conf: "99%" },
    { id: "e2", label: "Google Chrome", x: 0.12, y: 0.38, w: 0.16, h: 0.1, type: "app", conf: "98%" },
    { id: "e3", label: "Calculator", x: 0.36, y: 0.38, w: 0.16, h: 0.1, type: "app", conf: "98%" },
    { id: "e4", label: "Notes App", x: 0.60, y: 0.38, w: 0.16, h: 0.1, type: "app", conf: "97%" },
    { id: "e5", label: "Camera", x: 0.84, y: 0.38, w: 0.16, h: 0.1, type: "app", conf: "99%" },
    { id: "e6", label: "Navigation Dock", x: 0.1, y: 0.92, w: 0.8, h: 0.06, type: "nav", conf: "100%" },
  ];

  // Linked Template Apps list (Template Connect)
  const [templateApps] = useState<LinkedTemplateApp[]>([
    {
      id: "app_crm_lead",
      name: "Customer CRM & Lead Submitter",
      category: "CRM & Sales",
      description: "Automate customer record creation, contact logging, and follow-up alerts from this linked app only",
      icon: "Users",
      color: "from-blue-600 to-indigo-700",
      isolatedAutomation: true,
      capabilities: ["Form Filling", "Contact Import", "Status Tags", "Auto-Submit"],
      sampleWorkflows: ["Auto-Fill Client Intake", "Export CRM Contacts", "Trigger Follow-up SMS"],
    },
    {
      id: "app_inventory",
      name: "Barcode & Inventory Scanner",
      category: "Logistics",
      description: "Perform real-time item lookups, SKU scanning, quantity adjustments, and warehouse stock reconciliation",
      icon: "Scan",
      color: "from-amber-600 to-orange-700",
      isolatedAutomation: true,
      capabilities: ["Barcode Decoding", "SKU Lookup", "Stock Delta", "Batch Export"],
      sampleWorkflows: ["Scan Received Shipment", "Reconcile Stock Count", "Flag Damaged Inventory"],
    },
    {
      id: "app_social_poster",
      name: "Social Media Multi-Poster",
      category: "Marketing",
      description: "Queue, preview, and auto-dispatch promotional posts across linked brand accounts with media uploads",
      icon: "Share2",
      color: "from-pink-600 to-rose-700",
      isolatedAutomation: true,
      capabilities: ["Multi-Account Sync", "Image Attachment", "Schedule Queue", "Hashtag Auto-Fill"],
      sampleWorkflows: ["Broadcast Flash Sale", "Publish Daily Update", "Check Account Insights"],
    },
    {
      id: "app_form_intake",
      name: "Smart Form Intake & Validator",
      category: "Operations",
      description: "Parse structured form entries, execute automated verification checks, and dispatch records to database",
      icon: "FileText",
      color: "from-emerald-600 to-teal-700",
      isolatedAutomation: true,
      capabilities: ["Field Extraction", "Format Validation", "Webhook Dispatch", "Error Highlight"],
      sampleWorkflows: ["Validate Incoming Submissions", "Auto-Fill Employee Onboarding", "Batch CSV Import"],
    },
    {
      id: "app_invoice_extract",
      name: "Invoice & Receipt Auto-Processor",
      category: "Finance",
      description: "Extract line items, tax breakdowns, totals, and vendor details from receipts with automatic expense ledger entry",
      icon: "Calculator",
      color: "from-purple-600 to-violet-700",
      isolatedAutomation: true,
      capabilities: ["OCR Parsing", "Expense Categorization", "Tax Extraction", "Ledger Sync"],
      sampleWorkflows: ["Process Weekly Receipts", "Reconcile Card Expenses", "Export Month-End Tax Report"],
    },
    {
      id: "app_order_tracker",
      name: "E-Commerce Fulfillment Tracker",
      category: "E-Commerce",
      description: "Track shipment milestones, update package tracking numbers, and send instant fulfillment confirmation alerts",
      icon: "Folder",
      color: "from-cyan-600 to-blue-700",
      isolatedAutomation: true,
      capabilities: ["Carrier API Sync", "Tracking Notification", "Status Refresh", "Exception Alerts"],
      sampleWorkflows: ["Check Delayed Shipments", "Send Delivery Confirmations", "Update Tracking URLs"],
    },
  ]);

  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [deviceName] = useState("Mobile Phone (Sightline Bridge)");
  const { isInstallable, install } = usePWAInstall();

  // Refs for camera / screen capture
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryCamVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const primaryStreamRef = useRef<MediaStream | null>(null);
  const secondaryStreamRef = useRef<MediaStream | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const vfcCallbackRef = useRef<number | null>(null);
  const lastSentTimeRef = useRef<number>(0);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const isSendingFrameRef = useRef<boolean>(false);
  const isStreamingRef = useRef<boolean>(true);
  const targetFpsRef = useRef<number>(15);
  const streamModeRef = useRef<StreamMode>("interactive_phone");
  const wakeLockRef = useRef<any>(null);
  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silentOscillatorRef = useRef<OscillatorNode | null>(null);
  const sendLockTimeoutRef = useRef<any>(null);
  const pcMirrorContainerRef = useRef<HTMLDivElement | null>(null);

  isStreamingRef.current = isStreaming;
  targetFpsRef.current = targetFps;
  streamModeRef.current = streamMode;
  lastTouchRef.current = lastTouch;

  // Background Web Worker Frame Scheduler for resilient 15-60 FPS
  useEffect(() => {
    const workerCode = `
      let intervalId = null;
      self.onmessage = function(e) {
        if (e.data.command === 'start') {
          if (intervalId) clearInterval(intervalId);
          intervalId = setInterval(() => {
            self.postMessage('tick');
          }, e.data.interval || 66);
        } else if (e.data.command === 'stop') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        } else if (e.data.command === 'setInterval') {
          if (intervalId) clearInterval(intervalId);
          intervalId = setInterval(() => {
            self.postMessage('tick');
          }, e.data.interval || 66);
        }
      };
    `;

    try {
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        if (e.data === "tick" && isStreamingRef.current) {
          triggerFrameProcess();
        }
      };

      workerRef.current = worker;
      worker.postMessage({ command: "start", interval: Math.floor(1000 / targetFps) });

      return () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      };
    } catch (e) {
      console.warn("Web worker fallback", e);
    }
  }, []);

  // Update worker interval when target FPS changes
  useEffect(() => {
    if (workerRef.current && isStreaming) {
      const intervalMs = Math.max(30, Math.floor(1000 / targetFps));
      workerRef.current.postMessage({ command: "setInterval", interval: intervalMs });
    }
  }, [targetFps, isStreaming]);

  // Request & maintain screen wake lock
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && (navigator as any).wakeLock?.request) {
        if (!wakeLockRef.current) {
          const lock = await (navigator as any).wakeLock.request("screen");
          wakeLockRef.current = lock;
          setWakeLockActive(true);
          lock.addEventListener("release", () => {
            setWakeLockActive(false);
            wakeLockRef.current = null;
          });
        }
      }
    } catch {}
  }, []);

  const releaseWakeLock = useCallback(() => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {}
    setWakeLockActive(false);
  }, []);

  // Periodic Wake Lock Auto-Renewal Loop (every 6s)
  useEffect(() => {
    const wakeInterval = setInterval(() => {
      if (isStreamingRef.current) {
        requestWakeLock();
      }
    }, 6000);
    return () => clearInterval(wakeInterval);
  }, [requestWakeLock]);

  // Fetch Synced Workflows from backend
  const fetchSyncedWorkflows = useCallback(async () => {
    setIsLoadingWorkflows(true);
    try {
      const res = await fetch("/api/mobile-stream/workflows");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.workflows)) {
          setWorkflows(data.workflows);
        }
      }
    } catch {
    } finally {
      setIsLoadingWorkflows(false);
    }
  }, []);

  // Auto-Check Workspace for Scheduled Workflows
  const fetchScheduledWorkflows = useCallback(async () => {
    setIsLoadingScheduled(true);
    try {
      const res = await fetch("/api/mobile-stream/scheduled-workflows");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.workflows)) {
          setScheduledWorkflows(data.workflows);
        }
      }
    } catch {
    } finally {
      setIsLoadingScheduled(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncedWorkflows();
    fetchScheduledWorkflows();
    const interval = setInterval(() => {
      fetchSyncedWorkflows();
      fetchScheduledWorkflows();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchSyncedWorkflows, fetchScheduledWorkflows]);

  // Silent Web Audio carrier to prevent OS tab suspension on minimize
  const startBackgroundAudioKeepalive = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.00001; // inaudible
          osc.frequency.value = 35;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();

          audioContextRef.current = ctx;
          silentOscillatorRef.current = osc;
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn("Silent audio notice:", e);
    }
  }, []);

  const stopBackgroundAudioKeepalive = useCallback(() => {
    try {
      if (silentOscillatorRef.current) {
        silentOscillatorRef.current.stop();
        silentOscillatorRef.current.disconnect();
        silentOscillatorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch {}
  }, []);

  // Keep stream alive across app minimize / screen switch
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        if (isStreamingRef.current) {
          requestWakeLock();
          if (primaryVideoRef.current && primaryVideoRef.current.paused) {
            try {
              await primaryVideoRef.current.play();
            } catch {}
          }
          if (secondaryCamVideoRef.current && secondaryCamVideoRef.current.paused) {
            try {
              await secondaryCamVideoRef.current.play();
            } catch {}
          }
        }
      } else {
        if (isStreamingRef.current) {
          startBackgroundAudioKeepalive();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestWakeLock, startBackgroundAudioKeepalive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
      releaseWakeLock();
      stopBackgroundAudioKeepalive();
      if (frameRequestRef.current) cancelAnimationFrame(frameRequestRef.current);
    };
  }, [releaseWakeLock, stopBackgroundAudioKeepalive]);

  // Live polling for Main PC Screen Frame when in mirror_pc mode
  useEffect(() => {
    if (streamMode !== "mirror_pc" || !isStreaming) return;

    let isMounted = true;
    const pollPcScreen = async () => {
      try {
        const res = await fetch("/api/screen/capture");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && data.imageData) {
            setPcMirrorFrame(data.imageData);
          }
        }
      } catch {}
    };

    pollPcScreen();
    const interval = setInterval(pollPcScreen, 250);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [streamMode, isStreaming]);

  // Polling for incoming automation actions from PC Deck & Hub
  useEffect(() => {
    if (!isStreaming) return;
    const actionInterval = setInterval(() => {
      pollIncomingActions();
    }, 250);
    return () => clearInterval(actionInterval);
  }, [isStreaming]);

  const pollIncomingActions = async () => {
    try {
      const res = await fetch("/api/mobile-stream/actions");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.actions) && data.actions.length > 0) {
        for (const act of data.actions) {
          handleExecuteIncomingAction(act);
        }
      }
    } catch {}
  };

  const handleExecuteIncomingAction = (act: any) => {
    try {
      if (navigator.vibrate) {
        if (act.type === "double_tap") {
          navigator.vibrate([30, 40, 30]);
        } else if (act.type === "swipe" || act.type === "drag") {
          navigator.vibrate([50, 30]);
        } else if (act.key === "HOME") {
          navigator.vibrate([80, 40, 80]);
        } else {
          navigator.vibrate(40);
        }
      }
    } catch {}

    // App Launching / Deep Link Trigger
    if (act.type === "open_app" || act.appUrl || act.package || act.appName) {
      const name = act.appName || act.package || "App";
      const targetUrl = act.appUrl || (act.package ? `https://${act.package}` : "");

      const low = name.toLowerCase();
      if (low.includes("chrome") || low.includes("browser")) setVirtualOsActiveApp("chrome");
      else if (low.includes("calc")) setVirtualOsActiveApp("calculator");
      else if (low.includes("note")) setVirtualOsActiveApp("notes");
      else if (low.includes("youtube") || low.includes("video")) setVirtualOsActiveApp("youtube");
      else if (low.includes("music") || low.includes("spotify")) setVirtualOsActiveApp("spotify");
      else if (low.includes("term") || low.includes("adb")) setVirtualOsActiveApp("terminal");
      else if (low.includes("set")) setVirtualOsActiveApp("settings");
      else if (low.includes("file")) setVirtualOsActiveApp("files");

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sightline-app-launch", {
            detail: { package: act.package, appName: act.appName, appUrl: act.appUrl },
          })
        );
      }

      setIncomingAppPrompt({ name, url: targetUrl, pkg: act.package });
      setTimeout(() => setIncomingAppPrompt(null), 6000);
    }

    // Typing / Text Injection
    if ((act.type === "type_text" || act.type === "type") && act.text) {
      setIncomingClipboardText(act.text);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(act.text).catch(() => {});
        }
      } catch {}

      if (virtualOsActiveApp === "chrome") setVirtualOsAppUrl(act.text);
      else if (virtualOsActiveApp === "calculator") setVirtualOsCalc((prev) => (prev === "0" ? act.text : prev + act.text));
      else if (virtualOsActiveApp === "notes") setVirtualOsNotes((prev) => prev + " " + act.text);

      setTimeout(() => setIncomingClipboardText(null), 5000);
    }

    // Navigation / Back
    if (act.type === "key" && act.key === "BACK") {
      setVirtualOsActiveApp("home");
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sightline-navigate-back"));
        }
        if (window.history.length > 1) {
          window.history.back();
        }
      } catch {}
    }

    // Navigation / Home
    if (act.type === "key" && act.key === "HOME") {
      setVirtualOsActiveApp("home");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sightline-navigate-home"));
      }
      setIsTemplateDrawerOpen(true);
    }

    const indicator: ExecutedActionIndicator = {
      id: act.id || String(Date.now()),
      type: act.type || "tap",
      x: typeof act.x === "number" ? act.x : 0.5,
      y: typeof act.y === "number" ? act.y : 0.5,
      toX: act.toX,
      toY: act.toY,
      text: act.text,
      appName: act.appName,
      appUrl: act.appUrl,
      package: act.package,
      key: act.key,
      description:
        act.description ||
        (act.type === "open_app"
          ? `Open App: ${act.appName || act.package || act.appUrl}`
          : act.type === "type_text"
          ? `Type: "${act.text}"`
          : `Dispatched ${act.type}`),
      timestamp: Date.now(),
    };

    setActiveActionIndicator(indicator);
    setStatus(`🤖 Dispatched: ${indicator.description}`);
    setActionHistory((prev) => [
      { id: indicator.id, desc: indicator.description || indicator.type, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 15),
    ]);

    setTimeout(() => {
      setActiveActionIndicator((cur) => (cur?.id === indicator.id ? null : cur));
    }, 2500);

    fetch("/api/mobile-stream/action-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionId: act.id,
        success: true,
        result: `Executed ${act.type} on phone`,
        action: act,
      }),
    }).catch(() => {});
  };

  // Frame scheduler loop
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  const triggerFrameProcess = useCallback(() => {
    if (!isStreamingRef.current) return;
    const now = Date.now();
    const minInterval = Math.floor(1000 / targetFpsRef.current);

    if (now - lastSentTimeRef.current < minInterval - 5) {
      return;
    }

    processFrameTick();
  }, []);

  // Primary animation & video frame loop
  useEffect(() => {
    if (!isStreaming) return;

    let active = true;

    const continuousLoop = () => {
      if (!active) return;
      triggerFrameProcess();
      frameRequestRef.current = requestAnimationFrame(continuousLoop);
    };

    frameRequestRef.current = requestAnimationFrame(continuousLoop);

    const video = primaryVideoRef.current;
    if (video && "requestVideoFrameCallback" in video) {
      const vfcLoop = () => {
        if (!active) return;
        triggerFrameProcess();
        vfcCallbackRef.current = (video as any).requestVideoFrameCallback(vfcLoop);
      };
      vfcCallbackRef.current = (video as any).requestVideoFrameCallback(vfcLoop);
    }

    return () => {
      active = false;
      if (frameRequestRef.current) cancelAnimationFrame(frameRequestRef.current);
      if (video && vfcCallbackRef.current && "cancelVideoFrameCallback" in video) {
        (video as any).cancelVideoFrameCallback(vfcCallbackRef.current);
      }
    };
  }, [isStreaming, triggerFrameProcess]);

  // Frame Capture & Sync to PC Engine
  const processFrameTick = async () => {
    if (!canvasRef.current || !isStreamingRef.current) return;

    // 1. Synthetic Frame Rendering for Interactive & Live View Modes
    if (streamModeRef.current === "interactive_phone" || streamModeRef.current === "live_view") {
      if (isSendingFrameRef.current) return;
      try {
        isSendingFrameRef.current = true;
        if (sendLockTimeoutRef.current) clearTimeout(sendLockTimeoutRef.current);
        sendLockTimeoutRef.current = setTimeout(() => {
          isSendingFrameRef.current = false;
        }, 600);

        const canvas = canvasRef.current;
        canvas.width = 480;
        canvas.height = 800;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) {
          isSendingFrameRef.current = false;
          return;
        }

        // Clean Realistic Phone Wallpaper & Background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "#090d16");
        gradient.addColorStop(0.5, "#0b1329");
        gradient.addColorStop(1, "#040711");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Header Status Bar
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fillRect(0, 0, canvas.width, 36);

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`Sightline Phone • ${streamModeRef.current === "live_view" ? "LIVE VIEW" : "INTERACTIVE"}`, 16, 23);

        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px monospace";
        ctx.fillText(`94% ⚡ ${timeStr}`, canvas.width - 96, 23);

        // Content
        ctx.fillStyle = "rgba(30, 41, 59, 0.7)";
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(16, 50, canvas.width - 32, 130, 16) : ctx.rect(16, 50, canvas.width - 32, 130);
        ctx.fill();

        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("📱 Connected Phone Screen", 32, 85);

        ctx.fillStyle = "#38bdf8";
        ctx.font = "12px sans-serif";
        ctx.fillText("AI Vision & Automation Active • Full OS Mirror", 32, 110);

        const qualityVal = streamQuality === "hd" ? 0.75 : streamQuality === "fast" ? 0.45 : 0.6;
        const imageData = canvas.toDataURL("image/jpeg", qualityVal);
        lastSentTimeRef.current = Date.now();

        await sendFrameToPC(imageData, lastTouchRef.current?.x, lastTouchRef.current?.y);

        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          const measuredFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
          setFps(measuredFps);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }
      } catch {
      } finally {
        isSendingFrameRef.current = false;
        if (sendLockTimeoutRef.current) clearTimeout(sendLockTimeoutRef.current);
      }
      return;
    }

    // 2. Video-based stream processing (Real Screen Share or Camera)
    if (!primaryVideoRef.current) return;
    const video = primaryVideoRef.current;
    if (video.readyState < 2) return;

    if (isSendingFrameRef.current) return;

    try {
      isSendingFrameRef.current = true;
      if (sendLockTimeoutRef.current) clearTimeout(sendLockTimeoutRef.current);
      sendLockTimeoutRef.current = setTimeout(() => {
        isSendingFrameRef.current = false;
      }, 600);

      const canvas = canvasRef.current;
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;

      const maxW = streamQuality === "hd" ? 1080 : streamQuality === "fast" ? 540 : 720;
      const scale = maxW / vWidth;
      canvas.width = maxW;
      canvas.height = Math.round(vHeight * scale);

      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        isSendingFrameRef.current = false;
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const qualityVal = streamQuality === "hd" ? 0.75 : streamQuality === "fast" ? 0.45 : 0.6;
      const imageData = canvas.toDataURL("image/jpeg", qualityVal);
      lastSentTimeRef.current = Date.now();

      await sendFrameToPC(imageData, lastTouchRef.current?.x, lastTouchRef.current?.y);

      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        const measuredFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
        setFps(measuredFps);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    } catch {
    } finally {
      isSendingFrameRef.current = false;
      if (sendLockTimeoutRef.current) clearTimeout(sendLockTimeoutRef.current);
    }
  };

  const sendFrameToPC = async (imageData: string, tx?: number, ty?: number) => {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch("/api/mobile-stream/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          imageData,
          deviceName,
          streamType: streamModeRef.current,
          fps,
          touchX: tx,
          touchY: ty,
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setConnected(true);
        setFramesSent((prev) => prev + 1);
        setLastLatencyMs(Date.now() - startTime);
      }
    } catch {}
  };

  const stopAllStreams = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ command: "stop" });
    }
    if (primaryStreamRef.current) {
      primaryStreamRef.current.getTracks().forEach((t) => t.stop());
      primaryStreamRef.current = null;
    }
    if (secondaryStreamRef.current) {
      secondaryStreamRef.current.getTracks().forEach((t) => t.stop());
      secondaryStreamRef.current = null;
    }
    if (primaryVideoRef.current) {
      primaryVideoRef.current.srcObject = null;
    }
    if (secondaryCamVideoRef.current) {
      secondaryCamVideoRef.current.srcObject = null;
    }
    releaseWakeLock();
    stopBackgroundAudioKeepalive();
    setIsStreaming(false);
  };

  const requestScreenShareStream = async (): Promise<MediaStream> => {
    const nav = navigator as any;
    const mediaDevices = navigator.mediaDevices as any;

    const displayFn =
      mediaDevices && typeof mediaDevices.getDisplayMedia === "function"
        ? mediaDevices.getDisplayMedia.bind(mediaDevices)
        : nav && typeof nav.getDisplayMedia === "function"
        ? nav.getDisplayMedia.bind(nav)
        : null;

    if (!displayFn) {
      throw new Error("SCREEN_NOT_SUPPORTED");
    }

    try {
      return await displayFn({
        video: {
          displaySurface: "monitor",
          frameRate: { ideal: targetFps, max: 30 },
        },
        audio: false,
      });
    } catch (e1: any) {
      if (e1.name === "NotAllowedError" || e1.name === "AbortError" || e1.name === "SecurityError") {
        throw e1;
      }
      try {
        return await displayFn({ video: true, audio: false });
      } catch (e2: any) {
        if (e2.name === "NotAllowedError" || e2.name === "AbortError") {
          throw e2;
        }
        return await displayFn({ video: true });
      }
    }
  };

  const startStream = async (mode: StreamMode) => {
    stopAllStreams();

    try {
      setStreamMode(mode);
      setIsStreaming(true);
      setConnected(true);

      if (mode === "interactive_phone") {
        setStatus("● LIVE: 📱 Interactive Phone OS Active");
        requestWakeLock();
        startBackgroundAudioKeepalive();
        toast.success("📱 Interactive Phone OS: Tap, type & automate");
        return;
      }

      if (mode === "live_view") {
        setStatus("● LIVE: 👀 Live Telepresence Mirror • Read-Only Inspection");
        requestWakeLock();
        startBackgroundAudioKeepalive();
        toast.info("👀 Live View Mirror: Read-Only inspection feed");
        return;
      }

      if (mode === "mirror_pc") {
        setStatus("● LIVE: 🖥️ PC Desktop Screen Mirror & Remote Controller");
        requestWakeLock();
        startBackgroundAudioKeepalive();
        toast.info("🖥️ PC Mirror Active: Control PC from phone");
        return;
      }

      let primaryStream: MediaStream;

      if (mode === "screen" || mode === "dual") {
        try {
          primaryStream = await requestScreenShareStream();
        } catch (screenErr: any) {
          setIsApkModalOpen(true);
          toast.error("Browser screen capture restricted. Switch to Interactive Phone or Camera mode.");
          setStatus("Screen share restricted by browser. APK options opened.");
          setStreamMode("interactive_phone");
          return;
        }

        const videoTrack = primaryStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            stopAllStreams();
            setStatus("Screen share stopped");
          };
        }
      } else {
        // Camera mode (back or front)
        const facing = mode === "camera_front" ? "user" : "environment";
        primaryStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: targetFps },
          },
          audio: false,
        });
      }

      primaryStreamRef.current = primaryStream;

      if (primaryVideoRef.current) {
        primaryVideoRef.current.srcObject = primaryStream;
        primaryVideoRef.current.setAttribute("playsinline", "true");
        primaryVideoRef.current.muted = true;
        await primaryVideoRef.current.play();
      }

      setStatus(`● LIVE: ${mode.toUpperCase()} Stream Active`);
      requestWakeLock();
      startBackgroundAudioKeepalive();
    } catch (err: any) {
      setStatus("Notice: " + (err?.message || String(err)));
      toast.error("Stream access: " + (err?.message || "Unavailable in this browser"));
      setStreamMode("interactive_phone");
      setIsStreaming(true);
    }
  };

  const handleSwitchStreamSource = (mode: StreamMode) => {
    startStream(mode);
  };

  // PC Mirror Click Dispatch
  const handlePcMirrorTouch = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!pcMirrorContainerRef.current) return;
    const rect = pcMirrorContainerRef.current.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setLastTouch({ x: relX, y: relY });

    fetch("/api/interactive/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "click",
        x: relX,
        y: relY,
        button: "left",
      }),
    }).catch(() => {});

    toast.success(`🖥️ Dispatched Click to PC at (${Math.round(relX * 100)}%, ${Math.round(relY * 100)}%)`);
  };

  // Live View Touch Handler (Protected Inspection Notice)
  const handleLiveViewTouch = () => {
    setLiveViewNotice(true);
    setTimeout(() => setLiveViewNotice(false), 4000);
  };

  // Record 10-Screenshot Differential Workflow Pack
  const handleRecord10DifferentialScreenshots = async () => {
    if (isRecording10Pack) return;
    setIsRecording10Pack(true);
    setPackProgress(0);
    const frames: DifferentialFrame[] = [];
    toast.info("📸 Starting 10-Screenshot Workflow Sequence Recording...");

    try {
      const actionsSequence = [
        { type: "tap", x: 0.15, y: 0.35, desc: "Open Google Chrome Browser" },
        { type: "type", text: "Autonomous Vision AI", desc: "Input Search Query" },
        { type: "tap", x: 0.85, y: 0.12, desc: "Submit Search Request" },
        { type: "swipe", x: 0.5, y: 0.7, desc: "Scroll Search Results" },
        { type: "key", key: "HOME", desc: "Return to Phone Main Menu" },
        { type: "tap", x: 0.38, y: 0.35, desc: "Launch Calculator Tool" },
        { type: "type", text: "450 * 1.25", desc: "Calculate Ledger Multiplier" },
        { type: "tap", x: 0.85, y: 0.85, desc: "Evaluate Math Result" },
        { type: "key", key: "HOME", desc: "Minimize Calculator" },
        { type: "tap", x: 0.62, y: 0.35, desc: "Open Notes & Sync Telemetry" },
      ];

      for (let i = 0; i < 10; i++) {
        setPackProgress(i + 1);
        const act = actionsSequence[i];

        let snapshotData = "";
        if (canvasRef.current) {
          snapshotData = canvasRef.current.toDataURL("image/jpeg", 0.65);
        } else {
          snapshotData = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzBkMTExNyIvPjwvc3ZnPg==";
        }

        frames.push({
          id: `diff_frame_${Date.now()}_${i + 1}`,
          stepNumber: i + 1,
          imageData: snapshotData,
          actionType: act.type,
          x: act.x || 0.5,
          y: act.y || 0.5,
          description: act.desc,
          timestamp: Date.now(),
        });

        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      setTenFramesPack(frames);
      setActiveTab("pack10");
      toast.success("✅ Recorded 10-Differential Frame Sequence Pack!");

      await fetch("/api/mobile-stream/pack10", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packName: `Mobile 10-Pack - ${new Date().toLocaleTimeString()}`,
          frames,
          device: deviceName,
        }),
      }).catch(() => {});
    } catch (e) {
      toast.error("Failed recording 10-pack sequence");
    } finally {
      setIsRecording10Pack(false);
    }
  };

  // Instant Snapshot
  const handleCaptureSnapshot = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `sightline-snapshot-${Date.now()}.png`;
      a.click();
      toast.success("📷 Snapshot downloaded");
    } else {
      toast.info("📷 Snapshot captured & logged to Hub");
    }
  };

  // Scheduled Workflow Action Handlers
  const handleScheduledWorkflowAction = async (
    workflowId: string,
    action: "restart" | "continue" | "pause" | "step"
  ) => {
    setActiveScheduledActionId(workflowId);
    try {
      const res = await fetch(`/api/mobile-stream/scheduled-workflows/${workflowId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success(`⚡ ${data.message || `Workflow ${action}ed`}`);
          fetchScheduledWorkflows();
        }
      }
    } catch (e) {
      toast.error(`Failed to ${action} workflow`);
    } finally {
      setActiveScheduledActionId(null);
    }
  };

  // Run Synced Workflow on Connected Phone
  const handleExecuteWorkflow = async (wf: SyncedWorkflow) => {
    setExecutingWorkflowId(wf.id);
    toast.info(`▶ Executing "${wf.name}" on Phone...`);
    try {
      for (let i = 0; i < wf.actions.length; i++) {
        const step = wf.actions[i];
        handleExecuteIncomingAction({
          id: `act_${Date.now()}_${i}`,
          type: step.type,
          x: step.x,
          y: step.y,
          text: step.text,
          key: step.key,
          description: step.description || `Step ${i + 1}/${wf.actions.length}`,
        });
        await new Promise((resolve) => setTimeout(resolve, step.durationMs || 900));
      }
      toast.success(`✅ Completed "${wf.name}" execution`);
    } catch {
      toast.error("Workflow execution interrupted");
    } finally {
      setExecutingWorkflowId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-2 sm:p-4 font-sans select-none max-w-7xl mx-auto">
      {/* ---------------------------------------------------- */}
      {/* TOP HEADER & TELEMETRY STRIP */}
      {/* ---------------------------------------------------- */}
      <div className="w-full max-w-md flex flex-col gap-1.5 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                Sightline Mobile Remote
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono border border-cyan-800">
                  ARM64
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">
                {connected ? (
                  <span className="text-emerald-400 font-bold">● Connected • Latency: {lastLatencyMs}ms</span>
                ) : (
                  <span className="text-amber-400 font-bold">Connecting...</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsApkModalOpen(true)}
              className="h-7 px-2 text-[10px] font-bold border-slate-700 bg-slate-900 hover:bg-slate-800 text-cyan-300 gap-1"
            >
              <Download className="w-3 h-3 text-cyan-400" /> APK
            </Button>
            {isInstallable && (
              <Button
                size="sm"
                onClick={install}
                className="h-7 px-2 text-[10px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white gap-1"
              >
                <Plus className="w-3 h-3" /> PWA
              </Button>
            )}
          </div>
        </div>

        {/* Status Line */}
        <div className="flex items-center justify-between text-[10px] font-mono bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
          <span className="text-cyan-300 truncate">{status}</span>
          <span className="text-slate-400 text-[9px] shrink-0 ml-2">
            Frames: <strong className="text-white">{framesSent}</strong>
          </span>
        </div>

        {/* 5 Main Module Navigation Tabs */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1 mt-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("stream")}
            className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
              activeTab === "stream" ? "bg-cyan-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <Video className="w-3 h-3" /> Screen
          </button>
          <button
            onClick={() => setActiveTab("scheduled")}
            className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
              activeTab === "scheduled" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <Clock className="w-3 h-3" /> Scheduled
            {scheduledWorkflows.length > 0 && (
              <span className="text-[9px] px-1 rounded-full bg-black/40">{scheduledWorkflows.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("workflows")}
            className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
              activeTab === "workflows" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-3 h-3" /> Workflows
            <span className="text-[9px] px-1 rounded-full bg-black/40">{workflows.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("pack10")}
            className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
              activeTab === "pack10" ? "bg-teal-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <Camera className="w-3 h-3" /> 10-Snaps
          </button>
          <button
            onClick={() => setActiveTab("actions")}
            className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
              activeTab === "actions" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="w-3 h-3" /> AI Actions
          </button>
        </div>
      </div>

      {/* Active Linked App Scope Indicator (Template Connect Scope) */}
      {activeLinkedApp && (
        <div className="w-full max-w-md my-1 p-2 rounded-xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/40 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[11px] font-bold">
              ⚡
            </div>
            <div className="text-[10px] leading-tight">
              <span className="text-slate-400">Template Connect: </span>
              <span className="font-bold text-white">{activeLinkedApp.name}</span>
              <span className="text-[9px] text-indigo-300 block">AI automation scoped to this app only</span>
            </div>
          </div>
          <button
            onClick={() => setActiveLinkedApp(null)}
            className="text-[9px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
          >
            Clear Scope
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 1: SCREEN VIEWPORT (DISTINCT FOR EACH MODE) */}
      {/* ---------------------------------------------------- */}
      {activeTab === "stream" && (
        <div className="w-full max-w-md flex flex-col gap-2">
          {/* Main Viewport Container (Guaranteed solid height & responsive phone casing) */}
          <div className="w-full min-h-[640px] h-[640px] sm:h-[680px] rounded-[40px] border-[8px] border-slate-800/90 bg-slate-950 shadow-2xl relative flex flex-col overflow-hidden ring-1 ring-white/10">
            {/* Top Phone Speaker Bar */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-1 rounded-full bg-slate-700/80 z-50 pointer-events-none" />

            {/* 1. INTERACTIVE PHONE OS MODE (FULL REAL PHONE USAGE) */}
            {streamMode === "interactive_phone" && (
              <div className="w-full h-full relative overflow-hidden bg-slate-950 flex flex-col">
                <InteractivePhoneVirtualOS
                  onActionLogged={(action, details) => {
                    setStatus(`Action: ${action} - ${details}`);
                    if (isRecordingWorkflow) {
                      setRecordedSteps((prev) => [
                        ...prev,
                        {
                          id: `step_${Date.now()}`,
                          type: action,
                          description: details,
                          time: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
                        },
                      ]);
                    }
                  }}
                  className="w-full h-full"
                />

                {/* Workflow Recording Banner / Control on Phone */}
                {isRecordingWorkflow && (
                  <div className="absolute bottom-10 inset-x-2 p-2 rounded-xl bg-red-950/90 border border-red-500/80 text-white z-40 backdrop-blur flex items-center justify-between shadow-2xl animate-pulse">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span>Recording: {recordedSteps.length} Steps</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setIsRecordingWorkflow(false);
                          if (recordedSteps.length > 0) {
                            setIsCreateWfModalOpen(true);
                            setNewWfName(`Phone Workflow ${new Date().toLocaleDateString()}`);
                            setNewWfDesc(`Recorded ${recordedSteps.length} interactive actions`);
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px]"
                      >
                        Finish & Save
                      </button>
                      <button
                        onClick={() => {
                          setIsRecordingWorkflow(false);
                          setRecordedSteps([]);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white font-mono text-[9px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. LIVE VIEW (READ-ONLY TELEPRESENCE MIRROR OF PHONE WITH AI BOXES) */}
            {streamMode === "live_view" && (
              <div
                onClick={handleLiveViewTouch}
                onTouchStart={handleLiveViewTouch}
                className="w-full h-full relative overflow-hidden bg-slate-950 flex flex-col justify-between cursor-default"
                style={{ transform: `scale(${liveViewZoom})`, transformOrigin: "center center" }}
              >
                {/* Top Telepresence HUD Bar */}
                <div className="z-30 p-2 bg-slate-950/95 border-b border-cyan-500/30 flex items-center justify-between backdrop-blur">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-[10px] font-mono font-bold text-cyan-300">
                      👀 LIVE VIEW MIRROR
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
                    <span>1080x2400</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">{fps || 60} FPS</span>
                    <span>•</span>
                    <span className="text-cyan-300 font-bold">{lastLatencyMs}ms</span>
                  </div>
                </div>

                {/* Simulated / Real Phone Screen Live Display */}
                <div className="flex-1 relative flex flex-col justify-between p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
                  {/* Grid Overlay if enabled */}
                  {showGridOverlay && (
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#08334415_1px,transparent_1px),linear-gradient(to_bottom,#08334415_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                  )}

                  {/* Top Status Bar Mirror */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 border-b border-white/5 pb-2">
                    <span className="font-bold">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="w-16 h-3 bg-black rounded-full border border-slate-800 flex items-center justify-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1 text-[9px]">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>5G</span>
                      <span>96% ⚡</span>
                    </div>
                  </div>

                  {/* Search Bar Mirror with AI Bounding Box */}
                  <div className="relative my-2 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between text-slate-300">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium text-slate-400">Search apps, web or ask AI...</span>
                    </div>
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    {showAiBoundingBoxes && (
                      <div className="absolute -top-1.5 right-2 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500 text-[8px] font-mono text-cyan-300 font-bold">
                        Input • 99%
                      </div>
                    )}
                  </div>

                  {/* App Grid Mirror with AI Bounding Boxes */}
                  <div className="grid grid-cols-4 gap-3 py-4 relative">
                    {[
                      { name: "Chrome", icon: Globe, color: "from-blue-600 to-cyan-600", conf: "98%" },
                      { name: "Calculator", icon: Calculator, color: "from-amber-600 to-orange-600", conf: "98%" },
                      { name: "Notes", icon: FileText, color: "from-indigo-600 to-purple-600", conf: "97%" },
                      { name: "Camera", icon: Camera, color: "from-emerald-600 to-teal-600", conf: "99%" },
                      { name: "YouTube", icon: Video, color: "from-red-600 to-rose-600", conf: "96%" },
                      { name: "Music", icon: Music, color: "from-green-600 to-emerald-700", conf: "97%" },
                      { name: "Terminal", icon: Terminal, color: "from-slate-800 to-slate-950", conf: "99%" },
                      { name: "Files", icon: Folder, color: "from-amber-500 to-yellow-600", conf: "95%" },
                    ].map((app) => (
                      <div key={app.name} className="flex flex-col items-center gap-1 relative group">
                        <div
                          className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center text-white shadow-lg border border-white/20 relative`}
                        >
                          <app.icon className="w-5 h-5" />
                          {showAiBoundingBoxes && (
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-black animate-ping" />
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-300 truncate max-w-[54px]">{app.name}</span>
                        {showAiBoundingBoxes && (
                          <span className="text-[7px] font-mono text-emerald-400">{app.conf}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Navigation Dock Mirror */}
                  <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-around text-slate-400">
                    <ArrowLeft className="w-4 h-4" />
                    <Home className="w-4 h-4 text-cyan-400" />
                    <Layers className="w-4 h-4" />
                  </div>

                  {/* Notice overlay when touched in Live View */}
                  {liveViewNotice && (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 p-3 rounded-2xl bg-slate-950/95 border-2 border-cyan-500 shadow-2xl backdrop-blur z-50 text-center space-y-2 animate-in fade-in zoom-in duration-150">
                      <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center mx-auto text-cyan-300">
                        <Lock className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-white">Live View is Protected (Viewing Only)</p>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Touch input is disabled in Live View to prevent accidental misfires.
                      </p>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchStreamSource("interactive_phone");
                        }}
                        className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white w-full gap-1"
                      >
                        <Smartphone className="w-3.5 h-3.5" /> Switch to Interactive Mode to Touch
                      </Button>
                    </div>
                  )}
                </div>

                {/* Bottom Live View Telemetry Toolbar */}
                <div className="p-2 bg-slate-950/95 border-t border-slate-800 flex items-center justify-between gap-1 z-30">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAiBoundingBoxes((prev) => !prev);
                      }}
                      className={`h-6 px-1.5 text-[9px] font-mono border-slate-700 ${
                        showAiBoundingBoxes ? "bg-cyan-950 text-cyan-300 border-cyan-600" : "text-slate-400"
                      }`}
                    >
                      <Target className="w-2.5 h-2.5 mr-0.5" /> AI Boxes
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowGridOverlay((prev) => !prev);
                      }}
                      className={`h-6 px-1.5 text-[9px] font-mono border-slate-700 ${
                        showGridOverlay ? "bg-cyan-950 text-cyan-300 border-cyan-600" : "text-slate-400"
                      }`}
                    >
                      <Crosshair className="w-2.5 h-2.5 mr-0.5" /> Grid
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSwitchStreamSource("interactive_phone");
                    }}
                    className="h-6 px-2 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                  >
                    <Smartphone className="w-2.5 h-2.5" /> Switch to Interactive
                  </Button>
                </div>
              </div>
            )}

            {/* 3. PC MIRROR MODE */}
            {streamMode === "mirror_pc" && (
              <div
                ref={pcMirrorContainerRef}
                onClick={handlePcMirrorTouch}
                onTouchStart={handlePcMirrorTouch}
                className="w-full h-full relative overflow-hidden bg-black flex flex-col items-center justify-center cursor-crosshair group"
              >
                {pcMirrorFrame ? (
                  <img
                    src={pcMirrorFrame}
                    alt="Main PC Screen Mirror"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="text-center p-4 space-y-2 text-slate-400">
                    <Laptop className="w-8 h-8 text-cyan-400 animate-pulse mx-auto" />
                    <p className="text-xs font-bold text-white">Connecting to Main PC Viewport...</p>
                    <p className="text-[10px] text-slate-500">Tap anywhere on phone to control PC cursor</p>
                  </div>
                )}

                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur text-[9px] font-mono text-cyan-300 border border-cyan-500/40">
                  🖥️ PC MIRROR • Tap to Click
                </div>
              </div>
            )}

            {/* 4. REAL SCREEN SHARE & CAMERA VIDEO MODES */}
            <video
              ref={primaryVideoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-contain bg-black ${
                streamMode === "screen" || streamMode === "camera_back" || streamMode === "camera_front" || streamMode === "dual"
                  ? "block"
                  : "hidden"
              }`}
            />

            {/* Camera Viewfinder Overlay when in camera mode */}
            {(streamMode === "camera_back" || streamMode === "camera_front") && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-black/70 text-[9px] font-mono text-teal-300 border border-teal-500/40">
                    📷 LIVE CAMERA ({streamMode === "camera_front" ? "FRONT" : "REAR"})
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-[9px] font-mono text-emerald-400 border border-emerald-500/40">
                    60 FPS
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-20 h-20 border-2 border-dashed border-teal-400/60 rounded-xl" />
                </div>
                <div className="text-center text-[9px] font-mono text-slate-400 bg-black/60 p-1 rounded-md">
                  Point camera at screen or workspace to stream directly to PC HUD
                </div>
              </div>
            )}

            {/* Canvas for background frame processing */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Visual Action Indicator Overlay */}
            {activeActionIndicator && (
              <div
                className="absolute pointer-events-none z-30 transition-all duration-200 flex flex-col items-center"
                style={{
                  left: `${activeActionIndicator.x * 100}%`,
                  top: `${activeActionIndicator.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-2 border-emerald-400 bg-emerald-500/30 animate-ping" />
                  <div className="absolute w-7 h-7 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,1)] flex items-center justify-center">
                    <MousePointer className="w-4 h-4 text-black" />
                  </div>
                </div>

                <div className="mt-2 px-2.5 py-1 rounded-md bg-black/95 border border-emerald-500/80 shadow-2xl backdrop-blur text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                  {activeActionIndicator.description || activeActionIndicator.type}
                  {activeActionIndicator.text ? `: "${activeActionIndicator.text}"` : ""}
                </div>
              </div>
            )}

            {/* Ripple Surface for Touch / Clicks */}
            {lastTouch && (
              <div
                className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full border-2 border-cyan-400 bg-cyan-400/30 animate-ping pointer-events-none z-40 transition-all duration-75"
                style={{
                  left: `${lastTouch.x * 100}%`,
                  top: `${lastTouch.y * 100}%`,
                }}
              />
            )}
          </div>

          {/* Mode Switcher Toolbar (All Distinct Modes) */}
          <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSwitchStreamSource("interactive_phone")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-all whitespace-nowrap ${
                streamMode === "interactive_phone"
                  ? "bg-emerald-600 text-white shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Interactive Phone OS: Tap apps, type text, and run AI automation"
            >
              <Smartphone className="w-3 h-3" /> Interactive Phone
            </button>

            <button
              onClick={() => handleSwitchStreamSource("live_view")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-all whitespace-nowrap ${
                streamMode === "live_view"
                  ? "bg-cyan-600 text-white shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Live View: Protected read-only inspection mirror"
            >
              <Eye className="w-3 h-3" /> Live View
            </button>

            <button
              onClick={() => handleSwitchStreamSource("mirror_pc")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-all whitespace-nowrap ${
                streamMode === "mirror_pc"
                  ? "bg-indigo-600 text-white shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Mirror Desktop PC Viewport & Click Surface"
            >
              <Laptop className="w-3 h-3" /> PC Mirror
            </button>

            <button
              onClick={() => handleSwitchStreamSource("camera_back")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-all whitespace-nowrap ${
                streamMode === "camera_back"
                  ? "bg-teal-600 text-white shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Rear Camera Stream"
            >
              <Camera className="w-3 h-3" /> Cam
            </button>
          </div>

          {/* Quick Hardware Action Bar */}
          <div className="grid grid-cols-4 gap-1.5">
            <Button
              onClick={() => setIsTemplateDrawerOpen(true)}
              className="h-8 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white gap-1"
              title="Template Connect - Linked Apps (Scoped Automation)"
            >
              <Grid className="w-3 h-3" /> Home Apps
            </Button>
            <Button
              onClick={() => {
                if (streamMode === "interactive_phone") {
                  setIsRecordingWorkflow((prev) => !prev);
                  if (!isRecordingWorkflow) {
                    setRecordedSteps([]);
                    toast.info("🔴 Workflow Recording Started: Tap apps to record steps");
                  }
                } else {
                  handleSwitchStreamSource("interactive_phone");
                  setIsRecordingWorkflow(true);
                  setRecordedSteps([]);
                  toast.info("🔴 Switched to Phone & Started Recording Steps");
                }
              }}
              variant="outline"
              className={`h-8 rounded-lg text-[11px] font-bold border-slate-700 bg-slate-800 gap-1 ${
                isRecordingWorkflow ? "text-red-400 border-red-500" : "text-slate-200"
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              {isRecordingWorkflow ? "Stop Rec" : "Record Wf"}
            </Button>
            <Button
              onClick={handleRecord10DifferentialScreenshots}
              disabled={isRecording10Pack}
              className="h-8 rounded-lg text-[11px] font-bold bg-teal-600 hover:bg-teal-500 text-white gap-1"
              title="Record 10-Screenshot Differential Workflow Pack"
            >
              {isRecording10Pack ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
              {isRecording10Pack ? `${packProgress}/10` : "10-Snap"}
            </Button>
            <Button
              onClick={handleCaptureSnapshot}
              className="h-8 rounded-lg text-[11px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white gap-1"
            >
              <Zap className="w-3 h-3" /> Snap
            </Button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: SCHEDULED WORKFLOWS (CHECKED FROM WORKSPACE) */}
      {/* ---------------------------------------------------- */}
      {activeTab === "scheduled" && (
        <div className="w-full max-w-md flex-1 space-y-2.5 my-2">
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-xs font-bold text-white">Workspace Scheduled Workflows</h3>
                <p className="text-[9px] text-slate-400">Assigned to: {deviceName}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchScheduledWorkflows}
              className="h-6 px-2 text-[9px] font-mono border-slate-700 text-cyan-300 gap-1"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isLoadingScheduled ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {/* Scheduled Tasks List */}
          <div className="space-y-2">
            {scheduledWorkflows.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">No Scheduled Workflows Active</p>
                <p className="text-[10px] text-slate-500">
                  Workflows scheduled in the workspace or desktop scheduler will appear here automatically.
                </p>
              </div>
            ) : (
              scheduledWorkflows.map((sw) => (
                <div
                  key={sw.id}
                  className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 hover:border-amber-500/50 transition-colors shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{sw.name}</span>
                        <Badge
                          className={`text-[8px] py-0 px-1 font-mono ${
                            sw.status === "running"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-700 animate-pulse"
                              : sw.status === "paused"
                              ? "bg-amber-950 text-amber-300 border-amber-700"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {sw.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{sw.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-mono text-cyan-300 block">
                        Every {sw.intervalMinutes || 15}m
                      </span>
                      <span className="text-[8px] font-mono text-slate-500">
                        Step {sw.currentStepIndex + 1}/{sw.totalSteps}
                      </span>
                    </div>
                  </div>

                  {/* Step Progress Visual Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex gap-0.5">
                      {sw.steps.map((step, idx) => (
                        <div
                          key={step.id}
                          className={`flex-1 h-full rounded-full transition-all ${
                            idx < sw.currentStepIndex
                              ? "bg-emerald-400"
                              : idx === sw.currentStepIndex && sw.status === "running"
                              ? "bg-cyan-400 animate-pulse"
                              : idx === sw.currentStepIndex && sw.status === "paused"
                              ? "bg-amber-400"
                              : "bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[8px] font-mono text-slate-400">
                      <span>Current: {sw.steps[sw.currentStepIndex]?.description || "Ready"}</span>
                      {sw.autoHeal && <span className="text-emerald-400">⚡ Auto-Heal ON</span>}
                    </div>
                  </div>

                  {/* Execution Control Action Buttons (Continue, Restart, Pause, Step) */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                    {sw.status === "running" ? (
                      <Button
                        size="sm"
                        onClick={() => handleScheduledWorkflowAction(sw.id, "pause")}
                        disabled={activeScheduledActionId === sw.id}
                        className="flex-1 h-7 text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white gap-1"
                      >
                        <Pause className="w-3 h-3" /> Pause
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleScheduledWorkflowAction(sw.id, "continue")}
                        disabled={activeScheduledActionId === sw.id}
                        className="flex-1 h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                      >
                        <Play className="w-3 h-3" /> Continue / Run
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScheduledWorkflowAction(sw.id, "restart")}
                      disabled={activeScheduledActionId === sw.id}
                      className="flex-1 h-7 text-[10px] font-bold border-slate-700 bg-slate-800 hover:bg-slate-700 text-cyan-300 gap-1"
                    >
                      <RotateCcw className="w-3 h-3 text-cyan-400" /> Restart Step 1
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScheduledWorkflowAction(sw.id, "step")}
                      disabled={activeScheduledActionId === sw.id}
                      className="h-7 px-2 text-[10px] font-bold border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Step Forward 1 Action"
                    >
                      <SkipForward className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: WORKFLOWS MANAGER */}
      {/* ---------------------------------------------------- */}
      {activeTab === "workflows" && (
        <div className="w-full max-w-md flex-1 space-y-2.5 my-2">
          <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <div>
                <h3 className="text-xs font-bold text-white">Synced Workflows</h3>
                <p className="text-[9px] text-slate-400">{workflows.length} workflows saved</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setIsCreateWfModalOpen(true)}
              className="h-6 px-2 text-[9px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white gap-1"
            >
              <Plus className="w-2.5 h-2.5" /> Create
            </Button>
          </div>

          <div className="relative">
            <input
              value={workflowSearch}
              onChange={(e) => setWorkflowSearch(e.target.value)}
              placeholder="Search workflows by name or action..."
              className="w-full h-8 bg-slate-900 rounded-xl px-3 text-[11px] font-mono text-slate-200 border border-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-indigo-500/50 transition-colors shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">{wf.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{wf.description}</p>
                  </div>
                  <Badge className="text-[8px] py-0 px-1.5 bg-indigo-950 text-indigo-300 border-indigo-700">
                    {wf.actions.length} Steps
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="text-[9px] font-mono text-slate-500">
                    Created {new Date(wf.createdAt).toLocaleDateString()}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleExecuteWorkflow(wf)}
                    disabled={executingWorkflowId === wf.id}
                    className="h-6 px-2.5 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                  >
                    {executingWorkflowId === wf.id ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Play className="w-2.5 h-2.5" />
                    )}
                    {executingWorkflowId === wf.id ? "Executing..." : "Run on Phone"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: 10-SCREENSHOT DIFFERENTIAL PACKS */}
      {/* ---------------------------------------------------- */}
      {activeTab === "pack10" && (
        <div className="w-full max-w-md flex-1 space-y-2.5 my-2">
          <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-teal-400" />
              <div>
                <h3 className="text-xs font-bold text-white">10-Screenshot Differential Packs</h3>
                <p className="text-[9px] text-slate-400">Step-by-step differential capture</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleRecord10DifferentialScreenshots}
              disabled={isRecording10Pack}
              className="h-6 px-2 text-[9px] font-bold bg-teal-600 hover:bg-teal-500 text-white gap-1"
            >
              {isRecording10Pack ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
              {isRecording10Pack ? `Recording ${packProgress}/10...` : "Record 10-Pack"}
            </Button>
          </div>

          {tenFramesPack.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
              <Camera className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-bold text-slate-400">No 10-Screenshot Pack Recorded</p>
              <p className="text-[10px] text-slate-500">
                Tap 'Record 10-Pack' to capture a full 10-step differential workflow sequence with visual deltas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {tenFramesPack.map((f) => (
                <div key={f.id} className="p-2 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[9px] font-mono">
                    <span className="font-bold text-teal-300">Step #{f.stepNumber}</span>
                    <span className="text-slate-500">{f.actionType}</span>
                  </div>
                  <div className="w-full aspect-[9/14] bg-black rounded-lg overflow-hidden border border-slate-800">
                    <img src={f.imageData} alt={`Step ${f.stepNumber}`} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[8px] text-slate-400 truncate">{f.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 5: AI ACTIONS LOG & DISPATCHER */}
      {/* ---------------------------------------------------- */}
      {activeTab === "actions" && (
        <div className="w-full max-w-md flex-1 space-y-2.5 my-2">
          <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <div>
                <h3 className="text-xs font-bold text-white">AI Dispatched Actions</h3>
                <p className="text-[9px] text-slate-400">Live execution stream from AI planner</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActionHistory([])}
              className="h-6 px-2 text-[9px] font-mono border-slate-700 text-slate-400"
            >
              Clear Log
            </Button>
          </div>

          <div className="space-y-1.5">
            {actionHistory.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                <Zap className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">No Actions Recorded Yet</p>
                <p className="text-[10px] text-slate-500">
                  Actions executed by the AI copilot or forwarded from the desktop deck will appear here.
                </p>
              </div>
            ) : (
              actionHistory.map((a) => (
                <div
                  key={a.id}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[10px] font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-slate-200">{a.desc}</span>
                  </div>
                  <span className="text-[9px] text-slate-500">{a.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TEMPLATE CONNECT / LINKED APPS DRAWER (HOME APPS) */}
      {/* ---------------------------------------------------- */}
      {isTemplateDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-4 max-h-[85vh] flex flex-col gap-3 shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold">
                  ⚡
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Template Connect • Linked Apps
                  </h3>
                  <p className="text-[9px] text-slate-400">
                    Connect a linked app to isolate AI automation and workflows strictly to that application
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTemplateDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Apps Grid */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {templateApps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => {
                    setActiveLinkedApp(app);
                    setIsTemplateDrawerOpen(false);
                    toast.success(`⚡ Template Connected: Scoped to "${app.name}"`);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                    activeLinkedApp?.id === app.id
                      ? "bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-950"
                      : "bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-white font-bold shadow-md`}>
                        <Grid className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{app.name}</h4>
                        <span className="text-[9px] font-mono text-cyan-400">{app.category}</span>
                      </div>
                    </div>

                    <Badge
                      className={`text-[8px] py-0 px-1.5 font-mono ${
                        activeLinkedApp?.id === app.id
                          ? "bg-indigo-600 text-white border-transparent"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {activeLinkedApp?.id === app.id ? "ACTIVE LINK" : "CONNECT"}
                    </Badge>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">{app.description}</p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {app.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                      >
                        ✓ {cap}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              {activeLinkedApp ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActiveLinkedApp(null);
                    setIsTemplateDrawerOpen(false);
                    toast.info("Cleared Linked Scope: Full Phone OS active");
                  }}
                  className="h-7 text-[10px] font-mono border-slate-700 text-slate-400"
                >
                  Clear Scope (Full Phone OS)
                </Button>
              ) : (
                <span className="text-[9px] font-mono text-slate-500">No linked app scoped currently</span>
              )}
              <Button
                size="sm"
                onClick={() => setIsTemplateDrawerOpen(false)}
                className="h-7 px-3 text-[10px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* CREATE WORKFLOW MODAL */}
      {/* ---------------------------------------------------- */}
      {isCreateWfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" /> Save Recorded Workflow
              </h3>
              <button onClick={() => setIsCreateWfModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-mono text-slate-400">Workflow Name</label>
                <Input
                  value={newWfName}
                  onChange={(e) => setNewWfName(e.target.value)}
                  placeholder="e.g. Chrome Search & Note Sync"
                  className="h-8 bg-slate-950 border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400">Description</label>
                <Input
                  value={newWfDesc}
                  onChange={(e) => setNewWfDesc(e.target.value)}
                  placeholder="e.g. Automated navigation and note logging"
                  className="h-8 bg-slate-950 border-slate-800 text-xs text-white"
                />
              </div>

              {recordedSteps.length > 0 && (
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 max-h-32 overflow-y-auto space-y-1">
                  <span className="text-[9px] font-mono text-cyan-300 font-bold block">
                    Recorded Steps ({recordedSteps.length}):
                  </span>
                  {recordedSteps.map((s, idx) => (
                    <div key={s.id} className="text-[8px] font-mono text-slate-400 flex items-center justify-between">
                      <span>
                        #{idx + 1}: {s.description}
                      </span>
                      <span>{s.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreateWfModalOpen(false)}
                className="h-7 text-[10px] border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!newWfName.trim()) {
                    toast.error("Please enter a workflow name");
                    return;
                  }
                  const newWf: SyncedWorkflow = {
                    id: `wf_${Date.now()}`,
                    name: newWfName,
                    description: newWfDesc || "Interactive mobile workflow",
                    tags: ["phone", "recorded"],
                    actions: recordedSteps.map((s, i) => ({
                      id: `act_${i}`,
                      type: s.type || "tap",
                      description: s.description,
                      durationMs: 800,
                    })),
                    createdAt: Date.now(),
                  };

                  try {
                    await fetch("/api/mobile-stream/workflows", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ workflow: newWf }),
                    });
                    setWorkflows((prev) => [newWf, ...prev]);
                    setIsCreateWfModalOpen(false);
                    setRecordedSteps([]);
                    toast.success("✅ Saved workflow to cloud repository");
                  } catch {
                    toast.error("Failed saving workflow");
                  }
                }}
                className="h-7 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Save Workflow
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* APK / PWA Modal */}
      <ApkAndPwaModal open={isApkModalOpen} onOpenChange={setIsApkModalOpen} />
    </div>
  );
}
