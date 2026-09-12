import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";

let genAiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!genAiClient) {
    genAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAiClient;
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function ensureUnderWordLimit(text: string, limit: number = 20): { text: string; wordCount: number } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return { text: text.trim(), wordCount: words.length };
  }
  const truncated = words.slice(0, limit).join(" ");
  // Ensure clean trailing punctuation
  const cleaned = truncated.replace(/[,;:\-\s]+$/, "") + ".";
  return { text: cleaned, wordCount: countWords(cleaned) };
}

export interface RefinedResult {
  refinedDescription: string;
  wordCount: number;
  keyPropositions: string[];
  rationale: string;
  variations: Array<{ text: string; wordCount: number; style: string }>;
  originalWordCount: number;
  source: "gemini" | "heuristic-engine";
}

/**
 * Heuristic NLP fallback to refine rough descriptions when Gemini API is offline or key is absent.
 */
export function heuristicRefineDescription(
  rawText: string,
  targetLimit: number = 20,
  tone: string = "high-impact"
): RefinedResult {
  const cleanRaw = rawText.trim();
  const originalWordCount = countWords(cleanRaw);

  // Common fluff prefixes to strip
  const fluffPatterns = [
    /^this is (an? )?(comprehensive |all-in-one |powerful |modern |simple |intuitive )?(app|application|platform|tool|system|service|project) (designed to|built to|aimed at|created for|used to|that helps to|that allows users to|which allows users to)/i,
    /^(this (app|application|platform|tool|system|service|project) is (designed to|built to|aimed at|created for|used to))/i,
    /^(an? (all-in-one|comprehensive|complete|intuitive|powerful|modern|simple) (app|platform|tool|solution) (that|which|to))/i,
    /^(we have created|we are building|our app is|this is basically|a tool that allows (users|teams) to)/i,
    /^(allows (users|teams|people) to)/i,
    /^(helps (users|teams|people) (to )?)/i,
    /^(designed to help (users|teams|people) (to )?)/i,
  ];

  let stripped = cleanRaw;
  for (const pattern of fluffPatterns) {
    stripped = stripped.replace(pattern, "").trim();
  }
  // Capitalize first character
  if (stripped.length > 0) {
    stripped = stripped.charAt(0).toUpperCase() + stripped.slice(1);
  }

  // Value proposition extraction
  const lower = cleanRaw.toLowerCase();
  const props: string[] = [];

  if (lower.includes("vision") || lower.includes("perception") || lower.includes("detect") || lower.includes("camera") || lower.includes("screen")) {
    props.push("Computer Vision & Screen Perception");
  }
  if (lower.includes("automat") || lower.includes("bot") || lower.includes("agent") || lower.includes("workflow") || lower.includes("orchestrat")) {
    props.push("Autonomous Task Automation");
  }
  if (lower.includes("game") || lower.includes("player") || lower.includes("hud") || lower.includes("movement")) {
    props.push("Adaptive Game & Input Controls");
  }
  if (lower.includes("ai") || lower.includes("model") || lower.includes("reasoning") || lower.includes("gemini")) {
    props.push("Intelligent Multi-Modal Reasoning");
  }
  if (lower.includes("track") || lower.includes("monitor") || lower.includes("log") || lower.includes("analytics")) {
    props.push("Real-Time Tracking & Telemetry");
  }
  if (props.length === 0) {
    props.push("Core Workflow Optimization", "Streamlined Task Execution");
  }

  // Build variations
  let baseSentence = stripped;
  const sentenceEndMatch = baseSentence.match(/^([^.!?]+[.!?])/);
  if (sentenceEndMatch && countWords(sentenceEndMatch[1]) <= targetLimit && countWords(sentenceEndMatch[1]) >= 6) {
    baseSentence = sentenceEndMatch[1].trim();
  }

  const bounded = ensureUnderWordLimit(baseSentence, targetLimit);

  // Variation 1: Direct Action-oriented
  const actionVariationText = ensureUnderWordLimit(
    `${props[0] || "Automates workflows"} with ${props[1] || "intelligent controls"} and precision execution.`,
    targetLimit
  );

  // Variation 2: Outcome-oriented
  const outcomeVariationText = ensureUnderWordLimit(
    `High-performance platform delivering ${props.slice(0, 2).join(" and ")} in unified real-time workflows.`,
    targetLimit
  );

  return {
    refinedDescription: bounded.text,
    wordCount: bounded.wordCount,
    keyPropositions: props.slice(0, 3),
    rationale: `Removed introductory fillers, consolidated core action verbs, and distilled key value propositions strictly under ${targetLimit} words.`,
    variations: [
      { text: actionVariationText.text, wordCount: actionVariationText.wordCount, style: "Action-Driven" },
      { text: outcomeVariationText.text, wordCount: outcomeVariationText.wordCount, style: "Outcome-Focused" },
    ],
    originalWordCount,
    source: "heuristic-engine",
  };
}

export async function handleRefineDescription(req: Request, res: Response) {
  try {
    const { description, targetWords = 20, tone = "high-impact" } = req.body;

    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({
        success: false,
        error: "A valid 'description' string is required.",
      });
    }

    const rawText = description.trim();
    const wordLimit = Math.min(Math.max(Number(targetWords) || 20, 5), 20); // strictly capped at 20 words
    const originalWordCount = countWords(rawText);

    const client = getGenAiClient();

    if (client) {
      try {
        const prompt = `You are an elite product copywriter and app store strategist.
Rewrite the following rough app description into a punchy, crystal-clear description that is STRICTLY UNDER ${wordLimit} WORDS (ideally 10 to 18 words).
It MUST maintain the application's core value propositions, target audience, and primary functionality without marketing fluff.

Rough app description:
"${rawText}"

Tone: ${tone}
Strict constraints:
1. Output MUST be strictly under ${wordLimit} words. NEVER exceed ${wordLimit} words.
2. Maintain core value propositions accurately.
3. Eliminate fillers like "this app allows you to" or "a tool that helps".

Respond ONLY with a valid JSON object matching this exact TypeScript structure:
{
  "refinedDescription": "string (strictly <= ${wordLimit} words)",
  "keyPropositions": ["string", "string"],
  "rationale": "string (brief note on how value was preserved)",
  "variations": [
    { "text": "string (strictly <= ${wordLimit} words)", "style": "Action-Driven" },
    { "text": "string (strictly <= ${wordLimit} words)", "style": "Minimalist" }
  ]
}`;

        const response = await client.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        });

        const responseText = response.text?.trim();
        if (responseText) {
          const parsed = JSON.parse(responseText);
          const safeRefined = ensureUnderWordLimit(parsed.refinedDescription || rawText, wordLimit);
          const safeVariations = (Array.isArray(parsed.variations) ? parsed.variations : []).map((v: any) => {
            const safe = ensureUnderWordLimit(v.text || "", wordLimit);
            return {
              text: safe.text,
              wordCount: safe.wordCount,
              style: v.style || "Alternative",
            };
          });

          return res.json({
            success: true,
            refinedDescription: safeRefined.text,
            wordCount: safeRefined.wordCount,
            keyPropositions: Array.isArray(parsed.keyPropositions) ? parsed.keyPropositions : ["Core Automation", "Vision Hub"],
            rationale: parsed.rationale || `Refined to ${safeRefined.wordCount} words while preserving key capabilities.`,
            variations: safeVariations,
            originalWordCount,
            source: "gemini",
          });
        }
      } catch (geminiError) {
        console.warn("[Description Refiner] Gemini API error, falling back to heuristic engine:", geminiError);
      }
    }

    // Heuristic fallback
    const result = heuristicRefineDescription(rawText, wordLimit, tone);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Description Refiner] Error refining description:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error refining description",
      details: String(error),
    });
  }
}

export function handleGetSamplePresets(_req: Request, res: Response) {
  res.json({
    success: true,
    presets: [
      {
        title: "Current App: DroidVision & Master Orchestrator",
        rough: "Unified AI Automation Master Platform — Autonomous Automation & Vision Control Hub with Master Workflow Orchestrator for real-time game perception and screen controls.",
      },
      {
        title: "Cloud Infrastructure Monitor",
        rough: "This is a comprehensive devops dashboard that helps engineers monitor their cloud clusters, detect anomalous resource spikes across Kubernetes pods, and automatically trigger safe auto-scaling policies.",
      },
      {
        title: "Collaborative Whiteboard",
        rough: "An all-in-one infinite canvas tool where distributed remote product designers and software engineers can brainstorm system architectures, draw wireframes together in real time, and export production assets.",
      },
      {
        title: "AI Personal Finance Assistant",
        rough: "Basically an app designed to track all your daily credit card spending and bank accounts, categorize transactions using artificial intelligence, and send helpful alerts when you are close to exceeding your monthly budget.",
      },
      {
        title: "Autonomous Game Vision Agent",
        rough: "A deep learning neural perception engine that captures desktop video frames, analyzes minimap and player coordinates, and computes safe cubic-spline mouse movements to automate repetitive gaming tasks.",
      },
    ],
  });
}
