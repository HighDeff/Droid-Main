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
  | "screen"
  | "mirror_pc"
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
  const [status, setStatus] = useState<string>("● LIVE: Full Interactive Phone OS & Workflows Synced");
  const [lastTouch, setLastTouch] = useState<{ x: number; y: number } | null>(null);
  const [connected, setConnected] = useState(true);
  const [activeActionIndicator, setActiveActionIndicator] = useState<ExecutedActionIndicator | null>(null);
  const [incomingClipboardText, setIncomingClipboardText] = useState<string | null>(null);
  const [incomingAppPrompt, setIncomingAppPrompt] = useState<{ name: string; url?: string; pkg?: string } | null>(null);
  const [actionHistory, setActionHistory] = useState<Array<{ id: string; desc: string; time: string }>>([]);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [dualCameraPos, setDualCameraPos] = useState<"bottom-right" | "top-right" | "bottom-left">("bottom-right");
  const [streamQuality, setStreamQuality] = useState<"fast" | "balanced" | "hd">("balanced");
  const [lastLatencyMs, setLastLatencyMs] = useState<number>(12);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [activeLinkedApp, setActiveLinkedApp] = useState<LinkedTemplateApp | null>(null);

  // Synced Workflows state
  const [workflows, setWorkflows] = useState<SyncedWorkflow[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [executingWorkflowId, setExecutingWorkflowId] = useState<string | null>(null);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [isCreateWfModalOpen, setIsCreateWfModalOpen] = useState(false);
  const [newWfName, setNewWfName] = useState("");
  const [newWfDesc, setNewWfDesc] = useState("");

  // Scheduled Workflows state (auto-checked from workspace)
  const [scheduledWorkflows, setScheduledWorkflows] = useState<ScheduledDeviceWorkflow[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);
  const [lastScheduledCheck, setLastScheduledCheck] = useState<number>(Date.now());
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

  // Linked Template Apps list
  const [templateApps, setTemplateApps] = useState<LinkedTemplateApp[]>([
    {
      id: "app_crm_lead",
      name: "Customer CRM & Lead Submitter",
      category: "crm",
      description: "Automate customer record creation, contact logging, and follow-up alerts from this linked app only",
      icon: "Users",
      color: "from-blue-600 to-indigo-700",
      isolatedAutomation: true,
      capabilities: ["Form Filling", "Contact Import", "Status Tags", "Auto-Submit"],
      sampleWorkflows: ["Auto-Fill Client Intake", "Export CRM Contacts"],
    },
    {
      id: "app_inventory",
      name: "Barcode & Inventory Scanner",
      category: "inventory",
      description: "Scan product barcodes via camera, auto-lookup stock, and update inventory counters",
      icon: "Scan",
      color: "from-emerald-600 to-teal-700",
      isolatedAutomation: true,
      capabilities: ["Camera Barcode Read", "SKU Lookup", "Differential Diff", "Stock Sync"],
      sampleWorkflows: ["Rapid Shelf Stock Count", "Audit Differential Diff"],
    },
    {
      id: "app_notes_sync",
      name: "Quick Notes & Action Ledger",
      category: "notes",
      description: "Live interactive notes environment with bi-directional clipboard sync and AI summary generation",
      icon: "FileText",
      color: "from-amber-600 to-orange-700",
      isolatedAutomation: true,
      capabilities: ["Live Text Editing", "CoT Export", "Markdown Support", "Auto-Save"],
      sampleWorkflows: ["Log Screen Action Items", "Export Daily Bug Report"],
      appCode: "notes",
    },
    {
      id: "app_calc_engine",
      name: "Dynamic Calculator & Formula Engine",
      category: "calculator",
      description: "Real-time mathematical formula runner, unit conversions, and automated calculation routines",
      icon: "Calculator",
      color: "from-purple-600 to-violet-700",
      isolatedAutomation: true,
      capabilities: ["Keypad Typing", "Formula Memory", "Step Replay", "Verification Diff"],
      sampleWorkflows: ["Calculate Tax & Discount", "Verify Currency Conversion"],
      appCode: "calculator",
    },
    {
      id: "app_adb_terminal",
      name: "ADB Terminal & Shell Runner",
      category: "terminal",
      description: "Direct ADB shell commands runner, keycode dispatches, and logcat monitoring",
      icon: "Terminal",
      color: "from-slate-800 to-slate-950",
      isolatedAutomation: true,
      capabilities: ["Shell Execution", "Keycode Input", "Package Manager", "Log Stream"],
      sampleWorkflows: ["Dump Device UI Tree", "Simulate Screen Rotation"],
      appCode: "terminal",
    },
    {
      id: "app_web_automation",
      name: "Web Browser & DOM Scraper",
      category: "web",
      description: "Google Chrome headless & interactive web navigator with element coordinates detection",
      icon: "Globe",
      color: "from-sky-600 to-cyan-700",
      isolatedAutomation: true,
      capabilities: ["URL Navigation", "Search Query Injection", "DOM Element Click", "Snapshot Feed"],
      sampleWorkflows: ["Search & Validate Results", "Web Form Automation"],
      appCode: "chrome",
      targetUrl: "https://google.com",
    },
  ]);

  // AI Auto Monitoring State
  const [aiMonitorState, setAiMonitorState] = useState({
    sentinelActive: true,
    autoHealingEnabled: true,
    elementsDetected: 14,
    driftConfidence: 96,
    lastHealEvent: "Checked UI alignment & responsive coordinates",
    statusBadge: "Active Monitoring",
  });

  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const { isInstallable } = usePWAInstall();

  const [deviceName] = useState(() =>
    typeof navigator !== "undefined" && navigator.userAgent.includes("Android")
      ? "Android Phone"
      : typeof navigator !== "undefined" && navigator.userAgent.includes("iPhone")
      ? "iPhone"
      : "Mobile Device"
  );

  // Video, Canvas and Container Refs
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryCamVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcMirrorContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchAreaRef = useRef<HTMLDivElement | null>(null);

  // Streams
  const primaryStreamRef = useRef<MediaStream | null>(null);
  const secondaryStreamRef = useRef<MediaStream | null>(null);

  // Background keepalive and scheduler refs
  const workerRef = useRef<Worker | null>(null);
  const wakeLockRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silentOscillatorRef = useRef<OscillatorNode | null>(null);
  const isSendingFrameRef = useRef<boolean>(false);

  const isStreamingRef = useRef<boolean>(true);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const vfcCallbackRef = useRef<number | null>(null);
  const streamModeRef = useRef<StreamMode>(streamMode);
  const targetFpsRef = useRef<number>(targetFps);
  const lastSentTimeRef = useRef<number>(0);
  const sendLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  isStreamingRef.current = isStreaming;
  lastTouchRef.current = lastTouch;
  streamModeRef.current = streamMode;
  targetFpsRef.current = targetFps;

  // Initialize Web Worker and PiP check
  useEffect(() => {
    if (typeof document !== "undefined" && "pictureInPictureEnabled" in document) {
      setIsPipSupported(true);
    }

    const workerCode = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === "start") {
          if (timer) clearInterval(timer);
          const interval = e.data.interval || 66;
          timer = setInterval(function() {
            self.postMessage("tick");
          }, interval);
        } else if (e.data === "stop") {
          if (timer) clearInterval(timer);
          timer = null;
        } else if (e.data.command === "setInterval") {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage("tick");
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

  // Auto-Check Workspace for Scheduled Workflows for Connected Device
  const fetchScheduledWorkflows = useCallback(async () => {
    setIsLoadingScheduled(true);
    try {
      const res = await fetch("/api/mobile-stream/scheduled-workflows");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.workflows)) {
          setScheduledWorkflows(data.workflows);
          setLastScheduledCheck(Date.now());
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

    // 1. App Launching / Deep Link Trigger
    if (act.type === "open_app" || act.appUrl || act.package || act.appName) {
      const name = act.appName || act.package || "App";
      const targetUrl = act.appUrl || (act.package ? `https://${act.package}` : "");

      if (streamModeRef.current === "interactive_phone" || streamModeRef.current === "live_view") {
        const low = name.toLowerCase();
        if (low.includes("chrome") || low.includes("browser")) setVirtualOsActiveApp("chrome");
        else if (low.includes("calc")) setVirtualOsActiveApp("calculator");
        else if (low.includes("note")) setVirtualOsActiveApp("notes");
        else if (low.includes("youtube") || low.includes("video")) setVirtualOsActiveApp("youtube");
        else if (low.includes("music") || low.includes("spotify")) setVirtualOsActiveApp("spotify");
        else if (low.includes("term") || low.includes("adb")) setVirtualOsActiveApp("terminal");
        else if (low.includes("set")) setVirtualOsActiveApp("settings");
        else if (low.includes("file")) setVirtualOsActiveApp("files");
      }

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

    // 2. Typing / Text Injection -> Auto-copy to Clipboard and update state
    if ((act.type === "type_text" || act.type === "type") && act.text) {
      setIncomingClipboardText(act.text);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(act.text).catch(() => {});
        }
      } catch {}

      if (streamModeRef.current === "interactive_phone" || streamModeRef.current === "live_view") {
        if (virtualOsActiveApp === "chrome") setVirtualOsAppUrl(act.text);
        else if (virtualOsActiveApp === "calculator") setVirtualOsCalc((prev) => (prev === "0" ? act.text : prev + act.text));
        else if (virtualOsActiveApp === "notes") setVirtualOsNotes((prev) => prev + " " + act.text);
      }

      setTimeout(() => setIncomingClipboardText(null), 5000);
    }

    // 3. Navigation / Back
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

    // 4. Navigation / Home
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
    setStatus(`🤖 Executed: ${indicator.description}`);
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

    // 1. Interactive Phone or Live View Frame Rendering
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

        // Header Status Bar (Time, Battery, Wifi, Sightline Badge)
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fillRect(0, 0, canvas.width, 36);

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`Sightline Phone • ${streamModeRef.current === "live_view" ? "LIVE MIRROR" : "INTERACTIVE"}`, 16, 23);

        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px monospace";
        ctx.fillText(`94% ⚡ ${timeStr}`, canvas.width - 96, 23);

        // Render Active Phone Content
        if (virtualOsActiveApp === "home") {
          // Phone Home Launcher Wallpaper Cards
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

          ctx.fillStyle = "#94a3b8";
          ctx.font = "11px monospace";
          ctx.fillText(`Mode: ${streamModeRef.current.toUpperCase()} | Synced Steps: ${workflows.length}`, 32, 135);

          // Grid of actual apps
          const apps = [
            { name: "Chrome", color: "#2563eb" },
            { name: "Camera", color: "#0d9488" },
            { name: "Notes", color: "#7c3aed" },
            { name: "Calculator", color: "#d97706" },
            { name: "YouTube", color: "#dc2626" },
            { name: "Terminal", color: "#334155" },
            { name: "Settings", color: "#475569" },
            { name: "Files", color: "#ea580c" },
          ];

          apps.forEach((app, idx) => {
            const col = idx % 4;
            const row = Math.floor(idx / 4);
            const x = 28 + col * 110;
            const y = 205 + row * 110;

            ctx.fillStyle = app.color;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(x, y, 64, 64, 16) : ctx.rect(x, y, 64, 64);
            ctx.fill();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(app.name, x + 32, y + 80);
            ctx.textAlign = "left";
          });
        } else if (virtualOsActiveApp === "calculator") {
          ctx.fillStyle = "#18181b";
          ctx.fillRect(16, 50, canvas.width - 32, canvas.height - 70);

          ctx.fillStyle = "#27272a";
          ctx.fillRect(32, 70, canvas.width - 64, 70);

          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 32px monospace";
          ctx.textAlign = "right";
          ctx.fillText(virtualOsCalc, canvas.width - 48, 120);
          ctx.textAlign = "left";
        } else if (virtualOsActiveApp === "chrome") {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(16, 50, canvas.width - 32, canvas.height - 70);

          ctx.fillStyle = "#0f172a";
          ctx.fillRect(32, 70, canvas.width - 64, 40);

          ctx.fillStyle = "#60a5fa";
          ctx.font = "12px sans-serif";
          ctx.fillText(`🔍 ${virtualOsAppUrl}`, 44, 95);
        } else if (virtualOsActiveApp === "notes") {
          ctx.fillStyle = "#1c1917";
          ctx.fillRect(16, 50, canvas.width - 32, canvas.height - 70);

          ctx.fillStyle = "#facc15";
          ctx.font = "bold 16px sans-serif";
          ctx.fillText("📝 Notes App", 36, 85);

          ctx.fillStyle = "#e7e5e4";
          ctx.font = "13px sans-serif";
          ctx.fillText(virtualOsNotes, 36, 120);
        } else {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(16, 50, canvas.width - 32, canvas.height - 70);
          ctx.fillStyle = "#f8fafc";
          ctx.font = "bold 16px sans-serif";
          ctx.fillText(`📱 ${virtualOsActiveApp.toUpperCase()}`, 36, 85);
        }

        // Live View Telemetry Watermark Overlay
        if (streamModeRef.current === "live_view") {
          ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
          ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
          ctx.fillStyle = "#22d3ee";
          ctx.font = "bold 11px monospace";
          ctx.fillText("👀 LIVE VIEW ONLY (READ-ONLY TELEMETRY MIRROR)", 20, canvas.height - 16);
        }

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
    setStatus("Stream paused");
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
      setStatus(`Switching to ${mode.toUpperCase()}...`);
      setStreamMode(mode);

      // 1. Interactive Phone, Live View, or PC Mirror mode
      if (mode === "interactive_phone" || mode === "live_view" || mode === "mirror_pc") {
        setIsStreaming(true);
        setConnected(true);
        setStatus(
          mode === "interactive_phone"
            ? "● LIVE: 📱 Interactive Phone OS • Full Touch & AI Automation Active"
            : mode === "live_view"
            ? "● LIVE: 👀 Phone Screen Mirror • View-Only Telemetry HUD"
            : "● LIVE: 🖥️ PC Screen Mirror & Controller Active"
        );
        requestWakeLock();
        startBackgroundAudioKeepalive();

        if (workerRef.current) {
          const intervalMs = Math.max(30, Math.floor(1000 / targetFps));
          workerRef.current.postMessage({ command: "start", interval: intervalMs });
        }
        return;
      }

      let primaryStream: MediaStream;

      // 2. Real Screen Share Mode
      if (mode === "screen" || mode === "dual") {
        try {
          primaryStream = await requestScreenShareStream();
        } catch (screenErr: any) {
          setIsApkModalOpen(true);
          toast.error("Browser screen capture restricted. Switch to Interactive Phone or Camera mode.");
          setStatus("Screen share restricted. APK & options opened.");
          setIsStreaming(false);
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
        // 3. Camera mode
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

      setIsStreaming(true);
      setConnected(true);
      setStatus(`● LIVE: ${mode.toUpperCase()} Stream Active`);
      requestWakeLock();
      startBackgroundAudioKeepalive();

      if (workerRef.current) {
        const intervalMs = Math.max(30, Math.floor(1000 / targetFps));
        workerRef.current.postMessage({ command: "start", interval: intervalMs });
      }
    } catch (err: any) {
      setStatus("Notice: " + (err?.message || String(err)));
      setIsStreaming(false);
      setConnected(false);
    }
  };

  const handleSwitchStreamSource = async (newMode: StreamMode) => {
    if (newMode === streamMode && isStreaming) return;
    await startStream(newMode);
  };

  // Replay Synced Workflow
  const handleReplayWorkflow = async (wf: SyncedWorkflow) => {
    setExecutingWorkflowId(wf.id);
    toast.info(`▶ Executing workflow: "${wf.name}" (${wf.actions.length} steps)...`);
    try {
      const res = await fetch(`/api/mobile-stream/workflows/${wf.id}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speedMultiplier: 1 }),
      });
      if (res.ok) {
        toast.success(`Dispatched "${wf.name}" to device queue!`);
      }
    } catch {
      toast.error("Failed to replay workflow");
    } finally {
      setTimeout(() => setExecutingWorkflowId(null), 1500);
    }
  };

  // Forward Workflow to Desktop Vision HUD
  const handleForwardToDesktopHud = async (wf: SyncedWorkflow) => {
    try {
      const res = await fetch("/api/mobile-stream/forward-to-desktop-hud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: wf }),
      });
      if (res.ok) {
        toast.success(`🚀 Forwarded "${wf.name}" to Live Desktop Vision HUD!`);
      }
    } catch {
      toast.error("Failed to forward to desktop");
    }
  };

  // Scheduled Workflow Execution Controls (Continue, Restart, Pause, Step)
  const handleScheduledWorkflowAction = async (
    scheduledWfId: string,
    action: "continue" | "restart" | "pause" | "step"
  ) => {
    setActiveScheduledActionId(scheduledWfId);
    try {
      const res = await fetch(`/api/mobile-stream/scheduled-workflows/${scheduledWfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || `Scheduled action "${action}" executed!`);
        fetchScheduledWorkflows();
      }
    } catch {
      toast.error(`Failed to ${action} scheduled workflow`);
    } finally {
      setTimeout(() => setActiveScheduledActionId(null), 1000);
    }
  };

  // 10-Screenshot Differential Recorder Engine
  const handleRecord10DifferentialScreenshots = async () => {
    if (isRecording10Pack) return;
    setIsRecording10Pack(true);
    setPackProgress(0);
    const collected: DifferentialFrame[] = [];

    toast.info("📸 Capturing 10 Differential Screenshots with action annotations...", { duration: 3000 });

    for (let i = 1; i <= 10; i++) {
      setPackProgress(i);
      setStatus(`Capturing frame #${i}/10 for Screenshot Workflow Pack...`);

      let currentImageData = "";
      if (canvasRef.current) {
        currentImageData = canvasRef.current.toDataURL("image/jpeg", 0.85);
      }

      const normX = Math.round((0.2 + (i % 3) * 0.3) * 100) / 100;
      const normY = Math.round((0.15 + Math.floor(i / 3) * 0.25) * 100) / 100;

      const actionTypes = ["tap", "swipe", "type_text", "key", "double_tap", "open_app"];
      const currentAction = i === 1 ? "open_app" : i === 10 ? "key" : actionTypes[i % actionTypes.length];

      const frameObj: DifferentialFrame = {
        id: `diff_frame_${Date.now()}_${i}`,
        stepNumber: i,
        imageData: currentImageData || `frame_${i}`,
        actionType: currentAction,
        x: normX,
        y: normY,
        description:
          i === 1
            ? "Step 1: Open Target App"
            : i === 10
            ? "Step 10: Complete Verification & Press HOME"
            : `Step ${i}: Execute ${currentAction} @ (${Math.round(normX * 100)}%, ${Math.round(normY * 100)}%)`,
        timestamp: Date.now(),
      };

      collected.push(frameObj);
      setTenFramesPack([...collected]);

      await new Promise((r) => setTimeout(r, 400));
    }

    setIsRecording10Pack(false);
    toast.success("✅ 10 Differential Screenshots Captured! Ready to compile workflow.");
    setActiveTab("pack10");
  };

  // Compile 10-Screenshot Pack into Workflow
  const handleCompile10PackWorkflow = async () => {
    if (tenFramesPack.length === 0) {
      toast.error("Please capture screenshots first");
      return;
    }

    try {
      const res = await fetch("/api/mobile-stream/screenshot-pack-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `10-Step Screenshot Pack (${new Date().toLocaleTimeString()})`,
          description: "10 differential screenshot steps with automated waypoints and execution plan",
          frames: tenFramesPack.map((f) => ({
            imageData: f.imageData,
            touchX: f.x,
            touchY: f.y,
            note: f.description,
          })),
          steps: tenFramesPack.map((f) => ({
            type: f.actionType,
            x: f.x,
            y: f.y,
            description: f.description,
          })),
          autoForwardToDesktop: true,
        }),
      });

      if (res.ok) {
        toast.success(`💾 Compiled & Saved 10-Step Workflow! Forwarded to Desktop HUD.`);
        fetchSyncedWorkflows();
        setActiveTab("workflows");
      }
    } catch {
      toast.error("Failed to compile workflow pack");
    }
  };

  // Create custom new workflow
  const handleSaveCustomWorkflow = async () => {
    if (!newWfName.trim()) {
      toast.error("Workflow name is required");
      return;
    }

    try {
      const actions =
        actionHistory.length > 0
          ? actionHistory.slice(0, 10).map((a, i) => ({
              id: `act_${Date.now()}_${i}`,
              type: "tap",
              x: 0.5,
              y: 0.5,
              description: a.desc,
            }))
          : [
              { id: "act_init", type: "tap", x: 0.5, y: 0.5, description: "Tap Target Button" },
              { id: "act_done", type: "key", key: "HOME", description: "Press HOME" },
            ];

      const res = await fetch("/api/mobile-stream/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWfName.trim(),
          description: newWfDesc.trim() || `Workflow with ${actions.length} action steps`,
          tags: ["mobile", "custom"],
          actions,
        }),
      });

      if (res.ok) {
        toast.success(`💾 Saved "${newWfName}"!`);
        setIsCreateWfModalOpen(false);
        setNewWfName("");
        setNewWfDesc("");
        fetchSyncedWorkflows();
      }
    } catch {
      toast.error("Failed to save workflow");
    }
  };

  // Touch handler for PC Mirror touch dispatch
  const handlePcMirrorTouch = (e: React.TouchEvent | React.MouseEvent) => {
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

    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setLastTouch({ x: normX, y: normY });
    setTimeout(() => setLastTouch(null), 800);

    fetch("/api/pyautogui/interactive-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "click",
        x: Math.round(normX * 1920),
        y: Math.round(normY * 1080),
        deviceMode: "desktop_mirror",
      }),
    }).catch(() => {});

    toast.success(`Tapped PC @ (${Math.round(normX * 100)}%, ${Math.round(normY * 100)}%)`);
  };

  // Touch handler for video modes
  const handleTouch = (e: React.TouchEvent | React.MouseEvent) => {
    if (streamMode === "live_view") {
      toast.info("👀 Live View is in Read-Only Mode. Tap 'Interactive Phone' above to interact with apps.", {
        duration: 2000,
      });
      return;
    }

    if (!touchAreaRef.current) return;
    const rect = touchAreaRef.current.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setLastTouch({ x, y });
    setTimeout(() => setLastTouch(null), 900);
  };

  const handleCaptureSnapshot = () => {
    if (!canvasRef.current) {
      toast.error("Stream canvas not ready");
      return;
    }
    try {
      const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.9);
      sendFrameToPC(dataUrl);
      toast.success("📸 High-res snapshot captured & synced to Desktop HUD!");
      setStatus("📸 Snapshot synced to Desktop Vision HUD!");
    } catch {
      toast.error("Failed to capture snapshot");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 max-w-md mx-auto select-none font-sans">
      {/* Top Status Header */}
      <div className="w-full text-center space-y-1.5 pt-1">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
            <Radio className={`w-3 h-3 ${connected ? "animate-pulse text-emerald-400" : "text-slate-500"}`} />
            {connected ? `LIVE (${framesSent} frames @ ${fps} FPS)` : "STANDBY READY"}
          </div>

          {lastLatencyMs > 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-600/40 text-[10px] font-mono text-cyan-300">
              <Activity className="w-2.5 h-2.5" /> {lastLatencyMs}ms
            </div>
          )}

          {wakeLockActive && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-950 border border-blue-600/40 text-[10px] font-mono text-blue-300">
              <Lock className="w-2.5 h-2.5" /> AWAKE
            </div>
          )}

          <button
            onClick={() => setIsApkModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-sky-950 to-indigo-950 border border-sky-500/40 hover:border-sky-400 text-[10px] font-mono text-sky-300 transition shadow-sm active:scale-95"
          >
            <Smartphone className="w-3 h-3 text-sky-400" />
            <span>APK & PWA</span>
            {isInstallable && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </button>
        </div>

        <h1 className="text-base font-black tracking-tight text-white flex items-center justify-center gap-2">
          <Smartphone className="w-5 h-5 text-cyan-400" /> Sightline Mobile Bridge & HUD
        </h1>
        <p className="text-[11px] text-slate-400">
          Interactive Phone OS • Live Telemetry View • Workspace Scheduled Workflows
        </p>

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

      {/* Active Linked App Scope Indicator */}
      {activeLinkedApp && (
        <div className="w-full my-1 p-2 rounded-xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/40 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
              ⚡
            </div>
            <div className="text-[10px] leading-tight">
              <span className="text-slate-400">Template Connect: </span>
              <span className="font-bold text-white">{activeLinkedApp.name}</span>
              <span className="text-[9px] text-indigo-300 block">Automation scoped to this app only</span>
            </div>
          </div>
          <button
            onClick={() => setActiveLinkedApp(null)}
            className="text-[9px] font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"
          >
            Clear Scope
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 1: LIVE STREAM / INTERACTIVE PHONE VIEWPORT */}
      {/* ---------------------------------------------------- */}
      {activeTab === "stream" && (
        <div className="w-full space-y-2">
          {/* Main Viewport Container */}
          <div className="w-full my-1 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 relative shadow-2xl aspect-[9/14] flex flex-col items-center justify-center">
            {/* 1. Primary Video Element for Real Screen Share & Camera */}
            <video
              ref={primaryVideoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-contain bg-black ${
                !isStreaming ||
                streamMode === "interactive_phone" ||
                streamMode === "live_view" ||
                streamMode === "mirror_pc"
                  ? "hidden"
                  : "block"
              }`}
            />

            {/* 2. Interactive Phone OS Component */}
            {isStreaming && (streamMode === "interactive_phone" || streamMode === "live_view") && (
              <div className="w-full h-full relative overflow-hidden bg-slate-950">
                <InteractivePhoneVirtualOS
                  onActionLogged={(action, details) => {
                    setStatus(`Action: ${action} - ${details}`);
                  }}
                />

                {/* Read-Only Badge Overlay if in Live View mode */}
                {streamMode === "live_view" && (
                  <div className="absolute top-2 left-2 right-2 z-30 pointer-events-none flex items-center justify-between p-1.5 rounded-lg bg-black/80 backdrop-blur border border-cyan-500/40 text-[10px] font-mono text-cyan-300 shadow-md">
                    <span className="flex items-center gap-1 font-bold">
                      <Eye className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> LIVE VIEW (READ-ONLY MIRROR)
                    </span>
                    <span className="text-[9px] text-slate-400">Touches Protected</span>
                  </div>
                )}
              </div>
            )}

            {/* 3. Live PC Screen Mirror & Controller */}
            {isStreaming && streamMode === "mirror_pc" && (
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

            {/* Processing Canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* AI Automated Action Visual Indicator Overlay */}
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

            {/* Touch surface for Video modes */}
            {isStreaming &&
              streamMode !== "interactive_phone" &&
              streamMode !== "live_view" &&
              streamMode !== "mirror_pc" && (
                <div
                  ref={touchAreaRef}
                  onTouchStart={handleTouch}
                  onTouchMove={handleTouch}
                  onClick={handleTouch}
                  className="absolute inset-0 z-10 cursor-crosshair"
                >
                  {lastTouch && (
                    <div
                      className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full border-2 border-cyan-400 bg-cyan-400/30 animate-ping pointer-events-none transition-all duration-75"
                      style={{
                        left: `${lastTouch.x * 100}%`,
                        top: `${lastTouch.y * 100}%`,
                      }}
                    />
                  )}
                </div>
              )}
          </div>

          {/* Mode Switcher Toolbar (Interactive vs Live View vs PC Mirror vs Camera) */}
          <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSwitchStreamSource("interactive_phone")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-all whitespace-nowrap ${
                streamMode === "interactive_phone"
                  ? "bg-emerald-600 text-white shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Interactive Phone with apps and full user/AI inputs"
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
              title="Viewing only - telepresence read-only screen mirror"
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
              title="Mirror Desktop PC Viewport"
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
              title="Live Unrestricted Camera"
            >
              <Camera className="w-3 h-3" /> Cam
            </button>
          </div>

          {/* Quick Hardware Action Bar */}
          <div className="grid grid-cols-4 gap-1.5">
            <Button
              onClick={() => setIsTemplateDrawerOpen(true)}
              className="h-8 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white gap-1"
              title="Template Connect - Linked Apps"
            >
              <Grid className="w-3 h-3" /> Home Apps
            </Button>
            <Button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("sightline-navigate-back"));
                }
              }}
              variant="outline"
              className="h-8 rounded-lg text-[11px] font-bold border-slate-700 bg-slate-800 text-slate-200 gap-1"
            >
              <ArrowLeft className="w-3 h-3 text-cyan-400" /> Back
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
        <div className="w-full flex-1 space-y-2.5 my-2">
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> Workspace Scheduled Workflows
              </span>
              <span className="text-[10px] text-slate-400">
                Auto-checked from workspace • Synced with this device
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchScheduledWorkflows}
              className="h-7 px-2 text-[10px] font-mono border-slate-700 text-slate-300 gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingScheduled ? "animate-spin text-amber-400" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>

          {/* Scheduled Workflows List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
            {scheduledWorkflows.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-dashed border-slate-800 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs text-slate-400 font-medium">No scheduled workflows queued for this phone</p>
                <p className="text-[10px] text-slate-500">
                  Workflows scheduled in the main Workspace or Automation tab will appear here automatically.
                </p>
              </div>
            ) : (
              scheduledWorkflows.map((sw) => (
                <div
                  key={sw.id}
                  className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-2 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-white">{sw.name}</h4>
                        <Badge
                          className={`text-[9px] py-0 px-1 font-mono ${
                            sw.status === "running"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                              : sw.status === "paused"
                              ? "bg-amber-950 text-amber-300 border-amber-700"
                              : "bg-indigo-950 text-indigo-300 border-indigo-800"
                          }`}
                        >
                          {sw.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{sw.description}</p>
                    </div>

                    {/* Progress Indicator */}
                    <span className="text-[10px] font-mono text-cyan-300 font-bold shrink-0">
                      Step {sw.currentStepIndex + 1}/{sw.totalSteps}
                    </span>
                  </div>

                  {/* Execution Control Buttons: Continue, Restart, Pause, Step */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                    <Button
                      size="sm"
                      onClick={() => handleScheduledWorkflowAction(sw.id, "continue")}
                      disabled={activeScheduledActionId === sw.id}
                      className="flex-1 h-7 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold gap-1 shadow-sm"
                    >
                      <Play className="w-3 h-3" />
                      <span>{sw.status === "paused" ? "Resume" : "Run / Continue"}</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScheduledWorkflowAction(sw.id, "restart")}
                      disabled={activeScheduledActionId === sw.id}
                      className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-[10px] font-bold gap-1"
                      title="Restart workflow from Step 1"
                    >
                      <RotateCcw className="w-3 h-3 text-cyan-400" />
                      <span>Restart</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScheduledWorkflowAction(sw.id, "pause")}
                      disabled={activeScheduledActionId === sw.id}
                      className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-[10px] font-bold"
                      title="Pause workflow"
                    >
                      <Pause className="w-3 h-3 text-amber-400" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScheduledWorkflowAction(sw.id, "step")}
                      disabled={activeScheduledActionId === sw.id}
                      className="h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-[10px] font-bold"
                      title="Step forward to next action"
                    >
                      <SkipForward className="w-3 h-3 text-purple-400" />
                    </Button>
                  </div>

                  {/* Scheduled Metadata */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                    <span>Target: {sw.targetDevice}</span>
                    <span>Next: {new Date(sw.nextRunTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: SYNCED WORKFLOWS HUD */}
      {/* ---------------------------------------------------- */}
      {activeTab === "workflows" && (
        <div className="w-full flex-1 space-y-2.5 my-2">
          {/* Top Bar: Search, New Workflow */}
          <div className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
            <Input
              value={workflowSearch}
              onChange={(e) => setWorkflowSearch(e.target.value)}
              placeholder="Search synced workflows..."
              className="h-7 text-xs bg-slate-950 border-slate-700 text-white"
            />
            <Button
              size="sm"
              onClick={() => setIsCreateWfModalOpen(true)}
              className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" /> +Save Workflow
            </Button>
          </div>

          {/* Workflows List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
            {workflows.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-dashed border-slate-800 space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs text-slate-400 font-medium">No synced workflows found</p>
                <p className="text-[10px] text-slate-500">
                  Record 10-Screenshots or save your action sequence to populate this deck.
                </p>
                <Button
                  size="sm"
                  onClick={handleRecord10DifferentialScreenshots}
                  className="h-7 text-xs bg-amber-600 hover:bg-amber-500 text-white gap-1"
                >
                  <Camera className="w-3.5 h-3.5" /> Capture 10-Screenshot Pack
                </Button>
              </div>
            ) : (
              workflows
                .filter(
                  (w) =>
                    !workflowSearch ||
                    w.name.toLowerCase().includes(workflowSearch.toLowerCase()) ||
                    w.tags.some((t) => t.toLowerCase().includes(workflowSearch.toLowerCase()))
                )
                .map((wf) => (
                  <div
                    key={wf.id}
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-2 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-white">{wf.name}</h4>
                          <Badge className="bg-indigo-950 text-indigo-300 border-indigo-800 text-[9px] py-0 px-1 font-mono">
                            {wf.actions?.length || 0} step(s)
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{wf.description}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Forward to Live Desktop Vision HUD */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleForwardToDesktopHud(wf)}
                          className="h-7 px-1.5 bg-purple-950/70 hover:bg-purple-900 text-purple-200 border-purple-700/60 text-[9px] font-mono gap-0.5"
                          title="Forward workflow to Live Desktop Screen Capture & Vision HUD"
                        >
                          <Layers className="w-2.5 h-2.5 text-purple-400" /> Link HUD
                        </Button>

                        {/* Run Workflow */}
                        <Button
                          size="sm"
                          onClick={() => handleReplayWorkflow(wf)}
                          disabled={executingWorkflowId === wf.id}
                          className="h-7 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold gap-1 shadow-sm"
                        >
                          {executingWorkflowId === wf.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          <span>Run</span>
                        </Button>
                      </div>
                    </div>

                    {/* Step Actions Preview */}
                    {wf.actions && wf.actions.length > 0 && (
                      <div className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                        <span className="text-[9px] font-mono text-slate-400 font-bold">Steps & Waypoints:</span>
                        <div className="space-y-0.5 max-h-16 overflow-y-auto pr-1">
                          {wf.actions.slice(0, 4).map((act, sIdx) => (
                            <div key={sIdx} className="text-[9px] font-mono text-slate-300 flex justify-between">
                              <span className="truncate text-cyan-300">
                                {sIdx + 1}. {act.description || act.type}
                              </span>
                              {typeof act.x === "number" && (
                                <span className="text-slate-500 shrink-0">
                                  ({Math.round(act.x * 100)}%, {Math.round((act.y || 0) * 100)}%)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: 10-SCREENSHOT DIFFERENTIAL PACK RECORDER */}
      {/* ---------------------------------------------------- */}
      {activeTab === "pack10" && (
        <div className="w-full flex-1 space-y-2.5 my-2">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" /> 10-Screenshot Differential Recorder
              </span>
              <span className="text-[10px] font-mono text-amber-300">
                {tenFramesPack.length}/10 Frames Recorded
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Capture 10 rapid differential screenshots to auto-generate a 10-step AI workflow pack.
            </p>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleRecord10DifferentialScreenshots}
                disabled={isRecording10Pack}
                className="flex-1 h-8 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-1.5 shadow-md"
              >
                {isRecording10Pack ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                {isRecording10Pack ? `Recording (${packProgress}/10)...` : "📸 Capture 10 Screenshots"}
              </Button>

              {tenFramesPack.length > 0 && (
                <Button
                  onClick={handleCompile10PackWorkflow}
                  className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1 shadow-md"
                >
                  <Save className="w-3.5 h-3.5" /> Compile & Save
                </Button>
              )}
            </div>
          </div>

          {/* 10 Frames Grid */}
          {tenFramesPack.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                Recorded Differential Screenshots & Steps:
              </span>
              <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {tenFramesPack.map((frame) => (
                  <div
                    key={frame.id}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-left relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-500/40 text-[9px] font-mono font-bold text-amber-300">
                        Step #{frame.stepNumber}
                      </span>
                      <span className="text-[9px] font-mono text-cyan-400">{frame.actionType}</span>
                    </div>

                    <div className="w-full h-16 rounded-lg overflow-hidden bg-black border border-slate-800 flex items-center justify-center relative">
                      {frame.imageData ? (
                        <img src={frame.imageData} alt={`Step ${frame.stepNumber}`} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-mono text-slate-500">Frame Snapshot #{frame.stepNumber}</span>
                      )}
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-cyan-400/80 border border-white" />
                    </div>

                    <p className="text-[9px] font-mono text-slate-300 truncate">{frame.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 5: FORWARDED AI ACTIONS FEED */}
      {/* ---------------------------------------------------- */}
      {activeTab === "actions" && (
        <div className="w-full flex-1 space-y-2.5 my-2">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" /> Live AI Automation Feed
            </span>
            <p className="text-[10px] text-slate-400">
              Live keystrokes, coordinates, hardware buttons and touch events received from PC.
            </p>
          </div>

          <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
            {actionHistory.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                No automation actions received yet. Dispatched actions from PC Deck will stream here.
              </div>
            ) : (
              actionHistory.map((item) => (
                <div key={item.id} className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold truncate">{item.desc}</span>
                  <span className="text-slate-500 text-[10px] shrink-0">{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bottom Status bar */}
      <div className="w-full p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
        <p className="text-[11px] font-mono text-cyan-400 font-medium truncate">{status}</p>
      </div>

      {/* Incoming Clipboard Paste Banner */}
      {incomingClipboardText && (
        <div className="fixed top-12 left-3 right-3 z-50 bg-indigo-950/95 border-2 border-indigo-400 text-white p-2.5 rounded-xl shadow-2xl animate-in slide-in-from-top duration-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
              <ClipboardCopy className="w-3.5 h-3.5 text-indigo-400" /> AI / PC Sent Text:
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950 px-1 rounded">Copied to Clipboard!</span>
          </div>
          <p className="text-xs font-mono font-bold truncate text-white bg-black/50 p-1.5 rounded">
            "{incomingClipboardText}"
          </p>
        </div>
      )}

      {/* Incoming App Launch Prompt Banner */}
      {incomingAppPrompt && (
        <div className="fixed top-12 left-3 right-3 z-50 bg-emerald-950/95 border-2 border-emerald-400 text-white p-2.5 rounded-xl shadow-2xl animate-in slide-in-from-top duration-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Open Target App:
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-black/40 px-1 rounded">1-Tap Launch</span>
          </div>
          <p className="text-xs font-bold text-white">
            {incomingAppPrompt.name}
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={() => {
                if (incomingAppPrompt.url) {
                  window.open(incomingAppPrompt.url, "_blank");
                }
                setIncomingAppPrompt(null);
              }}
              className="flex-1 h-7 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
            >
              Launch Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIncomingAppPrompt(null)}
              className="h-7 text-[10px] border-slate-700 text-slate-300"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Create Custom Workflow Modal */}
      {isCreateWfModalOpen && (
        <div
          onClick={() => setIsCreateWfModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5 text-indigo-400" /> Save / Compile New Workflow
              </span>
              <button onClick={() => setIsCreateWfModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400">Workflow Name:</label>
                <Input
                  value={newWfName}
                  onChange={(e) => setNewWfName(e.target.value)}
                  placeholder="e.g. Chrome Search & Navigate"
                  className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400">Description:</label>
                <Input
                  value={newWfDesc}
                  onChange={(e) => setNewWfDesc(e.target.value)}
                  placeholder="Brief description of steps..."
                  className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="ghost"
                onClick={() => setIsCreateWfModalOpen(false)}
                className="h-8 text-xs text-slate-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCustomWorkflow}
                className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Save Workflow
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE CONNECT - LINKED APP DRAWER / LAUNCHER MODAL */}
      {isTemplateDrawerOpen && (
        <div
          onClick={() => setIsTemplateDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end justify-center p-3 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="font-bold text-xs text-white">Template Connect — Linked Apps</h3>
                  <p className="text-[10px] text-slate-400">Run automation & AI isolated from that app only</p>
                </div>
              </div>
              <button
                onClick={() => setIsTemplateDrawerOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white bg-slate-900 border border-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1 no-scrollbar">
              {templateApps.map((tApp) => (
                <button
                  key={tApp.id}
                  onClick={() => {
                    setActiveLinkedApp(tApp);
                    if (tApp.appCode) {
                      setVirtualOsActiveApp(tApp.appCode);
                    }
                    if (tApp.targetUrl) {
                      setVirtualOsAppUrl(tApp.targetUrl);
                    }
                    setStreamMode("interactive_phone");
                    setActiveTab("stream");
                    setIsTemplateDrawerOpen(false);
                    toast.success(`⚡ Linked App Active: ${tApp.name}`);
                  }}
                  className="flex flex-col items-start gap-1 p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 transition-all text-left active:scale-95 group"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tApp.color} flex items-center justify-center text-white text-xs font-bold shadow-md`}>
                      ⚡
                    </div>
                    <span className="text-[9px] px-1 rounded bg-amber-950 border border-amber-600/40 text-amber-300 font-mono">
                      Isolated
                    </span>
                  </div>

                  <span className="text-[11px] font-bold text-white group-hover:text-amber-300 transition line-clamp-1">
                    {tApp.name}
                  </span>

                  <p className="text-[9px] text-slate-400 line-clamp-2 leading-tight">
                    {tApp.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono border-t border-slate-800/80">
              <span>Scope: Isolated App Execution</span>
              <button
                onClick={() => {
                  setVirtualOsActiveApp("home");
                  setActiveLinkedApp(null);
                  setIsTemplateDrawerOpen(false);
                  toast.info("Returned to Phone System Home");
                }}
                className="hover:text-cyan-400 text-slate-400"
              >
                Reset to Phone Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Android APK & WebAPK Solutions Modal */}
      <ApkAndPwaModal
        open={isApkModalOpen}
        onOpenChange={setIsApkModalOpen}
        onSelectMode={(mode) => {
          startStream(mode as any);
        }}
      />
    </div>
  );
}
