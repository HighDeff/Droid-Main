import { Bot } from "lucide-react";
import { AiMonitorPanel } from "@/components/ai-monitor-panel";

/**
 * Standalone AI Monitor screen: current AI status, ongoing actions and the
 * recent tasks performed on screen, plus CSV export for Google Sheets.
 */
export default function AiMonitor() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800">
            <Bot className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">AI Monitor</h1>
            <p className="text-xs text-slate-400">
              Live status, ongoing actions and the recent tasks the AI performed
              on screen.
            </p>
          </div>
        </div>

        <AiMonitorPanel />
      </div>
    </div>
  );
}
