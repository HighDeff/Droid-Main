import math


def align_pointer(gui, x, y, tolerance_px=1, max_attempts=3):
    screen_width, screen_height = gui.size()
    target_x = int(round(x))
    target_y = int(round(y))
    if not (0 <= target_x < screen_width and 0 <= target_y < screen_height):
        raise ValueError("Intended pointer coordinate is outside the desktop")

    start_x, start_y = gui.position()
    actual_x, actual_y = int(start_x), int(start_y)
    initial_drift_px = math.hypot(target_x - actual_x, target_y - actual_y)
    correction_x = 0
    correction_y = 0
    drift_px = initial_drift_px

    for attempt in range(1, max_attempts + 1):
        requested_x = max(0, min(screen_width - 1, target_x + correction_x))
        requested_y = max(0, min(screen_height - 1, target_y + correction_y))
        gui.moveTo(requested_x, requested_y, duration=0)
        position = gui.position()
        actual_x, actual_y = int(position.x), int(position.y)
        correction_x = target_x - actual_x
        correction_y = target_y - actual_y
        drift_px = math.hypot(correction_x, correction_y)
        if drift_px <= tolerance_px:
            return {
                "aligned": True,
                "targetPosition": {"x": target_x, "y": target_y},
                "actualPosition": {"x": actual_x, "y": actual_y},
                "initialPosition": {"x": int(start_x), "y": int(start_y)},
                "initialDriftPx": round(initial_drift_px, 2),
                "driftPx": round(drift_px, 2),
                "correction": {"x": correction_x, "y": correction_y},
                "attempts": attempt,
                "recalibrated": attempt > 1,
                "screenResolution": {"width": screen_width, "height": screen_height},
            }

    return {
        "aligned": False,
        "targetPosition": {"x": target_x, "y": target_y},
        "actualPosition": {"x": actual_x, "y": actual_y},
        "initialPosition": {"x": int(start_x), "y": int(start_y)},
        "initialDriftPx": round(initial_drift_px, 2),
        "driftPx": round(drift_px, 2),
        "correction": {"x": correction_x, "y": correction_y},
        "attempts": max_attempts,
        "recalibrated": True,
        "screenResolution": {"width": screen_width, "height": screen_height},
    }
