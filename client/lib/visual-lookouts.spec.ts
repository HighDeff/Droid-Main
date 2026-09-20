import { describe, expect, it } from "vitest";
import type { VisualLookout } from "@shared/assistant";
import { evaluateVisualLookouts } from "./visual-lookouts";

const lookout = (patch: Partial<VisualLookout> = {}): VisualLookout => ({
  id: "lookout-1",
  label: "Saved banner",
  region: { id: "region-1", x: 100, y: 100, width: 300, height: 200 },
  expectedText: "Saved",
  expectation: "present",
  minConfidence: 0.8,
  onMatch: "continue",
  onMiss: "retry",
  ...patch,
});

describe("visual lookout evaluation", () => {
  it("matches confident text inside the selected region", () => {
    const result = evaluateVisualLookouts(
      [lookout()],
      [{ name: "Saved successfully", confidence: 0.94, center: { x: 180, y: 140 } }],
      false,
    );
    expect(result.allSatisfied).toBe(true);
    expect(result.results[0].matchedElement?.name).toContain("Saved");
  });

  it("requests a retry when the expected element moved outside the selected region", () => {
    const result = evaluateVisualLookouts(
      [lookout()],
      [{ textValue: "Saved", confidence: 0.99, center: { x: 900, y: 700 } }],
      false,
    );
    expect(result.allSatisfied).toBe(false);
    expect(result.shouldRetry).toBe(true);
  });

  it("supports stop-on-match and screen-change lookouts", () => {
    const result = evaluateVisualLookouts(
      [lookout({ expectation: "changed", onMatch: "stop", expectedText: undefined })],
      [],
      true,
    );
    expect(result.allSatisfied).toBe(true);
    expect(result.shouldStop).toBe(true);
  });
});
