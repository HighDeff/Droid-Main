import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  configureLatestFrameProvider,
  configureReplayPlanProvider,
  dispatchActionToPython,
  handleQwenGuideStep,
  handleReplayDriftActions,
} from "./dual-ai-pipeline";

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

afterEach(async () => {
  configureLatestFrameProvider(() => null);
  configureReplayPlanProvider();
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function startReplayApi() {
  const app = express();
  app.use(express.json());
  app.post("/replay", handleReplayDriftActions);
  app.post("/guide", handleQwenGuideStep);
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  return async (body: unknown, path = "/replay") => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { response, body: await response.json() };
  };
}

describe("reviewed replay API", () => {
  it("rejects malformed coordinates at the shared native dispatch boundary", async () => {
    const result = await dispatchActionToPython({
      action: "click",
      x: true,
      y: 20,
      delayMs: 500,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("coordinates");
  });

  it("rejects replay when no reviewed actions are supplied", async () => {
    const request = await startReplayApi();
    const result = await request({ steps: [] });

    expect(result.response.status).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("previews supplied actions without claiming coordinate verification", async () => {
    const request = await startReplayApi();
    const result = await request({
      steps: [{ name: "Submit", action: "click", x: 10, y: 20 }],
    });

    expect(result.response.status).toBe(200);
    expect(result.body.status).toBe("preview");
    expect(result.body.executedActions[0].pcResult.preview).toBe(true);
    expect(result.body.executedActions[0].clickPoint.verified).toBe(false);
  });

  it("requires both approval and a fresh frame before device control", async () => {
    const request = await startReplayApi();
    const step = [{ name: "Submit", action: "click", x: 10, y: 20 }];

    const unapproved = await request({ steps: step, executeOnPC: true });
    expect(unapproved.response.status).toBe(403);

    configureReplayPlanProvider(() => undefined);
    const noFrame = await request({
      steps: step,
      executeOnPC: true,
      approved: true,
      sessionId: "session",
      planId: "plan",
    });
    configureReplayPlanProvider(() => ({
      id: "plan",
      sessionId: "session",
      title: "Approved replay",
      goal: "Replay",
      approvalState: "approved",
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [{
        id: "step",
        order: 1,
        title: "Submit",
        action: "click",
        target: { x: 10, y: 20 },
        targetDevice: "desktop",
      }],
    }));
    const approvedNoFrame = await request({
      executeOnPC: true,
      approved: true,
      sessionId: "session",
      planId: "plan",
    });
    expect(noFrame.response.status).toBe(403);
    expect(approvedNoFrame.response.status).toBe(409);
  });

  it("binds Android replay to the device stored in the approved plan", async () => {
    const request = await startReplayApi();
    configureReplayPlanProvider(() => ({
      id: "android-plan",
      sessionId: "session",
      title: "Approved Android replay",
      goal: "Replay on the reviewed phone",
      approvalState: "approved",
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [{
        id: "step",
        order: 1,
        title: "Tap submit",
        action: "click",
        target: { x: 10, y: 20 },
        targetDevice: "android",
        deviceId: "emulator-5554",
      }],
    }));

    const result = await request({
      executeOnPC: true,
      approved: true,
      targetDevice: "android",
      deviceId: "emulator-5556",
      sessionId: "session",
      planId: "android-plan",
    });

    expect(result.response.status).toBe(403);
    expect(result.body.error).toContain("approved in the persisted plan");
  });

  it("does not invent Qwen guidance without a screenshot", async () => {
    const request = await startReplayApi();
    const result = await request({ currentStep: { name: "Submit" } }, "/guide");

    expect(result.response.status).toBe(400);
    expect(result.body.success).toBe(false);
  });
});
