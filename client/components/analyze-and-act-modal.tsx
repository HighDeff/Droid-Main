import React, { useState } from "react";
import {
  Sparkles,
  Bot,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Zap,
  Layers,
  Search,
  Volume2,
  Calculator,
  Edit3,
  Clipboard,
  Eye,
  RefreshCw,
  Clock,
  Terminal,
  Play,
  ArrowRight,
  Shield,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { playClickPip } from "@/lib/audio-synthesizer";
import { ensureAssistantSession } from "@/lib/assistant-session";

interface AnalyzeAndActModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveScreenUrl?: string | null;
  screenStreamUrl?: string | null;
  storedSteps?: any[];
  onAdoptAssembledWorkflow?: (tasks: any[]) => void;
}

export const AnalyzeAndActModal: React.FC<AnalyzeAndActModalProps> = ({
  isOpen,
  onClose,
  liveScreenUrl,
  screenStreamUrl,
  storedSteps = [],
  onAdoptAssembledWorkflow,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"analysis" | "tasks" | "tools" | "preferences">("analysis");

  const [bridgeResultLog, setBridgeResultLog] = useState<string | null>(null);
  const [objective, setObjective] = useState(
    "Analyze the current screen and propose the safest next action toward my goal.",
  );

  // Key Point Action Tools State
  const [searchQuery, setSearchQuery] = useState("sightline workspace automation");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [calcExpression, setCalcExpression] = useState("1920 * 1080 / 1000");
  const [calcResult, setCalcResult] = useState<string | null>("2073.6");
  const [liveWriteText, setLiveWriteText] = useState("operator.lead@enterprise.ai");
  const [isLiveWriting, setIsLiveWriting] = useState(false);
  const [watcherActive, setWatcherActive] = useState(true);

  // Trigger Analyze and Act
  const handleRunAnalyzeAndAct = async () => {
    const activeImage = [liveScreenUrl, screenStreamUrl].find((url) =>
      url?.startsWith("data:image/"),
    );
    if (!activeImage) {
      setAnalysisResult({ success: false, error: "Capture a real current screen before running analysis." });
      return;
    }
    setIsAnalyzing(true);
    setBridgeResultLog(null);
    try {
      const response = await fetch("/api/ai/analyze-and-act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveScreenUrl: activeImage,
          previousTasks: storedSteps,
          userInstructions: objective.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setAnalysisResult(data);
        playClickPip(680);
      } else {
        setAnalysisResult({ success: false, error: data.error || "Screen analysis failed." });
      }
    } catch (e: any) {
      console.error("Analyze & Act error:", e);
      setAnalysisResult({
        success: false,
        error: e?.message || "Screen analysis request failed.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const prepareTasksForApproval = async (tasks: any[]) => {
    if (!tasks.length) {
      setBridgeResultLog("No reviewed tasks are available to prepare.");
      return false;
    }
    try {
      const sessionId = await ensureAssistantSession({
        project: { name: "Analyzed workflow review" },
      });

      const draftResponse = await fetch("/api/assistant/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, instructionText: "Review analyzed workflow" }),
      });
      const draft = await draftResponse.json();
      if (!draftResponse.ok || !draft?.plan?.id) {
        throw new Error(draft?.error || "Could not create a draft plan");
      }
      const steps = tasks.map((task, index) => {
        const x = Number(task.x ?? task.targetPosition?.x ?? task.parameters?.x);
        const y = Number(task.y ?? task.targetPosition?.y ?? task.parameters?.y);
        return {
          id: String(task.id || `analyzed_${index + 1}`),
          order: index + 1,
          title: String(task.name || `Analyzed action ${index + 1}`),
          description: String(task.description || "Review analyzed action"),
          action: String(task.action || "click"),
          ...(Number.isFinite(x) && Number.isFinite(y) ? { target: { x, y } } : {}),
          text: task.text ?? task.parameters?.text,
          key: task.key ?? task.keyPayload ?? task.parameters?.key,
          targetDevice: "desktop",
          timing: "when_ready",
          confidence: Number(task.confidence ?? 0.5),
          status: "pending",
        };
      });
      const saveResponse = await fetch(
        `/api/assistant/plans/${encodeURIComponent(draft.plan.id)}?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ steps, timing: "when_ready" }),
        },
      );
      const saved = await saveResponse.json();
      if (!saveResponse.ok || !saved.success) {
        throw new Error(saved?.error || "Could not save the draft plan");
      }
      setBridgeResultLog(`Prepared ${steps.length} step(s) in a persisted draft. Review and approve them in Automation.`);
      window.dispatchEvent(new CustomEvent("assistant-session-changed", { detail: { sessionId } }));
      return true;
    } catch (error) {
      setBridgeResultLog(error instanceof Error ? error.message : "Could not prepare the draft plan");
      return false;
    }
  };

  // Physical execution is intentionally delegated to the persisted plan approval flow.
  const handleDispatchBridge = async (actionType = "click") => {
    const reviewedTask = analysisResult?.autoAssembledTasks?.[0];
    if (!reviewedTask) {
      setBridgeResultLog("Run screen analysis and review its proposed task before device control.");
      return;
    }
    const isTextAction = actionType === "type" || actionType === "clear_and_type";
    await prepareTasksForApproval([{
      ...reviewedTask,
      action: actionType,
      ...(isTextAction ? { text: liveWriteText } : {}),
    }]);
  };

  // Perform Live Web Search tool
  const handleExecuteSearch = () => {
    setSearchResults([
      `Web search is not configured in this runtime. No results were invented for "${searchQuery}".`,
    ]);
  };

  // Perform Calculator tool
  const handleEvaluateCalc = () => {
    try {
      // Safe numeric calculation
      const sanitized = calcExpression.replace(/[^0-9+\-*/.() ]/g, "");
      const res = Function(`'use strict'; return (${sanitized})`)();
      setCalcResult(String(res));
      playClickPip(720);
    } catch {
      setCalcResult("Invalid Expression");
    }
  };

  // Perform Live Write tool
  const handleExecuteLiveWrite = async () => {
    setIsLiveWriting(true);
    playClickPip(600);
    await handleDispatchBridge("type");
    setIsLiveWriting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-slate-950 border border-cyan-500/50 text-slate-100 shadow-2xl p-0 overflow-hidden font-mono">
        <DialogHeader className="p-4 bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center">
                <Brain className="w-4 h-4 text-cyan-300 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Analyze & Act Master Vision Engine</span>
                  <Badge className="bg-cyan-600 text-white text-[10px]">Qwen Vision + Review Gate</Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Inspects a fresh frame, cross-references prior actions, and prepares reviewable PC or phone steps.
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleRunAnalyzeAndAct}
              disabled={isAnalyzing}
              className="h-8 px-4 font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-950 gap-1.5"
            >
              <Sparkles className={`w-3.5 h-3.5 text-yellow-300 ${isAnalyzing ? "animate-spin" : ""}`} />
              <span>{isAnalyzing ? "ANALYZING LIVE SCREEN..." : "ANALYZE & PLAN"}</span>
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-800/80 text-xs">
            {[
              { id: "analysis", label: "Perception & Cross-Reference", icon: Eye },
              { id: "tasks", label: "Auto-Assembled Tasks", icon: Layers },
              { id: "tools", label: "Key Point Action Tools", icon: Zap },
              { id: "preferences", label: "PC Bridge & Monitors", icon: Terminal },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeTab === t.id
                      ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/60"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] p-4 space-y-4">
          {/* Tab 1: Analysis & Cross-Reference */}
          {activeTab === "analysis" && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
                <label className="font-bold text-slate-200" htmlFor="analyze-objective">
                  Live goal for Qwen planning
                </label>
                <Textarea
                  id="analyze-objective"
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  maxLength={2000}
                  className="min-h-20 bg-slate-950 border-slate-700 text-slate-200"
                  placeholder="Describe the result the AI should work toward on this screen."
                />
              </div>
              {/* Visual Preview */}
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  Visual Input Surfaces
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold">Live Screen Canvas</span>
                    <div className="w-full h-24 bg-slate-900 rounded flex items-center justify-center text-slate-500 text-[11px] overflow-hidden border border-slate-800">
                      {liveScreenUrl ? (
                        <img src={liveScreenUrl} alt="Live Screen" className="w-full h-full object-cover" />
                      ) : (
                        <span>No current screen captured</span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold">Screen Stream Frame</span>
                    <div className="w-full h-24 bg-slate-900 rounded flex items-center justify-center text-slate-500 text-[11px] overflow-hidden border border-slate-800">
                      {screenStreamUrl ? (
                        <img src={screenStreamUrl} alt="Screen Stream" className="w-full h-full object-cover" />
                      ) : (
                        <span>No stream frame available</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Summary */}
              <div className="p-3 bg-cyan-950/30 border border-cyan-500/40 rounded-xl space-y-1.5">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  AI Perception Summary
                </span>
                <p className="text-slate-200 leading-relaxed">
                  {analysisResult?.visualSummary ||
                    analysisResult?.error ||
                    "Run analysis after capturing a current screen."}
                </p>
              </div>

              {/* Cross-Reference Comparison */}
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                  Cross-Reference Analysis (Previous Actions ⇄ Current Screen)
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-950/80 rounded border border-slate-800 space-y-1">
                    <span className="text-slate-400 font-semibold">What Was Done Before:</span>
                    <p className="text-slate-300">
                      {analysisResult?.crossReferenceAnalysis?.previousActionSummary ||
                        "No prior action has been analyzed."}
                    </p>
                  </div>
                  <div className="p-2 bg-slate-950/80 rounded border border-slate-800 space-y-1">
                    <span className="text-slate-400 font-semibold">Current State & Shifts:</span>
                    <p className="text-cyan-300">
                      {analysisResult?.crossReferenceAnalysis?.currentScreenState ||
                        "No verified current screen state is available."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Auto-Assembled Tasks */}
          {activeTab === "tasks" && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">
                  AI Auto-Assembled Workflow ({analysisResult?.autoAssembledTasks?.length ?? 0} Steps)
                </span>
                <Button
                  size="sm"
                  onClick={() => onAdoptAssembledWorkflow?.(analysisResult?.autoAssembledTasks || [])}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Adopt Into Workflow
                </Button>
              </div>

              <div className="space-y-2">
                {(analysisResult?.autoAssembledTasks || []).map((task: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500 flex items-center justify-center font-bold text-cyan-300 text-[10px]">
                        {task.stepNumber || idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-100">{task.name}</div>
                        <div className="text-[10px] text-slate-400">
                          Action: <span className="text-cyan-300 font-semibold">{task.action}</span> | Target: ({task.targetPosition?.x ?? "?"}, {task.targetPosition?.y ?? "?"})
                          {task.text && <span className="text-amber-300 ml-1">"{task.text}"</span>}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-slate-800 text-slate-300 text-[10px]">
                      {Math.round((task.confidence ?? 0) * 100)}% Conf
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Key Point Action Tools */}
          {activeTab === "tools" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Watcher Agent */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      Assign Watcher Agent
                    </span>
                    <Badge className={watcherActive ? "bg-emerald-600 text-white text-[9px]" : "bg-slate-800 text-slate-400 text-[9px]"}>
                      {watcherActive ? "MONITORING ACTIVE" : "PAUSED"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Monitors live screen regions for asynchronous visual changes or completion badges.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWatcherActive(!watcherActive)}
                    className="h-7 text-xs border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300 w-full"
                  >
                    {watcherActive ? "Pause Watcher Agent" : "Activate Watcher Agent"}
                  </Button>
                </div>

                {/* 2. Media Play */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    Media Play & Chime Trigger
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Plays verification audio feedback tone on workflow completion or drift alerts.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => playClickPip(880)}
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-500 text-white w-full gap-1"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Test Notification Chime
                  </Button>
                </div>

                {/* 3. Internet Search */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 col-span-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-blue-400" />
                    Web Search Status
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
                    />
                    <Button size="sm" onClick={handleExecuteSearch} className="h-7 bg-blue-600 hover:bg-blue-500 text-white">
                      Check availability
                    </Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1 text-[11px] text-slate-300">
                      {searchResults.map((r, i) => (
                        <div key={i}>• {r}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Calculator */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-purple-400" />
                    Dynamic Coordinate Calculator
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={calcExpression}
                      onChange={(e) => setCalcExpression(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
                    />
                    <Button size="sm" onClick={handleEvaluateCalc} className="h-7 bg-purple-600 hover:bg-purple-500 text-white">
                      Calc
                    </Button>
                  </div>
                  {calcResult && (
                    <div className="text-[11px] text-purple-300 font-bold">
                      Result: {calcResult}
                    </div>
                  )}
                </div>

                {/* 5. Live Write & Paste Text */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-pink-400" />
                    Active Agent (Live Write & Paste)
                  </span>
                  <input
                    type="text"
                    value={liveWriteText}
                    onChange={(e) => setLiveWriteText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleExecuteLiveWrite}
                      disabled={isLiveWriting}
                      className="h-7 text-xs bg-pink-600 hover:bg-pink-500 text-white flex-1 gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      Live Write
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDispatchBridge("clear_and_type")}
                      className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 flex-1 gap-1"
                    >
                      <Clipboard className="w-3 h-3" />
                      Replace Text
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: PyAutoGUI Execution Bridge & Companion Commands */}
          {activeTab === "preferences" && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-yellow-400" />
                  Native Step Review Bridge
                </span>
                <p className="text-slate-400 text-[11px]">
                  Prepares the action proposed from the current analyzed screen for approval. Full workflows use fresh-frame checks between steps.
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleDispatchBridge("click")}
                      disabled={!analysisResult?.autoAssembledTasks?.length}
                      className="h-8 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold gap-1.5 flex-1"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      Prepare Single Step for Approval
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        const tasks = analysisResult?.autoAssembledTasks?.length
                          ? analysisResult.autoAssembledTasks
                          : storedSteps;
                        void prepareTasksForApproval(tasks).then((prepared) => {
                          if (prepared) onClose();
                        });
                      }}
                      disabled={!(analysisResult?.autoAssembledTasks?.length || storedSteps.length)}
                      className="h-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold gap-1.5 flex-1"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Prepare Full Workflow for Approval
                    </Button>
                  </div>

                  {bridgeResultLog && (
                    <div className="p-2 bg-slate-950 rounded border border-amber-500/50 text-amber-300 text-[11px] font-mono">
                      Review required: {bridgeResultLog}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
