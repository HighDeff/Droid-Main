import React, { useState, useEffect } from 'react';
import {
  Eye,
  Activity,
  Sparkles,
  Bot,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Compass,
  Scan,
  Maximize2,
  Minimize2,
  X,
  ChevronRight,
  ShieldCheck,
  Clock,
  Volume2,
  Search,
  Layers,
  MousePointer,
  Route,
  Check,
  CheckCheck,
  Wand2,
} from 'lucide-react';
import {
  OverseerLearnedNote,
  OverseerNudge,
  AutoDeploySettings,
  WorkflowStep,
} from '../types/automation';
import { ActiveSection } from '../types/drive';
import { BackgroundUIObserver } from '../services/uiStateObserver';
import { MouseTrajectoryStore } from '../services/mouseTrajectoryStore';

interface OverseerAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: ActiveSection;
  onSwitchSection: (section: ActiveSection) => void;
  learnedNotes: OverseerLearnedNote[];
  settings: AutoDeploySettings;
  onUpdateSettings: (settings: Partial<AutoDeploySettings>) => void;
  onOpenSettingsModal: () => void;
  onExecuteNudgeAction?: (nudge: OverseerNudge) => void;
  onOpenWorkflowOrchestrator?: () => void;
  isAnalyzingFrame?: boolean;
  currentDiffScore?: number;
}

export const OverseerAIPanel: React.FC<OverseerAIPanelProps> = ({
  isOpen,
  onClose,
  activeSection,
  onSwitchSection,
  learnedNotes,
  settings,
  onUpdateSettings,
  onOpenSettingsModal,
  onExecuteNudgeAction,
  onOpenWorkflowOrchestrator,
  isAnalyzingFrame = false,
  currentDiffScore = 0.94,
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'notes' | 'nudges'>('monitor');
  const [pendingExpectationCount, setPendingExpectationCount] = useState(0);
  const [batchAutoFixEnabled, setBatchAutoFixEnabled] = useState<boolean>(false);
  const [batchFixToast, setBatchFixToast] = useState<string | null>(null);
  const [autoFixedIds, setAutoFixedIds] = useState<Set<string>>(new Set());

  const [nudges, setNudges] = useState<OverseerNudge[]>([
    {
      id: 'nudge-speed-anomaly-1',
      title: 'Mouse Velocity Spike in Search Navigation',
      message: 'Detected abrupt cursor velocity leap of 1,680 px/s (295% higher than baseline 410 px/s). Suggested smooth cubic bezier path is ready.',
      severity: 'warning',
      pathAnomalyDetails: {
        currentSpeed: 1680,
        baselineSpeed: 410,
        deviationPercentage: 295,
        anomalyType: 'too_fast',
        stepTitle: 'Search Bar Cursor Acceleration',
        targetSelector: '#drive-search-input',
        originalCoords: { x: 960, y: 540 },
        correctionMethod: 'cubic_bezier_smoothing',
        applied: false,
        correctedWaypoints: [
          { x: 140, y: 140, speed: 280, timestampOffsetMs: 0, label: 'Origin (Smoothed)' },
          { x: 420, y: 110, speed: 410, timestampOffsetMs: 250, label: 'Arc Transition' },
          { x: 740, y: 80, speed: 430, timestampOffsetMs: 500, label: 'Pre-Arrival Easing' },
          { x: 960, y: 64, speed: 310, timestampOffsetMs: 750, label: 'Target Search Arrival' },
        ],
      },
    },
    {
      id: 'nudge-speed-anomaly-2',
      title: 'Erratic Diagonal Cursor Leap in File Grid',
      message: 'Detected erratic mouse vector of 1,520 px/s skipping intermediate frame anchors. Realigned waypoint sequence generated.',
      severity: 'warning',
      pathAnomalyDetails: {
        currentSpeed: 1520,
        baselineSpeed: 390,
        deviationPercentage: 289,
        anomalyType: 'too_fast',
        stepTitle: 'File Selection Trajectory Drift',
        targetSelector: '#file-row-presentation',
        originalCoords: { x: 300, y: 600 },
        correctionMethod: 'cubic_bezier_smoothing',
        applied: false,
        correctedWaypoints: [
          { x: 200, y: 220, speed: 260, timestampOffsetMs: 0, label: 'Grid Origin' },
          { x: 380, y: 360, speed: 400, timestampOffsetMs: 220, label: 'Linear Center Arc' },
          { x: 560, y: 480, speed: 410, timestampOffsetMs: 440, label: 'Approach Angle' },
          { x: 680, y: 550, speed: 290, timestampOffsetMs: 650, label: 'File Row Anchor' },
        ],
      },
    },
    {
      id: 'nudge-1',
      title: 'Contextual Tab Recommendation',
      message: "Target operations index starred files. Switch to 'Starred' tab to ensure proper element resolution.",
      severity: 'tip',
      targetTab: 'starred',
      suggestedAction: {
        label: 'Switch to Starred Tab',
        step: {
          title: 'Navigate to Starred Tab',
          targetSelector: '#nav-item-starred',
          actionType: 'switch_tab',
          targetTab: 'starred',
          status: 'pending',
        },
      },
    },
    {
      id: 'nudge-2',
      title: 'Modal Overlay Detected',
      message: "An active dialog is covering 42% of the primary file grid. Auto-dismiss 'X' rule is ready to deploy.",
      severity: 'info',
      suggestedAction: {
        label: "Auto-Deploy 'X' Dismiss",
        step: {
          title: "Dismiss Blocking 'X' Overlay",
          targetSelector: '#btn-close-modal',
          actionType: 'dismiss_overlay',
          status: 'pending',
        },
      },
    },
  ]);

  // Subscribe to BackgroundUIObserver and MouseTrajectoryStore for real-time alerts
  useEffect(() => {
    const observer = BackgroundUIObserver.getInstance();
    observer.setEnabled(settings.enableBackgroundUiObserver);
    observer.setDefaultTimeoutMs(settings.expectedElementTimeoutMs);

    const unsubscribeObserver = observer.subscribe((timeoutNudge, note) => {
      setNudges((prev) => [timeoutNudge, ...prev.filter((n) => n.id !== timeoutNudge.id)]);
      setActiveTab('nudges');
      setPendingExpectationCount(observer.getActiveExpectations().length);
    });

    const trajectoryStore = MouseTrajectoryStore.getInstance();
    const unsubscribeAnomaly = trajectoryStore.subscribeAnomalyAlerts((anomalyNudge, note) => {
      if (settings.mouseAnomalyDetectionEnabled ?? true) {
        if (batchAutoFixEnabled && anomalyNudge.pathAnomalyDetails) {
          const autoAppliedNudge: OverseerNudge = {
            ...anomalyNudge,
            pathAnomalyDetails: {
              ...anomalyNudge.pathAnomalyDetails,
              applied: true,
            },
          };
          setAutoFixedIds((prev) => new Set(prev).add(autoAppliedNudge.id));
          setNudges((prev) => [autoAppliedNudge, ...prev.filter((n) => n.id !== autoAppliedNudge.id)]);
          onExecuteNudgeAction?.(autoAppliedNudge);
          setBatchFixToast(`⚡ Batch Auto-Fix applied suggested path correction to new anomaly: ${anomalyNudge.title}`);
          setTimeout(() => setBatchFixToast(null), 3500);
        } else {
          setNudges((prev) => [anomalyNudge, ...prev.filter((n) => n.id !== anomalyNudge.id)]);
        }
        setActiveTab('nudges');
      }
    });

    const interval = setInterval(() => {
      setPendingExpectationCount(observer.getActiveExpectations().length);
    }, 1000);

    return () => {
      unsubscribeObserver();
      unsubscribeAnomaly();
      clearInterval(interval);
    };
  }, [settings.enableBackgroundUiObserver, settings.expectedElementTimeoutMs, settings.mouseAnomalyDetectionEnabled, batchAutoFixEnabled, onExecuteNudgeAction]);

  if (!isOpen) return null;

  const handleDismissNudge = (id: string) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSimulateObserverTimeout = () => {
    const observer = BackgroundUIObserver.getInstance();
    observer.expectElement({
      selector: '#non-existent-target-test-element',
      stepTitle: 'Test Missing Element Watchdog',
      targetTab: 'trash',
      actionType: 'click',
      timeoutMs: 1500,
    });
    setPendingExpectationCount(observer.getActiveExpectations().length);
  };

  const handleSimulateSpeedAnomaly = () => {
    const trajectoryStore = MouseTrajectoryStore.getInstance();
    const speed = Math.round(1400 + Math.random() * 500);
    const deviation = Math.round(((speed - 410) / 410) * 100);
    trajectoryStore.emitSpeedAnomalyAlert({
      currentSpeed: speed,
      deviationPercentage: deviation,
      anomalyType: 'too_fast',
      stepTitle: `Simulated Mouse Vector Leap #${Math.floor(Math.random() * 900 + 100)}`,
      targetSelector: '#drive-search-input',
    });
  };

  const handleSimulateMultipleSpeedAnomalies = () => {
    const trajectoryStore = MouseTrajectoryStore.getInstance();
    const targets = [
      { sel: '#drive-search-input', title: 'Search Acceleration Spike', speed: 1720 },
      { sel: '#btn-new-create', title: 'Action Button Overshoot Drift', speed: 1580 },
      { sel: '#file-grid-item', title: 'File Grid Rapid Drag Glitch', speed: 1840 },
    ];
    targets.forEach((t, i) => {
      setTimeout(() => {
        const deviation = Math.round(((t.speed - 410) / 410) * 100);
        trajectoryStore.emitSpeedAnomalyAlert({
          currentSpeed: t.speed,
          deviationPercentage: deviation,
          anomalyType: 'too_fast',
          stepTitle: t.title,
          targetSelector: t.sel,
        });
      }, i * 150);
    });
  };

  const handleAutoFixPath = (nudge: OverseerNudge) => {
    if (!nudge.pathAnomalyDetails) return;

    setAutoFixedIds((prev) => new Set(prev).add(nudge.id));

    // Update nudge state
    setNudges((prev) =>
      prev.map((n) =>
        n.id === nudge.id
          ? {
              ...n,
              pathAnomalyDetails: {
                ...n.pathAnomalyDetails!,
                applied: true,
              },
            }
          : n
      )
    );

    // If caller provided callback, execute suggested action
    if (onExecuteNudgeAction) {
      onExecuteNudgeAction(nudge);
    }
  };

  // Batch Auto-Fix: Apply suggested path corrections to all detected anomalies at once
  const handleBatchAutoFixAll = () => {
    const unapplied = nudges.filter(
      (n) => n.pathAnomalyDetails && !n.pathAnomalyDetails.applied && !autoFixedIds.has(n.id)
    );

    if (unapplied.length === 0) {
      setBatchFixToast('All detected anomaly paths in recording are already auto-fixed!');
      setTimeout(() => setBatchFixToast(null), 3000);
      return;
    }

    const updatedFixedIds = new Set(autoFixedIds);
    unapplied.forEach((n) => updatedFixedIds.add(n.id));
    setAutoFixedIds(updatedFixedIds);

    setNudges((prev) =>
      prev.map((n) => {
        if (n.pathAnomalyDetails && (!n.pathAnomalyDetails.applied || !autoFixedIds.has(n.id))) {
          return {
            ...n,
            pathAnomalyDetails: {
              ...n.pathAnomalyDetails,
              applied: true,
            },
          };
        }
        return n;
      })
    );

    unapplied.forEach((nudge) => {
      onExecuteNudgeAction?.(nudge);
    });

    setBatchFixToast(
      `✓ Batch Auto-Fix applied suggested path corrections to all ${unapplied.length} detected anomaly paths simultaneously!`
    );
    setTimeout(() => setBatchFixToast(null), 4000);
  };

  const handleToggleBatchAutoFix = (enabled: boolean) => {
    setBatchAutoFixEnabled(enabled);
    if (enabled) {
      const unapplied = nudges.filter(
        (n) => n.pathAnomalyDetails && !n.pathAnomalyDetails.applied && !autoFixedIds.has(n.id)
      );
      if (unapplied.length > 0) {
        handleBatchAutoFixAll();
      } else {
        setBatchFixToast('⚡ Batch Auto-Fix enabled: All detected path anomalies will be corrected automatically.');
        setTimeout(() => setBatchFixToast(null), 3500);
      }
    } else {
      setBatchFixToast('Batch Auto-Fix disabled: Corrections require manual one-by-one approval.');
      setTimeout(() => setBatchFixToast(null), 3000);
    }
  };

  const timeoutNudgesCount = nudges.filter((n) => n.elementTimeoutDetails).length;

  return (
    <aside
      id="overseer-ai-panel"
      className="fixed right-4 bottom-4 z-40 w-96 max-h-[85vh] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/60 dark:bg-zinc-800/40">
        <div className="flex items-center space-x-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300 shadow-xs">
              <Eye className="w-4 h-4" />
            </div>
            {/* Live radar beacon */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-900 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Overseer AI
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded-md font-semibold">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Autonomous screen monitor & UI state observer
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            id="btn-overseer-settings"
            onClick={onOpenSettingsModal}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Configure Auto-Deploy & Observer Watchdog Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            id="btn-close-overseer"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Status Bar */}
      <div className="px-4 py-2 bg-zinc-100/60 dark:bg-zinc-800/60 border-b border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          {settings.freeRoamMode ? (
            <span className="inline-flex items-center space-x-1 font-bold text-[11px] text-purple-600 dark:text-purple-400">
              <Zap className="w-3 h-3 text-purple-500 animate-bounce" />
              <span>Free Roam: ACTIVE</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 text-zinc-600 dark:text-zinc-400 text-[11px]">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>UI Observer: {settings.enableBackgroundUiObserver ? 'ON' : 'OFF'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 font-mono text-[10px] text-zinc-500">
          <span>Active Tab:</span>
          <span className="font-bold text-zinc-800 dark:text-zinc-200">{activeSection}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold px-4 pt-2">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`pb-2 px-2.5 transition-colors border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'monitor'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Scan className="w-3.5 h-3.5" />
          <span>Monitor</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-2 px-2.5 transition-colors border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'notes'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Learned Notes ({learnedNotes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('nudges')}
          className={`pb-2 px-2.5 transition-colors border-b-2 flex items-center space-x-1.5 relative ${
            activeTab === 'nudges'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span>Nudges ({nudges.length})</span>
          {timeoutNudgesCount > 0 ? (
            <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[9px] font-bold animate-pulse">
              {timeoutNudgesCount} alert
            </span>
          ) : nudges.length > 0 ? (
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          ) : null}
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        {activeTab === 'monitor' && (
          <div className="space-y-3 text-xs">
            {/* Screen Telemetry Card */}
            <div className="p-3 rounded-2xl bg-zinc-900 text-white space-y-2 relative overflow-hidden border border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-mono text-[11px] text-zinc-300 font-semibold">
                    REALTIME SCREEN VISION
                  </span>
                </div>
                <span className="font-mono text-[10px] text-zinc-400">
                  Diff Index: {(currentDiffScore * 100).toFixed(1)}%
                </span>
              </div>

              {/* Simulated mini HUD view */}
              <div className="h-28 rounded-xl bg-zinc-950/80 border border-zinc-800 p-2 relative flex flex-col justify-between font-mono text-[10px]">
                {isAnalyzingFrame && (
                  <div className="absolute inset-0 bg-blue-900/30 backdrop-blur-2xs flex flex-col items-center justify-center space-y-1 text-blue-300 z-10 animate-pulse">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                    <span className="font-bold text-xs">ANALYZING FRAME...</span>
                  </div>
                )}

                <div className="flex justify-between text-zinc-500">
                  <span>[#app-header] OK</span>
                  <span>[#app-sidebar] ALIGNED</span>
                </div>

                {/* Target overlay indicator */}
                <div className="mx-auto border border-dashed border-purple-400/80 bg-purple-500/10 rounded-md p-1.5 text-center text-purple-300">
                  Target Anchor: #drive-search-input (0px drift)
                </div>

                <div className="flex justify-between text-zinc-500 text-[9px]">
                  <span>Frame 1440x900</span>
                  <span>Surroundings: 96% Match</span>
                </div>
              </div>
            </div>

            {/* Background UI State Observer Watchdog Status */}
            <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-500" />
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                    Background UI Observer
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                    settings.enableBackgroundUiObserver
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                  }`}
                >
                  {settings.enableBackgroundUiObserver ? 'WATCHDOG ACTIVE' : 'DISABLED'}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span>Timeout Watchdog:</span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {settings.expectedElementTimeoutMs}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pending UI Expectations:</span>
                  <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
                    {pendingExpectationCount} elements
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Timeout Action:</span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 capitalize">
                    {settings.onElementTimeoutAction.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSimulateObserverTimeout}
                className="w-full py-1.5 px-2.5 rounded-xl border border-dashed border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 font-semibold text-[11px] flex items-center justify-center space-x-1 transition-colors"
              >
                <Clock className="w-3 h-3" />
                <span>Simulate Expected Element Timeout</span>
              </button>
            </div>

            {/* Mouse Speed Anomaly Watchdog Status */}
            <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-pink-500" />
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                    Mouse Velocity Anomaly Watchdog
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                    settings.mouseAnomalyDetectionEnabled ?? true
                      ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                  }`}
                >
                  {settings.mouseAnomalyDetectionEnabled ?? true ? 'ANOMALY GUARD ON' : 'OFF'}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span>Sensitivity Multiplier:</span>
                  <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                    {(settings.mouseSpeedThresholdMultiplier || 2.2).toFixed(1)}x Historical Baseline
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Historical Baseline:</span>
                  <span className="font-mono font-semibold text-pink-600 dark:text-pink-400">
                    ~410 px/s (±280 px/s)
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  id="btn-simulate-speed-anomaly"
                  onClick={handleSimulateSpeedAnomaly}
                  className="flex-1 py-1.5 px-2.5 rounded-xl border border-dashed border-pink-300 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/50 font-semibold text-[10px] flex items-center justify-center space-x-1 transition-colors"
                  title="Simulate a single velocity spike in the active recording"
                >
                  <Zap className="w-3 h-3 text-pink-500" />
                  <span>Simulate 1 Anomaly</span>
                </button>
                <button
                  id="btn-simulate-multi-anomalies"
                  onClick={handleSimulateMultipleSpeedAnomalies}
                  className="flex-1 py-1.5 px-2.5 rounded-xl border border-dashed border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 font-semibold text-[10px] flex items-center justify-center space-x-1 transition-colors"
                  title="Simulate multiple anomalies across a recording session for batch testing"
                >
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  <span>Simulate Batch (3x)</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                id="btn-open-orchestrator-from-overseer"
                onClick={onOpenWorkflowOrchestrator}
                className="w-full py-2.5 px-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-xs transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Launch Autonomous Orchestrator</span>
              </button>

              <button
                id="btn-toggle-free-roam-quick"
                onClick={() =>
                  onUpdateSettings({ freeRoamMode: !settings.freeRoamMode })
                }
                className={`w-full py-2 px-3 rounded-2xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                  settings.freeRoamMode
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <span>
                  {settings.freeRoamMode
                    ? '⚡ Disable Free Roam Mode'
                    : '🚀 Enable Free Roam Mode'}
                </span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-2.5 text-xs">
            <p className="text-[11px] text-zinc-400">
              Overseer AI continuously records learned conditions & anchor behaviors:
            </p>
            {learnedNotes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {note.title}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {note.timestamp}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {note.observation}
                </p>
                {note.actionTaken && (
                  <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-1 rounded-md">
                    &rarr; {note.actionTaken}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'nudges' && (
          <div className="space-y-2.5 text-xs">
            {/* Batch Auto-Fix Toast Banner */}
            {batchFixToast && (
              <div className="p-2.5 rounded-2xl bg-purple-900/90 text-white font-mono text-[11px] flex items-center justify-between border border-purple-400/60 shadow-lg animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                  <span className="leading-tight">{batchFixToast}</span>
                </div>
                <button
                  onClick={() => setBatchFixToast(null)}
                  className="text-purple-300 hover:text-white ml-2 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Batch Auto-Fix Control Bar */}
            <div className="p-3 rounded-2xl border border-purple-300 dark:border-purple-800/80 bg-gradient-to-r from-purple-50 via-indigo-50/70 to-purple-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                    <CheckCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-purple-950 dark:text-purple-100 flex items-center space-x-1.5">
                      <span>Batch Auto-Fix</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md font-mono text-[9px] font-bold ${
                          batchAutoFixEnabled
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {batchAutoFixEnabled ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-[10px] text-purple-800/80 dark:text-purple-300/80 leading-tight">
                      Apply suggested path corrections to all detected anomalies at once
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2" title="Toggle Batch Auto-Fix mode">
                  <input
                    type="checkbox"
                    id="toggle-batch-autofix"
                    checked={batchAutoFixEnabled}
                    onChange={(e) => handleToggleBatchAutoFix(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Batch Action Button when unapplied path anomalies exist */}
              {nudges.some((n) => n.pathAnomalyDetails && !n.pathAnomalyDetails.applied && !autoFixedIds.has(n.id)) && (
                <button
                  id="btn-batch-autofix-all"
                  onClick={handleBatchAutoFixAll}
                  className="w-full py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/20 transition-all cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-purple-200 animate-pulse" />
                  <span>
                    ⚡ Batch Auto-Fix All (
                    {
                      nudges.filter(
                        (n) => n.pathAnomalyDetails && !n.pathAnomalyDetails.applied && !autoFixedIds.has(n.id)
                      ).length
                    }
                    ) Detected Anomalies Now
                  </span>
                </button>
              )}
            </div>

            {nudges.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                <p className="text-xs">No active nudges. Operator and workflow are aligned!</p>
              </div>
            ) : (
              nudges.map((nudge) => {
                const isTimeoutAlert = !!nudge.elementTimeoutDetails;
                const isPathAnomaly = !!nudge.pathAnomalyDetails;
                const isAutoFixed = autoFixedIds.has(nudge.id) || nudge.pathAnomalyDetails?.applied;

                return (
                  <div
                    key={nudge.id}
                    className={`p-3.5 rounded-2xl border space-y-2 relative transition-all ${
                      isTimeoutAlert
                        ? 'border-red-300 dark:border-red-900/70 bg-red-50/70 dark:bg-red-950/30'
                        : isPathAnomaly
                        ? 'border-purple-300 dark:border-purple-900/70 bg-purple-50/70 dark:bg-purple-950/30'
                        : nudge.severity === 'warning'
                        ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30'
                    }`}
                  >
                    <button
                      onClick={() => handleDismissNudge(nudge.id)}
                      className="absolute top-2.5 right-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center space-x-1.5">
                      {isTimeoutAlert ? (
                        <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
                          <span className="font-bold text-xs text-red-900 dark:text-red-200">
                            {nudge.title}
                          </span>
                        </div>
                      ) : isPathAnomaly ? (
                        <div className="flex items-center space-x-1 text-purple-600 dark:text-purple-400">
                          <Zap className="w-4 h-4 shrink-0 animate-pulse text-purple-500" />
                          <span className="font-bold text-xs text-purple-950 dark:text-purple-200">
                            {nudge.title}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-amber-500">
                          <Lightbulb className="w-4 h-4 shrink-0" />
                          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                            {nudge.title}
                          </span>
                        </div>
                      )}
                    </div>

                    <p
                      className={`text-[11px] leading-snug ${
                        isTimeoutAlert
                          ? 'text-red-800 dark:text-red-300'
                          : isPathAnomaly
                          ? 'text-purple-900 dark:text-purple-300'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {nudge.message}
                    </p>

                    {/* Path Dynamics Anomaly Diagnostics & Auto-Fix Waypoint Sequence */}
                    {isPathAnomaly && nudge.pathAnomalyDetails && (
                      <div className="p-2.5 rounded-xl bg-purple-100/70 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 font-mono text-[10px] space-y-2 text-purple-950 dark:text-purple-200">
                        <div className="grid grid-cols-2 gap-1.5 pb-1 border-b border-purple-200/60 dark:border-purple-800/40">
                          <div>
                            <span className="text-purple-600 dark:text-purple-400 text-[9px]">Measured Speed:</span>
                            <div className="font-bold text-red-600 dark:text-red-400">
                              {nudge.pathAnomalyDetails.currentSpeed} px/s
                            </div>
                          </div>
                          <div>
                            <span className="text-purple-600 dark:text-purple-400 text-[9px]">Baseline Pattern:</span>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              {nudge.pathAnomalyDetails.baselineSpeed} px/s
                            </div>
                          </div>
                        </div>

                        {/* Waypoint Coordinates Preview */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] text-purple-700 dark:text-purple-300 font-semibold">
                            <span className="flex items-center space-x-1">
                              <Route className="w-3 h-3 text-purple-500" />
                              <span>Suggested Realigned Waypoints ({nudge.pathAnomalyDetails.correctedWaypoints.length}):</span>
                            </span>
                            <span>Cubic Bezier Eased</span>
                          </div>
                          <div className="max-h-20 overflow-y-auto space-y-0.5 bg-purple-50/90 dark:bg-purple-950/80 p-1.5 rounded-lg border border-purple-200/50 dark:border-purple-900/50 text-[9px]">
                            {nudge.pathAnomalyDetails.correctedWaypoints.map((wp, idx) => (
                              <div key={idx} className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                                <span>{wp.label}:</span>
                                <span className="font-bold text-purple-700 dark:text-purple-300">
                                  ({wp.x}, {wp.y}) ~{wp.speed}px/s
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Auto-Fix Path Action Button */}
                        <div className="pt-1">
                          {isAutoFixed ? (
                            <div className="w-full py-1.5 px-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold text-xs flex items-center justify-center space-x-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>✓ Path Realigned to Historical Pattern</span>
                            </div>
                          ) : (
                            <button
                              id="btn-autofix-path"
                              onClick={() => handleAutoFixPath(nudge)}
                              className="w-full py-1.5 px-3 font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm shadow-purple-900/30 transition-all cursor-pointer"
                            >
                              <Route className="w-3.5 h-3.5 text-purple-200" />
                              <span>Auto-Fix Path (Realign to Baseline)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timeout Diagnostics Box */}
                    {isTimeoutAlert && nudge.elementTimeoutDetails && (
                      <div className="p-2 rounded-xl bg-red-100/70 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 font-mono text-[10px] space-y-1 text-red-900 dark:text-red-200">
                        <div className="flex justify-between">
                          <span>Target Selector:</span>
                          <span className="font-bold">{nudge.elementTimeoutDetails.expectedSelector}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Timeout Period:</span>
                          <span>{nudge.elementTimeoutDetails.timeoutMs || nudge.elementTimeoutDetails.timeElapsed}ms</span>
                        </div>
                        {nudge.elementTimeoutDetails.targetTab && (
                          <div className="flex justify-between">
                            <span>Required Tab:</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">
                              {nudge.elementTimeoutDetails.targetTab}
                            </span>
                          </div>
                        )}
                        {nudge.elementTimeoutDetails.potentialReason && (
                          <div className="text-[9px] text-red-700 dark:text-red-300 italic pt-0.5">
                            Cause: {nudge.elementTimeoutDetails.potentialReason}
                          </div>
                        )}
                      </div>
                    )}

                    {nudge.suggestedAction && !isPathAnomaly && (
                      <button
                        onClick={() => {
                          if (nudge.targetTab) {
                            onSwitchSection(nudge.targetTab);
                          }
                          onExecuteNudgeAction?.(nudge);
                          handleDismissNudge(nudge.id);
                        }}
                        className={`w-full py-1.5 px-3 font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-2xs transition-colors ${
                          isTimeoutAlert
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                        }`}
                      >
                        <span>{nudge.suggestedAction.label}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

