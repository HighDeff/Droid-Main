import React, { useState, useEffect } from "react";
import {
  Bot,
  FileText,
  Wrench,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  Clock,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Sliders,
  ChevronRight,
  Terminal,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface SquadAgent {
  id: string;
  name: string;
  roleTitle: string;
  avatar: string;
  themeColor: string;
  status: "active" | "monitoring" | "intervening" | "idle";
  liveThought: string;
  interventions: number;
  lastAction: string;
  lastActionTime: string;
  metrics: { [key: string]: string | number };
}

interface ThreeAiAgentsSquadProps {
  className?: string;
  onDispatchFix?: () => Promise<void>;
  onRefreshScreen?: () => Promise<{ screenDescription?: string }>;
}

export const ThreeAiAgentsSquad: React.FC<ThreeAiAgentsSquadProps> = ({
  className = "",
  onDispatchFix,
  onRefreshScreen,
}) => {
  const [agents, setAgents] = useState<SquadAgent[]>([
    {
      id: "agent_assistant",
      name: "Assistant Agent",
      roleTitle: "Proactive Workflow Guide",
      avatar: "🤖",
      themeColor: "cyan",
      status: "idle",
      liveThought: "Refresh screen AI to inspect the current screenshot and workflow context.",
      interventions: 0,
      lastAction: "Waiting for current-screen perception",
      lastActionTime: "—",
      metrics: {},
    },
    {
      id: "agent_log_reader",
      name: "Log Watcher Sentinel",
      roleTitle: "Real-time Telemetry & Error Inspector",
      avatar: "📜",
      themeColor: "emerald",
      status: "monitoring",
      liveThought: "Polling the interaction log endpoint for current activity.",
      interventions: 0,
      lastAction: "Waiting for interaction events",
      lastActionTime: "—",
      metrics: {},
    },
    {
      id: "agent_corrector",
      name: "Auto-Corrector & Healer",
      roleTitle: "Adaptive Action Recovery & Scheduler",
      avatar: "🛠️",
      themeColor: "amber",
      status: "idle",
      liveThought: "Retry is available only for a failed step and uses fresh perception before verified replay.",
      interventions: 0,
      lastAction: "Waiting for a failed workflow step",
      lastActionTime: "—",
      metrics: {},
    },
  ]);

  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);

  const refreshInteractions = async () => {
    const res = await fetch("/api/interactions");
    if (!res.ok) throw new Error("Could not refresh interaction telemetry.");
    const data = await res.json();
    const interactions = data.interactions || [];
    const errCount = interactions.filter((i: any) => i.status === "error" || i.status === "failed").length;
    setAgents((prev) => [
      prev[0],
      {
        ...prev[1],
        liveThought: `Inspected ${interactions.length} interactions. ${errCount === 0 ? "All commands healthy." : `${errCount} warning(s) found.`}`,
        metrics: { "Logged Interactions": interactions.length, "Health Score": errCount === 0 ? "100%" : "Warnings" },
      },
      prev[2],
    ]);
    return interactions.length;
  };

  // Live polling of logs and self-healing telemetry
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await refreshInteractions();
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleManualHealTrigger = async (agentId: string) => {
    setBusyAgentId(agentId);
    try {
      if (agentId === "agent_corrector") {
        if (!onDispatchFix) throw new Error("Verified retry is unavailable.");
        await onDispatchFix();
      } else if (agentId === "agent_log_reader") {
        const count = await refreshInteractions();
        toast.success(`Refreshed telemetry from ${count} interaction(s).`);
      } else {
        if (!onRefreshScreen) throw new Error("Screen perception is unavailable.");
        const report = await onRefreshScreen();
        setAgents((prev) => [
          { ...prev[0], liveThought: report?.screenDescription || "Current screen perception refreshed." },
          prev[1],
          prev[2],
        ]);
        toast.success("Refreshed AI perception from the current screen.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Agent action failed.");
    } finally {
      setBusyAgentId(null);
    }
  };

  return (
    <Card className={`bg-slate-950/90 border-slate-800 shadow-2xl overflow-hidden font-mono ${className}`}>
      <CardHeader className="p-3 bg-slate-900/80 border-b border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <CardTitle className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>Tri-Agent Autonomous Operations Squad</span>
              <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[9px] py-0">
                3 Agents Active
              </Badge>
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`p-2.5 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                agent.themeColor === "cyan"
                  ? "bg-slate-900/80 border-cyan-500/40 hover:border-cyan-400 shadow-md shadow-cyan-950/40"
                  : agent.themeColor === "emerald"
                  ? "bg-slate-900/80 border-emerald-500/40 hover:border-emerald-400 shadow-md shadow-emerald-950/40"
                  : "bg-slate-900/80 border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-950/40"
              }`}
            >
              <div>
                {/* Agent Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{agent.avatar}</span>
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-100">{agent.name}</h4>
                      <p className="text-[9px] text-slate-400">{agent.roleTitle}</p>
                    </div>
                  </div>
                  <Badge
                    className={`text-[8px] uppercase py-0 ${
                      agent.status === "active"
                        ? "bg-cyan-950 text-cyan-300 border-cyan-700"
                        : agent.status === "intervening"
                        ? "bg-amber-950 text-amber-300 border-amber-700 animate-pulse"
                        : "bg-emerald-950 text-emerald-300 border-emerald-700"
                    }`}
                  >
                    {agent.status}
                  </Badge>
                </div>

                {/* Live Thought Stream */}
                <div className="mt-2 p-1.5 rounded bg-slate-950 border border-slate-800/80 text-[10px] text-slate-300 leading-relaxed">
                  <span className="text-cyan-400 font-bold block text-[9px] uppercase">Thought Stream:</span>
                  {agent.liveThought}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-1.5 mt-2 text-[9px]">
                  {Object.entries(agent.metrics).map(([k, v]) => (
                    <div key={k} className="p-1 rounded bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block truncate">{k}:</span>
                      <span className="text-emerald-400 font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer action */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[9px]">
                <span className="text-slate-500 truncate">Interventions: {agent.interventions}</span>
                <Button
                  size="sm"
                  onClick={() => void handleManualHealTrigger(agent.id)}
                  disabled={busyAgentId === agent.id}
                  className={`h-6 px-2 text-[9px] font-bold ${
                    agent.themeColor === "amber"
                      ? "bg-amber-600 hover:bg-amber-500 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  }`}
                >
                  {busyAgentId === agent.id ? "Working…" : agent.id === "agent_corrector" ? "Retry Failed Step" : agent.id === "agent_log_reader" ? "Refresh Logs" : "Refresh Screen AI"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
