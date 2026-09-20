import { Link } from "react-router-dom";
import { ArrowLeft, Bot, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstructionPlanningPanel } from "@/components/instruction-planning-panel";
import { WorkflowLibraryPanel } from "@/components/workflow-library-panel";

export default function AutomationPage() {
  return (
    <main className="min-h-screen bg-[#0b1020] px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              <Bot className="h-4 w-4" /> Connected goal automation
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Plan, review, run, verify, and learn
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Turn an objective into reviewed device actions. Each run requires
              explicit confirmation, checks a fresh screen between steps, pauses
              for adapted methods, and saves successful workflows for reuse.
            </p>
          </div>
          <Button asChild variant="outline" className="border-white/10 bg-white/5">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-xs text-slate-400">
            <ShieldCheck className="mb-2 h-4 w-4 text-cyan-300" />
            Physical PC or Android input only follows the exact approved plan.
          </div>
          <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-xs text-slate-400">
            <RefreshCw className="mb-2 h-4 w-4 text-cyan-300" />
            Fresh frames re-align named targets and detect unchanged screens.
          </div>
          <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-xs text-slate-400">
            <Bot className="mb-2 h-4 w-4 text-cyan-300" />
            Confirmed runs update reusable workflow memory and next-step guidance.
          </div>
        </div>

        <InstructionPlanningPanel />
        <WorkflowLibraryPanel />
      </div>
    </main>
  );
}
