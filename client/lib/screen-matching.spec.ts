import { describe, expect, it } from "vitest";
import {
  applyEuclideanCorrectionsToSteps,
  matchLiveFeedWithTemplates,
} from "./screen-matching";

describe("screen matching", () => {
  const template = {
    id: "submit",
    name: "Submit",
    selector: "#submit",
    expectedPosition: { x: 100, y: 100 },
    tolerancePx: 8,
  };

  it("marks missing detections as unverified without inventing drift", () => {
    const result = matchLiveFeedWithTemplates([template], []);

    expect(result.status).toBe("red");
    expect(result.overallAccuracy).toBe(0);
    expect(result.matches[0]).toMatchObject({
      matched: false,
      livePosition: null,
      isDrifting: false,
      alignmentAccuracy: 0,
    });

    const correction = applyEuclideanCorrectionsToSteps(
      [{ x: 100, y: 100, selector: "#submit" }],
      result,
    );
    expect(correction.correctedCount).toBe(0);
    expect(correction.updatedSteps[0]).toMatchObject({ x: 100, y: 100 });
  });

  it("rejects an unrelated distant detection as a coordinate correction", () => {
    const result = matchLiveFeedWithTemplates(
      [template],
      [
        {
          id: "other",
          name: "Other",
          currentPosition: { x: 900, y: 700 },
          confidence: 0.99,
        },
      ],
    );

    expect(result.matches[0].matched).toBe(false);
  });

  it("keeps the 30px spatial candidate boundary explicit", () => {
    const within = matchLiveFeedWithTemplates(
      [template],
      [{ id: "near", name: "Near", currentPosition: { x: 129, y: 100 }, confidence: 1 }],
    );
    const outside = matchLiveFeedWithTemplates(
      [template],
      [{ id: "far", name: "Far", currentPosition: { x: 131, y: 100 }, confidence: 1 }],
    );
    const atBoundary = matchLiveFeedWithTemplates(
      [template],
      [{ id: "edge", name: "Edge", currentPosition: { x: 130, y: 100 }, confidence: 1 }],
    );

    expect(within.matches[0].matched).toBe(true);
    expect(atBoundary.matches[0].matched).toBe(true);
    expect(outside.matches[0].matched).toBe(false);
  });
});
