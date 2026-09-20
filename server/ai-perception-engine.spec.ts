import { afterEach, describe, expect, it } from "vitest";
import { resolveAIEndpoint } from "./ai-perception-engine";

const originalEnvironment = {
  endpoint: process.env.OLLAMA_ENDPOINT,
  allowCustom: process.env.ALLOW_CUSTOM_AI_ENDPOINTS,
  allowlist: process.env.AI_ENDPOINT_ALLOWLIST,
};

afterEach(() => {
  for (const [name, value] of Object.entries({
    OLLAMA_ENDPOINT: originalEnvironment.endpoint,
    ALLOW_CUSTOM_AI_ENDPOINTS: originalEnvironment.allowCustom,
    AI_ENDPOINT_ALLOWLIST: originalEnvironment.allowlist,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("AI endpoint resolution", () => {
  it("requires an explicitly configured provider endpoint", () => {
    delete process.env.OLLAMA_ENDPOINT;
    expect(() => resolveAIEndpoint()).toThrow("must be configured");
  });

  it("rejects non-HTTP providers and malformed allowlist entries", () => {
    process.env.OLLAMA_ENDPOINT = "file:///tmp/provider";
    expect(() => resolveAIEndpoint()).toThrow("HTTP or HTTPS");

    process.env.OLLAMA_ENDPOINT = "https://vision.example.test/api/chat";
    process.env.ALLOW_CUSTOM_AI_ENDPOINTS = "true";
    process.env.AI_ENDPOINT_ALLOWLIST = "not-a-url";
    expect(() => resolveAIEndpoint("https://planner.example.test/api/chat")).toThrow(
      "allowlist entry",
    );
  });

  it("rejects request-provided endpoints that are not server allowlisted", () => {
    process.env.OLLAMA_ENDPOINT = "https://vision.example.test/api/chat";
    process.env.ALLOW_CUSTOM_AI_ENDPOINTS = "true";
    delete process.env.AI_ENDPOINT_ALLOWLIST;

    expect(() => resolveAIEndpoint("http://127.0.0.1:8080/private")).toThrow(
      "server-side allowlist",
    );
  });

  it("accepts an exact endpoint configured in the server allowlist", () => {
    process.env.OLLAMA_ENDPOINT = "https://vision.example.test/api/chat";
    process.env.ALLOW_CUSTOM_AI_ENDPOINTS = "true";
    process.env.AI_ENDPOINT_ALLOWLIST = "https://planner.example.test/api/chat";

    expect(resolveAIEndpoint("https://planner.example.test/api/chat").href).toBe(
      "https://planner.example.test/api/chat",
    );
  });

  it("ignores request-provided endpoints when custom endpoints are disabled", () => {
    process.env.OLLAMA_ENDPOINT = "https://vision.example.test/api/chat";
    delete process.env.ALLOW_CUSTOM_AI_ENDPOINTS;
    process.env.AI_ENDPOINT_ALLOWLIST = "https://planner.example.test/api/chat";

    expect(resolveAIEndpoint("https://planner.example.test/api/chat").href).toBe(
      "https://vision.example.test/api/chat",
    );
  });
});
