import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Bot,
  Sparkles,
  Eye,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  ShieldCheck,
  Scan,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  MousePointer,
  RefreshCw,
  FolderSync,
  Compass,
  Calendar,
  Clock,
  Repeat,
  Timer,
  Trash2,
  PlayCircle,
  PauseCircle,
  Bell,
  ListOrdered,
} from 'lucide-react';
import {
  WorkflowStep,
  StepActionType,
  AutoDeploySettings,
  SurroundingElementAnchor,
} from '../types/automation';
import { ActiveSection, DriveFile } from '../types/drive';
import { AutoDeployEngine } from '../services/autoDeployEngine';
import { BackgroundUIObserver } from '../services/uiStateObserver';
import { MouseTrajectoryStore } from '../services/mouseTrajectoryStore';

export type ScheduleFrequency = 'once' | '15_min' | 'hourly' | 'daily' | 'weekly';

export interface ScheduledWorkflow {
  id: string;
  workflowName: string;
  description: string;
  scheduledTime: string; // ISO string for datetime-local
  frequency: ScheduleFrequency;
  status: 'active' | 'paused' | 'completed';
  lastRun?: string;
  nextRun: string;
  autoContinue: boolean;
  freeRoam: boolean;
  targetSection: ActiveSection;
}

interface AutonomousWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: ActiveSection;
  onSwitchSection: (section: ActiveSection) => void;
  engine: AutoDeployEngine;
  settings: AutoDeploySettings;
  onUpdateSettings: (settings: Partial<AutoDeploySettings>) => void;
  onOpenSettingsModal: () => void;
  files: DriveFile[];
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

const INITIAL_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'step-1',
    title: 'Verify Drive Header Navigation Bar',
    description: 'Anchor perception to main search and brand banner',
    targetSelector: '#drive-search-input',
    actionType: 'click',
    targetCoords: { x: 500, y: 32 },
    targetTab: 'my-drive',
    status: 'pending',
    addedBy: 'user',
    surroundingAnchors: [
      { selectorOrTag: '#app-header', relativePosition: 'parent', present: true, confidence: 0.99 },
      { selectorOrTag: '#btn-view-grid', relativePosition: 'right', present: true, confidence: 0.95 },
    ],
  },
  {
    id: 'step-2',
    title: 'Swipe Down to Refresh List Grid',
    description: 'Execute downward swipe gesture to trigger visual sync',
    targetSelector: '#file-grid-container',
    actionType: 'swipe_down',
    targetCoords: { x: 540, y: 220 },
    swipeOffset: { dx: 0, dy: 140 },
    targetTab: 'my-drive',
    status: 'pending',
    addedBy: 'user',
    surroundingAnchors: [
      { selectorOrTag: '#app-sidebar', relativePosition: 'left', present: true, confidence: 0.98 },
      { selectorOrTag: '#btn-new-drive-item', relativePosition: 'left', present: true, confidence: 0.97 },
    ],
  },
  {
    id: 'step-3',
    title: 'Select First File Item for Preview Inspection',
    description: 'Click primary target card and inspect overlay bounds',
    targetSelector: '#file-card-1',
    actionType: 'click',
    targetCoords: { x: 420, y: 360 },
    targetTab: 'my-drive',
    status: 'pending',
    addedBy: 'user',
    surroundingAnchors: [
      { selectorOrTag: '#app-sidebar', relativePosition: 'left', present: true, confidence: 0.98 },
      { selectorOrTag: '#drive-search-input', relativePosition: 'above', present: true, confidence: 0.96 },
    ],
  },
];

export const AutonomousWorkflowModal: React.FC<AutonomousWorkflowModalProps> = ({
  isOpen,
  onClose,
  activeSection,
  onSwitchSection,
  engine,
  settings,
  onUpdateSettings,
  onOpenSettingsModal,
  files,
  onShowToast,
}) => {
  const [steps, setSteps] = useState<WorkflowStep[]>(INITIAL_WORKFLOW_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAnalyzingFrame, setIsAnalyzingFrame] = useState<boolean>(false);
  const [analyzingMessage, setAnalyzingMessage] = useState<string>('Analyzing frame consistency...');
  const [surroundingCheckResult, setSurroundingCheckResult] = useState<{
    score: number;
    passed: boolean;
    reasoning: string;
  } | null>(null);

  // Active Modal Subnav Tab
  const [activeModalTab, setActiveModalTab] = useState<'queue' | 'schedule' | 'discovery'>('queue');

  // Manual Add Step Form
  const [isAddingStepManual, setIsAddingStepManual] = useState<boolean>(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualSelector, setManualSelector] = useState('');
  const [manualAction, setManualAction] = useState<StepActionType>('click');
  const [manualTab, setManualTab] = useState<ActiveSection>('my-drive');
  const [manualCoords, setManualCoords] = useState({ x: 500, y: 300 });

  // Scheduled Workflows State
  const [scheduledWorkflows, setScheduledWorkflows] = useState<ScheduledWorkflow[]>([
    {
      id: 'sched-1',
      workflowName: 'Hourly Drive Health & Search Perception Check',
      description: 'Verifies header search anchor and index integrity every hour',
      scheduledTime: new Date(Date.now() + 45 * 60 * 1000).toISOString().slice(0, 16),
      frequency: 'hourly',
      status: 'active',
      lastRun: '1 hour ago',
      nextRun: 'In 45 minutes',
      autoContinue: true,
      freeRoam: false,
      targetSection: 'my-drive',
    },
    {
      id: 'sched-2',
      workflowName: 'Daily Starred Items Synchronization Routine',
      description: 'Executes automated swipe and sync check for critical flagged documents',
      scheduledTime: new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 16),
      frequency: 'daily',
      status: 'active',
      lastRun: 'Yesterday at 09:00 AM',
      nextRun: 'Tomorrow at 09:00 AM',
      autoContinue: true,
      freeRoam: true,
      targetSection: 'starred',
    },
    {
      id: 'sched-3',
      workflowName: '15-Min Continuous Anomaly Watchdog Sweep',
      description: 'Periodically surveys UI interaction zones and mouse velocity compliance',
      scheduledTime: new Date(Date.now() + 8 * 60 * 1000).toISOString().slice(0, 16),
      frequency: '15_min',
      status: 'active',
      lastRun: '7 minutes ago',
      nextRun: 'In 8 minutes',
      autoContinue: true,
      freeRoam: false,
      targetSection: 'my-drive',
    },
  ]);

  // New Schedule Creation Form State
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [scheduleName, setScheduleName] = useState('Full Autonomous Sequence');
  const [scheduleDescription, setScheduleDescription] = useState('Automated periodic sequence trigger');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [scheduleFreq, setScheduleFreq] = useState<ScheduleFrequency>('hourly');
  const [scheduleTargetSection, setScheduleTargetSection] = useState<ActiveSection>('my-drive');
  const [scheduleAutoContinue, setScheduleAutoContinue] = useState(true);
  const [scheduleFreeRoam, setScheduleFreeRoam] = useState(false);

  // AI Operation Discovery Logs
  const [aiDiscoveredLogs, setAiDiscoveredLogs] = useState<
    Array<{
      timestamp: string;
      stepTitle: string;
      reasoning: string;
      autoAdded: boolean;
    }>
  >([]);

  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Handle Manual Step Addition
  const handleAddManualStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualSelector.trim()) return;

    const newStep: WorkflowStep = {
      id: `step-manual-${Date.now()}`,
      title: manualTitle.trim(),
      description: `User-defined ${manualAction} action on ${manualSelector.trim()}`,
      targetSelector: manualSelector.trim(),
      actionType: manualAction,
      targetCoords: manualCoords,
      targetTab: manualTab,
      status: 'pending',
      addedBy: 'user',
      surroundingAnchors: [
        { selectorOrTag: '#app-header', relativePosition: 'parent', present: true, confidence: 0.98 },
        { selectorOrTag: '#app-sidebar', relativePosition: 'left', present: true, confidence: 0.97 },
      ],
    };

    setSteps((prev) => [...prev, newStep]);
    setManualTitle('');
    setManualSelector('');
    setIsAddingStepManual(false);
    onShowToast(`Added new step: "${newStep.title}"`);
  };

  // Schedule Workflow Handlers
  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleName.trim() || !scheduleDate) return;

    const formattedDate = new Date(scheduleDate).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newSchedule: ScheduledWorkflow = {
      id: `sched-${Date.now()}`,
      workflowName: scheduleName.trim(),
      description: scheduleDescription.trim() || 'Automated scheduled workflow sequence',
      scheduledTime: scheduleDate,
      frequency: scheduleFreq,
      status: 'active',
      nextRun: `${formattedDate} (${scheduleFreq})`,
      autoContinue: scheduleAutoContinue,
      freeRoam: scheduleFreeRoam,
      targetSection: scheduleTargetSection,
    };

    setScheduledWorkflows((prev) => [newSchedule, ...prev]);
    setIsCreatingSchedule(false);
    onShowToast(`Scheduled workflow "${newSchedule.workflowName}" registered successfully!`, 'success');
  };

  const handleToggleScheduleStatus = (scheduleId: string) => {
    setScheduledWorkflows((prev) =>
      prev.map((s) => {
        if (s.id === scheduleId) {
          const nextStatus = s.status === 'active' ? 'paused' : 'active';
          onShowToast(`Schedule "${s.workflowName}" is now ${nextStatus}.`);
          return { ...s, status: nextStatus };
        }
        return s;
      })
    );
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    setScheduledWorkflows((prev) => prev.filter((s) => s.id !== scheduleId));
    onShowToast('Scheduled trigger removed.');
  };

  const handleRunScheduledWorkflowNow = (schedule: ScheduledWorkflow) => {
    onShowToast(`Triggering scheduled sequence: "${schedule.workflowName}" now!`, 'success');
    if (schedule.targetSection !== activeSection) {
      onSwitchSection(schedule.targetSection);
    }
    setActiveModalTab('queue');
    setIsRunning(true);
    executeStep(0);
  };

  // AI Step Discovery & Reasoning Trigger
  const handleTriggerAiDiscovery = () => {
    const activeStep = steps[currentStepIndex] || steps[0];
    const discovery = engine.discoverNextOperationSteps(activeStep, activeSection, {
      hasModal: false,
      hasUnstarredFiles: files.some((f) => !f.starred),
      currentQuery: '',
    });

    if (discovery.discoveredSteps.length > 0) {
      const stepToAdd = discovery.discoveredSteps[0];

      const logItem = {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        stepTitle: stepToAdd.title,
        reasoning: discovery.availableReasoning || 'Visual DOM inspection confirmed valid actionable anchor.',
        autoAdded: discovery.canAutoAdd,
      };

      setAiDiscoveredLogs((prev) => [logItem, ...prev]);

      if (discovery.canAutoAdd) {
        setSteps((prev) => [...prev, stepToAdd]);
        onShowToast(`AI Auto-Added Step: "${stepToAdd.title}" with verified reasoning!`);
      } else {
        onShowToast(`AI Discovered Operation: "${stepToAdd.title}" (Awaiting reasoning confirmation)`);
      }
    } else {
      onShowToast('AI Vision scanned surroundings: All operation targets are currently optimized.');
    }
  };

  // Execute a single step with "Analyzing Frame" & Surrounding Verification
  const executeStep = async (stepIndex: number) => {
    if (stepIndex >= steps.length) {
      setIsRunning(false);
      onShowToast('Workflow execution completed successfully!', 'success');
      return;
    }

    const currentStep = steps[stepIndex];
    setCurrentStepIndex(stepIndex);

    // 1. Enter "Analyzing Frame..." state
    setIsAnalyzingFrame(true);
    setAnalyzingMessage(`Analyzing Frame for Step ${stepIndex + 1}: ${currentStep.title}...`);

    // Register expectation in Background UI State Observer
    if (settings.enableBackgroundUiObserver && currentStep.targetSelector) {
      BackgroundUIObserver.getInstance().expectElement({
        selector: currentStep.targetSelector,
        stepTitle: currentStep.title,
        stepId: currentStep.id,
        targetTab: currentStep.targetTab,
        actionType: currentStep.actionType,
        timeoutMs: settings.expectedElementTimeoutMs || 3500,
        onTimeout: (expectation) => {
          if (settings.onElementTimeoutAction === 'pause_workflow' && !settings.freeRoamMode) {
            setIsRunning(false);
            setIsAnalyzingFrame(false);
            onShowToast(
              `UI State Observer: Target element "${expectation.selector}" did not appear within ${expectation.timeoutMs}ms. Workflow paused.`,
              'error'
            );
          }
        },
      });
    }

    // Check Tab Rectification (make sure it performs on the right tab!)
    if (currentStep.targetTab && currentStep.targetTab !== activeSection) {
      if (settings.autoTabRectification || settings.freeRoamMode) {
        onShowToast(`Auto-Switching Tab to '${currentStep.targetTab}' before executing step...`);
        onSwitchSection(currentStep.targetTab);
        await new Promise((r) => setTimeout(r, 600));
      } else {
        setAnalyzingMessage(`Tab Mismatch: Expected '${currentStep.targetTab}', currently on '${activeSection}'.`);
      }
    }

    // Check Auto-Deploy Triggers (e.g. 'X' close button, emergency condition, custom rules)
    const triggerEval = engine.evaluateAutoDeployTriggers(activeSection, currentStep, ['#drive-search-input']);
    if (triggerEval.shouldDeploy) {
      onShowToast(`Auto-Deploy Triggered: ${triggerEval.reasoning}`);
    }

    // 2. Perform Surrounding Elements Consistency Check
    const anchors = currentStep.surroundingAnchors || [
      { selectorOrTag: '#app-header', relativePosition: 'parent', present: true, confidence: 0.99 },
    ];
    const surroundingResult = engine.analyzeSurroundingConsistency(currentStep, anchors);
    setSurroundingCheckResult(surroundingResult);

    // Simulate frame scan duration
    await new Promise((r) => setTimeout(r, 700));

    if (!surroundingResult.passed && !settings.freeRoamMode) {
      // Consistency failed & not in Free Roam: Pause and notify
      setIsAnalyzingFrame(false);
      setIsRunning(false);
      setSteps((prev) =>
        prev.map((s, idx) => (idx === stepIndex ? { ...s, status: 'failed' } : s))
      );
      onShowToast(`Frame Consistency check failed. Missing: ${surroundingResult.missingAnchors.join(', ')}`, 'error');
      return;
    }

    // 3. Mark Executing
    setIsAnalyzingFrame(false);
    setSteps((prev) =>
      prev.map((s, idx) => (idx === stepIndex ? { ...s, status: 'executing' } : s))
    );

    // Evaluate pointer velocity anomaly if enabled
    if (settings.mouseAnomalyDetectionEnabled ?? true) {
      const trajectoryStore = MouseTrajectoryStore.getInstance();
      const distance = Math.hypot(
        (currentStep.targetCoords.x || 960) - 960,
        (currentStep.targetCoords.y || 540) - 540
      );
      const simulatedSpeed = Math.round(distance / 0.4); // px/sec
      const anomalyCheck = trajectoryStore.checkSpeedAnomaly(simulatedSpeed, {
        stepTitle: currentStep.title,
        thresholdMultiplier: settings.mouseSpeedThresholdMultiplier || 2.2,
      });

      if (anomalyCheck.isAnomaly) {
        trajectoryStore.emitSpeedAnomalyAlert({
          currentSpeed: simulatedSpeed,
          deviationPercentage: anomalyCheck.deviationPercentage,
          anomalyType: anomalyCheck.type as 'too_fast' | 'too_slow',
          stepTitle: currentStep.title,
          targetSelector: currentStep.targetSelector,
          coords: currentStep.targetCoords,
        });
      }
    }

    // Simulate action execution duration
    await new Promise((r) => setTimeout(r, 600));

    // 4. Mark Completed & Record screenshot diff
    const mockDiffPercent = Number((Math.random() * 4 + 1.2).toFixed(1));
    setSteps((prev) =>
      prev.map((s, idx) =>
        idx === stepIndex
          ? {
              ...s,
              status: 'completed',
              screenshotDiffBeforeAfter: {
                diffPercent: mockDiffPercent,
                visualChangeDetected: true,
              },
            }
          : s
      )
    );

    // Record note in Overseer engine
    engine.addLearnedNote({
      category: currentStep.actionType.startsWith('swipe') ? 'drift_correction' : 'element_anchor',
      title: `Step ${stepIndex + 1}: ${currentStep.title}`,
      observation: `Action ${currentStep.actionType.toUpperCase()} dispatched at (${currentStep.targetCoords.x}, ${currentStep.targetCoords.y}). Frame Delta: ${mockDiffPercent}%.`,
      confidence: 97,
      actionTaken: 'Logged frame diff & anchor metrics.',
      frameDifferenceScore: 0.95,
    });

    // 5. Auto-Continue if enabled or Free Roam Mode active
    if (isRunning || settings.autoContinueEnabled || settings.freeRoamMode) {
      const nextIndex = stepIndex + 1;
      if (nextIndex < steps.length) {
        autoTimerRef.current = setTimeout(() => {
          executeStep(nextIndex);
        }, settings.autoContinueDelayMs);
      } else {
        // If in Free Roam Mode, scan for more operations to auto-add and keep roaming!
        if (settings.freeRoamMode) {
          onShowToast('Free Roam Mode: Autonomously discovering subsequent operations...', 'success');
          handleTriggerAiDiscovery();
          setTimeout(() => {
            executeStep(nextIndex);
          }, settings.autoContinueDelayMs);
        } else {
          setIsRunning(false);
          onShowToast('Workflow execution completed successfully!', 'success');
        }
      }
    }
  };

  const handleStartWorkflow = () => {
    setIsRunning(true);
    executeStep(currentStepIndex < steps.length ? currentStepIndex : 0);
  };

  const handlePauseWorkflow = () => {
    setIsRunning(false);
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    onShowToast('Workflow execution paused.');
  };

  const handleResetWorkflow = () => {
    setIsRunning(false);
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setCurrentStepIndex(0);
    setIsAnalyzingFrame(false);
    setSurroundingCheckResult(null);
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'pending' })));
    onShowToast('Workflow reset to initial state.');
  };

  const getActionIcon = (action: StepActionType) => {
    switch (action) {
      case 'swipe_up':
        return <ArrowUp className="w-3.5 h-3.5 text-blue-500" />;
      case 'swipe_down':
        return <ArrowDown className="w-3.5 h-3.5 text-blue-500" />;
      case 'swipe_left':
        return <ArrowLeft className="w-3.5 h-3.5 text-blue-500" />;
      case 'swipe_right':
        return <ArrowRight className="w-3.5 h-3.5 text-blue-500" />;
      case 'switch_tab':
        return <FolderSync className="w-3.5 h-3.5 text-purple-500" />;
      case 'dismiss_overlay':
        return <X className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <MousePointer className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="autonomous-workflow-modal"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300 shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Autonomous Workflow Orchestrator
                </h2>
                {settings.freeRoamMode && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 animate-pulse">
                    FREE ROAM ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Auto-continue, dynamic step addition, frame analysis & surrounding consistency verification
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="btn-orchestrator-settings"
              onClick={onOpenSettingsModal}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 text-xs font-semibold"
              title="Execution & Auto-Deploy Settings"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subnav Tab Switcher */}
        <div className="px-5 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs font-semibold">
            <button
              id="tab-workflow-queue"
              onClick={() => setActiveModalTab('queue')}
              className={`px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all ${
                activeModalTab === 'queue'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Sequence Queue ({steps.length})</span>
            </button>

            <button
              id="tab-schedule-workflow"
              onClick={() => setActiveModalTab('schedule')}
              className={`px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all ${
                activeModalTab === 'schedule'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Automation ({scheduledWorkflows.length})</span>
            </button>

            <button
              id="tab-ai-discovery"
              onClick={() => setActiveModalTab('discovery')}
              className={`px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all ${
                activeModalTab === 'discovery'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Logs & Reasoning ({aiDiscoveredLogs.length})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-[11px] font-mono text-zinc-500">
            <Clock className="w-3 h-3 text-purple-500" />
            <span>Scope: {activeSection}</span>
          </div>
        </div>

        {/* Toolbar & Status Bar (Visible for Queue Tab) */}
        {activeModalTab === 'queue' && (
          <div className="p-4 bg-zinc-100/70 dark:bg-zinc-800/70 border-b border-zinc-200/80 dark:border-zinc-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Controls */}
            <div className="flex items-center space-x-2">
              {!isRunning ? (
                <button
                  id="btn-start-workflow"
                  onClick={handleStartWorkflow}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Run Autonomous Sequence</span>
                </button>
              ) : (
                <button
                  id="btn-pause-workflow"
                  onClick={handlePauseWorkflow}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all"
                >
                  <Pause className="w-3.5 h-3.5 fill-white" />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={handleResetWorkflow}
                className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                title="Reset sequence"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* AI Discover & Add Button */}
              <button
                id="btn-ai-discover-steps"
                onClick={handleTriggerAiDiscovery}
                className="px-3 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold rounded-xl border border-blue-200 dark:border-blue-800 flex items-center space-x-1.5 transition-all shadow-2xs"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI Scan & Add Next Operations</span>
              </button>

              {/* Manual Add Step */}
              <button
                onClick={() => setIsAddingStepManual(!isAddingStepManual)}
                className="px-3 py-2 bg-white dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl border border-zinc-200 dark:border-zinc-600 flex items-center space-x-1.5 transition-all shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>

            {/* Mode Toggles */}
            <div className="flex items-center space-x-3 font-mono text-[11px]">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoContinueEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ autoContinueEnabled: e.target.checked })
                  }
                  className="w-3.5 h-3.5 text-blue-600 rounded-sm"
                />
                <span className="text-zinc-700 dark:text-zinc-300">Auto-Continue</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.freeRoamMode}
                  onChange={(e) =>
                    onUpdateSettings({ freeRoamMode: e.target.checked })
                  }
                  className="w-3.5 h-3.5 text-purple-600 rounded-sm"
                />
                <span className="text-purple-700 dark:text-purple-300 font-bold">Free Roam</span>
              </label>
            </div>
          </div>
        )}

        {/* Live Frame Analysis Banner (When active) */}
        {isAnalyzingFrame && (
          <div className="p-3 bg-blue-600 text-white flex items-center justify-between text-xs font-semibold animate-pulse shadow-inner">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{analyzingMessage}</span>
            </div>
            <div className="font-mono text-[11px] opacity-90">
              Verifying Surrounding Element Anchors...
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* TAB 1: SEQUENCE QUEUE */}
          {activeModalTab === 'queue' && (
            <>
              {/* Manual Add Step Form */}
              {isAddingStepManual && (
                <form
                  onSubmit={handleAddManualStep}
                  className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-purple-900 dark:text-purple-200">
                      Add Custom Execution Step to Queue
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingStepManual(false)}
                      className="text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                        Step Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Click Starred Folder"
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                        Target Selector / Element ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. #nav-item-starred"
                        value={manualSelector}
                        onChange={(e) => setManualSelector(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                        Action Type
                      </label>
                      <select
                        value={manualAction}
                        onChange={(e) => setManualAction(e.target.value as StepActionType)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                      >
                        <option value="click">Click</option>
                        <option value="swipe_up">Swipe Up ⬆️</option>
                        <option value="swipe_down">Swipe Down ⬇️</option>
                        <option value="swipe_left">Swipe Left ⬅️</option>
                        <option value="swipe_right">Swipe Right ➡️</option>
                        <option value="switch_tab">Switch Tab</option>
                        <option value="dismiss_overlay">Dismiss Overlay</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                        Target View / Tab
                      </label>
                      <select
                        value={manualTab}
                        onChange={(e) => setManualTab(e.target.value as ActiveSection)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                      >
                        <option value="my-drive">My Drive</option>
                        <option value="starred">Starred</option>
                        <option value="trash">Trash</option>
                        <option value="analytics">Storage Analytics</option>
                        <option value="execution-analytics">Execution Analytics</option>
                      </select>
                    </div>

                    <div className="flex justify-end items-end space-x-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsAddingStepManual(false)}
                        className="px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs"
                      >
                        Append to Queue
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Workflow Steps List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>Workflow Step Queue ({steps.length})</span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Active Tab Scope: {activeSection}
                  </span>
                </h3>

                <div className="space-y-2.5">
                  {steps.map((step, idx) => {
                    const isCurrent = idx === currentStepIndex && isRunning;
                    const isCompleted = step.status === 'completed';
                    const isFailed = step.status === 'failed';

                    return (
                      <div
                        key={step.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col space-y-2 ${
                          isCurrent
                            ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 ring-2 ring-purple-500/20 shadow-sm'
                            : isCompleted
                            ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20'
                            : isFailed
                            ? 'border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/20'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-750'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300">
                              {idx + 1}
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                                {step.title}
                              </span>
                              <span className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center">
                                {getActionIcon(step.actionType)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {step.targetTab && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                                tab: {step.targetTab}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                                  : isFailed
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300'
                                  : isCurrent
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 animate-pulse'
                                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-9">
                          {step.description}
                        </p>

                        {/* Step Reasoning (if provided by AI) */}
                        {step.reasoning && (
                          <div className="ml-9 p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-[11px] text-blue-800 dark:text-blue-300 flex items-start space-x-1.5">
                            <Bot className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <span>{step.reasoning}</span>
                          </div>
                        )}

                        {/* Surrounding Anchors Checklist */}
                        {step.surroundingAnchors && step.surroundingAnchors.length > 0 && (
                          <div className="ml-9 flex flex-wrap gap-1.5 pt-1">
                            {step.surroundingAnchors.map((anchor, aIdx) => (
                              <span
                                key={aIdx}
                                className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60"
                              >
                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                <span>
                                  {anchor.selectorOrTag} ({anchor.relativePosition})
                                </span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Screenshot Diff Score result */}
                        {step.screenshotDiffBeforeAfter && (
                          <div className="ml-9 flex items-center space-x-2 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 pt-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>
                              Frame Visual Delta Captured: +{step.screenshotDiffBeforeAfter.diffPercent}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: SCHEDULE WORKFLOW */}
          {activeModalTab === 'schedule' && (
            <div className="space-y-5">
              {/* Header & New Schedule Trigger Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/40">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="text-xs font-bold text-purple-950 dark:text-purple-200">
                      Autonomous Workflow Scheduler
                    </h3>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Schedule automated sequences to run periodically or at a specific set date & time.
                  </p>
                </div>

                <button
                  id="btn-add-schedule"
                  onClick={() => setIsCreatingSchedule(!isCreatingSchedule)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingSchedule ? 'Cancel' : 'Schedule New Workflow'}</span>
                </button>
              </div>

              {/* Schedule Creation Form */}
              {isCreatingSchedule && (
                <form
                  onSubmit={handleCreateSchedule}
                  className="p-5 rounded-2xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-zinc-800/80 shadow-md space-y-4 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-700/60 pb-3">
                    <div className="flex items-center space-x-2">
                      <Timer className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        Configure Scheduled Automation Sequence
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSchedule(false)}
                      className="text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                        Workflow Sequence Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Midnight Drive Integrity Sweep"
                        value={scheduleName}
                        onChange={(e) => setScheduleName(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-medium focus:ring-2 focus:ring-purple-500/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                        Target Section Scope
                      </label>
                      <select
                        value={scheduleTargetSection}
                        onChange={(e) => setScheduleTargetSection(e.target.value as ActiveSection)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-medium"
                      >
                        <option value="my-drive">My Drive View</option>
                        <option value="starred">Starred Items</option>
                        <option value="trash">Trash View</option>
                        <option value="analytics">Storage Analytics</option>
                        <option value="execution-analytics">Execution Analytics</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5 flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-500" />
                        <span>Scheduled Date & Time</span>
                      </label>
                      <input
                        id="input-schedule-datetime"
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-xs focus:ring-2 focus:ring-purple-500/20"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5 flex items-center space-x-1.5">
                        <Repeat className="w-3.5 h-3.5 text-purple-500" />
                        <span>Execution Frequency</span>
                      </label>
                      <select
                        id="select-schedule-frequency"
                        value={scheduleFreq}
                        onChange={(e) => setScheduleFreq(e.target.value as ScheduleFrequency)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-medium"
                      >
                        <option value="once">Run Once (Single Execution)</option>
                        <option value="15_min">Every 15 Minutes</option>
                        <option value="hourly">Hourly Interval</option>
                        <option value="daily">Daily at Scheduled Time</option>
                        <option value="weekly">Weekly (Every Monday)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                      Description / Operator Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Optional notes or operational intent..."
                      value={scheduleDescription}
                      onChange={(e) => setScheduleDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-medium"
                    />
                  </div>

                  {/* Automation Settings for Schedule */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 flex flex-wrap gap-4 text-xs font-mono">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleAutoContinue}
                        onChange={(e) => setScheduleAutoContinue(e.target.checked)}
                        className="w-3.5 h-3.5 text-purple-600 rounded-sm"
                      />
                      <span className="text-zinc-700 dark:text-zinc-300">Auto-Continue Step Cascade</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleFreeRoam}
                        onChange={(e) => setScheduleFreeRoam(e.target.checked)}
                        className="w-3.5 h-3.5 text-purple-600 rounded-sm"
                      />
                      <span className="text-purple-700 dark:text-purple-300 font-bold">Free Roam AI Discovery</span>
                    </label>
                  </div>

                  <div className="flex justify-end items-center space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingSchedule(false)}
                      className="px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-submit-schedule"
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs flex items-center space-x-1.5"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Register Schedule</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Scheduled Workflows List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>Active Scheduled Triggers ({scheduledWorkflows.length})</span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Engine Sync: Real-Time Active
                  </span>
                </h3>

                <div className="space-y-3">
                  {scheduledWorkflows.map((schedule) => {
                    const isActive = schedule.status === 'active';
                    const isPaused = schedule.status === 'paused';

                    return (
                      <div
                        key={schedule.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col space-y-3 ${
                          isActive
                            ? 'border-purple-200 dark:border-purple-900/50 bg-white dark:bg-zinc-800/80 shadow-xs hover:border-purple-400'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 opacity-75'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-xs ${
                                isActive
                                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300'
                                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                              }`}
                            >
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                                  {schedule.workflowName}
                                </h4>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider font-mono ${
                                    isActive
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  }`}
                                >
                                  {schedule.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {schedule.description}
                              </p>
                            </div>
                          </div>

                          {/* Action Controls */}
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleRunScheduledWorkflowNow(schedule)}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold text-xs rounded-xl border border-purple-200 dark:border-purple-800 flex items-center space-x-1.5 transition-colors shadow-2xs"
                              title="Run immediately"
                            >
                              <PlayCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>Run Now</span>
                            </button>

                            <button
                              onClick={() => handleToggleScheduleStatus(schedule.id)}
                              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                              title={isActive ? 'Pause schedule' : 'Resume schedule'}
                            >
                              {isActive ? (
                                <PauseCircle className="w-4 h-4 text-amber-500" />
                              ) : (
                                <PlayCircle className="w-4 h-4 text-emerald-500" />
                              )}
                            </button>

                            <button
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                              title="Delete schedule"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Metadata row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-750 text-[11px] font-mono">
                          <div className="bg-zinc-50 dark:bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60">
                            <span className="text-zinc-400 block text-[9px] uppercase font-sans font-bold">Frequency</span>
                            <span className="text-zinc-700 dark:text-zinc-300 font-semibold uppercase">{schedule.frequency.replace('_', ' ')}</span>
                          </div>

                          <div className="bg-zinc-50 dark:bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60">
                            <span className="text-zinc-400 block text-[9px] uppercase font-sans font-bold">Target Tab</span>
                            <span className="text-purple-600 dark:text-purple-400 font-semibold">{schedule.targetSection}</span>
                          </div>

                          <div className="bg-zinc-50 dark:bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60">
                            <span className="text-zinc-400 block text-[9px] uppercase font-sans font-bold">Next Run</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{schedule.nextRun}</span>
                          </div>

                          <div className="bg-zinc-50 dark:bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60">
                            <span className="text-zinc-400 block text-[9px] uppercase font-sans font-bold">Cascade Flags</span>
                            <span className="text-zinc-600 dark:text-zinc-400">
                              {schedule.autoContinue ? 'Auto-Step' : 'Manual'} {schedule.freeRoam ? '• Roam' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI DISCOVERY LOGS */}
          {activeModalTab === 'discovery' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200">
                      AI Available Operations & Verified Reasoning Log
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Historical and live autonomous reasoning logs generated by visual frame scanning.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTriggerAiDiscovery}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Scan Now</span>
                </button>
              </div>

              {aiDiscoveredLogs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs">
                  No autonomous operations discovered yet. Click "Scan Now" or run Free Roam mode to record reasoning logs.
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {aiDiscoveredLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-blue-100 dark:border-blue-900/40 space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {log.stepTitle}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {log.timestamp}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                        {log.reasoning}
                      </p>
                      <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                        {log.autoAdded
                          ? '✅ Auto-appended to execution queue based on reasoning verification.'
                          : '⚠️ Logged for operator approval (awaiting manual trigger).'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-800/40">
          <div className="flex items-center space-x-2 text-xs text-zinc-500 font-mono">
            <Scan className="w-3.5 h-3.5 text-purple-500" />
            <span>
              {isAnalyzingFrame
                ? 'Analyzing frame & surrounding consistency...'
                : isRunning
                ? 'Sequence executing...'
                : 'Sequence ready to launch'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 rounded-2xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
