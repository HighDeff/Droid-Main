/**
 * Safe API client utilities to guard against HTML 404/500/502 fallbacks,
 * plain-text rate limiting (e.g. "Rate exceeded."), network drops, and JSON parsing syntax errors.
 */

export interface SafeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  [key: string]: any;
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<SafeApiResponse<T>> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options?.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options?.headers,
      },
    });

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      if (contentType.includes("application/json")) {
        try {
          const errJson = await res.json();
          return {
            success: false,
            status: res.status,
            error: errJson.error || errJson.message || `Request failed with status ${res.status}`,
            ...errJson,
          };
        } catch {
          // fallback
        }
      }
      const rawText = await res.text().catch(() => "");
      const cleanMsg = rawText.length < 200 && !rawText.includes("<!doctype") && !rawText.includes("<html")
        ? rawText.trim()
        : `Server responded with HTTP ${res.status}`;
      return {
        success: false,
        status: res.status,
        error: cleanMsg || `Request failed (${res.status})`,
      };
    }

    if (!contentType.includes("application/json")) {
      const text = await res.text().catch(() => "");
      return {
        success: false,
        status: res.status,
        error: text.length < 150 ? text : "Received non-JSON response from server",
      };
    }

    const data = await res.json();
    return {
      success: true,
      status: res.status,
      data,
      ...data,
    };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError";
    const msg = isAbort ? "Request aborted" : err?.message || "Network connection error";
    return {
      success: false,
      error: msg,
    };
  }
}

export async function safePostJson<T = any>(
  url: string,
  body?: any,
  options?: RequestInit
): Promise<SafeApiResponse<T>> {
  return safeFetchJson<T>(url, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...options,
  });
}
