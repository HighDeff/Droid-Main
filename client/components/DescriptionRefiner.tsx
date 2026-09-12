import { useState, useEffect } from "react";
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Wand2,
  FileText,
  Sliders,
  Flame,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Hash,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

interface Variation {
  text: string;
  wordCount: number;
  style: string;
}

interface RefineResponse {
  success: boolean;
  refinedDescription: string;
  wordCount: number;
  keyPropositions: string[];
  rationale: string;
  variations: Variation[];
  originalWordCount: number;
  source: "gemini" | "heuristic-engine";
  error?: string;
}

const SAMPLE_PRESETS = [
  {
    title: "AI Game Automation (Current App)",
    rough:
      "This is a unified AI automation master platform and game vision control hub with autonomous screen perception, real pyautogui mouse movements, and master workflow orchestrator for cross-platform desktop and mobile games.",
  },
  {
    title: "Cloud Infrastructure Monitor",
    rough:
      "An all-in-one devops observability platform that helps engineering teams track Kubernetes clusters, detect anomalous memory spikes across microservices in real-time, and execute automated rollback procedures before outages happen.",
  },
  {
    title: "Infinite Collaborative Canvas",
    rough:
      "We have built a digital whiteboard tool designed to allow remote cross-functional product designers and engineers to brainstorm system architectures, draw intuitive flowcharts collaboratively, and export diagrams directly into GitHub code repositories.",
  },
  {
    title: "Personal AI Finance Manager",
    rough:
      "Basically an application designed to help everyday consumers connect multiple bank accounts, automatically categorize monthly transactions using machine learning, and deliver smart alerts to prevent overspending on subscriptions.",
  },
];

export function DescriptionRefiner({
  onApplyDescription,
}: {
  onApplyDescription?: (desc: string) => void;
}) {
  const [roughText, setRoughText] = useState(
    "This is a unified AI automation master platform and game vision control hub with autonomous screen perception, real pyautogui mouse movements, and master workflow orchestrator for cross-platform desktop and mobile games."
  );
  const [targetWordLimit, setTargetWordLimit] = useState<number>(20);
  const [tone, setTone] = useState<"high-impact" | "technical" | "minimalist" | "marketing">("high-impact");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [result, setResult] = useState<RefineResponse | null>(null);
  const [history, setHistory] = useState<RefineResponse[]>([]);

  // Calculate live words of input
  const countInputWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const inputWords = countInputWords(roughText);

  const handleRefine = async (customText?: string) => {
    const textToRefine = (customText ?? roughText).trim();
    if (!textToRefine) {
      toast.error("Please enter a rough description first.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/ai/refine-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: textToRefine,
          targetWords: targetWordLimit,
          tone,
        }),
      });

      const data: RefineResponse = await response.json();

      if (data.success) {
        setResult(data);
        setHistory((prev) => [data, ...prev.filter((item) => item.refinedDescription !== data.refinedDescription)].slice(0, 5));
        toast.success(`Refined down to ${data.wordCount} words (Under 20-word limit)!`);
      } else {
        toast.error(data.error || "Failed to refine description");
      }
    } catch (err: any) {
      toast.error("Error communicating with server: " + (err.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Run refinement on initial mount so user sees immediate results
  useEffect(() => {
    handleRefine();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = (text: string) => {
    if (onApplyDescription) {
      onApplyDescription(text);
    }
    toast.success("Applied refined description to application context!");
  };

  const currentWords = result ? result.wordCount : 0;
  const isStrictlyUnder20 = currentWords <= 20;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-inner">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Description Refiner
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700">
                  Strict &lt; 20 Words
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl font-mono">
              Transforms rambling rough descriptions and feature dumps into punchy, high-impact summaries
              under 20 words while rigorously preserving core value propositions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Target Word Limit</span>
              <span className="text-sm font-bold font-mono text-emerald-400">
                &le; {targetWordLimit} Words
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Pills */}
      <div className="space-y-2">
        <label className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          QUICK PRESETS (LOAD ROUGH PITCHES)
        </label>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setRoughText(preset.rough);
                handleRefine(preset.rough);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-900/90 border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-800/90 text-slate-300 hover:text-white transition-all text-left flex items-center gap-1.5 shadow-sm"
            >
              <FileText className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>{preset.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input and Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Rough Input & Controls */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="bg-slate-900/90 border-slate-800 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Rough App Description
                </CardTitle>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className={`px-2 py-0.5 rounded font-bold ${inputWords > 20 ? "bg-amber-950 text-amber-300 border border-amber-800" : "bg-slate-800 text-slate-300"}`}>
                    {inputWords} words
                  </span>
                  <span className="text-slate-300">{roughText.length} chars</span>
                </div>
              </div>
              <CardDescription className="text-xs text-slate-300">
                Paste your unedited feature notes, marketing ideas, or product overview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={roughText}
                onChange={(e) => setRoughText(e.target.value)}
                rows={5}
                placeholder="Enter rough, long, or unpolished app description here..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm font-mono text-slate-100 placeholder:text-slate-600 outline-none resize-none transition-all leading-relaxed"
              />

              {/* Controls bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1.5 font-bold">
                    Tone / Archetype
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-cyan-500 outline-none"
                  >
                    <option value="high-impact">High-Impact (Punchy & Direct)</option>
                    <option value="technical">Technical (Architecture & Stack)</option>
                    <option value="minimalist">Minimalist (Essential Core)</option>
                    <option value="marketing">Product Store (Outcome & Value)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1.5 font-bold">
                    Strict Word Ceiling
                  </label>
                  <div className="flex gap-1.5">
                    {[12, 16, 20].map((limit) => (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => setTargetWordLimit(limit)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                          targetWordLimit === limit
                            ? "bg-cyan-600 text-white border-cyan-400 shadow-sm"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        &le; {limit}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={() => handleRefine()}
                  disabled={isLoading || !roughText.trim()}
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-bold text-xs h-10 shadow-lg shadow-cyan-900/20 gap-2"
                >
                  {isLoading ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      Synthesizing Value Propositions...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 text-amber-300" />
                      Refine Under 20 Words
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRoughText("");
                    setResult(null);
                  }}
                  className="h-10 px-3 bg-slate-950 border-slate-800 text-slate-400 hover:text-white font-mono text-xs"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Refined Output & Value Propositions */}
        <div className="lg:col-span-6 space-y-4">
          {result ? (
            <Card className="bg-slate-900/90 border-slate-800 shadow-xl relative overflow-hidden">
              {/* Highlight ribbon */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-blue-500" />

              <CardHeader className="pb-3 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Refined Description
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm ${
                        isStrictlyUnder20
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                          : "bg-red-950 text-red-300 border border-red-700"
                      }`}
                    >
                      <Hash className="w-3 h-3" />
                      {result.wordCount} / {targetWordLimit} WORDS
                    </span>
                    <span className="px-2 py-1 rounded text-[10px] font-mono uppercase bg-slate-950 text-slate-400 border border-slate-800">
                      {result.source === "gemini" ? "Gemini 3.8 Flash" : "NLP Heuristic"}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Main Refined Output Box */}
                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 shadow-inner space-y-3">
                  <p className="text-base font-semibold text-white tracking-wide leading-relaxed selection:bg-cyan-500 selection:text-black">
                    "{result.refinedDescription}"
                  </p>

                  {/* Word-by-word visual chips */}
                  <div className="pt-2 border-t border-slate-900 flex flex-wrap gap-1">
                    {result.refinedDescription
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((word, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-300 border border-slate-800"
                        >
                          <span className="text-slate-600 mr-1">{idx + 1}</span>
                          {word}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Reduction metrics bar */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-300 block uppercase">Original</span>
                    <span className="text-sm font-bold text-slate-300">{result.originalWordCount} words</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-300 block uppercase">Refined</span>
                    <span className="text-sm font-bold text-emerald-400">{result.wordCount} words</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-300 block uppercase">Reduction</span>
                    <span className="text-sm font-bold text-cyan-400">
                      -{Math.max(0, Math.round(((result.originalWordCount - result.wordCount) / (result.originalWordCount || 1)) * 100))}%
                    </span>
                  </div>
                </div>

                {/* Extracted Core Value Propositions */}
                <div className="space-y-2">
                  <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    PRESERVED VALUE PROPOSITIONS
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.keyPropositions.map((prop, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-950/60 text-cyan-200 border border-cyan-800/60 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3 text-cyan-400" />
                        {prop}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Rationale */}
                {result.rationale && (
                  <p className="text-[11px] font-mono text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-300 font-bold">Optimization: </span>
                    {result.rationale}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(result.refinedDescription)}
                    className="flex-1 h-9 bg-slate-950 border-slate-700 hover:bg-slate-800 text-xs font-mono font-bold text-white gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        Copy Description
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => handleApply(result.refinedDescription)}
                    className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-500 text-xs font-mono font-bold text-white gap-1.5 shadow-md shadow-emerald-900/20"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Use as Active Pitch
                  </Button>
                </div>

                {/* Variations */}
                {result.variations && result.variations.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <span className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      ALTERNATIVE VARIATIONS (&le; 20 WORDS)
                    </span>
                    <div className="space-y-2">
                      {result.variations.map((v, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-purple-500/40 transition-all flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                                {v.style}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                {v.wordCount} words
                              </span>
                            </div>
                            <p className="text-xs text-slate-200 font-mono">
                              "{v.text}"
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setResult({
                                ...result,
                                refinedDescription: v.text,
                                wordCount: v.wordCount,
                              });
                              handleCopy(v.text);
                            }}
                            className="h-7 text-xs font-mono text-purple-300 hover:text-white hover:bg-purple-950 px-2"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Use
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900/50 border-dashed border-slate-800 text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-mono font-bold text-slate-300">Ready to Refine</h3>
                <p className="text-xs font-mono text-slate-500 max-w-sm mx-auto">
                  Click "Refine Under 20 Words" to distill your rough input into a concise, high-impact pitch.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default DescriptionRefiner;
