import { createReplayAdapter } from "../replay-adapter";
import { Request, Response } from "express";
import type { FrameMetadata } from "@shared/coordinates";

// In-memory cache of the latest real desktop screen frame synced from the user's browser or upload
let latestSyncedRealFrame: {
  imageData: string;
  metadata?: FrameMetadata;
  receivedAt: number;
} | null = null;

export const setLatestSyncedRealFrame = (
  imageData: string,
  metadata?: FrameMetadata,
) => {
  latestSyncedRealFrame = { imageData, metadata, receivedAt: Date.now() };
};

export const getLatestSyncedRealFrame = () => latestSyncedRealFrame;

export const captureDesktopFrame = async (): Promise<{
  success: boolean;
  imageData?: string;
  method?: string;
  metadata?: FrameMetadata;
  error?: string;
}> => {
  if (latestSyncedRealFrame && Date.now() - latestSyncedRealFrame.receivedAt <= 5000) {
    return { success: true, imageData: latestSyncedRealFrame.imageData, method: "real_desktop_stream", metadata: latestSyncedRealFrame.metadata };
  }
  try {
    const frame = await createReplayAdapter({ targetDevice: "desktop" }).capture();
    return { success: true, imageData: frame.image, method: "server_desktop" };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Capture unavailable" }; }
};

export const handleSyncRealFrame = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { imageData, metadata } = req.body;
    if (
      imageData &&
      typeof imageData === "string" &&
      imageData.startsWith("data:image/")
    ) {
      if (metadata !== undefined) {
        if (
          !metadata ||
          !metadata.pixels ||
          !metadata.viewport ||
          !Number.isInteger(metadata.pixels.width) ||
          !Number.isInteger(metadata.pixels.height) ||
          metadata.pixels.width <= 0 ||
          metadata.pixels.height <= 0 ||
          !Number.isFinite(metadata.scale?.x) ||
          !Number.isFinite(metadata.scale?.y) ||
          !Number.isFinite(metadata.offset?.x) ||
          !Number.isFinite(metadata.offset?.y)
        ) {
          res.status(400).json({
            success: false,
            error: "Invalid frame scale or viewport metadata.",
          });
          return;
        }
      }
      latestSyncedRealFrame = { imageData, metadata, receivedAt: Date.now() };
      res.json({
        success: true,
        message: "Real desktop frame synced successfully.",
      });
    } else {
      res
        .status(400)
        .json({ success: false, error: "Invalid image data format." });
    }
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Failed to sync real desktop frame." });
  }
};

export const handleCaptureScreen = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    res.json(await captureDesktopFrame());
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
