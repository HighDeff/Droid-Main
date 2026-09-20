import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantStateRepository } from "../assistant-state";
import { createAssistantRouter } from "./assistant";
import { methodLearningSystem } from "../method-learning";
import { qwenVisionEngine } from "../ai-perception-engine";

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function startApi(options: NonNullable<Parameters<typeof createAssistantRouter>[0]>) {
  const app = express();
  app.use(express.json());
  app.use("/api/assistant", createAssistantRouter({
    ...options,
    storeFrame: options.storeFrame ?? ((imageData) => ({
      frameId: `test-frame-${imageData.length}`,
      contentHash: `test:${imageData}`,
      storagePath: "memory",
      byteLength: imageData.length,
    })),
  }));
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  return async (path: string, init?: RequestInit) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/assistant${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    return { response, body: await response.json() };
  };
}

async function createApprovedPlan(
  request: Awaited<ReturnType<typeof startApi>>,
  instruction = "click at 10,20",
) {
  const created = await request("/sessions", {
    method: "POST",
    body: JSON.stringify({ project: { name: "Test" } }),
  });
  const sessionId = created.body.session.id as string;
  const planned = await request("/plans", {
    method: "POST",
    body: JSON.stringify({ sessionId, instructionText: instruction }),
  });
  const plan = planned.body.plan;
  const approved = await request(
    `/plans/${plan.id}/approve?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "POST" },
  );
  expect(approved.response.status).toBe(200);
  return { sessionId, plan: approved.body.plan };
}

describe("assistant automation API", () => {
  it("loads a scoped draft and allows targetless typing into the focused control", async () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const request = await startApi({ repository });
    const created = await request("/sessions", {
      method: "POST",
      body: JSON.stringify({ project: { name: "Typing" } }),
    });
    const sessionId = created.body.session.id as string;
    const planned = await request("/plans", {
      method: "POST",
      body: JSON.stringify({ sessionId, instructionText: 'type "hello"' }),
    });
    expect(planned.body.plan.steps[0].target).toBeUndefined();

    const loaded = await request(
      `/plans/${planned.body.plan.id}?sessionId=${encodeURIComponent(sessionId)}`,
    );
    expect(loaded.response.status).toBe(200);
    expect(loaded.body.plan.id).toBe(planned.body.plan.id);

    const approved = await request(
      `/plans/${planned.body.plan.id}/approve?sessionId=${encodeURIComponent(sessionId)}`,
      { method: "POST" },
    );
    expect(approved.response.status).toBe(200);
    expect(approved.body.plan.approvalState).toBe("approved");
  });

  it("separates chained keyboard actions into complete executable steps", async () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const request = await startApi({ repository });
    const created = await request("/sessions", {
      method: "POST",
      body: JSON.stringify({ project: { name: "Chained actions" } }),
    });
    const planned = await request("/plans", {
      method: "POST",
      body: JSON.stringify({
        sessionId: created.body.session.id,
        instructionText: 'click at 120,240 then type "hello" and press enter',
      }),
    });

    expect(planned.body.plan.steps.map((step: any) => step.action)).toEqual([
      "click",
      "type",
      "key",
    ]);
    expect(planned.body.plan.steps[2].key).toBe("enter");
  });

  it("requires confirmation, executes the approved action, verifies a fresh frame, and learns the workflow", async () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const executeAction = vi.fn(async () => ({ success: true }));
    let frameRead = 0;
    const request = await startApi({
      repository,
      executeAction,
      getLatestFrame: () => ({
        imageData: `data:image/png;base64,frame-${frameRead++}`,
        timestamp: Date.now(),
      }),
    });
    const { sessionId, plan } = await createApprovedPlan(request);

    const rejected = await request("/execution", {
      method: "POST",
      body: JSON.stringify({ sessionId, planId: plan.id, confirmation: false }),
    });
    expect(rejected.response.status).toBe(400);
    expect(executeAction).not.toHaveBeenCalled();

    const started = await request("/execution", {
      method: "POST",
      body: JSON.stringify({ sessionId, planId: plan.id, confirmation: true }),
    });
    expect(started.response.status).toBe(202);

    const unscopedRead = await request(`/execution/${started.body.execution.id}`);
    expect(unscopedRead.response.status).toBe(400);

    let execution = started.body.execution;
    for (let attempt = 0; attempt < 30 && execution.status === "running"; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      execution = (
        await request(
          `/execution/${execution.id}?sessionId=${encodeURIComponent(sessionId)}`,
        )
      ).body.execution;
    }
    expect(execution.status).toBe("completed");
    expect(execution.evidence[0].verification.status).toBe("changed");
    expect(execution.evidence[0].capture.imageData).toBeUndefined();
    expect(execution.evidence[0].capture.frameId).toMatch(/^test-frame-/);
    expect(execution.nextSuggestions).toHaveLength(3);
    expect(
      methodLearningSystem
        .getAllMethods()
        .some((method) => method.learnedFrom.includes(execution.id)),
    ).toBe(true);
    expect(executeAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "click", x: 10, y: 20, driftPx: 0 }),
    );

    const workflows = await request(`/workflows?sessionId=${encodeURIComponent(sessionId)}`);
    expect(workflows.body.workflows).toHaveLength(1);
    expect(workflows.body.workflows[0].executionCount).toBe(1);

    const invalidResume = await request("/execution", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        planId: plan.id,
        executionId: execution.id,
        confirmation: true,
      }),
    });
    expect(invalidResume.response.status).toBe(409);
    expect(invalidResume.body.error).toContain("cannot be resumed");

    const invalidApproval = await request(`/execution/${execution.id}/approve`, {
      method: "POST",
      body: JSON.stringify({ sessionId, confirmation: true }),
    });
    expect(invalidApproval.response.status).toBe(409);
    expect(invalidApproval.body.error).toContain("no pending approval");
  });

  it("persists reviewed gates and requires the approved OCR result after acting", async () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const executeAction = vi.fn(async () => ({ success: true }));
    let frameRead = 0;
    const successReport = {
      timestamp: Date.now(),
      screenDescription: "The operation is complete and Saved successfully",
      activeWindow: "Test app",
      visualStateChange: "Confirmation appeared",
      elements: [{
        id: "saved",
        name: "Success message",
        type: "text",
        boundingBox: { x: 10, y: 10, width: 120, height: 30 },
        center: { x: 70, y: 25 },
        confidence: 0.99,
        interactive: false,
        textValue: "Saved successfully",
      }],
      feedbackPosition: { x: 70, y: 25 },
      primarySuggestion: "Goal confirmed",
      confidence: 0.99,
      degraded: false,
    } as const;
    vi.spyOn(qwenVisionEngine, "analyzeScreen")
      .mockResolvedValueOnce({
        ...successReport,
        screenDescription: "The operation is still working",
        elements: [{
          ...successReport.elements[0],
          id: "working",
          textValue: "Working",
        }],
      })
      .mockResolvedValue(successReport);
    const request = await startApi({
      repository,
      executeAction,
      getLatestFrame: () => ({
        imageData: `data:image/png;base64,adaptive-${frameRead++}`,
        timestamp: Date.now(),
      }),
    });
    const created = await request("/sessions", {
      method: "POST",
      body: JSON.stringify({ project: { name: "Adaptive" } }),
    });
    const sessionId = created.body.session.id as string;
    const planned = await request("/plans", {
      method: "POST",
      body: JSON.stringify({ sessionId, instructionText: "click at 10,20" }),
    });
    const condition = {
      id: "condition_ready",
      type: "timer",
      label: "Ready delay",
      timeoutMs: 30000,
      pollIntervalMs: 500,
      confidenceThreshold: 0.8,
      approved: true,
      durationMs: 0,
      createdAt: new Date(Date.now() - 1000).toISOString(),
    };
    const step = {
      ...planned.body.plan.steps[0],
      waitConditions: [condition],
      adaptive: {
        captureBefore: true,
        verification: { kind: "text-present", text: "Saved successfully" },
        retry: { maxAttempts: 2, backoffMs: 10 },
      },
    };
    const saved = await request(
      `/plans/${planned.body.plan.id}?sessionId=${encodeURIComponent(sessionId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ steps: [step], timing: "when_ready" }),
      },
    );
    expect(saved.body.plan.approvalState).toBe("pending");
    expect(saved.body.plan.steps[0].waitConditions[0].id).toBe(condition.id);
    const approved = await request(
      `/plans/${planned.body.plan.id}/approve?sessionId=${encodeURIComponent(sessionId)}`,
      { method: "POST" },
    );
    expect(approved.response.status).toBe(200);

    const started = await request("/execution", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        planId: planned.body.plan.id,
        confirmation: true,
      }),
    });
    let execution = started.body.execution;
    for (let attempt = 0; attempt < 30 && execution.status === "running"; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      execution = (
        await request(
          `/execution/${execution.id}?sessionId=${encodeURIComponent(sessionId)}`,
        )
      ).body.execution;
    }
    if (execution.status === "running") {
      for (let attempt = 0; attempt < 50 && execution.status === "running"; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        execution = (
          await request(
            `/execution/${execution.id}?sessionId=${encodeURIComponent(sessionId)}`,
          )
        ).body.execution;
      }
    }
    expect(execution.status).toBe("completed");
    expect(executeAction).toHaveBeenCalledTimes(2);
    expect(execution.evidence[0].verification.status).toBe("missed");
    expect(execution.evidence[1].verification.status).toBe("verified");
    expect(execution.evidence[1].analysis.ocrText[0].text).toBe("Saved successfully");
  });

  it("pauses instead of claiming success when the native action fails", async () => {
    const repository = new AssistantStateRepository({ mode: "memory" });
    const request = await startApi({
      repository,
      executeAction: vi.fn(async () => ({ success: false, error: "No desktop bridge" })),
      getLatestFrame: () => ({
        imageData: "data:image/png;base64,unchanged",
        timestamp: Date.now(),
      }),
    });
    const { sessionId, plan } = await createApprovedPlan(request);
    const started = await request("/execution", {
      method: "POST",
      body: JSON.stringify({ sessionId, planId: plan.id, confirmation: true }),
    });
    let execution = started.body.execution;
    for (let attempt = 0; attempt < 30 && execution.status === "running"; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      execution = (
        await request(
          `/execution/${execution.id}?sessionId=${encodeURIComponent(sessionId)}`,
        )
      ).body.execution;
    }
    expect(execution.status).toBe("paused");
    expect(execution.error).toBe("No desktop bridge");
    expect(execution.pendingApproval.alternateStepId).toBe(plan.steps[0].id);
    expect(execution.pendingApproval.alternateAction.action).toBe("double_click");
  });
});
