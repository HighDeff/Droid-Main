import React, { useState } from 'react';
import {
  Settings,
  X,
  Zap,
  ShieldAlert,
  Sliders,
  Sparkles,
  Bot,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { AutoDeploySettings, AutoDeployConditionRule, StepActionType } from '../types/automation';

interface AutoDeploySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AutoDeploySettings;
  onSaveSettings: (settings: AutoDeploySettings) => void;
}

export const AutoDeploySettingsModal: React.FC<AutoDeploySettingsModalProps> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  onSaveSettings,
}) => {
  const [settings, setSettings] = useState<AutoDeploySettings>(initialSettings);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleAction, setNewRuleAction] = useState<StepActionType>('click');
  const [newRuleThreshold, setNewRuleThreshold] = useState(85);
  const [newRuleIsEmergency, setNewRuleIsEmergency] = useState(false);
  const [isAddingRule, setIsAddingRule] = useState(false);

  if (!isOpen) return null;

  const handleToggleRule = (ruleId: string) => {
    setSettings((prev) => ({
      ...prev,
      customRules: prev.customRules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  };

  const handleDeleteRule = (ruleId: string) => {
    setSettings((prev) => ({
      ...prev,
      customRules: prev.customRules.filter((r) => r.id !== ruleId),
    }));
  };

  const handleAddNewRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRulePattern.trim()) return;

    const newRule: AutoDeployConditionRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      conditionType: newRuleIsEmergency ? 'emergency_error' : 'element_present',
      pattern: newRulePattern.trim(),
      actionToDeploy: newRuleAction,
      enabled: true,
      confidenceThreshold: newRuleThreshold,
      isEmergency: newRuleIsEmergency,
      description: `User-defined custom trigger for '${newRulePattern.trim()}'.`,
      timesTriggered: 0,
    };

    setSettings((prev) => ({
      ...prev,
      customRules: [...prev.customRules, newRule],
    }));

    setNewRuleName('');
    setNewRulePattern('');
    setNewRuleIsEmergency(false);
    setIsAddingRule(false);
  };

  const handleSave = () => {
    onSaveSettings(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="auto-deploy-settings-modal"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Auto-Deploy & Autonomous Execution Settings
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Configure auto-continue rules, emergency triggers, frame analysis, and AI reasoning parameters
              </p>
            </div>
          </div>
          <button
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
          {/* Section 1: Core Automation Modes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Execution & Roam Modes</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Auto-Continue */}
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Auto-Continue</span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Automatically advance to the next step after completion
                    </p>
                  </div>
                  <input
                    id="toggle-auto-continue"
                    type="checkbox"
                    checked={settings.autoContinueEnabled}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, autoContinueEnabled: e.target.checked }))
                    }
                    className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {settings.autoContinueEnabled && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                      <span>Step Delay</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {settings.autoContinueDelayMs} ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min="400"
                      max="3000"
                      step="100"
                      value={settings.autoContinueDelayMs}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          autoContinueDelayMs: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Free Roam Mode */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  settings.freeRoamMode
                    ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">Free Roam Mode</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                        AUTONOMOUS
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Overrides reasoning gates & precondition pauses for continuous autonomous operation
                    </p>
                  </div>
                  <input
                    id="toggle-free-roam-mode"
                    type="checkbox"
                    checked={settings.freeRoamMode}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, freeRoamMode: e.target.checked }))
                    }
                    className="w-5 h-5 rounded-md text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: AI Step Addition & Reasoning Parameters */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
              <Bot className="w-3.5 h-3.5 text-blue-500" />
              <span>AI Step Discovery & Reasoning Controls</span>
            </h3>

            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Require Explicit Reasoning for AI Step Addition
                  </span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    When enabled, AI only auto-appends steps if validated reasoning from visual heuristics is available
                  </p>
                </div>
                <input
                  id="toggle-require-reasoning"
                  type="checkbox"
                  checked={settings.requireReasoningForAiStepAddition}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      requireReasoningForAiStepAddition: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Frame Surroundings Consistency */}
              <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      Analyze Frame & Verify Surrounding Elements
                    </span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Says &ldquo;Analyzing Frame&rdquo; between steps; checks that parent and neighboring elements match expectations
                    </p>
                  </div>
                  <input
                    id="toggle-analyze-surroundings"
                    type="checkbox"
                    checked={settings.analyzeSurroundingsBeforeStep}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        analyzeSurroundingsBeforeStep: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {settings.analyzeSurroundingsBeforeStep && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                      <span>Consistency Threshold Requirement</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {settings.surroundingConsistencyThreshold}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="95"
                      step="5"
                      value={settings.surroundingConsistencyThreshold}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          surroundingConsistencyThreshold: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Preset Auto-Deploy & Condition Triggers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
                <span>Auto-Deploy Triggers & Custom Parameters</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingRule(!isAddingRule)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Condition</span>
              </button>
            </div>

            {/* Built-in Pre-set triggers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Close 'X' button trigger */}
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    &lsquo;X&rsquo; Close Auto-Dismiss
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.closeXAutoDismiss}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, closeXAutoDismiss: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded-sm"
                  />
                </div>
                <p className="text-[11px] text-zinc-500">
                  If an &lsquo;X&rsquo; close button appears throughout app, auto-deploy dismiss action.
                </p>
              </div>

              {/* Tab Mismatch Auto-Rectifier */}
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    Auto-Tab Rectifier
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.autoTabRectification}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, autoTabRectification: e.target.checked }))
                    }
                    className="w-4 h-4 text-blue-600 rounded-sm"
                  />
                </div>
                <p className="text-[11px] text-zinc-500">
                  Switches to target tab automatically before executing scoped operations.
                </p>
              </div>

              {/* Emergency Auto Recover */}
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    Emergency Recovery
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.emergencyAutoRecover}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, emergencyAutoRecover: e.target.checked }))
                    }
                    className="w-4 h-4 text-red-600 rounded-sm"
                  />
                </div>
                <p className="text-[11px] text-zinc-500">
                  Auto-deploys recovery sequence if emergency modal or blocking error is detected.
                </p>
              </div>
            </div>

            {/* Custom Rules List */}
            <div className="space-y-2">
              {settings.customRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="w-4 h-4 rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {rule.name}
                        </span>
                        {rule.isEmergency && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-sm bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 shrink-0">
                            EMERGENCY
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                          ({rule.timesTriggered}x triggered)
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {rule.description}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg transition-colors shrink-0"
                    title="Delete rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Custom Rule Form */}
            {isAddingRule && (
              <form
                onSubmit={handleAddNewRule}
                className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-3 animate-in fade-in"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-blue-900 dark:text-blue-200">
                    Add New Custom Auto-Deploy Trigger Condition
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingRule(false)}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                      Condition Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Detect Floating Banner"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                      Selector / Element Match Pattern
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. #floating-ad, .alert-banner"
                      value={newRulePattern}
                      onChange={(e) => setNewRulePattern(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                      Action to Deploy
                    </label>
                    <select
                      value={newRuleAction}
                      onChange={(e) => setNewRuleAction(e.target.value as StepActionType)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                    >
                      <option value="click">Click Element</option>
                      <option value="dismiss_overlay">Dismiss Overlay</option>
                      <option value="switch_tab">Switch Tab</option>
                      <option value="auto_recover">Emergency Auto-Recover</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 block mb-1">
                      Confidence Threshold ({newRuleThreshold}%)
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={newRuleThreshold}
                      onChange={(e) => setNewRuleThreshold(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-4">
                    <input
                      id="checkbox-new-rule-emergency"
                      type="checkbox"
                      checked={newRuleIsEmergency}
                      onChange={(e) => setNewRuleIsEmergency(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded-sm cursor-pointer"
                    />
                    <label
                      htmlFor="checkbox-new-rule-emergency"
                      className="text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      Emergency Trigger
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingRule(false)}
                    className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                  >
                    Save Condition Rule
                  </button>
                </div>
              </form>
            )}
          </div>
          {/* Section 4: Background UI State Observer & Video Mouse Detection */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-purple-500" />
              <span>Background UI Observer & Video Mouse Movement</span>
            </h3>

            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-4">
              {/* Background UI Observer Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Background UI State Observer
                  </span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Continuously monitors DOM mutations and alerts Overseer panel if expected workflow element fails to appear
                  </p>
                </div>
                <input
                  id="toggle-background-observer"
                  type="checkbox"
                  checked={settings.enableBackgroundUiObserver}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      enableBackgroundUiObserver: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded-md text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>

              {settings.enableBackgroundUiObserver && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                      <span>Expected Element Timeout</span>
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                        {settings.expectedElementTimeoutMs} ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="10000"
                      step="500"
                      value={settings.expectedElementTimeoutMs}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          expectedElementTimeoutMs: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-600 dark:text-zinc-300 block font-medium">
                      Action on Element Timeout
                    </label>
                    <select
                      value={settings.onElementTimeoutAction}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          onElementTimeoutAction: e.target.value as any,
                        }))
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                    >
                      <option value="pause_workflow">Pause Workflow & Alert Overseer</option>
                      <option value="alert_only">Alert Overseer (Keep Running)</option>
                      <option value="auto_switch_tab">Auto-Switch Tab & Retry</option>
                      <option value="retry_anchor">Retry Anchor Resolution</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Video Recording Mouse Movement Detection */}
              <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      Track Mouse Motion in Video
                    </span>
                    <p className="text-[11px] text-zinc-500">
                      Captures real-time pointer coordinates and speeds during recordings
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.trackMouseMovementInVideo}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        trackMouseMovementInVideo: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-purple-600 rounded-sm cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      Render Mouse Trails on Keyframes
                    </span>
                    <p className="text-[11px] text-zinc-500">
                      Overlays trajectory vectors and cursor ripple dots onto frames
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.renderMouseTrailInVideo}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        renderMouseTrailInVideo: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-purple-600 rounded-sm cursor-pointer"
                  />
                </div>
              </div>

              {/* Anomaly Detection Toggle & Sensitivity */}
              <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                        Mouse Velocity Anomaly Detection
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">
                        Overseer Watchdog
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Alerts the Overseer AI Panel if mouse movement speeds during a task significantly deviate from historical baseline patterns
                    </p>
                  </div>
                  <input
                    id="toggle-mouse-anomaly-detection"
                    type="checkbox"
                    checked={settings.mouseAnomalyDetectionEnabled ?? true}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        mouseAnomalyDetectionEnabled: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded-md text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </div>

                {(settings.mouseAnomalyDetectionEnabled ?? true) && (
                  <div className="p-4 bg-purple-50/70 dark:bg-purple-950/40 rounded-2xl border border-purple-200/80 dark:border-purple-800/60 space-y-3.5">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-zinc-900 dark:text-zinc-100 font-semibold flex items-center space-x-1.5">
                          <Sliders className="w-3.5 h-3.5 text-purple-500" />
                          <span>Anomaly Detection Sensitivity Slider:</span>
                        </span>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          Controls how aggressively the system flags variations from historical mouse movement baselines
                        </p>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          (settings.mouseSpeedThresholdMultiplier || 2.2) <= 1.5
                            ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                            : (settings.mouseSpeedThresholdMultiplier || 2.2) <= 2.5
                            ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        }`}>
                          {(settings.mouseSpeedThresholdMultiplier || 2.2) <= 1.5
                            ? 'Strict / Aggressive'
                            : (settings.mouseSpeedThresholdMultiplier || 2.2) <= 2.5
                            ? 'Balanced / Moderate'
                            : 'Permissive / Relaxed'}
                        </span>
                        <span className="font-mono font-bold text-xs text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-700/60">
                          {(settings.mouseSpeedThresholdMultiplier || 2.2).toFixed(1)}x
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        id="input-anomaly-sensitivity-slider"
                        type="range"
                        min="1.1"
                        max="4.0"
                        step="0.1"
                        value={settings.mouseSpeedThresholdMultiplier || 2.2}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            mouseSpeedThresholdMultiplier: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-purple-600 h-2 bg-purple-200 dark:bg-zinc-800 rounded-lg cursor-pointer"
                      />

                      {/* Descriptive Scale Labels */}
                      <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                        <span className="text-red-600 dark:text-red-400 font-medium">Aggressive (1.1x &middot; &plusmn;10% variance)</span>
                        <span className="text-purple-600 dark:text-purple-400 font-medium">Balanced (2.2x)</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Permissive (4.0x &middot; &plusmn;300% variance)</span>
                      </div>
                    </div>

                    {/* Real-time Dynamic Diagnostics Box */}
                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-purple-100 dark:border-purple-900/40 text-[11px] font-mono space-y-1">
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>Baseline Mouse Velocity:</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">~410 px/sec (Historical Average)</span>
                      </div>
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>Anomaly Flagging Trigger:</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          &gt; {Math.round(410 * (settings.mouseSpeedThresholdMultiplier || 2.2))} px/sec (+{Math.round(((settings.mouseSpeedThresholdMultiplier || 2.2) - 1) * 100)}% variation)
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 pt-0.5 border-t border-purple-100 dark:border-zinc-800">
                        {(settings.mouseSpeedThresholdMultiplier || 2.2) <= 1.5
                          ? '🔥 High Aggressiveness: Overseer triggers Auto-Fix path alerts on minor trajectory jitters and micro-speed bursts.'
                          : (settings.mouseSpeedThresholdMultiplier || 2.2) <= 2.5
                          ? '⚖️ Standard Aggressiveness: Flags noticeable mouse acceleration leaps or sudden teleportation discrepancies.'
                          : '🛡️ Low Aggressiveness: Only flags severe anomalies, massive trajectory deviations, and frozen cursor states.'}
                      </div>
                    </div>

                    {/* Sensitivity Quick Presets */}
                    <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                      {[
                        { label: 'Strict (1.3x)', val: 1.3, sub: '±30%' },
                        { label: 'Balanced (2.0x)', val: 2.0, sub: '±100%' },
                        { label: 'Standard (2.6x)', val: 2.6, sub: '±160%' },
                        { label: 'Relaxed (3.6x)', val: 3.6, sub: '±260%' },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              mouseSpeedThresholdMultiplier: preset.val,
                            }))
                          }
                          className={`p-1.5 rounded-xl text-[10px] font-mono transition-all border text-center ${
                            Math.abs((settings.mouseSpeedThresholdMultiplier || 2.2) - preset.val) < 0.15
                              ? 'bg-purple-600 text-white font-bold border-purple-600 shadow-xs'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-400'
                          }`}
                        >
                          <div className="font-semibold">{preset.label}</div>
                          <div className="text-[9px] opacity-75">{preset.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center space-x-2 text-xs text-zinc-500 font-mono">
            <Bot className="w-3.5 h-3.5 text-blue-500" />
            <span>Parameters stored in active orchestrator runtime</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="btn-cancel-settings"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-save-settings"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xs transition-colors"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
