export interface ReplayFrame {
  imageData: string;
  timestamp: number;
  ageMs: number;
  frameHash: string;
  source: "live_hud_sync" | "desktop_capture" | "android_capture";
  deviceId?: string;
}

export async function captureReplayFrame(
  targetDevice: "desktop" | "android",
  deviceId: string | undefined,
  request: typeof fetch = fetch,
): Promise<ReplayFrame> {
  if (targetDevice === "android" && !deviceId) {
    throw new Error("Select a connected Android device before replaying a workflow");
  }
  const url = targetDevice === "android"
    ? `/api/adb/capture?deviceId=${encodeURIComponent(deviceId!)}`
    : "/api/capture-screen";
  const response = await request(url);
  const frame = await response.json();
  if (!response.ok || !frame.success || typeof frame.imageData !== "string") {
    throw new Error(frame.error || "No live frame is available from the selected device");
  }
  if (
    !Number.isFinite(frame.timestamp) ||
    !Number.isFinite(frame.ageMs) || frame.ageMs < 0 || frame.ageMs > 5_000 ||
    typeof frame.frameHash !== "string" || !/^[0-9a-f]{64}$/.test(frame.frameHash)
  ) {
    throw new Error("The selected device has no fresh verifiable screenshot");
  }
  if (targetDevice === "android"
    ? frame.source !== "android_capture" || frame.deviceId !== deviceId
    : frame.source !== "desktop_capture" && frame.source !== "live_hud_sync") {
    throw new Error("The screenshot came from a different device");
  }
  return frame as ReplayFrame;
}
