/**
 * Resolves the Ollama-compatible vision and chat endpoint used by the AI
 * perception, planner, and copilot engines.
 *
 * Configured Default:
 * URL: http://192.168.1.100:11434/api/chat
 * Model: qwen3.5:2b
 */

import { centralLogHub } from "./log-hub";

export const DEFAULT_OLLAMA_ENDPOINT = "http://192.168.1.100:11434/api/chat";
export const DEFAULT_QWEN_MODEL = "qwen3.5:2b";

export function resolveAiEndpoint(provided?: string | null): string {
  const endpoint = (provided ?? process.env.OLLAMA_ENDPOINT ?? "").trim();
  if (endpoint.length > 0) {
    if (endpoint.endsWith("/api/chat") || endpoint.endsWith("/api/generate")) {
      return endpoint;
    }
    return endpoint.endsWith("/") ? `${endpoint}api/chat` : `${endpoint}/api/chat`;
  }
  return DEFAULT_OLLAMA_ENDPOINT;
}

export function resolveAiModel(providedModel?: string | null): string {
  const model = (providedModel ?? process.env.OLLAMA_MODEL ?? "").trim();
  return model.length > 0 ? model : DEFAULT_QWEN_MODEL;
}

export interface QwenChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  images?: string[];
}

/**
 * Dispatches chat request to Qwen Ollama instance (http://192.168.1.100:11434/api/chat)
 */
export async function sendQwenChatRequest(
  messages: QwenChatMessage[],
  options?: {
    endpoint?: string;
    model?: string;
    format?: "json";
    timeoutMs?: number;
  }
): Promise<{ success: boolean; content: string; raw?: any; error?: string }> {
  const targetUrl = resolveAiEndpoint(options?.endpoint);
  const targetModel = resolveAiModel(options?.model);
  const timeoutMs = options?.timeoutMs || 25000;

  const payload: Record<string, any> = {
    model: targetModel,
    messages,
    stream: false,
  };

  if (options?.format === "json") {
    payload.format = "json";
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Qwen HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data?.message?.content || data?.response || "";

    centralLogHub.addLog(
      "Qwen Vision",
      "SUCCESS",
      `Qwen response received (${targetModel} @ ${targetUrl})`,
      { model: targetModel, promptLength: messages.length, contentLength: content.length }
    );

    return {
      success: true,
      content,
      raw: data,
    };
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    centralLogHub.addLog(
      "Qwen Vision",
      "WARN",
      `Qwen endpoint connection warning (${targetUrl}): ${errorMsg}`,
      { model: targetModel, error: errorMsg }
    );

    return {
      success: false,
      content: "",
      error: errorMsg,
    };
  }
}
