import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDiskFrameStore } from "./frame-store";

describe("disk frame store", () => {
  it("bounds frame retention without removing unrelated files", () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "frame-store-"));
    try {
      fs.writeFileSync(path.join(storageDir, "keep.txt"), "unrelated");
      for (let index = 0; index < 257; index += 1) {
        const hash = index.toString(16).padStart(64, "0");
        fs.writeFileSync(path.join(storageDir, `frame_${hash}.png`), "x");
      }

      createDiskFrameStore(storageDir)("data:image/png;base64,YQ==");

      const frames = fs.readdirSync(storageDir).filter((name) => name.startsWith("frame_"));
      expect(frames.length).toBeLessThanOrEqual(256);
      expect(fs.readFileSync(path.join(storageDir, "keep.txt"), "utf8")).toBe("unrelated");
    } finally {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
  });
});
