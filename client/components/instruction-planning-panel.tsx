import { useEffect, useState } from "react";
import type {
  AssistantPlan,
  PlannedStep,
  TimingHint,
  WaitCondition,
} from "@shared/assistant";
import { Check, Pencil, ShieldAlert, Sparkles, X, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ExecutionControlPanel } from "@/components/execution-control-panel";
import { WaitConditionPanel } from "@/components/wait-condition-panel";
import { ensureAssistantSession } from "@/lib/assistant-session";

const timingOptions: TimingHint[] = ["now", "soon", "scheduled", "when_ready"];
const actionOptions = [
  "",
  "click",
  "double_click",
  "right_click",
  "type",
  "clear_and_type",
  "key",
  "scroll",
  "wait",
];
const coordinateActions = new Set([
  "click",
  "double_click",
  "right_click",
  "type",
  "clear_and_type",
  "scroll",
]);
const requiredCoordinateActions = new Set([
  "click",
  "double_click",
  "right_click",
  "scroll",
]);

class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new RequestError(body?.error ?? "Request failed", response.status);
  if (!body) throw new RequestError("The server returned an invalid response", response.status);
  return body;
}

export function InstructionComposer({
  instruction,
  onInstructionChange,
  onSubmit,
  busy,
}: {
  instruction: string;
  onInstructionChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-200">
            Prepare a safe plan
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Describe the outcome you want. This stage only proposes steps; it
            never sends input or runs device actions. For exact automation, use
            phrases such as “click at 420,300 then type &quot;hello&quot; at 420,340”.
          </p>
          <Textarea
            value={instruction}
            onChange={(event) => onInstructionChange(event.target.value)}
            placeholder="e.g. Find the primary action and explain what needs attention."
            className="mt-3 min-h-24 border-white/10 bg-[#0d1528] text-slate-100 placeholder:text-slate-600"
            maxLength={4000}
          />
          <Button
            onClick={onSubmit}
            disabled={busy || !instruction.trim()}
            className="mt-3 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          >
            {busy ? "Preparing…" : "Prepare plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PlanReview({
  plan,
  onChange,
  onApprove,
  onReject,
  onRegenerate,
  busy,
}: {
  plan: AssistantPlan;
  onChange: (plan: AssistantPlan) => void;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate?: () => void;
  busy: boolean;
}) {
  const [coordinateDrafts, setCoordinateDrafts] = useState<
    Record<string, { x: string; y: string }>
  >({});
  useEffect(() => {
    setCoordinateDrafts({});
  }, [plan.id]);
  const updateStep = (stepId: string, patch: Partial<PlannedStep>) => {
    onChange({
      ...plan,
      approvalState: "pending",
      status: "draft",
      steps: plan.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch, status: "edited" } : step,
      ),
    });
  };
  const updateCoordinate = (
    step: PlannedStep,
    axis: "x" | "y",
    value: string,
  ) => {
    const current = coordinateDrafts[step.id] ?? {
      x: step.target ? String(step.target.x) : "",
      y: step.target ? String(step.target.y) : "",
    };
    const next = { ...current, [axis]: value };
    setCoordinateDrafts((drafts) => ({ ...drafts, [step.id]: next }));
    const x = Number(next.x);
    const y = Number(next.y);
    updateStep(step.id, {
      target:
        next.x !== "" && next.y !== "" && Number.isFinite(x) && Number.isFinite(y)
          ? { x, y }
          : undefined,
    });
  };
  const hasInvalidStep = plan.steps.some((step) => {
    if (!step.action) return true;
    if (
      requiredCoordinateActions.has(step.action) &&
      (!step.target ||
        !Number.isFinite(step.target.x) ||
        !Number.isFinite(step.target.y))
    ) return true;
    if (["type", "clear_and_type"].includes(step.action) && !step.text?.trim()) return true;
    if (step.action === "key" && !step.key?.trim()) return true;
    return step.targetDevice === "android" && !step.deviceId?.trim();
  });

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-200">Plan review</p>
          <p className="mt-1 text-xs text-slate-500">
            Nothing executes until you explicitly approve this exact plan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={busy}
              className="h-7 text-xs border-cyan-400/30 text-cyan-300 hover:bg-cyan-950/40 gap-1 font-medium"
              title="Regenerate plan using original instruction"
            >
              <RotateCcw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
              Regenerate
            </Button>
          )}
          <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-300">
            {plan.approvalState.replace("_", " ")}
          </Badge>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {plan.steps.map((step) => (
          <div
            key={step.id}
            className="rounded-lg border border-white/10 bg-[#0d1528] p-3"
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-300">
                {step.order}
              </span>
              <Pencil className="h-3 w-3" /> Editable proposal
            </div>
            <Input
              value={step.title}
              onChange={(event) =>
                updateStep(step.id, { title: event.target.value })
              }
              className="mt-2 border-white/10 bg-transparent font-medium text-slate-200"
              aria-label={`Step ${step.order} title`}
            />
            <Textarea
              value={step.description}
              onChange={(event) =>
                updateStep(step.id, { description: event.target.value })
              }
              className="mt-2 min-h-16 border-white/10 bg-transparent text-xs leading-5 text-slate-400"
              aria-label={`Step ${step.order} description`}
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-slate-500">
                Action
                <select
                  value={step.action ?? ""}
                  onChange={(event) => updateStep(step.id, { action: event.target.value })}
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#121b31] px-2 py-1.5 text-xs text-slate-300"
                >
                  {(actionOptions.includes(step.action ?? "")
                    ? actionOptions
                    : [...actionOptions, step.action]
                  ).map((option) => (
                    <option key={option} value={option}>
                      {option || "Choose an action"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-slate-500">
                Device
                <select
                  value={step.targetDevice ?? "desktop"}
                  onChange={(event) =>
                    updateStep(step.id, {
                      targetDevice: event.target.value as "desktop" | "android",
                    })
                  }
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#121b31] px-2 py-1.5 text-xs text-slate-300"
                >
                  <option value="desktop">Desktop PC</option>
                  <option value="android">Android / phone</option>
                </select>
              </label>
            </div>
            {coordinateActions.has(step.action) && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={coordinateDrafts[step.id]?.x ?? step.target?.x ?? ""}
                  onChange={(event) => updateCoordinate(step, "x", event.target.value)}
                  placeholder="X coordinate"
                  aria-label={`Step ${step.order} X coordinate`}
                />
                <Input
                  type="number"
                  value={coordinateDrafts[step.id]?.y ?? step.target?.y ?? ""}
                  onChange={(event) => updateCoordinate(step, "y", event.target.value)}
                  placeholder="Y coordinate"
                  aria-label={`Step ${step.order} Y coordinate`}
                />
              </div>
            )}
            {["type", "clear_and_type"].includes(step.action) && (
              <Input
                className="mt-2"
                value={step.text ?? ""}
                onChange={(event) => updateStep(step.id, { text: event.target.value })}
                placeholder="Exact text to enter"
                aria-label={`Step ${step.order} text`}
              />
            )}
            {step.action === "key" && (
              <Input
                className="mt-2"
                value={step.key ?? ""}
                onChange={(event) => updateStep(step.id, { key: event.target.value })}
                placeholder="enter, escape, tab…"
                aria-label={`Step ${step.order} key`}
              />
            )}
            {step.targetDevice === "android" && (
              <Input
                className="mt-2"
                value={step.deviceId ?? ""}
                onChange={(event) => updateStep(step.id, { deviceId: event.target.value })}
                placeholder="ADB device ID (for example emulator-5554)"
                aria-label={`Step ${step.order} Android device ID`}
              />
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-500">
                Timing
                <select
                  value={step.timing}
                  onChange={(event) =>
                    updateStep(step.id, {
                      timing: event.target.value as TimingHint,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-white/10 bg-[#121b31] px-2 py-1.5 text-xs text-slate-300"
                >
                  {timingOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-slate-500">
                Confidence ({Math.round(step.confidence * 100)}%)
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={step.confidence}
                  onChange={(event) =>
                    updateStep(step.id, {
                      confidence: Number(event.target.value),
                    })
                  }
                  className="mt-3 w-full accent-cyan-300"
                />
              </label>
            </div>
            {step.waitConditions && step.waitConditions.length > 0 && (
              <div className="mt-2 rounded-md border border-cyan-300/20 bg-cyan-300/5 p-2 text-[11px] text-cyan-200">
                Reviewable gates:{" "}
                {step.waitConditions
                  .map(
                    (condition) =>
                      `${condition.label} (${condition.approved ? "approved" : "needs approval"})`,
                  )
                  .join(", ")}
              </div>
            )}
            <label className="mt-2 block text-[11px] text-slate-500">
              Post-action OCR success text (optional)
              <Input
                className="mt-1"
                value={
                  step.adaptive?.verification?.kind === "text-present"
                    ? step.adaptive.verification.text ?? ""
                    : ""
                }
                onChange={(event) => {
                  const text = event.target.value;
                  updateStep(step.id, {
                    adaptive: {
                      ...step.adaptive,
                      captureBefore: true,
                      verification: text.trim()
                        ? { kind: "text-present", text }
                        : undefined,
                      retry: step.adaptive?.retry ?? {
                        maxAttempts: 2,
                        backoffMs: 500,
                      },
                    },
                  });
                }}
                placeholder="e.g. Saved successfully"
                aria-label={`Step ${step.order} post-action OCR success text`}
              />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {plan.risks[0]?.description ??
            "Review scope and prerequisites before approval."}
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          onClick={onApprove}
          disabled={busy || hasInvalidStep}
          className="flex-1 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
        >
          <Check className="h-4 w-4" /> Approve plan
        </Button>
        <Button
          onClick={onReject}
          disabled={busy}
          variant="outline"
          className="border-white/10 text-slate-300 hover:bg-white/10"
        >
          <X className="h-4 w-4" /> Reject
        </Button>
      </div>
      {hasInvalidStep && (
        <p className="mt-2 text-xs text-amber-300">
          Approval requires an action and all needed coordinates, text, keys, and Android device IDs.
        </p>
      )}
    </div>
  );
}

export function InstructionPlanningPanel() {
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<AssistantPlan>();
  const [sessionId, setSessionId] = useState(
    () => localStorage.getItem("assistant_session_id") ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const importedPlanId = query.get("planId");
    const importedSessionId = query.get("sessionId");
    if (!importedPlanId || !importedSessionId) return;
    let cancelled = false;
    setBusy(true);
    setError("");
    request<{ plan: AssistantPlan }>(
      `/api/assistant/plans/${encodeURIComponent(importedPlanId)}?sessionId=${encodeURIComponent(importedSessionId)}`,
    )
      .then(({ plan: importedPlan }) => {
        if (cancelled) return;
        setSessionId(importedSessionId);
        setInstruction(
          typeof importedPlan.instruction === "string"
            ? importedPlan.instruction
            : importedPlan.instruction?.text ?? importedPlan.goal,
        );
        setPlan(importedPlan);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load the draft plan");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureSession = async () => {
    const id = await ensureAssistantSession({
      project: {
        name: "Research sprint",
        description: "Instruction planning workspace",
      },
      goals: [],
      savedStateIds: [],
    });
    setSessionId(id);
    return id;
  };

  const prepare = async () => {
    setBusy(true);
    setError("");
    try {
      const id = await ensureSession();
      const response = await request<{ plan: AssistantPlan }>(
        "/api/assistant/plans",
        {
          method: "POST",
          body: JSON.stringify({ sessionId: id, instructionText: instruction }),
        },
      );
      setPlan(response.plan);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not prepare plan",
      );
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async (
    nextPlan: AssistantPlan,
    action?: "approve" | "reject",
  ) => {
    setBusy(true);
    setError("");
    try {
      const query = `?sessionId=${encodeURIComponent(nextPlan.sessionId)}`;
      const edited = await request<{ plan: AssistantPlan }>(
        `/api/assistant/plans/${nextPlan.id}${query}`,
        {
          method: "PUT",
          body: JSON.stringify({
            steps: nextPlan.steps,
            timing: nextPlan.timing,
            confidence: nextPlan.confidence,
          }),
        },
      );
      let current = edited.plan;
      if (action) {
        const response = await request<{ plan: AssistantPlan }>(
          `/api/assistant/plans/${current.id}/${action}${query}`,
          {
            method: "POST",
          },
        );
        current = response.plan;
      }
      setPlan(current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save plan");
    } finally {
      setBusy(false);
    }
  };

  const attachCondition = async (
    condition: WaitCondition,
    targetStepId: string,
  ) => {
    if (!plan) return;
    const nextPlan: AssistantPlan = {
      ...plan,
      approvalState: "pending",
      status: "draft",
      steps: plan.steps.map((step) =>
        step.id === targetStepId
          ? {
              ...step,
              waitConditions: [...(step.waitConditions ?? []), condition],
              status: "edited",
            }
          : step,
      ),
    };
    setPlan(nextPlan);
    await savePlan(nextPlan);
  };

  return (
    <div className="mt-5">
      <InstructionComposer
        instruction={instruction}
        onInstructionChange={setInstruction}
        onSubmit={prepare}
        busy={busy}
      />
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      {plan && (
        <>
          <PlanReview
            plan={plan}
            onChange={setPlan}
            onApprove={() => void savePlan(plan, "approve")}
            onReject={() => void savePlan(plan, "reject")}
            onRegenerate={prepare}
            busy={busy}
          />
          {plan.approvalState === "approved" && (
            <ExecutionControlPanel plan={plan} />
          )}
          <WaitConditionPanel
            sessionId={plan.sessionId}
            steps={plan.steps}
            onConditionCreated={(condition, targetStepId) =>
              void attachCondition(condition, targetStepId)
            }
          />
        </>
      )}
    </div>
  );
}
