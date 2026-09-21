/**
 * Resolves the optional Ollama-compatible vision endpoint used by the AI
 * perception and planner engines.
 *
 * The endpoint is never hardcoded: it comes from the caller (request body) or
 * from the OLLAMA_ENDPOINT environment variable. When neither is set the
 * engines use their built-in local/heuristic behaviour instead of calling a
 * remote host that may be unreachable.
 */
export function resolveAiEndpoint(provided?: string | null): string | null {
  const endpoint = (provided ?? process.env.OLLAMA_ENDPOINT ?? "").trim();
  return endpoint.length > 0 ? endpoint : null;
}
