import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  TrendingUp,
  BarChart3,
  Flame,
  Layers,
  Sparkles,
  ArrowUpRight,
  Filter,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface WorkflowRunMetric {
  id: string;
  workflowName: string;
  timestamp: string;
  durationMs: number;
  stepsCount: number;
  success: boolean;
  errorType?: string;
  driftRatePx: number;
  recalibrations: number;
}

const DEFAULT_METRICS: WorkflowRunMetric[] = [
  {
    id: "run-1",
    workflowName: "Checkout Dispatch Flow",
    timestamp: "10:15 AM",
    durationMs: 4200,
    stepsCount: 8,
    success: true,
    driftRatePx: 3.2,
    recalibrations: 1,
  },
  {
    id: "run-2",
    workflowName: "User Onboarding & Email Pass",
    timestamp: "10:30 AM",
    durationMs: 3800,
    stepsCount: 6,
    success: true,
    driftRatePx: 1.8,
    recalibrations: 0,
  },
  {
    id: "run-3",
    workflowName: "Drive File Batch Indexing",
    timestamp: "10:45 AM",
    durationMs: 6100,
    stepsCount: 12,
    success: false,
    errorType: "Selector drift exceeded threshold (+16px)",
    driftRatePx: 16.4,
    recalibrations: 3,
  },
  {
    id: "run-4",
    workflowName: "Settings Modal Verification",
    timestamp: "11:00 AM",
    durationMs: 2900,
    stepsCount: 5,
    success: true,
    driftRatePx: 2.1,
    recalibrations: 0,
  },
  {
    id: "run-5",
    workflowName: "Checkout Dispatch Flow",
    timestamp: "11:15 AM",
    durationMs: 4050,
    stepsCount: 8,
    success: true,
    driftRatePx: 2.4,
    recalibrations: 0,
  },
  {
    id: "run-6",
    workflowName: "Drive File Batch Indexing",
    timestamp: "11:30 AM",
    durationMs: 5400,
    stepsCount: 12,
    success: true,
    driftRatePx: 4.5,
    recalibrations: 1,
  },
  {
    id: "run-7",
    workflowName: "Auto Actor Replay & Cross Ref",
    timestamp: "11:45 AM",
    durationMs: 3200,
    stepsCount: 7,
    success: true,
    driftRatePx: 1.2,
    recalibrations: 0,
  },
];

export const ExecutionAnalyticsTab: React.FC<{
  onSelectWorkflow?: (name: string) => void;
}> = ({ onSelectWorkflow }) => {
  const [metrics, setMetrics] = useState<WorkflowRunMetric[]>(() => {
    try {
      const saved = localStorage.getItem("workflow_execution_analytics_history");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_METRICS;
  });

  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "all">("today");
  const [selectedWorkflowFilter, setSelectedWorkflowFilter] = useState<string>("all");

  const totalRuns = metrics.length;
  const successfulRuns = metrics.filter((m) => m.success).length;
  const failedRuns = totalRuns - successfulRuns;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;
  const avgDurationSec =
    totalRuns > 0
      ? (metrics.reduce((acc, m) => acc + m.durationMs, 0) / totalRuns / 1000).toFixed(1)
      : "0";
  const avgDriftPx =
    totalRuns > 0
      ? (metrics.reduce((acc, m) => acc + m.driftRatePx, 0) / totalRuns).toFixed(1)
      : "0";

  // Duration trend data
  const durationTrendData = metrics.map((m, idx) => ({
    name: m.timestamp || `#${idx + 1}`,
    durationSec: Number((m.durationMs / 1000).toFixed(2)),
    steps: m.stepsCount,
    driftPx: m.driftRatePx,
    status: m.success ? "Success" : "Failed",
  }));

  // Success vs Failure breakdown
  const pieData = [
    { name: "Successful Executions", value: successfulRuns, color: "#10b981" },
    { name: "Error / Re-calibrated", value: Math.max(failedRuns, 1), color: "#f43f5e" },
  ];

  // Error frequency by category
  const errorRateData = [
    { category: "Selector Drift", count: 4, fill: "#f59e0b" },
    { category: "Screen Changed", count: 2, fill: "#06b6d4" },
    { category: "PyAutoGUI Timeout", count: 1, fill: "#8b5cf6" },
    { category: "Element Occluded", count: 1, fill: "#ec4899" },
  ];

  const handleSimulateRun = (success = true) => {
    const newRun: WorkflowRunMetric = {
      id: `run-${Date.now()}`,
      workflowName:
        selectedWorkflowFilter === "all" ? "Checkout Dispatch Flow" : selectedWorkflowFilter,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      durationMs: Math.floor(Math.random() * 2500) + 2500,
      stepsCount: Math.floor(Math.random() * 6) + 5,
      success,
      driftRatePx: success ? Number((Math.random() * 3 + 1).toFixed(1)) : 14.8,
      recalibrations: success ? 0 : 2,
      errorType: success ? undefined : "Visual shift detected (+14.8px)",
    };
    const updated = [...metrics, newRun];
    setMetrics(updated);
    try {
      localStorage.setItem("workflow_execution_analytics_history", JSON.stringify(updated));
    } catch {}
  };

  return (
    <div id="execution-analytics-dashboard" className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              Execution Analytics & Automation Health
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                LIVE TELEMETRY
              </Badge>
            </h3>
            <p className="text-xs text-zinc-400">
              Duration curves, error rate trends, and success rates across PyAutoGUI desktop workflows
            </p>
          </div>
        </div>

        {/* Simulation and Filters */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSimulateRun(true)}
            className="h-8 text-xs border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
          >
            <Play className="w-3.5 h-3.5 mr-1" /> Log Successful Run
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSimulateRun(false)}
            className="h-8 text-xs border-rose-700/60 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Log Drift Anomaly
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {successRate}%
          </div>
          <p className="text-[11px] text-zinc-500">
            {successfulRuns} / {totalRuns} workflows completed cleanly
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Avg. Execution Duration</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100 font-mono">
            {avgDurationSec}s
          </div>
          <p className="text-[11px] text-zinc-500">
            Mean latency per end-to-end automation sequence
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Mean Coordinate Drift</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            ±{avgDriftPx}px
          </div>
          <p className="text-[11px] text-zinc-500">
            Average sub-pixel offset across monitored screen elements
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Total Executed Runs</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 font-mono">
            {totalRuns}
          </div>
          <p className="text-[11px] text-zinc-500">
            Synchronized across browser sessions & local cache
          </p>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Execution Duration & Drift Trend Area Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Duration & Pixel Drift Trajectory
              </h4>
              <p className="text-xs text-zinc-400">
                Execution speed (seconds) vs. template coordinate drift (pixels)
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Duration (s)
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Drift (px)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={durationTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="driftGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#09090b",
                    borderColor: "#27272a",
                    borderRadius: "12px",
                    color: "#f4f4f5",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="durationSec"
                  name="Duration (s)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#durationGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="driftPx"
                  name="Drift (px)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#driftGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success vs Error Distribution Pie */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-zinc-200">
              Reliability Breakdown
            </h4>
            <p className="text-xs text-zinc-400">
              Clean completions vs. drift interventions
            </p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#09090b",
                    borderColor: "#27272a",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Clean Execution
              </span>
              <span className="font-mono font-bold text-zinc-200">{successfulRuns}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" /> Drift Anomaly
              </span>
              <span className="font-mono font-bold text-zinc-200">{failedRuns}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Breakdown & Execution Ledger Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Error Frequency by Category */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-zinc-200">
              Error Frequency by Failure Mode
            </h4>
            <p className="text-xs text-zinc-400">
              Identified causes during autonomous browser & desktop replays
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorRateData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis type="number" stroke="#71717a" fontSize={11} />
                <YAxis dataKey="category" type="category" stroke="#71717a" fontSize={11} width={110} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#09090b",
                    borderColor: "#27272a",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" name="Incidents" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Run History Ledger */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Execution History Ledger
              </h4>
              <p className="text-xs text-zinc-400">
                Recent workflow passes with step counts & timing
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMetrics(DEFAULT_METRICS);
                localStorage.removeItem("workflow_execution_analytics_history");
              }}
              className="h-7 text-xs text-zinc-400 hover:text-white"
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset Ledger
            </Button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {metrics
              .slice(-6)
              .reverse()
              .map((run) => (
                <div
                  key={run.id}
                  className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-zinc-200 flex items-center gap-2">
                      {run.workflowName}
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {run.timestamp}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      {run.stepsCount} steps • {(run.durationMs / 1000).toFixed(1)}s • Drift: ±{run.driftRatePx}px
                    </div>
                  </div>

                  <Badge
                    className={`text-[10px] font-mono ${
                      run.success
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    {run.success ? "SUCCESS" : "DRIFT DETECTED"}
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
