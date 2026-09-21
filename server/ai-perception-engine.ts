/**
 * AI #1: Qwen Vision Perception & Feedback Positioning Engine
 * Inspects live screenshots to generate structured screen auto-descriptions,
 * detects UI elements with precise (X,Y,W,H) bounding boxes, and provides focus positioning.
 */

import { resolveAiEndpoint } from "./ai-endpoint";
import { detectScreenElementsAndSteps } from "./ai-gemini-service";
import type { AiMonitorBrowserContext } from "./ai-monitor-store";

export interface DetectedUIElement {
  id: string;
  name: string;
  type:
    | "button"
    | "input"
    | "icon"
    | "text"
    | "toggle"
    | "captcha"
    | "target"
    | "dialog"
    | "checkbox"
    | "other";
  boundingBox: { x: number; y: number; width: number; height: number };
  center: { x: number; y: number };
  confidence: number;
  interactive: boolean;
  textValue?: string;
}

export interface ScreenPerceptionReport {
  timestamp: number;
  screenDescription: string;
  activeWindow: string;
  visualStateChange: string;
  elements: DetectedUIElement[];
  feedbackPosition: { x: number; y: number };
  primarySuggestion: string;
  confidence: number;
  rawAnalysis?: string;
  degraded?: boolean;
  error?: string;
}

export function resolveAIEndpoint(candidate?: string): URL {
  const configured = process.env.OLLAMA_ENDPOINT;
  if (!configured) {
    throw new Error(
      "OLLAMA_ENDPOINT must be configured before screen frames are sent to a vision provider",
    );
  }
  const selected = process.env.ALLOW_CUSTOM_AI_ENDPOINTS === "true" && candidate
    ? candidate
    : configured;
  let selectedUrl: URL;
  try {
    selectedUrl = new URL(selected);
  } catch {
    throw new Error("The configured AI endpoint is not a valid URL");
  }
  if (!new Set(["http:", "https:"]).has(selectedUrl.protocol)) {
    throw new Error("AI endpoint must use HTTP or HTTPS");
  }
  if (selected !== configured) {
    const allowed = [
      configured,
      ...(process.env.AI_ENDPOINT_ALLOWLIST ?? "").split(","),
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value, index) => {
        try {
          return new URL(value).href;
        } catch {
          throw new Error(`Invalid AI endpoint allowlist entry at index ${index}`);
        }
      });
    if (!allowed.includes(selectedUrl.href)) {
      throw new Error("The requested AI endpoint is not in the server-side allowlist");
    }
  }
  return selectedUrl;
}

function createAnalysisSignal(parent?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error("Vision analysis timed out")),
    30_000,
  );
  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

export class QwenVisionPerceptionEngine {
  private lastDescription = "";
  private lastImageHash = "";

  async analyzeScreen(
    imageData: string,
    endpoint?: string,
    model = "qwen2.5vl:7b",
    browserContext?: AiMonitorBrowserContext | null,
    signal?: AbortSignal,
  ): Promise<ScreenPerceptionReport> {
    const resolvedEndpoint = resolveAiEndpoint(endpoint);
    if (!resolvedEndpoint) {
      // No remote vision endpoint configured: use the app's local AI provider
      // instead of failing against a hardcoded host.
      return this.analyzeWithLocalProvider(imageData, browserContext);
    }

    const base64Image = imageData.includes(",")
      ? imageData.split(",")[1]
      : imageData;

    const systemPrompt = `You are an expert Computer Vision Perception AI specialized in GUI and Game Automation.
Analyze the provided screenshot with high precision.
Return a STRICT valid JSON object matching this schema:
{
  "screenDescription": "Concise summary of what is currently displayed on the screen, active dialogs, and current view",
  "activeWindow": "Name or title of the main application/window in focus",
  "visualStateChange": "Notable state changes observed (e.g., modal opened, button active, input focused, page loaded, captcha prompt)",
  "feedbackPosition": { "x": 960, "y": 540 },
  "primarySuggestion": "Immediate recommended visual focus or next action candidate",
  "confidence": 0.95,
  "elements": [
    {
      "id": "elem_1",
      "name": "Submit Button",
      "type": "button",
      "boundingBox": { "x": 800, "y": 600, "width": 120, "height": 40 },
      "center": { "x": 860, "y": 620 },
      "confidence": 0.92,
      "interactive": true,
      "textValue": "Submit"
    }
  ]
}
IMPORTANT: Output ONLY the raw JSON without markdown formatting or code blocks. Coordinates must be based on a standard 1920x1080 resolution.`;

    const browserSection = this.describeBrowserContext(browserContext);
    const systemPromptWithBrowser = browserSection
      ? `${systemPrompt}\n\n${browserSection}`
      : systemPrompt;

    try {
      const endpointUrl = resolveAIEndpoint(resolvedEndpoint);
      const payload = {
        model,
        messages: [
          { role: "system", content: systemPromptWithBrowser },
          {
            role: "user",
            content:
              "Perform complete visual breakdown of this screen, identify all interactive UI elements with bounding boxes and coordinates, and suggest the key visual focus point.",
            images: [base64Image],
          },
        ],
        stream: false,
        format: "json",
      };

      const requestSignal = createAnalysisSignal(signal);
      let response: Response;
      let data: any;
      try {
        response = await fetch(endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: requestSignal.signal,
        });
        if (!response.ok) {
          throw new Error(`Ollama Vision API returned ${response.statusText}`);
        }
        data = await response.json();
      } finally {
        requestSignal.cleanup();
      }
      const providerContent = data.message?.content;
      const normalizedContent =
        typeof providerContent === "string" ? providerContent.trim() : "";
      const contentMissing = !normalizedContent || normalizedContent === "{}";
      const rawContent = normalizedContent || "{}";

      let parsed: any;
      let parsedFailed = contentMissing;
      try {
        const cleaned = rawContent
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
        if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) {
          parsedFailed = true;
        }
      } catch (parseErr) {
        parsedFailed = true;
        console.warn(
          "Failed to parse vision JSON; returning a degraded report",
          parseErr,
        );
      }

      if (parsedFailed) {
        const error = contentMissing
          ? "Vision returned an empty analysis payload"
          : `Vision returned invalid JSON (${rawContent.length} characters)`;
        return { ...this.generateFallbackReport(error), rawAnalysis: rawContent };
      }

      const report: ScreenPerceptionReport = {
        timestamp: Date.now(),
        screenDescription:
          parsed.screenDescription ||
          "Active workspace display with interactive elements.",
        activeWindow: parsed.activeWindow || "Main Application",
        visualStateChange:
          parsed.visualStateChange ||
          (this.lastDescription ? "State updated" : "Initial frame"),
        elements: this.mergeBrowserElements(
          Array.isArray(parsed.elements) && parsed.elements.length > 0
            ? parsed.elements.map((el: any, idx: number) => ({
                id: el.id || `elem_${idx + 1}`,
                name: el.name || `Element ${idx + 1}`,
                type: el.type || "button",
                boundingBox: el.boundingBox || {
                  x: el.center?.x || 960,
                  y: el.center?.y || 540,
                  width: 80,
                  height: 35,
                },
                center: el.center || { x: 960, y: 540 },
                confidence:
                  typeof el.confidence === "number" ? el.confidence : 0.85,
                interactive: el.interactive !== false,
                textValue: el.textValue || "",
              }))
            : [],
          browserContext,
        ),
        feedbackPosition: parsed.feedbackPosition || { x: 960, y: 540 },
        primarySuggestion:
          parsed.primarySuggestion ||
          "Inspect interactive targets and execute planned sequence.",
        confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : 0.88,
        rawAnalysis: rawContent,
        degraded: false,
      };

      this.lastDescription = report.screenDescription;
      return report;
    } catch (err) {
      console.warn(
        "Qwen Vision perception failed, providing structured fallback:",
        err,
      );
      return this.generateFallbackReport(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /**
   * Perception via the app's configured AI provider (Gemini). Falls back to the
   * heuristic report internally when no API key is configured.
   */
  private async analyzeWithLocalProvider(
    imageData: string,
    browserContext?: AiMonitorBrowserContext | null,
  ): Promise<ScreenPerceptionReport> {
    const analysis = await detectScreenElementsAndSteps({ imageData });

    const elements: DetectedUIElement[] = (analysis.elements || []).map(
      (el, idx) => ({
        id: el.id || `elem_${idx + 1}`,
        name: el.name || `Element ${idx + 1}`,
        type: this.normalizeElementType(el.type),
        boundingBox: {
          x: el.x,
          y: el.y,
          width: el.width || 80,
          height: el.height || 35,
        },
        center: { x: el.x, y: el.y },
        confidence:
          typeof el.confidence === "number" ? el.confidence : 0.85,
        interactive: true,
        textValue: el.suggestedTextPayload || "",
      }),
    );

    const focus = analysis.primaryActionTarget;
    const page = browserContext?.page;
    const report: ScreenPerceptionReport = {
      timestamp: Date.now(),
      screenDescription:
        this.describePage(browserContext) ||
        analysis.summary ||
        "Active workspace display with interactive elements.",
      activeWindow:
        page?.title || browserContext?.activeTab?.title || "Active Application",
      visualStateChange: this.lastDescription ? "State updated" : "Initial frame",
      elements: this.mergeBrowserElements(
        elements.length > 0 ? elements : this.generateDefaultElements(),
        browserContext,
      ),
      feedbackPosition: focus
        ? { x: focus.x, y: focus.y }
        : { x: 960, y: 540 },
      primarySuggestion: focus?.label
        ? `Focus ${focus.label}`
        : "Inspect interactive targets and execute planned sequence.",
      confidence: 0.85,
    };

    this.lastDescription = report.screenDescription;
    return report;
  }

  /**
   * Builds the prompt section describing the live browser tabs and page
   * elements, so the model interprets the web page rather than only pixels.
   */
  private describeBrowserContext(
    browserContext?: AiMonitorBrowserContext | null,
  ): string {
    if (!browserContext) return "";
    const { page, tabs, elements } = browserContext;
    const lines: string[] = [
      "BROWSER CONTEXT (authoritative, captured from the live page):",
      `- Active tab: "${page?.title || browserContext.activeTab?.title || "unknown"}" at ${page?.url || browserContext.activeTab?.url || "unknown"}`,
      `- Viewport: ${page?.viewport ? `${page.viewport.width}x${page.viewport.height}` : "unknown"}`,
    ];
    if (tabs.length > 1) {
      lines.push(
        `- Open tabs (${tabs.length}): ${tabs
          .slice(0, 10)
          .map((t) => `"${t.title}"`)
          .join(", ")}`,
      );
    }
    if (elements.length > 0) {
      lines.push(
        `- Page elements (${elements.length}, coordinates are page-relative):`,
        ...elements
          .slice(0, 40)
          .map(
            (el) =>
              `  • ${el.name} [${el.type}] selector="${el.selector || "n/a"}" center=(${el.x}, ${el.y}) size=${el.width}x${el.height}`,
          ),
      );
      lines.push(
        "Prefer these page elements over visually guessed ones, and reuse their names and coordinates in your JSON output.",
      );
    }
    return lines.join("\n");
  }

  private describePage(
    browserContext?: AiMonitorBrowserContext | null,
  ): string {
    if (!browserContext) return "";
    const title = browserContext.page?.title || browserContext.activeTab?.title;
    const url = browserContext.page?.url || browserContext.activeTab?.url;
    if (!title && !url) return "";
    return `Browser tab "${title || url}"${url ? ` (${url})` : ""} with ${browserContext.elements.length} interactive page element(s).`;
  }

  /** Puts exact DOM elements from the live page in front of visually detected ones. */
  private mergeBrowserElements(
    visionElements: DetectedUIElement[],
    browserContext?: AiMonitorBrowserContext | null,
  ): DetectedUIElement[] {
    if (!browserContext || browserContext.elements.length === 0) {
      return visionElements;
    }

    const domElements: DetectedUIElement[] = browserContext.elements.map(
      (el) => ({
        id: el.id,
        name: el.name,
        type: this.normalizeElementType(el.type),
        boundingBox: {
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
        },
        center: { x: el.x, y: el.y },
        confidence: el.confidence,
        interactive: el.interactive,
        textValue: el.textValue || "",
      }),
    );

    const domNames = new Set(domElements.map((el) => el.name.toLowerCase()));
    const extras = visionElements.filter(
      (el) => !domNames.has(el.name.toLowerCase()),
    );

    return [...domElements, ...extras].slice(0, 80);
  }

  private normalizeElementType(type: string): DetectedUIElement["type"] {
    switch (type) {
      case "button":
      case "input":
      case "icon":
      case "text":
      case "toggle":
      case "checkbox":
        return type;
      case "tab":
      case "link":
        return "button";
      case "dropdown":
      case "scroll_area":
        return "input";
      default:
        return "other";
    }
  }

  private fallbackExtraction(raw: string): any {
    return {
      screenDescription: raw.slice(0, 200) || "Active interface detected.",
      activeWindow: "Desktop Window",
      visualStateChange: "Screen refreshed",
      feedbackPosition: { x: 960, y: 540 },
      primarySuggestion: "Proceed with UI interaction",
      confidence: 0.75,
      elements: this.generateDefaultElements(),
    };
  }

  private generateDefaultElements(): DetectedUIElement[] {
    return [
      {
        id: "elem_center",
        name: "Primary Screen Center",
        type: "target",
        boundingBox: { x: 920, y: 500, width: 80, height: 80 },
        center: { x: 960, y: 540 },
        confidence: 0.9,
        interactive: true,
        textValue: "Focus Area",
      },
    ];
  }

  private generateFallbackReport(errorMsg: string): ScreenPerceptionReport {
    return {
      timestamp: Date.now(),
      screenDescription: "Vision provider unavailable; the screen has not been interpreted.",
      activeWindow: "Unknown",
      visualStateChange: "Unverified",
      elements: [],
      feedbackPosition: { x: 960, y: 540 },
      primarySuggestion: "Reconnect vision or use explicitly reviewed coordinates.",
      confidence: 0,
      degraded: true,
      error: errorMsg,
    };
  }
}

export const qwenVisionEngine = new QwenVisionPerceptionEngine();
