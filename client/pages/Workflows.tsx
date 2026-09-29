import React, { useState } from "react";
import { WorkflowLibraryPanel } from "@/components/workflow-library-panel";
import { AutonomousWorkflowLearnerPanel } from "@/components/autonomous-workflow-learner-panel";
import { WorkflowScheduler } from "@/components/workflow-scheduler";
import { WorkflowFlowchartView } from "@/components/WorkflowFlowchartView";
import { OverseerAIPanel } from "@/components/OverseerAIPanel";
import { BatchOperationManager } from "@/components/BatchOperationManager";
import { GitBranch, List, Calendar, Cpu, Sparkles, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Workflows() {
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<
    "flowchart" | "batch" | "overseer" | "learner" | "scheduler" | "library"
  >("flowchart");

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100 space-y-6 font-mono">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                AUTONOMOUS WORKFLOWS & AUTOMATION HUB
              </h1>
              <Badge className="bg-amber-950/80 border-amber-500/40 text-amber-300 text-xs">
                REACTFLOW + OVERSEER + BATCH
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Visualize action flowcharts, run sequential batch pipelines, inspect latency telemetry, assemble live tasks, and execute scheduled native PC commands.
            </p>
          </div>

          {/* View Mode Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveWorkflowTab("flowchart")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeWorkflowTab === "flowchart"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              FLOWCHART VIEW
            </button>

            <button
              onClick={() => setActiveWorkflowTab("batch")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeWorkflowTab === "batch"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              BATCH PIPELINE
            </button>

            <button
              onClick={() => setActiveWorkflowTab("overseer")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeWorkflowTab === "overseer"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              OVERSEER LATENCY
            </button>

            <button
              onClick={() => setActiveWorkflowTab("learner")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeWorkflowTab === "learner"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              WORKFLOW LEARNER
            </button>

            <button
              onClick={() => setActiveWorkflowTab("scheduler")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeWorkflowTab === "scheduler"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              SCHEDULER
            </button>

            <button
              onClick={() => setActiveWorkflowTab("library")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeWorkflowTab === "library"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              LIBRARY
            </button>
          </div>
        </div>

        {/* Tab 1: Interactive Workflow Flowchart */}
        {activeWorkflowTab === "flowchart" && (
          <div className="space-y-6">
            <WorkflowFlowchartView />
          </div>
        )}

        {/* Tab 2: Batch Operation Manager */}
        {activeWorkflowTab === "batch" && (
          <div className="space-y-6">
            <BatchOperationManager />
          </div>
        )}

        {/* Tab 3: Overseer Real-Time Latency Monitor */}
        {activeWorkflowTab === "overseer" && (
          <div className="space-y-6">
            <OverseerAIPanel />
          </div>
        )}

        {/* Tab 4: Autonomous Workflow Learner */}
        {activeWorkflowTab === "learner" && (
          <div className="space-y-6">
            <AutonomousWorkflowLearnerPanel />
          </div>
        )}

        {/* Tab 5: Scheduler */}
        {activeWorkflowTab === "scheduler" && (
          <div className="space-y-6">
            <WorkflowScheduler />
          </div>
        )}

        {/* Tab 6: Library */}
        {activeWorkflowTab === "library" && (
          <div className="space-y-6">
            <WorkflowLibraryPanel />
          </div>
        )}
      </div>
    </main>
  );
}
