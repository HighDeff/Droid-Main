import { describe, expect, it, vi } from "vitest";
import { captureReplayFrame } from "./replay-capture";

const frameHash = "a".repeat(64);
const mockRequest = (body: object) => vi.fn().mockResolvedValue({ ok: true, json: async () => body }) as unknown as typeof fetch;

describe("device-bound replay captures", () => {
  it("uses the selected Android device and its fresh PNG frame", async () => {
    const request = mockRequest({ success: true, imageData: "data:image/png;base64,AA==", timestamp: Date.now(), ageMs: 0, frameHash, source: "android_capture", deviceId: "emulator-5554" });
    const result = await captureReplayFrame("android", "emulator-5554", request);
    expect(request).toHaveBeenCalledWith("/api/adb/capture?deviceId=emulator-5554");
    expect(result.frameHash).toBe(frameHash);
  });

  it("refuses desktop frames while executing on a phone", async () => {
    const request = mockRequest({ success: true, imageData: "data:image/png;base64,AA==", timestamp: Date.now(), ageMs: 0, frameHash, source: "live_hud_sync" });
    await expect(captureReplayFrame("android", "emulator-5554", request)).rejects.toThrow("different device");
  });

  it("refuses mismatched phones and stale desktop frames", async () => {
    const otherPhone = mockRequest({ success: true, imageData: "data:image/png;base64,AA==", timestamp: Date.now(), ageMs: 0, frameHash, source: "android_capture", deviceId: "other-phone" });
    await expect(captureReplayFrame("android", "emulator-5554", otherPhone)).rejects.toThrow("different device");
    const stale = mockRequest({ success: true, imageData: "data:image/png;base64,AA==", timestamp: Date.now() - 6_000, ageMs: 6_000, frameHash, source: "live_hud_sync" });
    await expect(captureReplayFrame("desktop", undefined, stale)).rejects.toThrow("no fresh verifiable screenshot");
  });

  it("refuses a frame without a fingerprint", async () => {
    const request = mockRequest({ success: true, imageData: "data:image/png;base64,AA==", timestamp: Date.now(), ageMs: 0, source: "desktop_capture" });
    await expect(captureReplayFrame("desktop", undefined, request)).rejects.toThrow("no fresh verifiable screenshot");
  });
});
