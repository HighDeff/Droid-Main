import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handlePyAutoGUIBridge } from "./pyautogui-bridge";
import { dispatchActionToPython } from "./dual-ai-pipeline";

vi.mock("./dual-ai-pipeline", () => ({
  dispatchActionToPython: vi.fn(async () => ({ success: true, executed: true })),
}));

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];
const originalApplicationAllowlist = process.env.AUTOMATION_APP_ALLOWLIST;

beforeEach(() => {
  delete process.env.AUTOMATION_APP_ALLOWLIST;
  vi.clearAllMocks();
});

afterEach(async () => {
  if (originalApplicationAllowlist === undefined) {
    delete process.env.AUTOMATION_APP_ALLOWLIST;
  } else {
    process.env.AUTOMATION_APP_ALLOWLIST = originalApplicationAllowlist;
  }
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function startApi() {
  const app = express();
  app.use(express.json());
  app.post("/bridge", handlePyAutoGUIBridge);
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  return async (body: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}/bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { response, body: await response.json() };
  };
}

describe("PyAutoGUI bridge validation", () => {
  it("rejects application launch unless the server allowlists a name", async () => {
    const request = await startApi();
    const result = await request({ approved: true, action: "launch_app", launchApp: "calculator" });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("server-side allowlist");
  });

  it("returns validation errors for malformed action entries", async () => {
    const request = await startApi();
    const result = await request({ approved: true, actions: [null] });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("missing or unsupported");
  });

  it("does not discard supplied actions when an allowlisted app is also launched", async () => {
    process.env.AUTOMATION_APP_ALLOWLIST = JSON.stringify({ calculator: "/bin/true" });
    const request = await startApi();
    const result = await request({
      approved: true,
      action: "launch_app",
      launchApp: "calculator",
      actions: [{ type: "unsupported_action" }],
    });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("missing or unsupported");
  });

  it("rejects coordinates that are coercible but are not numbers", async () => {
    const request = await startApi();
    const result = await request({
      approved: true,
      action: "click",
      targetPosition: { x: true, y: 20 },
    });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("finite numbers");
  });

  it("allows typing into the focused control without pointer coordinates", async () => {
    const request = await startApi();
    const result = await request({
      approved: true,
      actions: [{ type: "type", text: "reviewed text" }],
    });

    expect(result.response.status).toBe(200);
    expect(result.body.executedCount).toBe(1);
    expect(result.body.actions[0]).toEqual({ type: "type", text: "reviewed text" });
    expect(dispatchActionToPython).toHaveBeenCalledWith(
      expect.objectContaining({ action: "type", x: undefined, y: undefined }),
      expect.any(AbortSignal),
    );
  });

  it("rejects action sequences whose combined waits exceed the request budget", async () => {
    const request = await startApi();
    const result = await request({
      approved: true,
      actions: [
        { type: "wait", delayMs: 60_001 },
        { type: "wait", delayMs: 60_000 },
      ],
    });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("Combined waits");
    expect(dispatchActionToPython).not.toHaveBeenCalled();
  });
});
