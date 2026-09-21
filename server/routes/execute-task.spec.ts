import express from "express";
import type { AddressInfo } from "node:net";
import { EventEmitter } from "node:events";
import { spawn } from "child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleExecuteTask } from "./execute-task";

vi.mock("child_process", () => ({ spawn: vi.fn() }));

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
    ),
  );
});

async function startApi() {
  const app = express();
  app.use(express.json());
  app.post("/execute", handleExecuteTask);
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  return async (body: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { response, body: await response.json() };
  };
}

describe("native task validation", () => {
  it("rejects an incomplete mouse route before starting native execution", async () => {
    const request = await startApi();
    const result = await request({
      task: {
        action: "stream_mouse_route",
        routePoints: [{ x: 10, y: 20 }],
      },
    });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("between 2 and 10,000 points");
  });

  it("requires an explicit Android device identifier", async () => {
    const request = await startApi();
    const result = await request({
      targetDevice: "android",
      task: { action: "click", targetPosition: { x: 10, y: 20 } },
    });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("device ID");
  });

  it("rejects wait delays outside the bounded native execution window", async () => {
    const request = await startApi();
    const result = await request({
      task: { action: "wait", delayMs: 120_001 },
    });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("between 0 and 120000ms");
  });

  it("validates optional typing coordinates when they are supplied", async () => {
    const request = await startApi();
    const result = await request({
      task: {
        action: "type",
        text: "reviewed text",
        targetPosition: { x: 20_000, y: 20 },
      },
    });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("outside the 16384x16384 bounds");
  });

  it("uses a nested Android target when a top-level target is null", async () => {
    const request = await startApi();
    const result = await request({
      targetDevice: null,
      task: {
        action: "right_click",
        targetDevice: "android",
        deviceId: "emulator-5554",
        targetPosition: { x: 10, y: 20 },
      },
    });

    expect(result.response.status).toBe(400);
    expect(result.body.error).toContain("Android execution does not support right_click");
  });

  it("writes exactly one normalized payload to the native process", async () => {
    const process = new EventEmitter() as any;
    process.stdout = new EventEmitter();
    process.stderr = new EventEmitter();
    process.kill = vi.fn();
    process.stdin = {
      write: vi.fn(),
      end: vi.fn(() => {
        queueMicrotask(() => {
          process.stdout.emit("data", Buffer.from(JSON.stringify({ success: true })));
          process.emit("close", 0);
        });
      }),
    };
    vi.mocked(spawn).mockReturnValueOnce(process);

    const request = await startApi();
    const result = await request({
      targetDevice: "desktop",
      task: { action: "click", targetPosition: { x: 10, y: 20 } },
    });

    expect(result.body.success).toBe(true);
    expect(process.stdin.write).toHaveBeenCalledTimes(1);
    expect(process.stdin.end).toHaveBeenCalledTimes(1);
    expect(JSON.parse(process.stdin.write.mock.calls[0][0])).toMatchObject({
      targetDevice: "desktop",
      action: "click",
      targetPosition: { x: 10, y: 20 },
    });
  });
});
