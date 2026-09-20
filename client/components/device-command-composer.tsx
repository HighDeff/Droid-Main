import { useMemo, useState } from "react";
import { Command, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseDeviceCommands, type ParsedDeviceCommand } from "@/lib/device-commands";

export function DeviceCommandComposer({
  onAddCommands,
}: {
  onAddCommands: (commands: ParsedDeviceCommand[]) => void;
}) {
  const [source, setSource] = useState("");
  const parsed = useMemo(() => {
    try {
      return { commands: parseDeviceCommands(source), error: "" };
    } catch (error) {
      return { commands: [], error: error instanceof Error ? error.message : "Invalid command" };
    }
  }, [source]);

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-950/90 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
            <Command className="h-4 w-4" /> Reviewed device commands
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Build workflow steps with click, double-click, right-click, type, key, hotkey, scroll, or wait. Commands are added for review and never run as shell code.
          </p>
        </div>
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
      </div>
      <Textarea
        value={source}
        onChange={(event) => setSource(event.target.value)}
        placeholder={'click 420,300\ntype "hello" at 420,340\nkey enter\nwait 750'}
        className="mt-3 min-h-24 border-slate-700 bg-slate-900 font-mono text-xs"
      />
      {parsed.error && source.trim() && <p className="mt-2 text-xs text-rose-300">{parsed.error}</p>}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{parsed.commands.length} reviewed step(s)</span>
        <Button
          size="sm"
          disabled={!parsed.commands.length || Boolean(parsed.error)}
          onClick={() => {
            onAddCommands(parsed.commands);
            setSource("");
          }}
          className="bg-cyan-600 hover:bg-cyan-500"
        >
          <Plus className="h-3.5 w-3.5" /> Add to workflow
        </Button>
      </div>
    </div>
  );
}
