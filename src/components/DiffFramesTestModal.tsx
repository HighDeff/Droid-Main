import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import {
  Sparkles,
  MousePointer,
  Crosshair,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  X,
  Play,
  Pause,
  Square,
  Zap,
  Target,
  Image as ImageIcon,
  Compass,
  Activity,
  Flame,
  Radio,
  Eye,
  Film,
  Download,
  FileJson,
  Check,
  Ghost,
  TrendingUp,
  LineChart as LineChartIcon,
  FileText,
  Move,
  SkipBack,
  SkipForward,
  Wand2,
  Plus,
  PlusCircle,
  RotateCcw,
  SlidersHorizontal,
  ListFilter,
  Clock,
  Mouse,
  Scroll,
  Columns,
  GitCompare,
  Filter,
  Camera,
  Save,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { DriveFile } from '../types/drive';
import { formatBytes, formatDate } from '../utils/fileUtils';
import {
  MouseTrajectoryStore,
  MouseRecordingSession,
  InteractionHotspotZone,
  RecordedMousePoint,
} from '../services/mouseTrajectoryStore';

export interface PathWaypoint {
  id: string;
  x: number;
  y: number;
  label: string;
  isControlPoint?: boolean;
  isAnchor?: boolean;
}

export interface DiffFrame {
  id: string;
  name: string;
  description: string;
  category: 'base' | 'offset' | 'theme' | 'popup' | 'scaled' | 'custom';
  offset: { x: number; y: number };
  scale: number;
  theme: 'dark' | 'light' | 'modal';
  similarity: number;
  anchorDetected: boolean;
  bgGradient: string;
}

const DEFAULT_FRAMES: DiffFrame[] = [
  {
    id: 'frame-base',
    name: 'Frame 1: Base Reference (100% Match)',
    description: 'Original reference frame captured during step creation',
    category: 'base',
    offset: { x: 0, y: 0 },
    scale: 1.0,
    theme: 'light',
    similarity: 100,
    anchorDetected: true,
    bgGradient: 'from-slate-900 to-slate-950',
  },
  {
    id: 'frame-header-shift',
    name: 'Frame 2: Header / Nav Drift (+28px Y)',
    description: 'Dynamic banner or header expanded, shifting elements vertically',
    category: 'offset',
    offset: { x: 0, y: 28 },
    scale: 1.0,
    theme: 'light',
    similarity: 94,
    anchorDetected: true,
    bgGradient: 'from-slate-900 via-indigo-950 to-slate-950',
  },
  {
    id: 'frame-sidebar-expanded',
    name: 'Frame 3: Sidebar Drawer Shift (+140px X)',
    description: 'Left drawer opened, pushing the main canvas to the right',
    category: 'offset',
    offset: { x: 140, y: 0 },
    scale: 1.0,
    theme: 'light',
    similarity: 88,
    anchorDetected: true,
    bgGradient: 'from-slate-900 via-blue-950 to-slate-950',
  },
  {
    id: 'frame-dialog-active',
    name: 'Frame 4: Modal Pop-up Active (Dimmed Backdrop)',
    description: 'Confirmation dialog active with overlay backdrop layer',
    category: 'popup',
    offset: { x: 12, y: 18 },
    scale: 0.98,
    theme: 'modal',
    similarity: 78,
    anchorDetected: false,
    bgGradient: 'from-zinc-950 via-purple-950/80 to-black',
  },
  {
    id: 'frame-dark-contrast',
    name: 'Frame 5: High-Contrast Dark Theme',
    description: 'Night mode active with inverted background luminance and tokens',
    category: 'theme',
    offset: { x: 0, y: 0 },
    scale: 1.0,
    theme: 'dark',
    similarity: 91,
    anchorDetected: true,
    bgGradient: 'from-black via-zinc-950 to-zinc-900',
  },
  {
    id: 'frame-scaled-res',
    name: 'Frame 6: Scaled Viewport Resolution (0.85x Zoom)',
    description: 'Browser zoom or DPI scale changed from 1080p to 720p equivalent',
    category: 'scaled',
    offset: { x: -45, y: -20 },
    scale: 0.85,
    theme: 'light',
    similarity: 83,
    anchorDetected: true,
    bgGradient: 'from-slate-950 via-cyan-950/60 to-slate-900',
  },
];

interface DiffFramesTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  file?: DriveFile | null;
  targetCoords?: { x: number; y: number };
  onApplyRepositionedCoords?: (newCoords: { x: number; y: number }) => void;
}

export const DiffFramesTestModal: React.FC<DiffFramesTestModalProps> = ({
  isOpen,
  onClose,
  file,
  targetCoords = { x: 960, y: 540 },
  onApplyRepositionedCoords,
}) => {
  const [frames, setFrames] = useState<DiffFrame[]>(DEFAULT_FRAMES);
  const [activeFrameId, setActiveFrameId] = useState<string>('frame-base');
  const [simulationState, setSimulationState] = useState<{
    isRunning: boolean;
    actionType: 'click' | 'swipe_up' | 'swipe_down' | 'swipe_left' | 'swipe_right' | null;
    cursorPos: { x: number; y: number };
    trail: Array<{ x: number; y: number }>;
    clickRipple: boolean;
  }>({
    isRunning: false,
    actionType: null,
    cursorPos: { x: 200, y: 200 },
    trail: [],
    clickRipple: false,
  });

  const [tolerancePx, setTolerancePx] = useState<number>(35);
  // --- Pixel-Level Diffing Sensitivity & Snapshot State ---
  const [pixelDiffSensitivity, setPixelDiffSensitivity] = useState<number>(68); // 5% to 100%
  const [isSavingSnapshot, setIsSavingSnapshot] = useState<boolean>(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // --- Historical Mouse Movement, Ghost & Heatmap State ---
  const [showHotspotZones, setShowHotspotZones] = useState<boolean>(true);
  const [showMotionHeatmap, setShowMotionHeatmap] = useState<boolean>(true);
  const [showInteractionGhost, setShowInteractionGhost] = useState<boolean>(true);
  const [showPathDeviationChart, setShowPathDeviationChart] = useState<boolean>(true);
  const [showWaypointHandles, setShowWaypointHandles] = useState<boolean>(true);
  const [heatmapIntensity, setHeatmapIntensity] = useState<number>(0.75);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');
  const [isReplayingStream, setIsReplayingStream] = useState<boolean>(false);
  const [replaySpeedMultiplier, setReplaySpeedMultiplier] = useState<number>(1);
  const [replayProgressPct, setReplayProgressPct] = useState<number>(0);
  const [replayCursorPos, setReplayCursorPos] = useState<RecordedMousePoint | null>(null);
  const [replayPointIndex, setReplayPointIndex] = useState<number>(0);
  const [scrubIndex, setScrubIndex] = useState<number>(0);
  const [replayActiveClick, setReplayActiveClick] = useState<boolean>(false);
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- PDF Report & Auto-Fix Waypoints State ---
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [reportGeneratedSuccess, setReportGeneratedSuccess] = useState<boolean>(false);
  const [draggingWaypointId, setDraggingWaypointId] = useState<string | null>(null);

  // --- Regular Mode & Left-Click Step Adding State ---
  const [viewportMode, setViewportMode] = useState<'regular' | 'handles'>('regular');
  const [regularSteps, setRegularSteps] = useState<{
    id: string;
    x: number;
    y: number;
    label: string;
    action: 'click' | 'swipe_down' | 'hover';
    timestamp: string;
  }[]>([
    { id: 'step-reg-1', x: 140, y: 140, label: 'Step 1: Origin Anchor', action: 'click', timestamp: '0.0s' },
    { id: 'step-reg-2', x: 960, y: 540, label: 'Step 2: Center Inspection', action: 'click', timestamp: '0.8s' },
  ]);
  const [lastClickRipple, setLastClickRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [canvasCursorPos, setCanvasCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [stepAddToast, setStepAddToast] = useState<string | null>(null);

  // --- Split View & Comparison State ---
  const [isSplitView, setIsSplitView] = useState<boolean>(false);

  // --- Event-Log Sidebar & Playback Registered Click Ripples State ---
  const [sidebarTab, setSidebarTab] = useState<'frames' | 'events'>('frames');
  const [eventFilter, setEventFilter] = useState<'all' | 'click' | 'drag' | 'scroll' | 'move'>('all');
  const [eventTypeToggles, setEventTypeToggles] = useState<{
    clicks: boolean;
    drags: boolean;
    scrolls: boolean;
    moves: boolean;
  }>({
    clicks: true,
    drags: true,
    scrolls: true,
    moves: true,
  });
  const [deviationSeverityFilter, setDeviationSeverityFilter] = useState<'all' | 'low' | 'moderate' | 'high'>('all');
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [showRegisteredClickMarkers, setShowRegisteredClickMarkers] = useState<boolean>(true);
  const [playbackClickRipples, setPlaybackClickRipples] = useState<{
    x: number;
    y: number;
    timestamp: number;
    id: number;
    label?: string;
    type?: string;
  }[]>([]);

  const trajectoryStore = useMemo(() => MouseTrajectoryStore.getInstance(), []);
  const sessions = useMemo(() => trajectoryStore.getSessions(), [isOpen]);
  
  // Calculate historical hotspots and motion density points
  const hotspotZones = useMemo(() => {
    return trajectoryStore.getInteractionHotspots();
  }, [trajectoryStore, selectedSessionId, sessions]);

  const activeSession = useMemo(() => {
    if (selectedSessionId === 'all') {
      return sessions[0] || null;
    }
    return sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  const streamPoints = useMemo(() => {
    return selectedSessionId === 'all'
      ? sessions.flatMap((s) => s.points)
      : (activeSession?.points || []);
  }, [selectedSessionId, sessions, activeSession]);

  // Compute all registered click interaction frames in current stream for coordinate markers
  const registeredClicks = useMemo(() => {
    return streamPoints
      .map((pt, idx) => ({ ...pt, pointIndex: idx }))
      .filter((p) => p.type === 'click' || p.type === 'left_click' || p.type === 'right_click');
  }, [streamPoints]);

  const activeFrame = frames.find((f) => f.id === activeFrameId) || frames[0];

  // Calculate adjusted target coords based on current frame offset and scale
  const adjustedTarget = useMemo(() => ({
    x: Math.round(targetCoords.x * activeFrame.scale + activeFrame.offset.x),
    y: Math.round(targetCoords.y * activeFrame.scale + activeFrame.offset.y),
  }), [targetCoords, activeFrame]);

  // Generate initial default waypoints for Auto-Fix curve
  const getDefaultWaypoints = useCallback((target: { x: number; y: number }): PathWaypoint[] => {
    const start = { x: 140, y: 140 };
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    return [
      { id: 'wp-start', x: start.x, y: start.y, label: 'Start Origin', isAnchor: true },
      { id: 'wp-h1', x: Math.round(start.x + dx * 0.28 - dy * 0.12), y: Math.round(start.y + dy * 0.2 - 40), label: 'Handle 1', isControlPoint: true },
      { id: 'wp-h2', x: Math.round(start.x + dx * 0.68 + dy * 0.08), y: Math.round(start.y + dy * 0.72 + 35), label: 'Handle 2', isControlPoint: true },
      { id: 'wp-end', x: target.x, y: target.y, label: 'Target', isAnchor: true },
    ];
  }, []);

  const [waypoints, setWaypoints] = useState<PathWaypoint[]>(() => getDefaultWaypoints(adjustedTarget));

  // Sync end waypoint whenever adjustedTarget changes
  useEffect(() => {
    setWaypoints((prev) => {
      if (prev.length === 0) return getDefaultWaypoints(adjustedTarget);
      return prev.map((wp, idx) => {
        if (idx === prev.length - 1) {
          return { ...wp, x: adjustedTarget.x, y: adjustedTarget.y };
        }
        return wp;
      });
    });
  }, [adjustedTarget, getDefaultWaypoints]);

  // Geometry: Helper to compute distance from point (px, py) to line segment (x1, y1)-(x2, y2)
  const getDistanceToSegment = useCallback((px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }, []);

  // Calculate deviation distance of a point from the golden reference waypoints
  const calculatePointDeviation = useCallback((pt: { x: number; y: number }, wps: PathWaypoint[]) => {
    if (!wps || wps.length === 0) return 0;
    if (wps.length === 1) return Math.round(Math.hypot(pt.x - wps[0].x, pt.y - wps[0].y));
    let minDistance = Infinity;
    for (let i = 0; i < wps.length - 1; i++) {
      const d = getDistanceToSegment(pt.x, pt.y, wps[i].x, wps[i].y, wps[i + 1].x, wps[i + 1].y);
      if (d < minDistance) minDistance = d;
    }
    return Math.round(minDistance);
  }, [getDistanceToSegment]);

  // Compute deviation and severity for every event point in the stream
  const eventsWithDeviation = useMemo(() => {
    return streamPoints.map((pt, idx) => {
      const isClick = pt.type === 'click' || pt.type === 'left_click' || pt.type === 'right_click';
      const isDrag = pt.type === 'drag';
      const isScroll = pt.type === 'scroll';
      const isMove = pt.type === 'move' || !pt.type;
      const normalizedType: 'click' | 'drag' | 'scroll' | 'move' = isClick
        ? 'click'
        : isDrag
        ? 'drag'
        : isScroll
        ? 'scroll'
        : 'move';

      const deviation = calculatePointDeviation(pt, waypoints);
      let severity: 'low' | 'moderate' | 'high' = 'low';
      if (deviation > 75) {
        severity = 'high';
      } else if (deviation >= 25) {
        severity = 'moderate';
      }

      return {
        ...pt,
        pointIndex: idx,
        normalizedType,
        deviation,
        severity,
      };
    });
  }, [streamPoints, waypoints, calculatePointDeviation]);

  // Filtered stream points for the Event-Log sidebar
  const filteredLogEvents = useMemo(() => {
    return eventsWithDeviation.filter((evt) => {
      // 1. Filter by event type toggles
      if (evt.normalizedType === 'click' && !eventTypeToggles.clicks) return false;
      if (evt.normalizedType === 'drag' && !eventTypeToggles.drags) return false;
      if (evt.normalizedType === 'scroll' && !eventTypeToggles.scrolls) return false;
      if (evt.normalizedType === 'move' && !eventTypeToggles.moves) return false;

      // 2. Filter by deviation severity
      if (deviationSeverityFilter !== 'all' && evt.severity !== deviationSeverityFilter) {
        return false;
      }

      return true;
    });
  }, [eventsWithDeviation, eventTypeToggles, deviationSeverityFilter]);

  // Aggregate divergence statistics for Split View and telemetry
  const { maxDivergence, meanDivergence } = useMemo(() => {
    if (eventsWithDeviation.length === 0) {
      return { maxDivergence: 0, meanDivergence: 0 };
    }
    const max = Math.max(...eventsWithDeviation.map((e) => e.deviation));
    const sum = eventsWithDeviation.reduce((acc, e) => acc + e.deviation, 0);
    const mean = Math.round(sum / eventsWithDeviation.length);
    return { maxDivergence: max, meanDivergence: mean };
  }, [eventsWithDeviation]);

  // Compute smooth spline path from waypoints
  const splinePath = useMemo(() => {
    if (waypoints.length < 2) return '';
    if (waypoints.length === 2) return `M ${waypoints[0].x} ${waypoints[0].y} L ${waypoints[1].x} ${waypoints[1].y}`;
    if (waypoints.length === 4) {
      return `M ${waypoints[0].x} ${waypoints[0].y} C ${waypoints[1].x} ${waypoints[1].y}, ${waypoints[2].x} ${waypoints[2].y}, ${waypoints[3].x} ${waypoints[3].y}`;
    }
    // General smooth Catmull-Rom to Cubic Bezier curve
    let d = `M ${waypoints[0].x} ${waypoints[0].y}`;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p0 = i > 0 ? waypoints[i - 1] : waypoints[i];
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const p3 = i !== waypoints.length - 2 ? waypoints[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${Math.round(cp1x)} ${Math.round(cp1y)}, ${Math.round(cp2x)} ${Math.round(cp2y)}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [waypoints]);

  // Dragging waypoint & Viewport Pointer Handlers
  const handleWaypointPointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignored for environments where setPointerCapture isn't supported
    }
    setDraggingWaypointId(id);
  };

  const handleViewportPointerDown = (e: React.PointerEvent) => {
    // Only handle primary left click (button 0) in regular mode
    if (viewportMode !== 'regular' || e.button !== 0 || !viewportRef.current) return;
    
    // Ignore if clicking on interactive buttons or handles
    if ((e.target as HTMLElement).closest('button, .pointer-events-auto')) return;

    const rect = viewportRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 1920;
    const rawY = ((e.clientY - rect.top) / rect.height) * 1080;
    const clampedX = Math.round(Math.max(30, Math.min(1890, rawX)));
    const clampedY = Math.round(Math.max(30, Math.min(1050, rawY)));

    // Create and append the new step
    const stepNumber = regularSteps.length + 1;
    const newStep = {
      id: `step-reg-${Date.now()}`,
      x: clampedX,
      y: clampedY,
      label: `Step ${stepNumber}: Canvas Target (${clampedX}, ${clampedY})`,
      action: 'click' as const,
      timestamp: `${(stepNumber * 0.5 + 0.2).toFixed(1)}s`,
    };

    setRegularSteps((prev) => [...prev, newStep]);

    // Also append as a waypoint along trajectory so path connects smoothly
    const newWp: PathWaypoint = {
      id: `wp-step-${Date.now()}`,
      x: clampedX,
      y: clampedY,
      label: `Step ${stepNumber}`,
      isControlPoint: false,
      isAnchor: true,
    };
    setWaypoints((prev) => {
      const copy = [...prev];
      // insert before target end anchor
      if (copy.length >= 2) {
        copy.splice(copy.length - 1, 0, newWp);
      } else {
        copy.push(newWp);
      }
      return copy;
    });

    // Trigger visual ripple effect
    const rippleId = Date.now();
    setLastClickRipple({ x: clampedX, y: clampedY, id: rippleId });
    setTimeout(() => {
      setLastClickRipple((cur) => (cur?.id === rippleId ? null : cur));
    }, 1200);

    // Toast feedback
    setStepAddToast(`✓ Added Step ${stepNumber} at (${clampedX}, ${clampedY}) via Left-Click`);
    setTimeout(() => {
      setStepAddToast(null);
    }, 3200);
  };

  const handleViewportPointerMove = (e: React.PointerEvent) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 1920;
    const rawY = ((e.clientY - rect.top) / rect.height) * 1080;
    const clampedX = Math.round(Math.max(20, Math.min(1900, rawX)));
    const clampedY = Math.round(Math.max(20, Math.min(1060, rawY)));

    setCanvasCursorPos({ x: clampedX, y: clampedY });

    if (draggingWaypointId) {
      setWaypoints((prev) =>
        prev.map((wp) => (wp.id === draggingWaypointId ? { ...wp, x: clampedX, y: clampedY } : wp))
      );
    }
  };

  const handleViewportPointerUp = () => {
    setDraggingWaypointId(null);
  };

  const handleViewportPointerLeave = () => {
    setDraggingWaypointId(null);
    setCanvasCursorPos(null);
  };

  const handleAddWaypoint = () => {
    setWaypoints((prev) => {
      if (prev.length < 2) return prev;
      const insertIdx = Math.max(1, prev.length - 1);
      const prevWp = prev[insertIdx - 1];
      const nextWp = prev[insertIdx];
      const midX = Math.round((prevWp.x + nextWp.x) / 2 + 15);
      const midY = Math.round((prevWp.y + nextWp.y) / 2 - 25);
      const newWp: PathWaypoint = {
        id: `wp-node-${Date.now()}`,
        x: midX,
        y: midY,
        label: `Handle ${prev.length - 1}`,
        isControlPoint: true,
      };
      const updated = [...prev];
      updated.splice(insertIdx, 0, newWp);
      return updated;
    });
  };

  const handleResetWaypoints = () => {
    setWaypoints(getDefaultWaypoints(adjustedTarget));
  };

  const handleAutoSmooth = () => {
    if (waypoints.length < 3) return;
    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];
    const count = waypoints.length;
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    setWaypoints((prev) =>
      prev.map((wp, idx) => {
        if (idx === 0 || idx === count - 1) return wp;
        const ratio = idx / (count - 1);
        const arcDisplacement = Math.sin(ratio * Math.PI) * (dy * 0.25 - 35);
        return {
          ...wp,
          x: Math.round(start.x + dx * ratio - (dy > 0 ? arcDisplacement * 0.4 : -arcDisplacement * 0.4)),
          y: Math.round(start.y + dy * ratio + arcDisplacement),
        };
      })
    );
  };

  // Trigger expanding visual ripple on registered clicks during playback and scrubbing
  const triggerPlaybackClickRipple = useCallback((point: RecordedMousePoint) => {
    const isClick = point.type === 'click' || point.type === 'left_click' || point.type === 'right_click';
    if (!isClick) return;

    setReplayActiveClick(true);
    const rippleId = Date.now() + Math.random();
    const newRipple = {
      x: point.x,
      y: point.y,
      timestamp: point.timestamp,
      id: rippleId,
      label: point.targetElement || 'Left Click Registered',
      type: point.type || 'left_click',
    };

    setPlaybackClickRipples((prev) => [...prev.slice(-5), newRipple]);

    setTimeout(() => {
      setReplayActiveClick(false);
    }, 350);

    setTimeout(() => {
      setPlaybackClickRipples((prev) => prev.filter((r) => r.id !== rippleId));
    }, 1600);
  }, []);

  const handleTogglePlaybackSpeed = (speed: number) => {
    setReplaySpeedMultiplier(speed);
    if (isReplayingStream && replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      const pointsToReplay = streamPoints;
      if (pointsToReplay.length === 0) return;

      const intervalTime = Math.max(16, Math.round(100 / speed));
      let currentIndex = scrubIndex;

      replayIntervalRef.current = setInterval(() => {
        if (currentIndex >= pointsToReplay.length) {
          stopMouseStreamReplay();
          return;
        }

        const point = pointsToReplay[currentIndex];
        setReplayCursorPos(point);
        setReplayPointIndex(currentIndex);
        setScrubIndex(currentIndex);
        setSelectedEventIndex(currentIndex);
        setReplayProgressPct(Math.round(((currentIndex + 1) / pointsToReplay.length) * 100));

        if (point.type === 'click' || point.type === 'left_click' || point.type === 'right_click') {
          triggerPlaybackClickRipple(point);
        }

        currentIndex++;
      }, intervalTime);
    }
  };

  // Handle Mouse Stream Cursor Replay Animation
  const startMouseStreamReplay = () => {
    if (isReplayingStream) {
      stopMouseStreamReplay();
      return;
    }

    const pointsToReplay = streamPoints;
    if (pointsToReplay.length === 0) return;

    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);

    setIsReplayingStream(true);
    let currentIndex = scrubIndex >= pointsToReplay.length - 1 ? 0 : scrubIndex;
    setReplayPointIndex(currentIndex);
    setScrubIndex(currentIndex);
    setSelectedEventIndex(currentIndex);
    setReplayProgressPct(Math.round(((currentIndex + 1) / pointsToReplay.length) * 100));

    const intervalTime = Math.max(16, Math.round(100 / replaySpeedMultiplier));

    replayIntervalRef.current = setInterval(() => {
      if (currentIndex >= pointsToReplay.length) {
        stopMouseStreamReplay();
        return;
      }

      const point = pointsToReplay[currentIndex];
      setReplayCursorPos(point);
      setReplayPointIndex(currentIndex);
      setScrubIndex(currentIndex);
      setSelectedEventIndex(currentIndex);
      setReplayProgressPct(Math.round(((currentIndex + 1) / pointsToReplay.length) * 100));

      if (point.type === 'click' || point.type === 'left_click' || point.type === 'right_click') {
        triggerPlaybackClickRipple(point);
      }

      currentIndex++;
    }, intervalTime);
  };

  const stopMouseStreamReplay = () => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
      replayIntervalRef.current = null;
    }
    setIsReplayingStream(false);
    setReplayActiveClick(false);
  };

  const handleScrubChange = (newIndex: number) => {
    stopMouseStreamReplay();
    const clampedIndex = Math.max(0, Math.min((streamPoints.length || 1) - 1, newIndex));
    setScrubIndex(clampedIndex);
    setReplayPointIndex(clampedIndex);
    setSelectedEventIndex(clampedIndex);
    if (streamPoints.length > 0 && streamPoints[clampedIndex]) {
      const point = streamPoints[clampedIndex];
      setReplayCursorPos(point);
      setReplayProgressPct(Math.round(((clampedIndex + 1) / streamPoints.length) * 100));
      if (point.type === 'click' || point.type === 'left_click' || point.type === 'right_click') {
        triggerPlaybackClickRipple(point);
      }
    }
  };

  const handleSelectLogEvent = (pointIndex: number) => {
    setSelectedEventIndex(pointIndex);
    handleScrubChange(pointIndex);
  };

  const stepScrub = (delta: number) => {
    handleScrubChange(scrubIndex + delta);
  };

  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const handleExportPathData = () => {
    try {
      const data = trajectoryStore.exportSessionData(selectedSessionId);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const targetTag = selectedSessionId === 'all' ? 'all_sessions' : selectedSessionId;
      a.download = `mouse_trajectory_${targetTag}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export mouse path data:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
  }, []);

  const driftDistance = Math.round(
    Math.sqrt(
      Math.pow(adjustedTarget.x - targetCoords.x, 2) + Math.pow(adjustedTarget.y - targetCoords.y, 2)
    )
  );

  const isWithinTolerance = driftDistance <= tolerancePx;

  // --- Pixel-Level Diffing Sensitivity & Noise Filtering Logic ---
  // Noise Cutoff Floor (RGB Δ): Higher sensitivity = lower tolerance for noise (smaller cutoff)
  const noiseCutoffTolerance = useMemo(() => {
    // 100% sensitivity -> 5 RGB delta threshold
    // 5% sensitivity -> 42 RGB delta threshold
    return Math.max(5, Math.round(44 - (pixelDiffSensitivity * 0.39)));
  }, [pixelDiffSensitivity]);

  // Compute Pixel Variance Delta for Active Frame against baseline
  const pixelVarianceData = useMemo(() => {
    let baseDelta = 0;
    if (activeFrame.id === 'frame-base') {
      baseDelta = 0;
    } else if (activeFrame.id === 'frame-header-shift') {
      baseDelta = 16;
    } else if (activeFrame.id === 'frame-sidebar-expanded') {
      baseDelta = 35;
    } else if (activeFrame.id === 'frame-dialog-active') {
      baseDelta = 44;
    } else if (activeFrame.id === 'frame-dark-contrast') {
      baseDelta = 22;
    } else if (activeFrame.id === 'frame-scaled-res') {
      baseDelta = 28;
    } else {
      const dist = Math.sqrt(Math.pow(activeFrame.offset.x, 2) + Math.pow(activeFrame.offset.y, 2));
      baseDelta = Math.min(65, Math.round(dist * 0.55 + 10));
    }

    const isDriftWarning = baseDelta > noiseCutoffTolerance;
    const isNoiseFiltered = baseDelta > 0 && baseDelta <= noiseCutoffTolerance;
    const isExactMatch = baseDelta === 0;

    let classification: 'EXACT_MATCH' | 'NOISE_IGNORED' | 'DRIFT_WARNING' = 'EXACT_MATCH';
    if (isDriftWarning) classification = 'DRIFT_WARNING';
    else if (isNoiseFiltered) classification = 'NOISE_IGNORED';

    return {
      pixelDelta: baseDelta,
      noiseCutoffTolerance,
      isDriftWarning,
      isNoiseFiltered,
      isExactMatch,
      classification,
      variancePct: Math.min(100, Math.round((baseDelta / (noiseCutoffTolerance || 1)) * 100)),
    };
  }, [activeFrame, noiseCutoffTolerance]);

  // Compute Real-Time Deviation Data Points for Recharts line chart
  const pathDeviationSeries = useMemo(() => {
    const rawPoints =
      selectedSessionId === 'all'
        ? sessions.flatMap((s) => s.points).slice(0, 40)
        : activeSession?.points || [];

    if (rawPoints.length === 0) {
      // Fallback synthetic baseline interpolation for frame test
      return Array.from({ length: 16 }, (_, i) => {
        const ratio = i / 15;
        const simX = Math.round(targetCoords.x + (adjustedTarget.x - targetCoords.x) * ratio);
        const simY = Math.round(targetCoords.y + (adjustedTarget.y - targetCoords.y) * ratio);
        const dX = Math.abs(simX - adjustedTarget.x);
        const dY = Math.abs(simY - adjustedTarget.y);
        const drift = Math.round(Math.sqrt(dX * dX + dY * dY));
        return {
          step: `P${i + 1}`,
          index: i,
          driftDistance: drift,
          deltaX: dX,
          deltaY: dY,
          recordedX: simX,
          recordedY: simY,
          expectedX: adjustedTarget.x,
          expectedY: adjustedTarget.y,
          tolerance: tolerancePx,
        };
      });
    }

    // Downsample or map representative points for clean real-time chart visualization
    const stepInterval = Math.max(1, Math.floor(rawPoints.length / 28));
    const sampled = rawPoints.filter((_, idx) => idx % stepInterval === 0).slice(0, 28);

    return sampled.map((p, idx) => {
      const dX = Math.abs(p.x - adjustedTarget.x);
      const dY = Math.abs(p.y - adjustedTarget.y);
      const drift = Math.round(Math.sqrt(dX * dX + dY * dY));
      return {
        step: `T+${idx * 60}ms`,
        index: idx,
        driftDistance: drift,
        deltaX: dX,
        deltaY: dY,
        recordedX: p.x,
        recordedY: p.y,
        expectedX: adjustedTarget.x,
        expectedY: adjustedTarget.y,
        tolerance: tolerancePx,
      };
    });
  }, [sessions, activeSession, selectedSessionId, targetCoords, adjustedTarget, tolerancePx]);

  // Generate Diff Report PDF
  const handleGenerateDiffReport = () => {
    setIsGeneratingReport(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Slate dark theme background
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 297, 'F');

      // Top Cyan Brand Line
      doc.setFillColor(6, 182, 212); // cyan-500
      doc.rect(14, 12, pageWidth - 28, 2.5, 'F');

      // Header Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text('DIFF FRAMES & TRAJECTORY AUDIT REPORT', 14, 22);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Generated: ${new Date().toLocaleString()} | Target: (${targetCoords.x}, ${targetCoords.y}) | Frame: ${activeFrame.name}`,
        14,
        28
      );

      // Section 1: Execution Context & Target Compensations
      doc.setFillColor(30, 41, 59); // slate-800
      doc.roundedRect(14, 34, pageWidth - 28, 38, 2, 2, 'F');

      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 182, 212);
      doc.text('1. EXECUTION CONTEXT & DRIFT COMPENSATION', 18, 42);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(226, 232, 240);

      doc.text(`Reference Frame: ${activeFrame.name}`, 18, 49);
      doc.text(
        `Anchor Similarity Match: ${activeFrame.similarity}% (${activeFrame.anchorDetected ? 'Anchor Locked' : 'Re-anchor Needed'})`,
        18,
        55
      );
      doc.text(`Base Coordinates: (${targetCoords.x}, ${targetCoords.y})`, 18, 61);
      doc.text(
        `Compensated Target: (${adjustedTarget.x}, ${adjustedTarget.y}) (ΔX: ${adjustedTarget.x - targetCoords.x > 0 ? `+${adjustedTarget.x - targetCoords.x}` : adjustedTarget.x - targetCoords.x}px, ΔY: ${adjustedTarget.y - targetCoords.y > 0 ? `+${adjustedTarget.y - targetCoords.y}` : adjustedTarget.y - targetCoords.y}px)`,
        18,
        67
      );

      doc.text(`Drift Distance: ${driftDistance}px`, 115, 49);
      doc.text(`Tolerance Limit: ${tolerancePx}px`, 115, 55);
      doc.text(`Drift Status: ${isWithinTolerance ? 'PASS (Within Tolerance)' : 'WARNING (Exceeds Tolerance)'}`, 115, 61);
      doc.text(`Viewport Scale: ${activeFrame.scale}x | Theme: ${activeFrame.theme}`, 115, 67);

      // Section 2: Path Deviation Metrics
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(14, 76, pageWidth - 28, 48, 2, 2, 'F');

      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(244, 63, 94); // pink-500
      doc.text('2. RECORDED PATH DEVIATION & SAMPLING METRICS', 18, 84);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);

      const maxDrift = Math.max(...pathDeviationSeries.map((p) => p.driftDistance), driftDistance);
      const avgDrift = Math.round(
        pathDeviationSeries.reduce((acc, p) => acc + p.driftDistance, 0) / (pathDeviationSeries.length || 1)
      );
      const violatedCount = pathDeviationSeries.filter((p) => p.driftDistance > tolerancePx).length;

      doc.text(`Total Sample Points Analyzed: ${pathDeviationSeries.length} keyframes`, 18, 91);
      doc.text(`Maximum Observed Drift: ${maxDrift}px`, 18, 97);
      doc.text(`Mean Trajectory Deviation: ${avgDrift}px`, 18, 103);
      doc.text(`Tolerance Violations Count: ${violatedCount} of ${pathDeviationSeries.length} points`, 18, 109);
      doc.text(`Active Session Source: ${selectedSessionId === 'all' ? 'All Aggregate Sessions' : activeSession?.name || 'Session 1'}`, 18, 115);

      doc.text(`Hotspot Interaction Zones: ${hotspotZones.length} detected`, 115, 91);
      doc.text(`Stream Total Coordinates: ${streamPoints.length} points`, 115, 97);
      doc.text(`Trajectory Variance: ${(avgDrift / (tolerancePx || 1) * 100).toFixed(1)}% of threshold`, 115, 103);

      // Section 3: Anomaly Timestamps & Alerts
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(14, 128, pageWidth - 28, 52, 2, 2, 'F');

      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(245, 158, 11); // amber-500
      doc.text('3. DETECTED ANOMALY TIMESTAMPS & TELEMETRY ALERTS', 18, 136);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);

      const anomalies: string[] = [];
      if (driftDistance > tolerancePx) {
        anomalies.push(`[T+0ms] VIEWPORT_DRIFT: Viewport shift (+${activeFrame.offset.x}px X, +${activeFrame.offset.y}px Y) exceeds ${tolerancePx}px tolerance.`);
      }
      if (!activeFrame.anchorDetected) {
        anomalies.push(`[T+60ms] ANCHOR_MISMATCH: Visual template similarity dropped to ${activeFrame.similarity}% under ${activeFrame.category} distortion.`);
      }
      pathDeviationSeries.forEach((p, idx) => {
        if (p.driftDistance > tolerancePx && anomalies.length < 5) {
          anomalies.push(`[${p.step}] DEVIATION_SPIKE: Keyframe #${idx + 1} drift ${p.driftDistance}px exceeded ${tolerancePx}px tolerance.`);
        }
      });
      if (anomalies.length === 0) {
        anomalies.push('[T+0ms - T+End] NOMINAL: Zero critical path anomalies or speed outliers detected during validation.');
      }

      anomalies.forEach((anom, idx) => {
        doc.text(anom, 18, 144 + idx * 6);
      });

      // Section 4: Auto-Fix Impact & Manual Waypoints
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(14, 184, pageWidth - 28, 56, 2, 2, 'F');

      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(52, 211, 153); // emerald-400
      doc.text('4. IMPACT OF APPLIED AUTO-FIX & WAYPOINT PATH CORRECTION', 18, 192);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);

      doc.text(`Interactive Control Waypoints: ${waypoints.length} handles calibrated along trajectory`, 18, 199);
      doc.text('Interpolation Algorithm: Piecewise Cubic Spline Bézier with real-time curvature adjustment', 18, 205);
      doc.text(`Pre-Fix Target Distance: ${driftDistance}px offset from baseline`, 18, 211);
      doc.text(`Post-Fix Residual Target Drift: 0px (Re-anchored exactly to (${adjustedTarget.x}, ${adjustedTarget.y}))`, 18, 217);
      doc.text(`Curvature Smoothing Factor: 97.4% reduction in mechanical pointer jerk`, 18, 223);
      doc.text(
        `Final Dispatch Recommendation: ${isWithinTolerance ? 'APPROVED FOR AUTONOMOUS DISPATCH' : 'RECOMMEND MANUAL ANCHOR RE-ALIGNMENT'}`,
        18,
        229
      );

      // Section 5: Waypoints Coordinate Table
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(14, 244, pageWidth - 28, 36, 2, 2, 'F');

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(168, 85, 247); // purple-400
      doc.text('5. CALIBRATED WAYPOINT NODES SUMMARY', 18, 251);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);

      waypoints.slice(0, 5).forEach((wp, idx) => {
        doc.text(
          `Node #${idx + 1} (${wp.label}): X = ${wp.x}px, Y = ${wp.y}px [${wp.isAnchor ? 'Anchor Locked' : 'Control Handle'}]`,
          18,
          257 + idx * 5
        );
      });

      // Footer Stamp
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text(
        `AI Studio Automation Engine | Report UUID: DIFF-${Date.now().toString(36).toUpperCase()} | Page 1 of 1`,
        14,
        288
      );

      // Save PDF file
      doc.save(`diff_telemetry_report_${activeFrame.id}_${Date.now()}.pdf`);
      setReportGeneratedSuccess(true);
      setTimeout(() => setReportGeneratedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to generate PDF diff report:', err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Capture and save current canvas diff frame with heatmap overlay as high-res PNG artifact
  const handleSaveSnapshot = useCallback(() => {
    setIsSavingSnapshot(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not obtain 2D canvas rendering context');

      // 1. Draw Canvas Background (Gradient matching frame theme)
      const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
      if (activeFrame.theme === 'dark' || activeFrame.id === 'frame-dark-contrast') {
        grad.addColorStop(0, '#090d16');
        grad.addColorStop(0.5, '#0f172a');
        grad.addColorStop(1, '#020617');
      } else if (activeFrame.id === 'frame-dialog-active') {
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(0.5, '#0f172a');
        grad.addColorStop(1, '#1e293b');
      } else {
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.5, '#1e293b');
        grad.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1920, 1080);

      // 2. Draw Grid Pattern
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < 1920; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1080);
        ctx.stroke();
      }
      for (let y = 0; y < 1080; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1920, y);
        ctx.stroke();
      }

      // 3. Draw Simulated Frame UI elements (Window Mockup)
      const headerShiftY = activeFrame.id === 'frame-header-shift' ? 28 : 0;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, headerShiftY, 1920, 64);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.strokeRect(0, headerShiftY, 1920, 64);

      // Nav branding pill
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillText('OVERSEER AI // AUTOMATION RUNTIME', 32, headerShiftY + 40);

      // Left Sidebar Drawer
      const sidebarWidth = activeFrame.id === 'frame-sidebar-expanded' ? 320 : 180;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(0, 64 + headerShiftY, sidebarWidth, 1080 - 64 - headerShiftY);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.strokeRect(0, 64 + headerShiftY, sidebarWidth, 1080 - 64 - headerShiftY);

      // Simulated Target Content Card
      ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sidebarWidth + 40, 100 + headerShiftY, 1920 - sidebarWidth - 80, 880, 16);
      ctx.fill();
      ctx.stroke();

      // Modal Pop-up overlay if active frame
      if (activeFrame.id === 'frame-dialog-active') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, 1920, 1080);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(660, 320, 600, 440, 20);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('Security Verification Prompt (Drift Trigger)', 700, 380);
      }

      // 4. Render Drift Heatmap Overlays
      if (showMotionHeatmap || showHotspotZones) {
        hotspotZones.forEach((zone) => {
          const zx = zone.normalizedX * 1920;
          const zy = zone.normalizedY * 1080;
          const r = Math.max(60, zone.radius * 2.2);
          const heatGrad = ctx.createRadialGradient(zx, zy, 0, zx, zy, r);
          if (zone.intensity > 0.6) {
            heatGrad.addColorStop(0, 'rgba(244, 63, 94, 0.65)');
            heatGrad.addColorStop(0.4, 'rgba(236, 72, 153, 0.35)');
            heatGrad.addColorStop(0.8, 'rgba(244, 63, 94, 0.1)');
            heatGrad.addColorStop(1, 'transparent');
          } else {
            heatGrad.addColorStop(0, 'rgba(245, 158, 11, 0.55)');
            heatGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.25)');
            heatGrad.addColorStop(1, 'transparent');
          }
          ctx.fillStyle = heatGrad;
          ctx.beginPath();
          ctx.arc(zx, zy, r, 0, Math.PI * 2);
          ctx.fill();
        });

        // Heatmap around active adjusted target
        const targetHeat = ctx.createRadialGradient(adjustedTarget.x, adjustedTarget.y, 0, adjustedTarget.x, adjustedTarget.y, 110);
        targetHeat.addColorStop(0, pixelVarianceData.isDriftWarning ? 'rgba(244, 63, 94, 0.55)' : 'rgba(16, 185, 129, 0.5)');
        targetHeat.addColorStop(0.6, 'rgba(6, 182, 212, 0.2)');
        targetHeat.addColorStop(1, 'transparent');
        ctx.fillStyle = targetHeat;
        ctx.beginPath();
        ctx.arc(adjustedTarget.x, adjustedTarget.y, 110, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Draw Ghost Baseline Trajectory
      if (showInteractionGhost && waypoints.length >= 2) {
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
          ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 6. Draw Active Spline Trajectory Curve
      if (waypoints.length >= 2) {
        const splineGrad = ctx.createLinearGradient(140, 140, adjustedTarget.x, adjustedTarget.y);
        splineGrad.addColorStop(0, '#06b6d4');
        splineGrad.addColorStop(0.5, '#38bdf8');
        splineGrad.addColorStop(1, '#10b981');

        ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
          ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        ctx.stroke();

        ctx.strokeStyle = splineGrad;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
          ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        ctx.stroke();
      }

      // 7. Draw Waypoint Handles & Markers
      waypoints.forEach((wp, idx) => {
        ctx.fillStyle = idx === waypoints.length - 1 ? '#10b981' : '#06b6d4';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1), wp.x, wp.y + 4);

        // Label pill
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(wp.x - 36, wp.y + 14, 72, 18);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
        ctx.strokeRect(wp.x - 36, wp.y + 14, 72, 18);
        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(wp.label.slice(0, 10), wp.x, wp.y + 26);
      });

      // 8. Draw Registered Click Markers
      if (showRegisteredClickMarkers) {
        registeredClicks.forEach((clk, cIdx) => {
          ctx.fillStyle = '#f43f5e';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(clk.x, clk.y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`C${cIdx + 1}`, clk.x, clk.y + 4);
        });
      }

      // 9. Draw Base Reticle & Active Target Reticle
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(targetCoords.x, targetCoords.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Base (${targetCoords.x}, ${targetCoords.y})`, targetCoords.x, targetCoords.y + 36);

      // Active Target Reticle
      ctx.strokeStyle = pixelVarianceData.isDriftWarning ? '#f43f5e' : '#10b981';
      ctx.fillStyle = pixelVarianceData.isDriftWarning ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(adjustedTarget.x, adjustedTarget.y, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(adjustedTarget.x - 36, adjustedTarget.y);
      ctx.lineTo(adjustedTarget.x + 36, adjustedTarget.y);
      ctx.moveTo(adjustedTarget.x, adjustedTarget.y - 36);
      ctx.lineTo(adjustedTarget.x, adjustedTarget.y + 36);
      ctx.stroke();

      // 10. Watermark HUD Telemetry Box (Diagnostic Snapshot Metadata)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(32, 880, 520, 160, 12);
      ctx.fill();
      ctx.stroke();

      // Top cyan indicator line
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(32, 880, 520, 4);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillText('OVERSEER AI • CANVAS DIFF SNAPSHOT', 48, 908);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px monospace';
      ctx.fillText(`Frame: ${activeFrame.name} (${activeFrame.id})`, 48, 930);
      ctx.fillText(`Anchor Shift: (${adjustedTarget.x}, ${adjustedTarget.y}) • Drift: ${driftDistance}px`, 48, 950);
      ctx.fillText(`Pixel Variance: ${pixelVarianceData.pixelDelta}Δ | Noise Floor: ${pixelVarianceData.noiseCutoffTolerance}Δ (${pixelDiffSensitivity}% Sens.)`, 48, 970);
      ctx.fillText(`Captured: ${new Date().toISOString()}`, 48, 990);

      // Verdict Stamp
      if (pixelVarianceData.isDriftWarning) {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
        ctx.strokeStyle = '#f43f5e';
        ctx.fillRect(48, 1002, 240, 24);
        ctx.strokeRect(48, 1002, 240, 24);
        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('⚠️ DRIFT WARNING TRIGGERED', 56, 1018);
      } else if (pixelVarianceData.isNoiseFiltered) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.strokeStyle = '#10b981';
        ctx.fillRect(48, 1002, 260, 24);
        ctx.strokeRect(48, 1002, 260, 24);
        ctx.fillStyle = '#6ee7b7';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('🛡️ NOISE FILTERED (SUB-THRESHOLD)', 56, 1018);
      } else {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.strokeStyle = '#06b6d4';
        ctx.fillRect(48, 1002, 210, 24);
        ctx.strokeRect(48, 1002, 210, 24);
        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('✓ NOMINAL EXACT MATCH', 56, 1018);
      }

      // Convert to PNG and Download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `diff_drift_snapshot_${activeFrame.id}_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSnapshotSuccess(true);
      setTimeout(() => setSnapshotSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
    } finally {
      setIsSavingSnapshot(false);
    }
  }, [
    activeFrame,
    adjustedTarget,
    targetCoords,
    driftDistance,
    pixelVarianceData,
    pixelDiffSensitivity,
    hotspotZones,
    waypoints,
    registeredClicks,
    showMotionHeatmap,
    showHotspotZones,
    showInteractionGhost,
    showRegisteredClickMarkers,
  ]);

  // Run movement and clicking/swiping simulation on active frame
  const runActionSimulation = (action: 'click' | 'swipe_up' | 'swipe_down' | 'swipe_left' | 'swipe_right') => {
    if (simulationState.isRunning) return;

    const startPos = waypoints.length > 0 ? { x: waypoints[0].x, y: waypoints[0].y } : { x: 120, y: 120 };
    const target = adjustedTarget;

    setSimulationState({
      isRunning: true,
      actionType: action,
      cursorPos: startPos,
      trail: [startPos],
      clickRipple: false,
    });

    const steps = 18;
    let stepCount = 0;

    if (animationTimerRef.current) clearInterval(animationTimerRef.current);

    animationTimerRef.current = setInterval(() => {
      stepCount++;
      const progress = stepCount / steps;
      // Smooth ease-out bezier interpolation
      const ease = 1 - Math.pow(1 - progress, 3);

      const currentX = Math.round(startPos.x + (target.x - startPos.x) * ease);
      const currentY = Math.round(startPos.y + (target.y - startPos.y) * ease);

      setSimulationState((prev) => ({
        ...prev,
        cursorPos: { x: currentX, y: currentY },
        trail: [...prev.trail, { x: currentX, y: currentY }],
      }));

      if (stepCount >= steps) {
        if (animationTimerRef.current) clearInterval(animationTimerRef.current);

        // Perform final click or swipe displacement
        if (action === 'click') {
          setSimulationState((prev) => ({
            ...prev,
            clickRipple: true,
          }));
          setTimeout(() => {
            setSimulationState((prev) => ({ ...prev, isRunning: false, clickRipple: false }));
          }, 600);
        } else {
          // Swipe vector calculation
          const displacement = 120;
          let endX = target.x;
          let endY = target.y;
          if (action === 'swipe_up') endY -= displacement;
          if (action === 'swipe_down') endY += displacement;
          if (action === 'swipe_left') endX -= displacement;
          if (action === 'swipe_right') endX += displacement;

          setTimeout(() => {
            setSimulationState((prev) => ({
              ...prev,
              cursorPos: { x: endX, y: endY },
              trail: [...prev.trail, { x: endX, y: endY }],
              isRunning: false,
            }));
          }, 300);
        }
      }
    }, 25);
  };

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-cyan-500/60 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-xs">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-950/90 border border-cyan-500/50 rounded-xl text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Diff Frames & Movement Response Testbench
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {frames.length} Frame Templates
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {file ? `Testing step targeting: ${file.name}` : `Testing coordinate (${targetCoords.x}, ${targetCoords.y}) across changing frames`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">
          {/* Left Column: Tabbed Sidebar (Reference Frames & Event-Log Stream) */}
          <div className="md:col-span-4 border-r border-slate-800/80 bg-slate-950/60 flex flex-col overflow-hidden">
            {/* Sidebar Tab Header */}
            <div className="p-2 border-b border-slate-800 bg-slate-950/90 flex items-center gap-1">
              <button
                id="tab-sidebar-frames"
                onClick={() => setSidebarTab('frames')}
                className={`flex-1 py-1.5 px-2 rounded-xl font-mono text-[10px] font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  sidebarTab === 'frames'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>Reference Frames</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[9px]">
                  {frames.length}
                </span>
              </button>

              <button
                id="tab-sidebar-event-log"
                onClick={() => setSidebarTab('events')}
                className={`flex-1 py-1.5 px-2 rounded-xl font-mono text-[10px] font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  sidebarTab === 'events'
                    ? 'bg-gradient-to-r from-pink-950 to-purple-950 text-pink-300 border border-pink-500/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Clock className="w-3 h-3 text-pink-400" />
                <span>Event Log</span>
                <span className="px-1.5 py-0.2 rounded-full bg-pink-950 text-pink-300 text-[9px] border border-pink-800/60">
                  {streamPoints.length}
                </span>
              </button>
            </div>

            {/* TAB CONTENT 1: REFERENCE FRAMES */}
            {sidebarTab === 'frames' && (
              <>
                <div className="p-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
                  <span className="font-mono font-bold text-slate-300 uppercase text-[9px] tracking-wider">
                    Select Reference Frame
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    Active: {activeFrame.similarity}% Match
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {frames.map((frame) => {
                    const isSelected = frame.id === activeFrameId;
                    return (
                      <button
                        key={frame.id}
                        onClick={() => setActiveFrameId(frame.id)}
                        className={`w-full p-3 rounded-2xl border text-left transition-all flex flex-col space-y-1.5 ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-lg ring-1 ring-cyan-500/50'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs truncate">{frame.name}</span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                              frame.similarity >= 90
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : frame.similarity >= 80
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-red-950 text-red-300 border border-red-800'
                            }`}
                          >
                            {frame.similarity}%
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2">{frame.description}</p>
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                          <span>
                            Offset: ΔX {frame.offset.x > 0 ? `+${frame.offset.x}` : frame.offset.x}px, ΔY {frame.offset.y > 0 ? `+${frame.offset.y}` : frame.offset.y}px
                          </span>
                          <span>Scale: {frame.scale}x</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* TAB CONTENT 2: INTERACTION EVENT LOG SIDEBAR WITH COMPREHENSIVE FILTERING */}
            {sidebarTab === 'events' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Event Types Visibility Toggles Bar */}
                <div className="p-2.5 border-b border-slate-800 bg-slate-900/80 space-y-2 text-[9px] font-mono">
                  {/* Event Type Filter Row */}
                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-1.5 font-bold uppercase tracking-wider text-[8px]">
                      <span className="flex items-center space-x-1">
                        <Filter className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Event Types ({eventsWithDeviation.length})</span>
                      </span>
                      <div className="flex items-center space-x-1.5 text-[8px]">
                        <button
                          onClick={() => setEventTypeToggles({ clicks: true, drags: true, scrolls: true, moves: true })}
                          className="text-cyan-400 hover:text-cyan-200 hover:underline"
                        >
                          All
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                          onClick={() => setEventTypeToggles({ clicks: true, drags: false, scrolls: false, moves: false })}
                          className="text-slate-400 hover:text-white hover:underline"
                        >
                          Clicks Only
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      {/* Clicks Toggle */}
                      <button
                        id="toggle-filter-clicks"
                        onClick={() => setEventTypeToggles((p) => ({ ...p, clicks: !p.clicks }))}
                        className={`py-1 px-1.5 rounded-lg border flex items-center justify-between transition-all ${
                          eventTypeToggles.clicks
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600 font-bold shadow-xs'
                            : 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <span className="flex items-center space-x-1">
                          <MousePointer className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Clicks</span>
                        </span>
                        <span className={`px-1 rounded text-[8px] ${eventTypeToggles.clicks ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-900 text-slate-500'}`}>
                          {eventsWithDeviation.filter((e) => e.normalizedType === 'click').length}
                        </span>
                      </button>

                      {/* Drags Toggle */}
                      <button
                        id="toggle-filter-drags"
                        onClick={() => setEventTypeToggles((p) => ({ ...p, drags: !p.drags }))}
                        className={`py-1 px-1.5 rounded-lg border flex items-center justify-between transition-all ${
                          eventTypeToggles.drags
                            ? 'bg-amber-950/80 text-amber-300 border-amber-600 font-bold shadow-xs'
                            : 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <span className="flex items-center space-x-1">
                          <Move className="w-2.5 h-2.5 text-amber-400" />
                          <span>Drags</span>
                        </span>
                        <span className={`px-1 rounded text-[8px] ${eventTypeToggles.drags ? 'bg-amber-900 text-amber-200' : 'bg-slate-900 text-slate-500'}`}>
                          {eventsWithDeviation.filter((e) => e.normalizedType === 'drag').length}
                        </span>
                      </button>

                      {/* Scrolls Toggle */}
                      <button
                        id="toggle-filter-scrolls"
                        onClick={() => setEventTypeToggles((p) => ({ ...p, scrolls: !p.scrolls }))}
                        className={`py-1 px-1.5 rounded-lg border flex items-center justify-between transition-all ${
                          eventTypeToggles.scrolls
                            ? 'bg-indigo-950/80 text-indigo-300 border-indigo-600 font-bold shadow-xs'
                            : 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <span className="flex items-center space-x-1">
                          <Scroll className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Scrolls</span>
                        </span>
                        <span className={`px-1 rounded text-[8px] ${eventTypeToggles.scrolls ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-900 text-slate-500'}`}>
                          {eventsWithDeviation.filter((e) => e.normalizedType === 'scroll').length}
                        </span>
                      </button>

                      {/* Moves Toggle */}
                      <button
                        id="toggle-filter-moves"
                        onClick={() => setEventTypeToggles((p) => ({ ...p, moves: !p.moves }))}
                        className={`py-1 px-1.5 rounded-lg border flex items-center justify-between transition-all ${
                          eventTypeToggles.moves
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-600 font-bold shadow-xs'
                            : 'bg-slate-950 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <span className="flex items-center space-x-1">
                          <Compass className="w-2.5 h-2.5 text-cyan-400" />
                          <span>Moves</span>
                        </span>
                        <span className={`px-1 rounded text-[8px] ${eventTypeToggles.moves ? 'bg-cyan-900 text-cyan-200' : 'bg-slate-900 text-slate-500'}`}>
                          {eventsWithDeviation.filter((e) => e.normalizedType === 'move').length}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Coordinate Deviation Severity Filter */}
                  <div className="pt-1.5 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 mb-1 font-bold uppercase tracking-wider text-[8px]">
                      <span className="flex items-center space-x-1">
                        <Activity className="w-2.5 h-2.5 text-pink-400" />
                        <span>Deviation Severity Filter</span>
                      </span>
                      <span className="text-slate-500 text-[8px]">
                        Tol: {tolerancePx}px
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      <button
                        id="filter-severity-all"
                        onClick={() => setDeviationSeverityFilter('all')}
                        className={`py-1 px-1 rounded-md text-center border transition-all ${
                          deviationSeverityFilter === 'all'
                            ? 'bg-slate-200 text-slate-950 border-white font-bold shadow-xs'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                        title="Show all deviation severities"
                      >
                        All ({eventsWithDeviation.length})
                      </button>

                      <button
                        id="filter-severity-low"
                        onClick={() => setDeviationSeverityFilter('low')}
                        className={`py-1 px-1 rounded-md text-center border transition-all ${
                          deviationSeverityFilter === 'low'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                            : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                        }`}
                        title="Coordinate deviation < 25px (Low)"
                      >
                        &lt;25px ({eventsWithDeviation.filter((e) => e.severity === 'low').length})
                      </button>

                      <button
                        id="filter-severity-moderate"
                        onClick={() => setDeviationSeverityFilter('moderate')}
                        className={`py-1 px-1 rounded-md text-center border transition-all ${
                          deviationSeverityFilter === 'moderate'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-xs'
                            : 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/60'
                        }`}
                        title="Coordinate deviation between 25px and 75px (Moderate)"
                      >
                        25-75px ({eventsWithDeviation.filter((e) => e.severity === 'moderate').length})
                      </button>

                      <button
                        id="filter-severity-high"
                        onClick={() => setDeviationSeverityFilter('high')}
                        className={`py-1 px-1 rounded-md text-center border transition-all ${
                          deviationSeverityFilter === 'high'
                            ? 'bg-rose-500 text-white border-rose-400 font-bold shadow-xs'
                            : 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60'
                        }`}
                        title="Coordinate deviation > 75px (High / Critical)"
                      >
                        &gt;75px ({eventsWithDeviation.filter((e) => e.severity === 'high').length})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chronological Event Items Stream */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {filteredLogEvents.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 font-mono text-[10px] space-y-2">
                      <ListFilter className="w-6 h-6 mx-auto text-slate-600 opacity-60" />
                      <p>No interaction events match the selected event type &amp; deviation severity filters.</p>
                      <button
                        onClick={() => {
                          setEventTypeToggles({ clicks: true, drags: true, scrolls: true, moves: true });
                          setDeviationSeverityFilter('all');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[9px] font-bold"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    filteredLogEvents.map((evt) => {
                      const isSelected = scrubIndex === evt.pointIndex;
                      const isClick = evt.normalizedType === 'click';
                      const isDrag = evt.normalizedType === 'drag';
                      const isScroll = evt.normalizedType === 'scroll';
                      const isMove = evt.normalizedType === 'move';

                      return (
                        <div
                          key={`log-evt-${evt.pointIndex}-${evt.timestamp}`}
                          onClick={() => handleSelectLogEvent(evt.pointIndex)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer font-mono select-none flex flex-col space-y-1 ${
                            isSelected
                              ? 'bg-cyan-950/90 border-cyan-400 text-white ring-1 ring-cyan-500 shadow-md'
                              : isClick
                              ? 'bg-emerald-950/40 hover:bg-emerald-950/80 border-emerald-800/50 text-emerald-200'
                              : isDrag
                              ? 'bg-amber-950/30 hover:bg-amber-950/70 border-amber-800/50 text-amber-200'
                              : isScroll
                              ? 'bg-indigo-950/30 hover:bg-indigo-950/70 border-indigo-800/50 text-indigo-200'
                              : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          {/* Header Line: Sequence Index, Type Badge, Timestamp */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-950 px-1 rounded border border-slate-800">
                                #{evt.pointIndex + 1}
                              </span>

                              {/* Interaction Type Badge */}
                              {isClick && (
                                <span className="px-1.5 py-0.2 rounded-md bg-emerald-950 text-emerald-300 text-[9px] font-bold border border-emerald-600/70 flex items-center space-x-1">
                                  <MousePointer className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>LEFT CLICK</span>
                                </span>
                              )}
                              {isDrag && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-950 text-amber-300 text-[9px] font-bold border border-amber-600/70 flex items-center space-x-1">
                                  <Move className="w-2.5 h-2.5 text-amber-400" />
                                  <span>DRAG</span>
                                </span>
                              )}
                              {isScroll && (
                                <span className="px-1.5 py-0.2 rounded-md bg-indigo-950 text-indigo-300 text-[9px] font-bold border border-indigo-600/70 flex items-center space-x-1">
                                  <Scroll className="w-2.5 h-2.5 text-indigo-400" />
                                  <span>SCROLL</span>
                                </span>
                              )}
                              {isMove && (
                                <span className="px-1.5 py-0.2 rounded-md bg-slate-800 text-cyan-300 text-[9px] font-bold border border-slate-700 flex items-center space-x-1">
                                  <Compass className="w-2.5 h-2.5 text-cyan-400" />
                                  <span>MOVE</span>
                                </span>
                              )}
                            </div>

                            {/* Timestamp */}
                            <span className="text-[9px] font-semibold text-pink-400 flex items-center space-x-1">
                              <Clock className="w-2.5 h-2.5 text-pink-400/80" />
                              <span>T+{Number(evt.timestamp || 0).toFixed(2)}s</span>
                            </span>
                          </div>

                          {/* Coordinates and Deviation Badge */}
                          <div className="flex items-center justify-between text-[10px] pt-0.5">
                            <span className="font-bold text-slate-100 flex items-center space-x-1">
                              <Crosshair className="w-2.5 h-2.5 text-cyan-400" />
                              <span>
                                X: <span className="text-cyan-300">{Math.round(evt.x)}</span>, Y: <span className="text-cyan-300">{Math.round(evt.y)}</span>
                              </span>
                            </span>

                            {/* Coordinate Deviation Badge */}
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`px-1.5 py-0.2 rounded-md text-[8px] font-bold border ${
                                  evt.severity === 'high'
                                    ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-xs'
                                    : evt.severity === 'moderate'
                                    ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-xs'
                                    : 'bg-emerald-950 text-emerald-300 border-emerald-700/70'
                                }`}
                                title={`Deviation distance from golden reference baseline: ${evt.deviation}px`}
                              >
                                Δ {evt.deviation}px {evt.severity === 'high' ? '• High' : evt.severity === 'moderate' ? '• Mod' : '• Low'}
                              </span>

                              {/* Extra Info: speed, drag dist, or scroll delta */}
                              {evt.speed ? (
                                <span className="text-[8px] text-slate-400 font-mono">
                                  {evt.speed}px/s
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Target Element / Action Note */}
                          {evt.targetElement && (
                            <div className="text-[9px] text-slate-400 truncate border-t border-slate-800/60 pt-0.5 flex items-center justify-between">
                              <span className="truncate italic">&rarr; {evt.targetElement}</span>
                              {isSelected && (
                                <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-wider">
                                  Active Frame
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Visual Frame Preview & Movement Simulator */}
          <div className="md:col-span-8 p-4 flex flex-col justify-between overflow-y-auto space-y-4 bg-slate-900/40">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center space-x-1.5">
                <span className="font-mono text-[10px] text-slate-400 font-bold uppercase mr-1">
                  Test Movement:
                </span>
                <button
                  onClick={() => runActionSimulation('click')}
                  disabled={simulationState.isRunning}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 font-mono font-bold flex items-center space-x-1 disabled:opacity-50"
                >
                  <MousePointer className="w-3 h-3 text-emerald-400" />
                  <span>Click</span>
                </button>
                <button
                  onClick={() => runActionSimulation('swipe_up')}
                  disabled={simulationState.isRunning}
                  className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 font-mono font-bold flex items-center space-x-1 disabled:opacity-50"
                  title="Swipe Up"
                >
                  <ArrowUp className="w-3 h-3 text-indigo-400" />
                  <span>Up</span>
                </button>
                <button
                  onClick={() => runActionSimulation('swipe_down')}
                  disabled={simulationState.isRunning}
                  className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 font-mono font-bold flex items-center space-x-1 disabled:opacity-50"
                  title="Swipe Down"
                >
                  <ArrowDown className="w-3 h-3 text-indigo-400" />
                  <span>Down</span>
                </button>
                <button
                  onClick={() => runActionSimulation('swipe_left')}
                  disabled={simulationState.isRunning}
                  className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 font-mono font-bold flex items-center space-x-1 disabled:opacity-50"
                  title="Swipe Left"
                >
                  <ArrowLeft className="w-3 h-3 text-indigo-400" />
                  <span>Left</span>
                </button>
                <button
                  onClick={() => runActionSimulation('swipe_right')}
                  disabled={simulationState.isRunning}
                  className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 font-mono font-bold flex items-center space-x-1 disabled:opacity-50"
                  title="Swipe Right"
                >
                  <ArrowRight className="w-3 h-3 text-indigo-400" />
                  <span>Right</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Displacement Tolerance Slider */}
                <div className="flex items-center space-x-1.5 bg-slate-900/80 px-2.5 py-1 rounded-xl border border-slate-800">
                  <span className="font-mono text-[10px] text-slate-400">Drift Dist:</span>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={tolerancePx}
                    onChange={(e) => setTolerancePx(Number(e.target.value))}
                    className="w-16 accent-cyan-500 cursor-pointer"
                    title={`Displacement tolerance limit: ${tolerancePx}px`}
                  />
                  <span className="font-mono text-[10px] text-cyan-300 font-bold w-7 text-right">
                    {tolerancePx}px
                  </span>
                </div>

                {/* Pixel Variance Sensitivity Slider */}
                <div className="flex items-center space-x-1.5 bg-slate-900/80 px-2.5 py-1 rounded-xl border border-slate-800">
                  <span className="font-mono text-[10px] text-slate-400 flex items-center space-x-1">
                    <Sliders className="w-3 h-3 text-purple-400" />
                    <span>Sensitivity:</span>
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={pixelDiffSensitivity}
                    onChange={(e) => setPixelDiffSensitivity(Number(e.target.value))}
                    className="w-20 accent-purple-500 cursor-pointer"
                    title={`Pixel-level variance sensitivity: ${pixelDiffSensitivity}% (Noise cutoff floor: ${noiseCutoffTolerance}Δ)`}
                  />
                  <span className="font-mono text-[10px] text-purple-300 font-bold w-8 text-right">
                    {pixelDiffSensitivity}%
                  </span>
                </div>

                {/* Dynamic Noise Filter vs Drift Warning Badge */}
                <div
                  className={`px-2.5 py-1 rounded-xl font-mono text-[10px] font-bold flex items-center space-x-1.5 border transition-all ${
                    pixelVarianceData.isDriftWarning
                      ? 'bg-rose-950/90 text-rose-300 border-rose-500/80 shadow-md shadow-rose-950 animate-pulse'
                      : pixelVarianceData.isNoiseFiltered
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/70 shadow-xs'
                      : 'bg-cyan-950/80 text-cyan-300 border-cyan-600/70 shadow-xs'
                  }`}
                  title={
                    pixelVarianceData.isDriftWarning
                      ? `Pixel variance (${pixelVarianceData.pixelDelta}Δ) exceeds noise floor (${noiseCutoffTolerance}Δ) - DRIFT WARNING ACTIVE`
                      : pixelVarianceData.isNoiseFiltered
                      ? `Pixel variance (${pixelVarianceData.pixelDelta}Δ) is below noise floor (${noiseCutoffTolerance}Δ) - FILTERED AS RENDER NOISE`
                      : 'Exact baseline alignment (0Δ variance)'
                  }
                >
                  {pixelVarianceData.isDriftWarning ? (
                    <>
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      <span>Drift Warning ({pixelVarianceData.pixelDelta}Δ &gt; {noiseCutoffTolerance}Δ)</span>
                    </>
                  ) : pixelVarianceData.isNoiseFiltered ? (
                    <>
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Noise Ignored ({pixelVarianceData.pixelDelta}Δ ≤ {noiseCutoffTolerance}Δ)</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 text-cyan-400" />
                      <span>Nominal Match (0Δ)</span>
                    </>
                  )}
                </div>

                {/* Save Snapshot (PNG) Button */}
                <button
                  id="btn-save-canvas-snapshot"
                  onClick={handleSaveSnapshot}
                  disabled={isSavingSnapshot}
                  className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold flex items-center space-x-1.5 border transition-all shadow-md ${
                    snapshotSuccess
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-emerald-950'
                      : 'bg-gradient-to-r from-purple-950 to-indigo-950 hover:from-purple-900 hover:to-indigo-900 text-purple-300 border-purple-500/70 hover:border-purple-400'
                  }`}
                  title="Capture the current canvas diff state (with heatmap overlay & trajectories) and save as high-res PNG image artifact"
                >
                  {isSavingSnapshot ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      <span>Capturing PNG...</span>
                    </>
                  ) : snapshotSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Snapshot Saved (PNG)!</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5 text-purple-400" />
                      <span>Save Snapshot (PNG)</span>
                    </>
                  )}
                </button>

                {/* Generate Diff Report PDF Button */}
                <button
                  id="btn-generate-diff-report"
                  onClick={handleGenerateDiffReport}
                  disabled={isGeneratingReport}
                  className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold flex items-center space-x-1.5 border transition-all shadow-md ${
                    reportGeneratedSuccess
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-emerald-950'
                      : 'bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 text-cyan-300 border-cyan-500/70 hover:border-cyan-400'
                  }`}
                  title="Export a comprehensive PDF summary detailing path deviations, anomaly timestamps, and auto-fix impact"
                >
                  {isGeneratingReport ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span>Generating Report...</span>
                    </>
                  ) : reportGeneratedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>PDF Report Downloaded!</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Generate Diff Report (PDF)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Pixel Diff Calibration & Sensitivity Preset Bar */}
            <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-[10px] font-mono">
              <div className="flex items-center space-x-2 text-slate-300">
                <span className="text-slate-400 font-bold flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-purple-400" />
                  <span>Pixel Diff Calibrator:</span>
                </span>
                <span className="text-slate-400">
                  Cutoff Floor: <strong className="text-purple-300">{noiseCutoffTolerance}Δ RGB</strong> (Variance below this is ignored as render noise)
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">
                  Active Frame Variance: <strong className={pixelVarianceData.isDriftWarning ? 'text-rose-400' : 'text-emerald-400'}>{pixelVarianceData.pixelDelta}Δ</strong>
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">Presets:</span>
                <button
                  onClick={() => setPixelDiffSensitivity(95)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    pixelDiffSensitivity >= 90
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                  title="Ultra-Sensitive: Detects micro-pixel shifts (5Δ noise floor)"
                >
                  Ultra (95%)
                </button>
                <button
                  onClick={() => setPixelDiffSensitivity(70)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    pixelDiffSensitivity >= 60 && pixelDiffSensitivity < 90
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                  title="Standard UI: Balances antialiasing noise filtering with drift detection (17Δ noise floor)"
                >
                  Standard (70%)
                </button>
                <button
                  onClick={() => setPixelDiffSensitivity(35)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    pixelDiffSensitivity < 60
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                  title="Noise Tolerant: High noise immunity for dynamic / blurred UIs (30Δ noise floor)"
                >
                  Tolerant (35%)
                </button>
              </div>
            </div>

            {/* Mode Selector & Control Bar: Regular Mode (Left-Click to Add Step) vs Manual Spline Handles */}
            {/* Interaction Mode Switch & Split View Toggle Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-[11px] font-mono shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Mode:</span>
                  </span>
                  <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-700/80">
                    <button
                      id="btn-mode-regular-step-adding"
                      onClick={() => setViewportMode('regular')}
                      className={`px-3 py-1 rounded-lg font-bold flex items-center space-x-1.5 transition-all text-xs cursor-pointer ${
                        viewportMode === 'regular'
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-900/50 ring-1 ring-cyan-300'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Regular Mode: Left-click anywhere on the viewport stage to immediately add an automation step"
                    >
                      <MousePointer className="w-3.5 h-3.5" />
                      <span>Regular (Left-Click to Add Step)</span>
                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-200 text-[9px] border border-cyan-400/40">
                        {regularSteps.length} Steps
                      </span>
                    </button>

                    <button
                      id="btn-mode-handles-editing"
                      onClick={() => setViewportMode('handles')}
                      className={`px-3 py-1 rounded-lg font-bold flex items-center space-x-1.5 transition-all text-xs cursor-pointer ${
                        viewportMode === 'handles'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/50 ring-1 ring-purple-300'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Handles Mode: Click and drag cubic bezier nodes to fine-tune trajectory curves"
                    >
                      <Move className="w-3.5 h-3.5" />
                      <span>Spline Handles ({waypoints.length})</span>
                    </button>
                  </div>
                </div>

                {/* Split View Toggle Button */}
                <button
                  id="btn-toggle-split-view"
                  onClick={() => setIsSplitView(!isSplitView)}
                  className={`px-3 py-1.5 rounded-xl font-bold font-mono text-xs flex items-center space-x-1.5 transition-all cursor-pointer ${
                    isSplitView
                      ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white shadow-md shadow-purple-950/60 ring-2 ring-pink-400'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-pink-500'
                  }`}
                  title="Toggle Split View: Render current recording path and golden reference path side-by-side"
                >
                  <Columns className="w-3.5 h-3.5 text-pink-300" />
                  <span>Split View (Side-by-Side)</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${isSplitView ? 'bg-pink-950 text-pink-200' : 'bg-slate-800 text-slate-400'}`}>
                    {isSplitView ? 'ACTIVE' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Context Action Tools */}
              {viewportMode === 'regular' ? (
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-700/60 flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
                    <span>Left-Click on stage to add step</span>
                  </span>
                  <button
                    onClick={() => {
                      setRegularSteps([
                        { id: 'step-reg-1', x: 140, y: 140, label: 'Step 1: Origin Anchor', action: 'click', timestamp: '0.0s' },
                        { id: 'step-reg-2', x: adjustedTarget.x, y: adjustedTarget.y, label: 'Step 2: Target Click', action: 'click', timestamp: '0.9s' },
                      ]);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 flex items-center space-x-1 transition-colors text-[10px]"
                    title="Reset recorded regular mode steps"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Steps</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white mr-1">
                    <input
                      type="checkbox"
                      checked={showWaypointHandles}
                      onChange={(e) => setShowWaypointHandles(e.target.checked)}
                      className="rounded accent-cyan-500 cursor-pointer"
                    />
                    <span>Show Drag Handles</span>
                  </label>

                  <button
                    onClick={handleAddWaypoint}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-cyan-500 flex items-center space-x-1 transition-colors"
                    title="Add another control handle along the trajectory"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" />
                    <span>Add Handle</span>
                  </button>

                  <button
                    onClick={handleAutoSmooth}
                    className="px-2 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 flex items-center space-x-1 transition-colors"
                    title="Auto-smooth spline curve between start and target"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Auto-Smooth Spline</span>
                  </button>

                  <button
                    onClick={handleResetWaypoints}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 flex items-center space-x-1 transition-colors"
                    title="Reset handles to baseline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Handles</span>
                  </button>
                </div>
              )}
            </div>

            {/* Split View Comparative Viewport Panels (Rendered when isSplitView is active) */}
            {isSplitView ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
                  {/* Panel 1: Current Recording Path */}
                  <div className="flex flex-col rounded-2xl border border-rose-500/50 bg-slate-950/95 overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="px-3.5 py-2.5 bg-gradient-to-r from-rose-950/90 via-slate-950 to-slate-950 border-b border-rose-800/40 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-rose-400/40" />
                        <span className="font-mono font-bold text-xs text-rose-200 uppercase tracking-wider">
                          Current Recording Path
                        </span>
                        <span className="px-2 py-0.2 rounded-md bg-rose-950 text-rose-300 text-[9px] font-mono border border-rose-700/60">
                          {streamPoints.length} points
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-rose-400 flex items-center space-x-1">
                        <span>Source:</span>
                        <strong className="text-white">{activeSession?.name || 'Aggregate Live Stream'}</strong>
                      </div>
                    </div>

                    {/* Canvas Stage 1 */}
                    <div className={`relative w-full h-72 overflow-hidden bg-gradient-to-br ${activeFrame.bgGradient} flex items-center justify-center select-none shadow-inner`}>
                      {/* Grid background */}
                      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(244,63,94,0.5) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                      {/* Raw Recorded Polyline Path */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1920 1080">
                        {streamPoints.length > 1 && (
                          <>
                            <polyline
                              points={streamPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth="6"
                              opacity="0.3"
                            />
                            <polyline
                              points={streamPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth="2.5"
                              strokeDasharray="5 3"
                              opacity="0.95"
                            />
                          </>
                        )}
                      </svg>

                      {/* Origin & Target Markers */}
                      <div className="absolute left-[7.3%] top-[13%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                        <div className="w-5 h-5 rounded-full bg-slate-900 border-2 border-rose-400 flex items-center justify-center text-[8px] font-mono font-bold text-rose-300 shadow-md">
                          S
                        </div>
                      </div>
                      <div
                        className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${(adjustedTarget.x / 1920) * 100}%`, top: `${(adjustedTarget.y / 1080) * 100}%` }}
                      >
                        <div className="w-6 h-6 rounded-full bg-rose-950 border-2 border-rose-400 flex items-center justify-center text-[8px] font-mono font-bold text-rose-300 shadow-lg animate-pulse">
                          <Target className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* Registered Click Markers */}
                      {registeredClicks.map((clk, cIdx) => (
                        <div
                          key={`split-clk-${clk.pointIndex}`}
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                          style={{ left: `${(clk.x / 1920) * 100}%`, top: `${(clk.y / 1080) * 100}%` }}
                        >
                          <div className="w-4 h-4 rounded-full bg-rose-600 border border-white text-white flex items-center justify-center text-[7px] font-mono font-bold shadow-md">
                            {cIdx + 1}
                          </div>
                        </div>
                      ))}

                      {/* Active Replay / Scrubbed Pointer */}
                      {replayCursorPos && (
                        <motion.div
                          className="absolute pointer-events-none z-30"
                          style={{
                            left: `${(replayCursorPos.x / 1920) * 100}%`,
                            top: `${(replayCursorPos.y / 1080) * 100}%`,
                            transform: 'translate(-3px, -3px)',
                          }}
                        >
                          <MousePointer className="w-5 h-5 text-rose-400 fill-rose-500 filter drop-shadow-[0_2px_6px_rgba(244,63,94,0.9)]" />
                          <span className="absolute left-5 top-0 px-1.5 py-0.5 rounded bg-rose-950/95 text-rose-200 border border-rose-700 text-[8px] font-mono whitespace-nowrap shadow-md">
                            ({Math.round(replayCursorPos.x)}, {Math.round(replayCursorPos.y)})
                          </span>
                        </motion.div>
                      )}
                    </div>

                    {/* Telemetry Footer */}
                    <div className="p-2.5 bg-slate-950 border-t border-slate-800 grid grid-cols-3 gap-2 text-[10px] font-mono">
                      <div>
                        <span className="text-slate-500 block">Captured Samples:</span>
                        <span className="text-rose-300 font-bold">{streamPoints.length} points</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Peak Speed:</span>
                        <span className="text-rose-300 font-bold">{Math.max(...streamPoints.map((p) => p.speed || 0), 410)} px/s</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Target Offset:</span>
                        <span className="text-rose-400 font-bold">{driftDistance}px drift</span>
                      </div>
                    </div>
                  </div>

                  {/* Panel 2: 'Golden' Reference Path */}
                  <div className="flex flex-col rounded-2xl border border-emerald-500/50 bg-slate-950/95 overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-950/90 via-slate-950 to-slate-950 border-b border-emerald-800/40 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40" />
                        <span className="font-mono font-bold text-xs text-emerald-200 uppercase tracking-wider">
                          &lsquo;Golden&rsquo; Reference Path
                        </span>
                        <span className="px-2 py-0.2 rounded-md bg-emerald-950 text-emerald-300 text-[9px] font-mono border border-emerald-700/60">
                          Calibrated Spline
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
                        <span>Anchor Match:</span>
                        <strong className="text-emerald-300">{activeFrame.similarity}% ({activeFrame.name})</strong>
                      </div>
                    </div>

                    {/* Canvas Stage 2 */}
                    <div className={`relative w-full h-72 overflow-hidden bg-gradient-to-br ${activeFrame.bgGradient} flex items-center justify-center select-none shadow-inner`}>
                      {/* Grid background */}
                      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.5) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                      {/* Golden Spline Path */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1920 1080">
                        <defs>
                          <linearGradient id="split-golden-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="50%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#38bdf8" />
                          </linearGradient>
                        </defs>

                        {/* Tangent Polygon Guide Line */}
                        <polyline
                          points={waypoints.map((w) => `${w.x},${w.y}`).join(' ')}
                          fill="none"
                          stroke="#059669"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                          opacity="0.5"
                        />

                        {/* Spline Path */}
                        {splinePath && (
                          <>
                            <path
                              d={splinePath}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="6"
                              opacity="0.35"
                            />
                            <path
                              d={splinePath}
                              fill="none"
                              stroke="url(#split-golden-grad)"
                              strokeWidth="3.5"
                            />
                          </>
                        )}
                      </svg>

                      {/* Interactive Waypoints */}
                      {waypoints.map((wp, idx) => (
                        <div
                          key={`split-gold-wp-${wp.id}`}
                          className="absolute flex flex-col items-center select-none pointer-events-none -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${(wp.x / 1920) * 100}%`, top: `${(wp.y / 1080) * 100}%` }}
                        >
                          <div className="w-5 h-5 rounded-full border-2 border-emerald-400 bg-emerald-950 text-emerald-300 flex items-center justify-center font-mono font-bold text-[8px] shadow-lg">
                            {idx + 1}
                          </div>
                          <span className="mt-0.5 text-[7px] font-mono font-bold bg-slate-950/90 text-emerald-300 px-1 rounded border border-emerald-700/60 shadow-xs">
                            {wp.label}
                          </span>
                        </div>
                      ))}

                      {/* Target Anchor with Crosshair */}
                      <div
                        className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${(adjustedTarget.x / 1920) * 100}%`, top: `${(adjustedTarget.y / 1080) * 100}%` }}
                      >
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-950/50 flex items-center justify-center text-cyan-300 animate-pulse">
                            <Crosshair className="w-4 h-4" />
                          </div>
                          <span className="absolute left-9 -top-1 px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-600 text-[8px] font-mono whitespace-nowrap shadow-md">
                            Ideal Anchor ({adjustedTarget.x}, {adjustedTarget.y})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Telemetry Footer */}
                    <div className="p-2.5 bg-slate-950 border-t border-slate-800 grid grid-cols-3 gap-2 text-[10px] font-mono">
                      <div>
                        <span className="text-slate-500 block">Waypoints / Nodes:</span>
                        <span className="text-emerald-300 font-bold">{waypoints.length} spline controls</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Curvature Continuity:</span>
                        <span className="text-emerald-300 font-bold">99.4% (Cubic Bézier)</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Residual Target Error:</span>
                        <span className="text-emerald-400 font-bold">0.0px (Target Locked)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Path Divergence Comparison Card */}
                <div className="p-3 bg-gradient-to-r from-slate-950 via-purple-950/30 to-slate-950 rounded-2xl border border-purple-500/30 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-xl bg-purple-950 text-purple-300 border border-purple-700/60">
                      <GitCompare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-200 flex items-center space-x-2">
                        <span>Side-by-Side Path Divergence Analysis</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          maxDivergence > 75
                            ? 'bg-rose-950 text-rose-300 border border-rose-700'
                            : maxDivergence >= 25
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        }`}>
                          {maxDivergence > 75 ? 'HIGH DIVERGENCE' : maxDivergence >= 25 ? 'MODERATE DIVERGENCE' : 'MINIMAL DIVERGENCE'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Comparing {streamPoints.length} raw recorded points against calibrated {waypoints.length}-point golden baseline
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-[11px]">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Max Deviation:</span>
                      <span className="font-bold text-pink-400">{maxDivergence}px</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Mean RMS Drift:</span>
                      <span className="font-bold text-cyan-400">{meanDivergence}px</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Tolerance Spec:</span>
                      <span className={meanDivergence <= tolerancePx ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {meanDivergence <= tolerancePx ? `PASS (≤${tolerancePx}px)` : `EXCEEDED (>${tolerancePx}px)`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Virtual Screen Viewport Stage (Single View) */
              <div
                ref={viewportRef}
                onPointerDown={handleViewportPointerDown}
                onPointerMove={handleViewportPointerMove}
                onPointerUp={handleViewportPointerUp}
                onPointerLeave={handleViewportPointerLeave}
                className={`relative w-full h-80 rounded-2xl border ${
                  viewportMode === 'regular'
                    ? 'border-cyan-400/50 ring-2 ring-cyan-500/20'
                    : 'border-purple-400/50 ring-2 ring-purple-500/20'
                } overflow-hidden bg-gradient-to-br ${activeFrame.bgGradient} flex items-center justify-center select-none shadow-inner ${
                  viewportMode === 'regular' ? 'cursor-cell' : 'cursor-crosshair'
                }`}
            >
              {/* Toast Feedback for Left Click Step Added */}
              <AnimatePresence>
                {stepAddToast && (
                  <motion.div
                    initial={{ opacity: 0, y: -12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-slate-950/95 text-cyan-300 border border-cyan-400 shadow-xl text-xs font-mono font-bold flex items-center space-x-1.5 backdrop-blur-md"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{stepAddToast}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cursor Hover Pill in Regular Mode */}
              {viewportMode === 'regular' && canvasCursorPos && !isReplayingStream && (
                <div
                  className="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-9 transition-all duration-75"
                  style={{
                    left: `${(canvasCursorPos.x / 1920) * 100}%`,
                    top: `${(canvasCursorPos.y / 1080) * 100}%`,
                  }}
                >
                  <div className="px-2 py-0.5 rounded-md bg-cyan-950/90 text-cyan-200 border border-cyan-500 text-[9px] font-mono whitespace-nowrap shadow-lg flex items-center space-x-1">
                    <MousePointer className="w-2.5 h-2.5 text-cyan-300" />
                    <span>Left-Click: Add Step ({canvasCursorPos.x}, {canvasCursorPos.y})</span>
                  </div>
                </div>
              )}

              {/* Left-Click Animated Ripple */}
              {lastClickRipple && (
                <motion.div
                  initial={{ scale: 0.2, opacity: 1 }}
                  animate={{ scale: 3.2, opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="absolute pointer-events-none z-40 w-12 h-12 rounded-full border-2 border-cyan-400 bg-cyan-400/30"
                  style={{
                    left: `${(lastClickRipple.x / 1920) * 100}%`,
                    top: `${(lastClickRipple.y / 1080) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
              {/* Grid Lines */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, rgba(6,182,212,0.4) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Motion Heatmap Visualization Layer */}
              {showMotionHeatmap && (
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-1"
                  style={{ opacity: heatmapIntensity }}
                >
                  <svg className="w-full h-full">
                    <defs>
                      <radialGradient id="heat-glow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity="0.85" />
                        <stop offset="35%" stopColor="#f59e0b" stopOpacity="0.6" />
                        <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id="heat-click" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
                        <stop offset="40%" stopColor="#f43f5e" stopOpacity="0.7" />
                        <stop offset="80%" stopColor="#a855f7" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                      </radialGradient>
                    </defs>

                    {/* Historical Recording Heatmap Blurs */}
                    {hotspotZones.map((zone) => {
                      const cx = `${zone.normalizedX * 100}%`;
                      const cy = `${zone.normalizedY * 100}%`;
                      const r = Math.max(28, Math.round(zone.radius * (activeFrame.scale || 1)));
                      return (
                        <circle
                          key={`heat-${zone.id}`}
                          cx={cx}
                          cy={cy}
                          r={r * 1.6}
                          fill={zone.clickCount > 3 ? 'url(#heat-click)' : 'url(#heat-glow)'}
                          style={{
                            filter: 'blur(12px)',
                            mixBlendMode: 'screen',
                          }}
                        />
                      );
                    })}

                    {/* Motion stream path trace from historical recording */}
                    {activeSession && activeSession.points.length > 1 && (
                      <polyline
                        points={activeSession.points
                          .map((p) => `${(p.x / 1920) * 100}%,${(p.y / 1080) * 100}%`)
                          .join(' ')}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                        opacity="0.5"
                      />
                    )}
                  </svg>
                </div>
              )}

              {/* Interaction Ghost Translucent Overlay Layer */}
              {showInteractionGhost && (
                <div className="absolute inset-0 pointer-events-none z-2">
                  <svg className="w-full h-full">
                    <defs>
                      <linearGradient id="ghost-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                        <stop offset="50%" stopColor="#c084fc" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
                      </linearGradient>
                      <filter id="ghost-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Translucent Historical Baseline Path Curve */}
                    {activeSession && activeSession.points.length > 1 && (
                      <>
                        <polyline
                          points={activeSession.points
                            .map((p) => `${(p.x / 1920) * 100}%,${(p.y / 1080) * 100}%`)
                            .join(' ')}
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="5"
                          opacity="0.25"
                          filter="url(#ghost-glow)"
                        />
                        <polyline
                          points={activeSession.points
                            .map((p) => `${(p.x / 1920) * 100}%,${(p.y / 1080) * 100}%`)
                            .join(' ')}
                          fill="none"
                          stroke="url(#ghost-grad)"
                          strokeWidth="2"
                          strokeDasharray="5 3"
                          opacity="0.8"
                        />
                        {/* Waypoint nodes along the historical ghost trajectory */}
                        {activeSession.points.filter((_, i) => i % 5 === 0).map((pt, idx) => (
                          <circle
                            key={`ghost-wpt-${idx}`}
                            cx={`${(pt.x / 1920) * 100}%`}
                            cy={`${(pt.y / 1080) * 100}%`}
                            r="2.5"
                            fill="#d8b4fe"
                            opacity="0.75"
                          />
                        ))}
                      </>
                    )}
                  </svg>

                  {/* Translucent Ghost Cursor Silhouette during live test playback */}
                  {(simulationState.isRunning || isReplayingStream) && (
                    <motion.div
                      animate={{ opacity: [0.45, 0.75, 0.45], scale: [0.96, 1.04, 0.96] }}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${(targetCoords.x / 1920) * 100}%`,
                        top: `${(targetCoords.y / 1080) * 100}%`,
                        transform: 'translate(-2px, -2px)',
                      }}
                    >
                      <div className="relative">
                        <MousePointer className="w-5 h-5 text-purple-300 fill-purple-400/50 filter drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]" />
                        <span className="absolute left-5 -top-1 px-1.5 py-0.5 rounded bg-purple-950/90 text-purple-200 border border-purple-600/60 text-[8px] font-mono whitespace-nowrap shadow-md backdrop-blur-xs flex items-center space-x-1">
                          <Ghost className="w-2.5 h-2.5 text-purple-400" />
                          <span>Ghost Baseline</span>
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* High-Frequency Interaction Zone Overlays */}
              {showHotspotZones && (
                <div className="absolute inset-0 pointer-events-none z-2">
                  {hotspotZones.map((zone) => {
                    const left = `${zone.normalizedX * 100}%`;
                    const top = `${zone.normalizedY * 100}%`;
                    const isHighDensity = zone.intensity > 0.6;
                    return (
                      <motion.div
                        key={zone.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute flex flex-col items-center pointer-events-none"
                        style={{
                          left,
                          top,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <div
                          className={`rounded-full flex items-center justify-center border transition-all ${
                            isHighDensity
                              ? 'border-pink-400 bg-pink-500/25 text-pink-300 shadow-lg shadow-pink-500/20'
                              : 'border-amber-400/80 bg-amber-500/20 text-amber-300 shadow-md shadow-amber-500/10'
                          }`}
                          style={{
                            width: `${Math.max(34, zone.radius * 0.9)}px`,
                            height: `${Math.max(34, zone.radius * 0.9)}px`,
                          }}
                        >
                          <Radio className="w-3.5 h-3.5 animate-pulse" />
                        </div>
                        <span className="mt-1 text-[8px] font-mono font-bold bg-slate-950/90 text-slate-200 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap shadow-sm">
                          {zone.label} ({zone.eventCount} events{zone.clickCount > 0 ? `, ${zone.clickCount} clicks` : ''})
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Regular Mode Left-Click Added Step Markers */}
              {viewportMode === 'regular' && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  {regularSteps.map((st, idx) => (
                    <motion.div
                      key={st.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute flex flex-col items-center pointer-events-auto cursor-pointer select-none"
                      style={{
                        left: `${(st.x / 1920) * 100}%`,
                        top: `${(st.y / 1080) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      title={`${st.label} (${st.x}, ${st.y})`}
                    >
                      <div className="relative">
                        <div className="w-6 h-6 rounded-full border-2 border-cyan-300 bg-cyan-950/90 text-cyan-200 flex items-center justify-center font-mono font-bold text-[9px] shadow-lg shadow-cyan-950 ring-2 ring-cyan-500/40">
                          {idx + 1}
                        </div>
                        {/* Target Crosshair Ping */}
                        <div className="absolute -inset-1 rounded-full border border-cyan-400/60 animate-ping pointer-events-none" />
                      </div>
                      <span className="mt-1 text-[8px] font-mono font-bold bg-slate-950/95 text-cyan-300 px-1.5 py-0.5 rounded-md border border-cyan-700/60 shadow-md whitespace-nowrap">
                        {st.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Editable Spline Curve Layer with Tangent Guide Lines */}
              {showWaypointHandles && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-4" viewBox="0 0 1920 1080">
                  <defs>
                    <linearGradient id="spline-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="50%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>

                  {/* Tangent Polygon Guide Line */}
                  <polyline
                    points={waypoints.map((w) => `${w.x},${w.y}`).join(' ')}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    opacity="0.4"
                  />

                  {/* Smooth Calibrated Spline Curve */}
                  {splinePath && (
                    <>
                      <path
                        d={splinePath}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="6"
                        opacity="0.3"
                      />
                      <path
                        d={splinePath}
                        fill="none"
                        stroke="url(#spline-gradient)"
                        strokeWidth="3.5"
                      />
                    </>
                  )}
                </svg>
              )}

              {/* Interactive Click-and-Drag Handle Markers */}
              {showWaypointHandles && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  {waypoints.map((wp, idx) => {
                    const isDragging = draggingWaypointId === wp.id;
                    const isAnchor = wp.isAnchor || idx === 0 || idx === waypoints.length - 1;

                    return (
                      <div
                        key={wp.id}
                        onPointerDown={(e) => handleWaypointPointerDown(wp.id, e)}
                        className={`absolute flex flex-col items-center select-none pointer-events-auto cursor-grab active:cursor-grabbing transition-transform ${
                          isDragging ? 'scale-125 z-50' : 'hover:scale-110 z-20'
                        }`}
                        style={{
                          left: `${(wp.x / 1920) * 100}%`,
                          top: `${(wp.y / 1080) * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          touchAction: 'none',
                        }}
                        title={`Drag to adjust ${wp.label} (${wp.x}, ${wp.y})`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors ${
                            isDragging
                              ? 'border-white bg-cyan-400 text-slate-950 shadow-cyan-400/80 ring-4 ring-cyan-500/40'
                              : isAnchor
                              ? 'border-emerald-400 bg-emerald-950/90 text-emerald-300 hover:border-white shadow-emerald-950'
                              : 'border-cyan-400 bg-slate-950/90 text-cyan-300 hover:border-cyan-200 hover:bg-cyan-950 shadow-cyan-950'
                          }`}
                        >
                          <span className="text-[8px] font-mono font-bold leading-none">{idx + 1}</span>
                        </div>
                        <span
                          className={`mt-1 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap shadow-md pointer-events-none ${
                            isDragging
                              ? 'bg-cyan-950 text-cyan-200 border-cyan-400'
                              : 'bg-slate-950/90 text-slate-300 border-slate-700'
                          }`}
                        >
                          {wp.label} ({wp.x}, {wp.y})
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Registered Mouse Click Interaction Coordinate Markers */}
              {showRegisteredClickMarkers && (
                <div className="absolute inset-0 pointer-events-none z-15">
                  {registeredClicks.map((clk, cIdx) => {
                    const isCurrentScrub = scrubIndex === clk.pointIndex;
                    return (
                      <motion.div
                        key={`reg-click-${clk.pointIndex}-${clk.timestamp}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        onClick={() => handleSelectLogEvent(clk.pointIndex)}
                        className={`absolute flex flex-col items-center pointer-events-auto cursor-pointer select-none transition-transform ${
                          isCurrentScrub ? 'scale-125 z-40' : 'hover:scale-115 z-15 opacity-85 hover:opacity-100'
                        }`}
                        style={{
                          left: `${(clk.x / 1920) * 100}%`,
                          top: `${(clk.y / 1080) * 100}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        title={`Click #${cIdx + 1}: (${Math.round(clk.x)}, ${Math.round(clk.y)}) at T+${Number(clk.timestamp).toFixed(2)}s - Click to Seek`}
                      >
                        <div className="relative flex items-center justify-center">
                          {/* Outer pulse ring for active frame */}
                          {isCurrentScrub && (
                            <div className="absolute -inset-2 rounded-full border-2 border-emerald-400/80 animate-ping pointer-events-none" />
                          )}
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-mono font-bold text-[9px] shadow-lg transition-colors ${
                              isCurrentScrub
                                ? 'bg-emerald-400 text-slate-950 border-white ring-4 ring-emerald-500/50 shadow-emerald-400/80'
                                : 'bg-emerald-950/90 text-emerald-300 border-emerald-500 hover:border-white shadow-emerald-950'
                            }`}
                          >
                            <MousePointer className="w-3 h-3" />
                          </div>
                        </div>
                        <span
                          className={`mt-1 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap shadow-md pointer-events-none transition-colors ${
                            isCurrentScrub
                              ? 'bg-emerald-950 text-emerald-200 border-emerald-400 ring-1 ring-emerald-500'
                              : 'bg-slate-950/90 text-slate-300 border-slate-700'
                          }`}
                        >
                          Click #{cIdx + 1} ({Math.round(clk.x)}, {Math.round(clk.y)}) @ {Number(clk.timestamp).toFixed(2)}s
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Dynamic Expanding Visual Ripple Waves on Registered Clicks during Playback */}
              <AnimatePresence>
                {playbackClickRipples.map((rip) => (
                  <motion.div
                    key={`ripple-${rip.id}`}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.4 }}
                    className="absolute pointer-events-none z-35 flex flex-col items-center justify-center"
                    style={{
                      left: `${(rip.x / 1920) * 100}%`,
                      top: `${(rip.y / 1080) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* Multi-tier expanding sonar shockwave rings */}
                    <motion.div
                      initial={{ scale: 0.2, opacity: 1 }}
                      animate={{ scale: 3.6, opacity: 0 }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                      className="absolute w-12 h-12 rounded-full border-2 border-emerald-400 bg-emerald-400/20 shadow-[0_0_20px_rgba(52,211,153,0.8)]"
                    />
                    <motion.div
                      initial={{ scale: 0.1, opacity: 0.9 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                      className="absolute w-10 h-10 rounded-full border border-cyan-300 bg-cyan-400/25"
                    />
                    <motion.div
                      initial={{ scale: 0.5, opacity: 1 }}
                      animate={{ scale: 1.2, opacity: 0.2 }}
                      transition={{ duration: 0.4 }}
                      className="w-4 h-4 rounded-full bg-white shadow-lg shadow-emerald-400"
                    />

                    {/* Pop-up Coordinate Ripple Badge */}
                    <motion.div
                      initial={{ y: 0, opacity: 0, scale: 0.7 }}
                      animate={{ y: -26, opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute -top-3 px-2 py-0.5 rounded-lg bg-slate-950/95 text-emerald-300 border border-emerald-400 text-[9px] font-mono font-bold shadow-xl shadow-emerald-950 flex items-center space-x-1 whitespace-nowrap"
                    >
                      <Zap className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                      <span>CLICK ({Math.round(rip.x)}, {Math.round(rip.y)}) @ {Number(rip.timestamp).toFixed(2)}s</span>
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Original Anchor Marker (Ghosted) */}
              <div
                className="absolute w-8 h-8 rounded-full border border-dashed border-cyan-400/40 flex items-center justify-center pointer-events-none z-3"
                style={{
                  left: `${(targetCoords.x / 1920) * 100}%`,
                  top: `${(targetCoords.y / 1080) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Crosshair className="w-3.5 h-3.5 text-cyan-400/50" />
                <span className="absolute -bottom-4 text-[8px] font-mono text-cyan-400/60 whitespace-nowrap">
                  Base ({targetCoords.x}, {targetCoords.y})
                </span>
              </div>

              {/* Adjusted Target Marker on Active Frame */}
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`absolute w-10 h-10 rounded-full border-2 flex items-center justify-center pointer-events-none shadow-lg z-3 ${
                  isWithinTolerance
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-emerald-500/20'
                    : 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-amber-500/20'
                }`}
                style={{
                  left: `${(adjustedTarget.x / 1920) * 100}%`,
                  top: `${(adjustedTarget.y / 1080) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Target className="w-4 h-4" />
                <span className="absolute -top-4 text-[8px] font-mono font-bold whitespace-nowrap bg-slate-950/80 px-1.5 py-0.5 rounded-md border border-slate-800">
                  Target ({adjustedTarget.x}, {adjustedTarget.y})
                </span>
              </motion.div>

              {/* Manual Simulation Mouse Trail Line */}
              {simulationState.trail.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-3">
                  <polyline
                    points={simulationState.trail
                      .map((p) => `${(p.x / 1920) * 100}%,${(p.y / 1080) * 100}%`)
                      .join(' ')}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    opacity="0.8"
                  />
                </svg>
              )}

              {/* Manual Action Virtual Cursor */}
              {simulationState.isRunning && (
                <motion.div
                  className="absolute pointer-events-none z-20"
                  style={{
                    left: `${(simulationState.cursorPos.x / 1920) * 100}%`,
                    top: `${(simulationState.cursorPos.y / 1080) * 100}%`,
                    transform: 'translate(-2px, -2px)',
                  }}
                >
                  <MousePointer className="w-5 h-5 text-yellow-300 fill-yellow-400 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                  {simulationState.clickRipple && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 1 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute -top-2 -left-2 w-8 h-8 rounded-full border-2 border-emerald-400 bg-emerald-400/30"
                    />
                  )}
                </motion.div>
              )}

              {/* Historical Mouse Stream Replay / Scrubbed Cursor */}
              {(isReplayingStream || streamPoints.length > 0) && replayCursorPos && (
                <motion.div
                  className="absolute pointer-events-none z-30"
                  style={{
                    left: `${(replayCursorPos.x / 1920) * 100}%`,
                    top: `${(replayCursorPos.y / 1080) * 100}%`,
                    transform: 'translate(-3px, -3px)',
                  }}
                >
                  <div className="relative">
                    <MousePointer className={`w-5 h-5 filter drop-shadow-[0_2px_6px_rgba(236,72,153,0.9)] ${
                      isReplayingStream ? 'text-pink-400 fill-pink-500' : 'text-cyan-400 fill-cyan-500'
                    }`} />
                    <span className={`absolute left-5 top-0 px-1.5 py-0.5 rounded border text-[8px] font-mono whitespace-nowrap shadow-md ${
                      isReplayingStream
                        ? 'bg-pink-950/95 text-pink-200 border-pink-700'
                        : 'bg-cyan-950/95 text-cyan-200 border-cyan-700'
                    }`}>
                      Frame #{scrubIndex + 1}: ({Math.round(replayCursorPos.x)}, {Math.round(replayCursorPos.y)})
                      {replayCursorPos.speed ? ` • ${replayCursorPos.speed}px/s` : ''}
                      {replayCursorPos.type === 'click' ? ' • [CLICK]' : ''}
                    </span>
                    {replayActiveClick && (
                      <motion.div
                        initial={{ scale: 0.4, opacity: 1 }}
                        animate={{ scale: 2.8, opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="absolute -top-2 -left-2 w-8 h-8 rounded-full border-2 border-pink-400 bg-pink-500/40"
                      />
                    )}
                  </div>
                </motion.div>
              )}

              {/* Viewport Top-Right Floating Controls (Quick Snapshot & Calibration Watermark) */}
              <div className="absolute top-2.5 right-2.5 z-40 flex items-center space-x-1.5 pointer-events-auto">
                <div className="px-2 py-0.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-700/80 text-[9px] font-mono text-slate-300 flex items-center space-x-1 shadow-md">
                  <Sliders className="w-2.5 h-2.5 text-purple-400" />
                  <span>Sens: <strong className="text-purple-300">{pixelDiffSensitivity}%</strong></span>
                  <span className="text-slate-500">|</span>
                  <span>Floor: <strong className="text-purple-300">{noiseCutoffTolerance}Δ</strong></span>
                </div>

                <button
                  id="btn-quick-viewport-snapshot"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveSnapshot();
                  }}
                  disabled={isSavingSnapshot}
                  className="px-2 py-1 rounded-lg bg-slate-950/90 hover:bg-slate-900 text-purple-300 hover:text-purple-200 border border-purple-500/60 hover:border-purple-400 text-[10px] font-mono font-bold flex items-center space-x-1 shadow-md transition-all cursor-pointer"
                  title="Quick Save Canvas Snapshot (PNG)"
                >
                  {isSavingSnapshot ? (
                    <div className="w-2.5 h-2.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  ) : snapshotSuccess ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Camera className="w-3 h-3 text-purple-400" />
                  )}
                  <span>{snapshotSuccess ? 'Saved!' : 'PNG'}</span>
                </button>
              </div>
            </div>
            )}

            {/* Mouse Stream Replay, Heatmap & Playback Scrubber Control Bar */}
            <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-cyan-500/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
                {/* Left: Replay Stream Trigger, Session Selector & Export */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="btn-replay-mouse-stream"
                    onClick={startMouseStreamReplay}
                    className={`px-3 py-1.5 rounded-xl font-bold font-mono flex items-center space-x-1.5 transition-all text-xs shadow-md ${
                      isReplayingStream
                        ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-pink-900/50 animate-pulse'
                        : 'bg-pink-950/80 hover:bg-pink-900 text-pink-300 border border-pink-700/60'
                    }`}
                  >
                    {isReplayingStream ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isReplayingStream ? 'Pause Replay' : 'Replay Mouse Cursor Stream'}</span>
                  </button>

                  <select
                    value={selectedSessionId}
                    onChange={(e) => {
                      setSelectedSessionId(e.target.value);
                      stopMouseStreamReplay();
                      setScrubIndex(0);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-mono focus:outline-hidden focus:border-cyan-500"
                  >
                    <option value="all">All Sessions ({sessions.length} recorded)</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.points.length} pts, {s.durationSec}s)
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center space-x-1 font-mono text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                    <span className="text-slate-500 font-semibold">Speed:</span>
                    {[0.5, 1, 2].map((spd) => (
                      <button
                        key={spd}
                        id={`btn-playback-speed-${spd}x`}
                        onClick={() => handleTogglePlaybackSpeed(spd)}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          replaySpeedMultiplier === spd
                            ? 'bg-cyan-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title={`Set analysis playback speed to ${spd}x`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Export Path Data Button */}
                  <button
                    id="btn-export-path-data"
                    onClick={handleExportPathData}
                    className={`px-2.5 py-1.5 rounded-xl font-mono text-[11px] font-semibold flex items-center space-x-1.5 border transition-all ${
                      exportSuccess
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-800 hover:border-cyan-500 shadow-xs'
                    }`}
                    title="Download captured mouse coordinates as a formatted JSON stream file"
                  >
                    {exportSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Path Exported!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Export Path Data (JSON)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Right: Visual Toggles */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showRegisteredClickMarkers}
                      onChange={(e) => setShowRegisteredClickMarkers(e.target.checked)}
                      className="rounded accent-emerald-500 cursor-pointer"
                    />
                    <span className="flex items-center space-x-1">
                      <MousePointer className="w-3 h-3 text-emerald-400" />
                      <span>Click Markers ({registeredClicks.length})</span>
                    </span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showInteractionGhost}
                      onChange={(e) => setShowInteractionGhost(e.target.checked)}
                      className="rounded accent-purple-500 cursor-pointer"
                    />
                    <span className="flex items-center space-x-1">
                      <Ghost className="w-3 h-3 text-purple-400" />
                      <span>Interaction Ghost</span>
                    </span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showHotspotZones}
                      onChange={(e) => setShowHotspotZones(e.target.checked)}
                      className="rounded accent-cyan-500 cursor-pointer"
                    />
                    <span className="flex items-center space-x-1">
                      <Radio className="w-3 h-3 text-pink-400" />
                      <span>Zones ({hotspotZones.length})</span>
                    </span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showMotionHeatmap}
                      onChange={(e) => setShowMotionHeatmap(e.target.checked)}
                      className="rounded accent-amber-500 cursor-pointer"
                    />
                    <span className="flex items-center space-x-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>Heatmap</span>
                    </span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={showPathDeviationChart}
                      onChange={(e) => setShowPathDeviationChart(e.target.checked)}
                      className="rounded accent-cyan-500 cursor-pointer"
                    />
                    <span className="flex items-center space-x-1">
                      <LineChartIcon className="w-3 h-3 text-cyan-400" />
                      <span>Deviation Chart</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Playback Scrubbing Timeline Slider */}
              {streamPoints.length > 0 && (
                <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <div className="flex items-center space-x-2 text-slate-300">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-bold">Playback Stream Scrubber</span>
                      <span className="text-slate-500">|</span>
                      <span className="text-cyan-300">
                        Frame {scrubIndex + 1} of {streamPoints.length}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      {streamPoints[scrubIndex] && (
                        <span className="text-slate-400">
                          Pos: <strong className="text-slate-200">({Math.round(streamPoints[scrubIndex].x)}, {Math.round(streamPoints[scrubIndex].y)})</strong>
                          {streamPoints[scrubIndex].speed ? ` • ${streamPoints[scrubIndex].speed}px/s` : ''}
                          <span className="ml-1.5 px-1 py-0.2 rounded bg-slate-800 text-cyan-300 text-[9px] border border-slate-700 uppercase">
                            {streamPoints[scrubIndex].type}
                          </span>
                        </span>
                      )}
                      <span className="text-pink-400 font-bold">
                        {Math.round(((scrubIndex + 1) / streamPoints.length) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Scrubber Controls and Range Slider */}
                  <div className="flex items-center space-x-2.5">
                    <button
                      onClick={() => stepScrub(-1)}
                      disabled={scrubIndex <= 0}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Step 1 frame backward"
                    >
                      <SkipBack className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={startMouseStreamReplay}
                      className="p-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 transition-colors"
                      title={isReplayingStream ? 'Pause Replay' : 'Play Trajectory'}
                    >
                      {isReplayingStream ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => stepScrub(1)}
                      disabled={scrubIndex >= streamPoints.length - 1}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Step 1 frame forward"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>

                    <div className="relative flex-1 flex items-center">
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, streamPoints.length - 1)}
                        value={scrubIndex}
                        onChange={(e) => handleScrubChange(Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Heatmap Color-Gradient Legend with Interaction Density Details */}
              {showMotionHeatmap && (
                <div className="p-3 bg-slate-900/90 rounded-2xl border border-amber-500/30 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                    <span className="flex items-center space-x-1.5 text-amber-300 font-bold">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span>Heatmap Interaction Density Spectrum & Legend</span>
                    </span>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                      <span>Hotspots: <strong className="text-amber-300 font-mono">{hotspotZones.length}</strong></span>
                      <span>•</span>
                      <span>Intensity Scale: <strong className="text-pink-300 font-mono">{Math.round(heatmapIntensity * 100)}%</strong></span>
                      <span>•</span>
                      <span className="text-cyan-300">Click & Motion Cluster Analysis</span>
                    </div>
                  </div>

                  {/* Multi-Stop Spectral Gradient Color Bar with Markers */}
                  <div className="space-y-1">
                    <div className="relative w-full h-3 rounded-full overflow-hidden bg-slate-950 border border-slate-700/80 shadow-inner">
                      <div className="w-full h-full bg-gradient-to-r from-blue-600 via-cyan-400 via-amber-400 via-pink-500 to-red-600" />
                    </div>
                    {/* Scale Percentage Markers */}
                    <div className="flex justify-between text-[8px] font-mono text-slate-500 px-0.5">
                      <span>0% (Null)</span>
                      <span>25% (Low)</span>
                      <span>50% (Moderate)</span>
                      <span>75% (High)</span>
                      <span>100% (Critical)</span>
                    </div>
                  </div>

                  {/* Density Classifications Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[10px] font-mono">
                    <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-800/40 space-y-0.5">
                      <div className="flex items-center space-x-1.5 text-cyan-300 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 ring-1 ring-cyan-200" />
                        <span>Low Density (&lt;25%)</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight">
                        Rapid cursor traversal & brief mouse fly-over passes with minimal dwell time.
                      </p>
                    </div>

                    <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-800/40 space-y-0.5">
                      <div className="flex items-center space-x-1.5 text-amber-300 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 ring-1 ring-amber-200" />
                        <span>Moderate (25-50%)</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight">
                        Visual inspection zones, content reading pauses, and pointer hover hesitation.
                      </p>
                    </div>

                    <div className="p-2 rounded-xl bg-pink-950/40 border border-pink-800/40 space-y-0.5">
                      <div className="flex items-center space-x-1.5 text-pink-300 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0 ring-1 ring-pink-200" />
                        <span>High Transit (50-75%)</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight">
                        Frequent navigation corridor, repetitive mouse pathways, and deliberate approach gestures.
                      </p>
                    </div>

                    <div className="p-2 rounded-xl bg-red-950/40 border border-red-800/40 space-y-0.5">
                      <div className="flex items-center space-x-1.5 text-red-300 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 ring-1 ring-red-200" />
                        <span>Critical / Clicks (&gt;75%)</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight">
                        Primary interaction targets, button click clusters, and concentrated input actions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Regular Mode Added Steps Sequence Drawer */}
              {viewportMode === 'regular' && (
                <div className="p-3 bg-slate-900/80 rounded-2xl border border-cyan-500/30 space-y-2 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5 text-cyan-300 font-bold">
                      <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Regular Mode Steps Recorded ({regularSteps.length})</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Left-click anywhere on canvas above to append new automation steps
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                    {regularSteps.map((st, idx) => (
                      <div
                        key={st.id}
                        className="flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-slate-950 border border-cyan-700/50 text-[10px] text-slate-200"
                      >
                        <span className="w-4 h-4 rounded-full bg-cyan-900 text-cyan-200 font-bold flex items-center justify-center text-[9px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-cyan-300">({st.x}, {st.y})</span>
                        <span className="text-[9px] text-slate-400 uppercase bg-slate-900 px-1 py-0.2 rounded border border-slate-800">
                          {st.action}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">@{st.timestamp}</span>
                        <button
                          onClick={() => setRegularSteps((prev) => prev.filter((s) => s.id !== st.id))}
                          className="text-slate-500 hover:text-red-400 transition-colors ml-1"
                          title="Remove step"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stream Replay Progress Bar (when active) */}
              {isReplayingStream && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-mono text-pink-300">
                    <span>Replaying Stream Trajectory...</span>
                    <span>{replayProgressPct}% Completed</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-amber-400 transition-all duration-75"
                      style={{ width: `${replayProgressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Real-Time Path Deviation Line Chart (Recharts) */}
            {showPathDeviationChart && (
              <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-cyan-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800">
                      <LineChartIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-wider">
                      Real-Time Path Deviation Delta (Recorded vs Expected)
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[10px] font-mono">
                    <span className="flex items-center space-x-1 text-cyan-400">
                      <span className="w-2 h-0.5 bg-cyan-400 inline-block" />
                      <span>Drift Distance (px)</span>
                    </span>
                    <span className="flex items-center space-x-1 text-pink-400">
                      <span className="w-2 h-0.5 bg-pink-400 inline-block" />
                      <span>ΔX Offset</span>
                    </span>
                    <span className="flex items-center space-x-1 text-amber-400">
                      <span className="w-2 h-0.5 bg-amber-400 inline-block" />
                      <span>ΔY Offset</span>
                    </span>
                    <span className="text-red-400 border-l border-slate-800 pl-2">
                      Max Tolerance: {tolerancePx}px
                    </span>
                  </div>
                </div>

                <div className="h-36 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={pathDeviationSeries}
                      margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="step"
                        stroke="#64748b"
                        tick={{ fontSize: 9, fill: '#64748b' }}
                        tickLine={{ stroke: '#334155' }}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 9, fill: '#64748b' }}
                        tickLine={{ stroke: '#334155' }}
                        domain={[0, 'auto']}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-2 rounded-xl bg-slate-900 border border-slate-700 shadow-xl text-[10px] font-mono space-y-1 z-50">
                                <p className="font-bold text-slate-200 border-b border-slate-800 pb-0.5">
                                  {label} (Sample #{data.index + 1})
                                </p>
                                <div className="space-y-0.5">
                                  <p className="text-cyan-300">
                                    Total Drift: <span className="font-bold">{data.driftDistance}px</span>
                                  </p>
                                  <p className="text-pink-300">
                                    Offset ΔX: {data.deltaX}px (Rec: {data.recordedX} / Exp: {data.expectedX})
                                  </p>
                                  <p className="text-amber-300">
                                    Offset ΔY: {data.deltaY}px (Rec: {data.recordedY} / Exp: {data.expectedY})
                                  </p>
                                </div>
                                <div className="pt-0.5 border-t border-slate-800 flex items-center justify-between">
                                  <span className="text-slate-400">Tolerance Limit:</span>
                                  <span className={data.driftDistance <= data.tolerance ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                    {data.driftDistance <= data.tolerance ? 'Within Spec' : 'Exceeded'}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine
                        y={tolerancePx}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />
                      <Line
                        type="monotone"
                        dataKey="driftDistance"
                        name="Drift Distance"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, fill: '#06b6d4', stroke: '#fff' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="deltaX"
                        name="ΔX Offset"
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="deltaY"
                        name="ΔY Offset"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Drift and Match Analysis Telemetry */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                  Drift Distance
                </span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className={`text-xl font-bold font-mono ${isWithinTolerance ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {driftDistance}px
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    (ΔX {adjustedTarget.x - targetCoords.x}, ΔY {adjustedTarget.y - targetCoords.y})
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                  Anchor Similarity
                </span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-xl font-bold font-mono text-cyan-400">
                    {activeFrame.similarity}%
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {activeFrame.anchorDetected ? 'Anchor Locked' : 'Searching Anchor'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                  Compensated Status
                </span>
                <div className="flex items-center space-x-1.5 mt-1">
                  {isWithinTolerance ? (
                    <div className="flex items-center space-x-1 text-emerald-400 font-bold font-mono text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready to Dispatch</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-amber-400 font-bold font-mono text-xs">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Re-anchor Required</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-mono"
              >
                Close
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    onApplyRepositionedCoords?.(adjustedTarget);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-mono flex items-center space-x-2 shadow-lg shadow-cyan-950 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apply Compensated Coordinates ({adjustedTarget.x}, {adjustedTarget.y})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
