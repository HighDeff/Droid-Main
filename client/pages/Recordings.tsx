import React, { useState } from "react";
import { RecordingPanel } from "@/components/recording-panel";
import { RecordingSessionManager } from "@/components/RecordingSessionManager";
import { SessionDifferentialViewer } from "@/components/SessionDifferentialViewer";
import { BatchOperationManager } from "@/components/BatchOperationManager";
import {
  History,
  SplitSquareVertical,
  Layers,
  Circle,
  Sparkles,
  ShieldCheck,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Recordings() {
  const [activeTab, setActiveTab] = useState<
    "session_manager" | "differential_viewer" | "batch_manager" | "live_capture"
  >("session_manager");

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100 space-y-6 font-mono">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                RECORDINGS & AUTOMATION ENGINE REPOSITORY
              </h1>
              <Badge className="bg-amber-950/80 border-amber-500/40 text-amber-300 text-xs">
                100-SESSION LEDGER + DIFF ENGINE
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Store, index, replay trajectory canvases, visually diff inter-session drift, and execute sequential batch pipelines.
            </p>
          </div>

          {/* View Mode Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab("session_manager")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeTab === "session_manager"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              100-SESSION LEDGER
            </button>

            <button
              onClick={() => setActiveTab("differential_viewer")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeTab === "differential_viewer"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              DIFFERENTIAL VIEWER
            </button>

            <button
              onClick={() => setActiveTab("batch_manager")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeTab === "batch_manager"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              BATCH PIPELINE
            </button>

            <button
              onClick={() => setActiveTab("live_capture")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeTab === "live_capture"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Circle className="w-3.5 h-3.5 fill-current text-rose-400" />
              SAFE CAPTURE
            </button>
          </div>
        </div>

        {/* Tab 1: 100-Session Manager & Canvas Playback */}
        {activeTab === "session_manager" && (
          <div className="h-[760px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <RecordingSessionManager
              isOpen={true}
              onClose={() => {}}
            />
          </div>
        )}

        {/* Tab 2: Session Differential Viewer */}
        {activeTab === "differential_viewer" && (
          <SessionDifferentialViewer />
        )}

        {/* Tab 3: Batch Operation Manager */}
        {activeTab === "batch_manager" && (
          <BatchOperationManager />
        )}

        {/* Tab 4: Live Safe Interaction Capture */}
        {activeTab === "live_capture" && (
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <RecordingPanel />
          </div>
        )}
      </div>
    </main>
  );
}
