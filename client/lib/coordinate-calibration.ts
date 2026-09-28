export interface CoordinateCalibrationProfile {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  dpiScale: number;
  jitterDamping: number;
  aspectRatioMode: "16:9" | "19.5:9" | "auto";
  screenWidth: number;
  screenHeight: number;
  lastCalibratedAt: number;
}

export const DEFAULT_CALIBRATION_PROFILE: CoordinateCalibrationProfile = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1.0,
  scaleY: 1.0,
  dpiScale: typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1.0,
  jitterDamping: 1.5,
  aspectRatioMode: "16:9",
  screenWidth: 1920,
  screenHeight: 1080,
  lastCalibratedAt: Date.now(),
};

const STORAGE_KEY = "sightline_coordinate_calibration";

export function getStoredCalibration(): CoordinateCalibrationProfile {
  if (typeof window === "undefined") return DEFAULT_CALIBRATION_PROFILE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_CALIBRATION_PROFILE, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_CALIBRATION_PROFILE;
}

export function saveStoredCalibration(profile: Partial<CoordinateCalibrationProfile>): CoordinateCalibrationProfile {
  const current = getStoredCalibration();
  const updated: CoordinateCalibrationProfile = {
    ...current,
    ...profile,
    lastCalibratedAt: Date.now(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("sightline-calibration-updated", { detail: updated }));
    } catch {}

    // Sync to backend
    fetch("/api/ai/coordinate-calibration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: updated }),
    }).catch(() => {});
  }

  return updated;
}

/**
 * Transforms raw x, y coordinates with active calibration parameters (offsets, scale, DPI, jitter damping)
 */
export function calibrateCoordinates(
  rawX: number,
  rawY: number,
  profile: CoordinateCalibrationProfile = getStoredCalibration()
): { x: number; y: number; normX: number; normY: number; driftPx: number } {
  // If normalized (0-1), expand to screen resolution first
  const baseNorm = rawX <= 1 && rawY <= 1;
  const targetW = profile.screenWidth || 1920;
  const targetH = profile.screenHeight || 1080;

  const standardX = baseNorm ? rawX * targetW : rawX;
  const standardY = baseNorm ? rawY * targetH : rawY;

  // Apply scaling and offsets
  const calibratedX = (standardX + profile.offsetX) * profile.scaleX;
  const calibratedY = (standardY + profile.offsetY) * profile.scaleY;

  // Clamped in standard space
  const clampedX = Math.max(0, Math.min(targetW, Math.round(calibratedX)));
  const clampedY = Math.max(0, Math.min(targetH, Math.round(calibratedY)));

  const normX = Math.max(0, Math.min(1, clampedX / targetW));
  const normY = Math.max(0, Math.min(1, clampedY / targetH));

  const driftX = clampedX - standardX;
  const driftY = clampedY - standardY;
  const driftPx = Math.sqrt(driftX * driftX + driftY * driftY);

  return {
    x: clampedX,
    y: clampedY,
    normX,
    normY,
    driftPx: Math.round(driftPx * 10) / 10,
  };
}
