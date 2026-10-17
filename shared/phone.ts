import { z } from "zod";

export interface PhoneFrame {
  image: string;
  width: number;
  height: number;
  hash: string;
  capturedAt: number;
}

export interface PhoneRecording {
  id: string;
  state: "recording" | "stopping" | "complete" | "failed";
  startedAt: number;
  stoppedAt?: number;
  segments: number;
  storage?: "phone";
  error?: string;
}

export const phoneActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tap"), x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }),
  z.object({ type: z.literal("swipe"), x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1), endX: z.number().finite().min(0).max(1), endY: z.number().finite().min(0).max(1), duration: z.number().int().min(100).max(2000) }),
  z.object({ type: z.literal("text"), text: z.string().min(1).max(4000).regex(/^[\x20-\x7E]+$/) }),
  z.object({ type: z.literal("key"), key: z.enum(["HOME", "BACK", "APP_SWITCH", "ENTER", "DEL", "TAB", "PASTE", "COPY"]) }),
]);

export type PhoneAction = z.infer<typeof phoneActionSchema>;
