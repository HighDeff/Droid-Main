import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createPhoneRouter } from "./phone";
import { PhoneBridge, PhoneRecorder } from "../phone-bridge";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function png(value = 1) { const b = Buffer.alloc(32, value); Buffer.from("89504e470d0a1a0a", "hex").copy(b); b.writeUInt32BE(1080, 16); b.writeUInt32BE(1920, 20); return b; }
describe("paired phone API", () => {
  let server: Server, base: string, root: string, screen: Buffer;
  let run: ReturnType<typeof vi.fn>, chat: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    vi.stubEnv("ASSISTANT_API_KEY", "local-test-key");
    root = await mkdtemp(path.join(os.tmpdir(), "phone-api-")); screen = png();
    run = vi.fn(async args => args[0] === "devices" ? Buffer.from("List of devices attached\nphone device model:Test\nother device\n") : args.includes("screencap") ? screen : Buffer.from(""));
    chat = vi.fn(async () => ({ success: true, content: JSON.stringify({ explanation: "Tap the visible button", action: { type: "tap", x: .5, y: .5 } }) }));
    const app = express(); app.use(express.json()); app.use("/api/phone", createPhoneRouter(new PhoneBridge(run), new PhoneRecorder(root), chat));
    server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}/api/phone`;
  });
  afterEach(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true }); vi.unstubAllEnvs(); });
  const request = (url: string, token?: string, body?: unknown, admin = false, method?: string) => fetch(base + url, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(admin ? { "x-api-key": "local-test-key" } : { Authorization: `Bearer ${token || ""}` }) }, body: body ? JSON.stringify(body) : undefined });
  async function pair() { return (await (await request("/sessions", undefined, { device: "phone" }, true)).json()).token; }
  it("requires admin to pair and a scoped token to view/control a phone", async () => {
    expect((await request("/devices")).status).toBe(401);
    expect((await request("/sessions", undefined, { device: "phone" })).status).toBe(401);
    expect((await request("/frame")).status).toBe(401);
    const token = await pair();
    const frame = await (await request("/frame", token)).json();
    const result = await request("/action", token, { frameHash: frame.hash, action: { type: "key", key: "HOME" }, device: "other" });
    expect(result.status).toBe(200);
    expect(run).toHaveBeenLastCalledWith(["-s", "phone", "shell", "input", "keyevent", "KEYCODE_HOME"]);
    expect((await request("/session", token, undefined, false, "DELETE")).status).toBe(200);
    expect((await request("/frame", token)).status).toBe(401);
  });
  it("rejects stale manual frames and shell injection without executing anything", async () => {
    const token = await pair(); const frame = await (await request("/frame", token)).json(); screen = png(2);
    expect((await request("/action", token, { frameHash: frame.hash, action: { type: "tap", x: .5, y: .5 } })).status).toBe(409);
    expect((await request("/action", token, { frameHash: frame.hash, action: { type: "key", key: "HOME;reboot" } })).status).toBe(400);
    expect(run.mock.calls.some(([args]) => args.includes("input"))).toBe(false);
  });
  it("previews AI actions, checks a fresh screen, and consumes approval only once", async () => {
    const token = await pair();
    let preview = await (await request("/plan", token, { goal: "Open settings" })).json();
    expect(chat.mock.calls[0][0][1].images).toHaveLength(1);
    expect(run.mock.calls.some(([args]) => args.includes("input"))).toBe(false);
    screen = png(2);
    expect((await request("/execute-plan", token, { id: preview.id })).status).toBe(409);
    preview = await (await request("/plan", token, { goal: "Open settings" })).json();
    expect((await request("/execute-plan", token, { id: preview.id })).status).toBe(200);
    expect((await request("/execute-plan", token, { id: preview.id })).status).toBe(409);
  });
  it("does not fabricate AI success when provider fails", async () => {
    const token = await pair(); chat.mockResolvedValue({ success: false, error: "Model offline" });
    expect((await request("/plan", token, { goal: "Open settings" })).status).toBe(502);
  });
  it("pairs the native app, mirrors its actual frame and waits for action confirmation", async () => {
    const invitation = await (await request("/sessions", undefined, { mode: "native" }, true)).json();
    expect(invitation.device).toMatch(/^native-/);
    const registered = await (await request("/native/register", undefined, { pairing: invitation.pairing, name: "Android test" })).json();
    expect((await request("/native/register", undefined, { pairing: invitation.pairing, name: "Other" })).status).toBe(401);
    expect((await request("/session", registered.token)).status).toBe(401);
    expect((await request("/native/poll", invitation.token, { controlEnabled: true })).status).toBe(401);
    const upload = await fetch(base + "/native/frame", { method: "POST", headers: { "Content-Type": "image/png", Authorization: `Bearer ${registered.token}` }, body: screen });
    expect(upload.status).toBe(200);
    await request("/native/poll", registered.token, { controlEnabled: true, recordings: [] });
    const frame = await (await request("/frame", invitation.token)).json();
    const actionRequest = request("/action", invitation.token, { frameHash: frame.hash, action: { type: "tap", x: .25, y: .75 } });
    let command;
    await vi.waitFor(async () => {
      const polled = await (await request("/native/poll", registered.token, { controlEnabled: true })).json();
      if (polled.command) command = polled.command;
      expect(command).toBeDefined();
    });
    expect(command.action).toEqual({ type: "tap", x: .25, y: .75 });
    expect((await (await request("/native/poll", registered.token, { controlEnabled: true })).json()).command).toBeNull();
    expect((await request("/native/result", registered.token, { id: command.id, success: true })).status).toBe(200);
    expect((await actionRequest).status).toBe(200);
    expect(run.mock.calls.some(([args]) => args.includes("input"))).toBe(false);
    const record = { id: "a62cafb2-8353-40d2-b824-fb1357fcd3fe", state: "recording", startedAt: Date.now(), segments: 0, storage: "phone" };
    await request("/native/poll", registered.token, { controlEnabled: true, recordings: [record] });
    expect((await (await request("/session", invitation.token)).json()).recordings).toEqual([record]);
    expect((await request("/session", invitation.token, undefined, false, "DELETE")).status).toBe(200);
    expect((await request("/native/poll", registered.token, { controlEnabled: true })).status).toBe(401);
  });

});
