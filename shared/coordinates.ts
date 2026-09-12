export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function validatePoint(
  point: { x: number; y: number },
  bounds: Size,
  label: string = "coordinates"
): void {
  if (
    typeof point.x !== "number" ||
    typeof point.y !== "number" ||
    Number.isNaN(point.x) ||
    Number.isNaN(point.y)
  ) {
    throw new Error(`Invalid ${label}: point coordinates must be valid numbers`);
  }
  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x > bounds.width ||
    point.y > bounds.height
  ) {
    throw new Error(
      `Out of bounds ${label}: (${point.x}, ${point.y}) exceeds bounds (${bounds.width}x${bounds.height})`
    );
  }
}
