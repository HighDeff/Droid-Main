import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const { sendQwenChatRequest } = vi.hoisted(() => ({ sendQwenChatRequest: vi.fn() }));
vi.mock("../ai-endpoint", () => ({
  sendQwenChatRequest,
  getConfiguredAiModel: () => "test-vision-model",
}));
import { handleAiReviewSteps } from "./ai-workflow-review";

describe("AI workflow review endpoint", () => {
  let server: Server;
  let base: string;
  beforeEach(async () => {
    sendQwenChatRequest.mockReset();
    const app = express();
    app.use(express.json());
    app.post("/review", handleAiReviewSteps);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}/review`;
  });
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const step = { id: "step-1", name: "Open settings", action: "click", x: 500, y: 300, delayMs: 500 };
  const screenshotUrl = "data:image/png;base64,aGVsbG8=";
  const review = {
    overallScore: 92,
    overallStatus: "ready",
    summary: "The target is visible.",
    consciousGuidance: "Click the visible settings control.",
    reviewedSteps: [{ stepId: "step-1", recommendedCoords: { x: 520, y: 310 }, confidence: 0.92, status: "recalibrated", notes: "Centered on the visible control." }],
  };
  const post = (body: unknown) => fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  it("reviews the supplied workflow against current and reference screenshots", async () => {
    sendQwenChatRequest.mockResolvedValue({ success: true, content: JSON.stringify(review) });
    const response = await post({ steps: [{ ...step, referenceScreenshotUrl: "data:image/jpeg;base64,aGVsbG8=" }], screenshotUrl, userObjective: "Open settings" });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.reviewedSteps[0]).toMatchObject({ stepNumber: 1, name: step.name, action: step.action, originalCoords: { x: 500, y: 300 }, recommendedCoords: { x: 520, y: 310 } });
    expect(data.aiModelUsed).toBe("test-vision-model");
    expect(sendQwenChatRequest).toHaveBeenCalledOnce();
    expect(sendQwenChatRequest.mock.calls[0][0][1].images).toHaveLength(2);
  });

  it("rejects non-raster current screenshots without calling the model", async () => {
    const response = await post({ steps: [step], screenshotUrl: "data:image/svg+xml;base64,PHN2Zz4=" });
    expect(response.status).toBe(400);
    expect(sendQwenChatRequest).not.toHaveBeenCalled();
  });

  it("does not report success when the model returns an incomplete review", async () => {
    sendQwenChatRequest.mockResolvedValue({ success: true, content: JSON.stringify({ ...review, reviewedSteps: [] }) });
    const response = await post({ steps: [step], screenshotUrl });
    expect(response.status).toBe(502);
    expect((await response.json()).success).toBe(false);
  });
});
