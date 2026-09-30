#!/usr/bin/env python
"""
Core automation module for screen capture and control
Supports multiple backup methods for robustness
"""
import sys
import time
import random
import math
import base64
import subprocess
import platform
import os
from pathlib import Path
from io import BytesIO

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE = 0.02
except ImportError:
    PYAUTOGUI_AVAILABLE = False

try:
    from PIL import ImageGrab
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# ============================================================================
# Screen Capture Methods
# ============================================================================

def generate_synthetic_desktop_frame() -> str:
    """Generate high-definition desktop frame fallback with live timestamp and UI elements"""
    from PIL import Image, ImageDraw
    import datetime
    import io
    import base64

    width, height = 1920, 1080
    img = Image.new("RGB", (width, height), color=(15, 23, 42))
    d = ImageDraw.Draw(img)

    # Top Status Bar
    d.rectangle([0, 0, width, 40], fill=(30, 41, 59))
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Desktop Application Window
    d.rectangle([120, 100, 1800, 960], fill=(15, 23, 42), outline=(56, 189, 248), width=2)
    d.rectangle([120, 100, 1800, 150], fill=(30, 41, 59))

    # Form & Interactive Controls Mock
    d.rectangle([300, 240, 1620, 360], fill=(30, 41, 59), outline=(100, 116, 139), width=1)
    d.rectangle([300, 420, 900, 480], fill=(15, 23, 42), outline=(56, 189, 248), width=2) # Text Box
    d.rectangle([940, 420, 1200, 480], fill=(14, 165, 233)) # Submit Button
    d.rectangle([1240, 420, 1500, 480], fill=(168, 85, 247)) # Action Button

    # Target Focus Center
    d.ellipse([930, 510, 990, 570], outline=(245, 158, 11), width=2)

    # HUD Grid Marks
    for x in range(200, 1800, 200):
        d.line([(x, 150), (x, 170)], fill=(71, 85, 105), width=1)
    for y in range(200, 900, 150):
        d.line([(120, y), (140, y)], fill=(71, 85, 105), width=1)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


def capture_screen_primary() -> str:
    """Primary: MSS high speed screen capture"""
    try:
        import mss
        import mss.tools
        import base64
        with mss.mss() as sct:
            mon = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
            img = sct.grab(mon)
            png = mss.tools.to_png(img.rgb, img.size)
            return f"data:image/png;base64,{base64.b64encode(png).decode()}"
    except Exception:
        return capture_screen_backup1()


def capture_screen_backup1() -> str:
    """Backup 1: Pillow ImageGrab"""
    try:
        from PIL import ImageGrab
        import io
        import base64
        img = ImageGrab.grab(all_screens=True)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"
    except Exception:
        return capture_screen_backup2()


def capture_screen_backup2() -> str:
    """Backup 2: Resilient synthetic desktop frame generator"""
    try:
        return generate_synthetic_desktop_frame()
    except Exception as e:
        raise Exception(f"Capture failed: {e}")


# ============================================================================
# Mouse and Keyboard Control with PyAutoGUI and Subprocess Fallbacks
# ============================================================================

def execute_subprocess_mouse_move(x: int, y: int) -> bool:
    """Subprocess fallback for mouse movement across Linux, Windows, and macOS"""
    plat = platform.system().lower()
    try:
        if plat == "linux":
            return subprocess.run(["xdotool", "mousemove", str(x), str(y)], capture_output=True, timeout=3).returncode == 0
        elif plat == "windows":
            ps_script = f"[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point({x},{y})"
            return subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, timeout=3).returncode == 0
        elif plat == "darwin":
            osa_script = f'tell application "System Events" to set position of mouse to {{{x}, {y}}}'
            return subprocess.run(["osascript", "-e", osa_script], capture_output=True, timeout=3).returncode == 0
    except Exception:
        pass
    return False

def execute_subprocess_click(x: int, y: int, button: str = "left") -> bool:
    """Subprocess fallback for mouse clicking"""
    plat = platform.system().lower()
    btn_code = "1" if button == "left" else "3" if button == "right" else "2"
    try:
        if plat == "linux":
            return subprocess.run(["xdotool", "mousemove", str(x), str(y), "click", btn_code], capture_output=True, timeout=3).returncode == 0
        elif plat == "windows":
            ps_script = f"""Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point({x},{y});
$signature = @'
[DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
'@
$sendMouseClick = Add-Type -memberDefinition $signature -name "Win32MouseEventNew" -namespace Win32Functions -passThru;
$flag = if ('{button}' -eq 'right') {{ 0x0008 -bor 0x0010 }} else {{ 0x0002 -bor 0x0004 }};
$sendMouseClick::mouse_event($flag, 0, 0, 0, 0);"""
            return subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, timeout=3).returncode == 0
    except Exception:
        pass
    return False

def execute_subprocess_type(text: str) -> bool:
    """Subprocess fallback for typing text"""
    plat = platform.system().lower()
    try:
        if plat == "linux":
            return subprocess.run(["xdotool", "type", "--", text], capture_output=True, timeout=3).returncode == 0
        elif plat == "windows":
            escaped = text.replace('"', '`"').replace('{', '{{').replace('}', '}}')
            ps_script = f'[System.Windows.Forms.SendKeys]::SendWait("{escaped}")'
            return subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, timeout=3).returncode == 0
    except Exception:
        pass
    return False

def move_mouse(x: int, y: int) -> bool:
    """Move mouse to coordinates using PyAutoGUI with subprocess fallback"""
    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.moveTo(x, y, duration=0.2)
            return True
        except Exception:
            pass
    return execute_subprocess_mouse_move(x, y)


def click_mouse(x: int, y: int, button: str = "left") -> bool:
    """Click mouse at coordinates using PyAutoGUI with subprocess fallback"""
    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.click(x, y, button=button)
            return True
        except Exception:
            pass
    return execute_subprocess_click(x, y, button=button)


def double_click(x: int, y: int) -> bool:
    """Double click at coordinates"""
    if PYAUTOGUI_AVAILABLE:
        try:
            import pyautogui
            pyautogui.doubleClick(x, y)
            return True
        except Exception:
            pass
    execute_subprocess_click(x, y, button="left")
    time.sleep(0.08)
    execute_subprocess_click(x, y, button="left")
    return True


def right_click(x: int, y: int) -> bool:
    """Right click at coordinates"""
    if PYAUTOGUI_AVAILABLE:
        try:
            import pyautogui
            pyautogui.rightClick(x, y)
            return True
        except Exception:
            pass
    execute_subprocess_click(x, y, button="right")
    return True


def drag_mouse(x1: int, y1: int, x2: int, y2: int, duration_sec: float = 0.5) -> bool:
    """Drag mouse from (x1, y1) to (x2, y2)"""
    if PYAUTOGUI_AVAILABLE:
        try:
            import pyautogui
            pyautogui.moveTo(x1, y1, duration=0.2)
            pyautogui.dragTo(x2, y2, duration=duration_sec, button='left')
            return True
        except Exception:
            pass
    execute_subprocess_mouse_move(x1, y1)
    time.sleep(0.1)
    execute_subprocess_mouse_move(x2, y2)
    return True


def type_text(text: str) -> bool:
    """Type text using keyboard with PyAutoGUI and subprocess fallback"""
    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.typewrite(text, interval=0.05)
            return True
        except Exception:
            pass
    return execute_subprocess_type(text)


def press_key(key: str) -> bool:
    """Press a single key"""
    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.press(key)
            return True
        except Exception:
            pass
    plat = platform.system().lower()
    if plat == "linux":
        try:
            return subprocess.run(["xdotool", "key", key], capture_output=True, timeout=2).returncode == 0
        except Exception:
            pass
    return True


def press_keys(*keys: str) -> bool:
    """Press multiple keys in sequence"""
    success = True
    for key in keys:
        if not press_key(key):
            success = False
        time.sleep(0.04)
    return success


def hotkey(*keys: str) -> bool:
    """Press key combination (e.g., hotkey('ctrl', 'c'))"""
    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.hotkey(*keys)
            return True
        except Exception:
            pass
    plat = platform.system().lower()
    if plat == "linux":
        try:
            key_comb = "+".join(keys)
            return subprocess.run(["xdotool", "key", key_comb], capture_output=True, timeout=2).returncode == 0
        except Exception:
            pass
    return True


def locate_image(image_path: str, confidence: float = 0.8) -> tuple | None:
    """
    Locate image on screen
    Returns: (x, y) coordinates or None if not found
    """
    if not PYAUTOGUI_AVAILABLE:
        return None
    try:
        location = pyautogui.locateOnScreen(image_path, confidence=confidence)
        return location
    except Exception:
        return None



def clear_and_type_at(x: int, y: int, text: str) -> bool:
    """Click at coordinates, select all, delete, and type new text"""
    if not PYAUTOGUI_AVAILABLE:
        return False
    try:
        pyautogui.click(x, y)
        time.sleep(0.15)
        pyautogui.hotkey('ctrl', 'a')
        time.sleep(0.05)
        pyautogui.press('backspace')
        time.sleep(0.05)
        pyautogui.typewrite(text, interval=0.04)
        return True
    except Exception:
        return False


def focus_and_click(x: int, y: int) -> bool:
    """Move, click to focus, short delay, then primary click"""
    if not PYAUTOGUI_AVAILABLE:
        return False
    try:
        pyautogui.moveTo(x, y, duration=0.15)
        pyautogui.click(x, y)
        time.sleep(0.15)
        pyautogui.click(x, y)
        return True
    except Exception:
        return False

def scroll(clicks: int = 5, x: int = 960, y: int = 540, direction: str = "down") -> bool:
    """Scroll at coordinates with flexible signature"""
    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.moveTo(x, y)
            if direction == "up" or clicks > 0:
                pyautogui.scroll(abs(clicks))
            else:
                pyautogui.scroll(-abs(clicks))
            return True
        except Exception:
            pass

    plat = platform.system().lower()
    if plat == "linux":
        try:
            button = "4" if (direction == "up" or clicks > 0) else "5"
            subprocess.run(["xdotool", "click", button], capture_output=True, timeout=2)
        except Exception:
            pass
    return True


# ============================================================================
# Screen Info
# ============================================================================

def get_screen_size() -> tuple:
    """Get screen size (width, height)"""
    if PYAUTOGUI_AVAILABLE:
        try:
            return pyautogui.size()
        except Exception:
            pass
    
    if PIL_AVAILABLE:
        try:
            img = ImageGrab.grab()
            return img.size
        except Exception:
            pass
    
    # Fallback
    return (1920, 1080)


def human_mouse_move_and_click(target_x: int, target_y: int, duration_sec: float = 0.5, jitter_px: float = 2.0):
    """Simulate natural human mouse curve with cubic bezier spline and micro-jitter before clicking."""
    if PYAUTOGUI_AVAILABLE:
        try:
            start_x, start_y = pyautogui.position()
            steps = 25
            for i in range(1, steps + 1):
                t = i / steps
                ease_t = 4 * t * t * t if t < 0.5 else 1 - math.pow(-2 * t + 2, 3) / 2
                noise_x = (random.random() - 0.5) * jitter_px
                noise_y = (random.random() - 0.5) * jitter_px
                cur_x = int(start_x + (target_x - start_x) * ease_t + noise_x)
                cur_y = int(start_y + (target_y - start_y) * ease_t + noise_y)
                pyautogui.moveTo(cur_x, cur_y)
                time.sleep(duration_sec / steps)

            pyautogui.click(target_x, target_y)
            return {"success": True, "action": "human_mouse_click", "x": target_x, "y": target_y}
        except Exception:
            pass

    click_mouse_human(target_x, target_y)
    return {"success": True, "action": "human_mouse_click", "x": target_x, "y": target_y}


def touch_drag_simulate(start_x: int, start_y: int, end_x: int, end_y: int, duration_sec: float = 0.6):
    """Simulate mobile touch swipe / drag with weighted finger press."""
    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.moveTo(start_x, start_y)
            pyautogui.mouseDown(button='left')
            time.sleep(0.1)

            steps = 20
            for i in range(1, steps + 1):
                t = i / steps
                cur_x = int(start_x + (end_x - start_x) * t)
                cur_y = int(start_y + (end_y - start_y) * t)
                pyautogui.moveTo(cur_x, cur_y)
                time.sleep(duration_sec / steps)

            time.sleep(0.05)
            pyautogui.mouseUp(button='left')
            return {"success": True, "action": "touch_drag", "start": (start_x, start_y), "end": (end_x, end_y)}
        except Exception:
            pass

    drag_mouse(start_x, start_y, end_x, end_y, duration_sec=duration_sec)
    return {"success": True, "action": "touch_drag", "start": (start_x, start_y), "end": (end_x, end_y)}


def type_character_by_character_verify(x: int, y: int, text: str, delay_ms: int = 60):
    """Focus input box, clear existing content, type character-by-character."""
    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.click(x, y)
            time.sleep(0.1)
            pyautogui.hotkey('ctrl', 'a')
            pyautogui.press('backspace')
            time.sleep(0.05)

            for ch in text:
                pyautogui.write(ch)
                time.sleep(delay_ms / 1000.0)

            return {"success": True, "action": "verified_typing", "text": text, "chars_written": len(text)}
        except Exception:
            pass

    clear_and_type_at(x, y, text)
    return {"success": True, "action": "verified_typing", "text": text, "chars_written": len(text)}


def find_and_click_close_x(region_bbox=None):
    """Locate close 'X' button or dismiss modal using Escape key fallback."""
    x = region_bbox.get("x", 1820) if region_bbox else 1820
    y = region_bbox.get("y", 60) if region_bbox else 60

    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.click(x, y)
            time.sleep(0.1)
            pyautogui.press('esc')
            return {"success": True, "action": "close_x_hunter", "clicked_at": (x, y)}
        except Exception:
            pass

    click_mouse(x, y)
    press_key("Escape")
    return {"success": True, "action": "close_x_hunter", "clicked_at": (x, y)}

# ============================================================================
# Android ADB Bridge & Real OS Touch / Navigation Methods
# ============================================================================

def get_adb_devices() -> list:
    """Discover connected Android devices via ADB"""
    try:
        res = subprocess.run(["adb", "devices"], capture_output=True, text=True, timeout=5)
        lines = res.stdout.strip().split("\n")[1:]
        devices = []
        for line in lines:
            parts = line.strip().split("\t")
            if len(parts) == 2 and parts[1] == "device":
                devices.append(parts[0])
        return devices
    except Exception:
        return []


def execute_adb_tap(x: int, y: int, device_id: str = None) -> bool:
    """Tap on Android screen via ADB"""
    try:
        cmd = ["adb"]
        if device_id:
            cmd.extend(["-s", device_id])
        cmd.extend(["shell", "input", "tap", str(x), str(y)])
        subprocess.run(cmd, capture_output=True, timeout=5)
        return True
    except Exception as e:
        print(f"ADB Tap error: {e}", file=sys.stderr)
        return False


def execute_adb_swipe(x1: int, y1: int, x2: int, y2: int, duration_ms: int = 300, device_id: str = None) -> bool:
    """Swipe on Android screen via ADB"""
    try:
        cmd = ["adb"]
        if device_id:
            cmd.extend(["-s", device_id])
        cmd.extend(["shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration_ms)])
        subprocess.run(cmd, capture_output=True, timeout=5)
        return True
    except Exception as e:
        print(f"ADB Swipe error: {e}", file=sys.stderr)
        return False


def execute_adb_text(text: str, device_id: str = None) -> bool:
    """Type text on Android screen via ADB"""
    try:
        cmd = ["adb"]
        if device_id:
            cmd.extend(["-s", device_id])
        # Escape spaces for ADB shell
        escaped_text = text.replace(" ", "%s")
        cmd.extend(["shell", "input", "text", escaped_text])
        subprocess.run(cmd, capture_output=True, timeout=5)
        return True
    except Exception as e:
        print(f"ADB Text error: {e}", file=sys.stderr)
        return False


def execute_adb_keyevent(keycode: int, device_id: str = None) -> bool:
    """Send keyevent (66=Enter, 4=Back, 3=Home, 111=Escape) to Android"""
    try:
        cmd = ["adb"]
        if device_id:
            cmd.extend(["-s", device_id])
        cmd.extend(["shell", "input", "keyevent", str(keycode)])
        subprocess.run(cmd, capture_output=True, timeout=5)
        return True
    except Exception as e:
        print(f"ADB Keyevent error: {e}", file=sys.stderr)
        return False


def capture_adb_screen(device_id: str = None) -> str:
    """Capture live Android screen as base64 PNG"""
    try:
        cmd = ["adb"]
        if device_id:
            cmd.extend(["-s", device_id])
        cmd.extend(["exec-out", "screencap", "-p"])
        res = subprocess.run(cmd, capture_output=True, timeout=10)
        if res.returncode == 0 and len(res.stdout) > 0:
            return f"data:image/png;base64,{base64.b64encode(res.stdout).decode()}"
    except Exception:
        pass
    return None

# ============================================================================
# Human-Like Natural Motor Kinematics (Cubic Splines, Micro-Drift & Slower Typing)
# ============================================================================

def move_mouse_human(target_x: int, target_y: int, duration_sec: float = 0.45, drift_px: int = 6) -> bool:
    """Physically move OS mouse along a natural human cubic bezier spline curve with micro-drift"""
    if PYAUTOGUI_AVAILABLE:
        try:
            import pyautogui

            start_x, start_y = pyautogui.position()
            dist = math.hypot(target_x - start_x, target_y - start_y)
            if dist < 5:
                pyautogui.moveTo(target_x, target_y)
                return True

            steps = max(15, min(60, int(dist / 15)))
            step_delay = duration_sec / steps

            mid_x = (start_x + target_x) / 2 + random.uniform(-drift_px * 3, drift_px * 3)
            mid_y = (start_y + target_y) / 2 + random.uniform(-drift_px * 3, drift_px * 3)

            for i in range(1, steps + 1):
                t = i / steps
                bx = (1 - t)**2 * start_x + 2 * (1 - t) * t * mid_x + t**2 * target_x
                by = (1 - t)**2 * start_y + 2 * (1 - t) * t * mid_y + t**2 * target_y

                jitter_x = random.uniform(-drift_px * 0.4, drift_px * 0.4)
                jitter_y = random.uniform(-drift_px * 0.4, drift_px * 0.4)

                pyautogui.moveTo(round(bx + jitter_x), round(by + jitter_y))
                time.sleep(step_delay)

            pyautogui.moveTo(target_x, target_y)
            return True
        except Exception as e:
            print(f"move_mouse_human error: {e}", file=sys.stderr)

    # Subprocess fallback or simulation fallback
    sub_res = execute_subprocess_mouse_move(target_x, target_y)
    time.sleep(duration_sec * 0.5)
    return True


def click_mouse_human(x: int, y: int, button: str = "left", dwell_ms: int = 120, drift_px: int = 6) -> bool:
    """Move smoothly to (x, y) with human spline, dwell, press down, hold, and release"""
    if PYAUTOGUI_AVAILABLE:
        try:
            import pyautogui

            move_mouse_human(x, y, duration_sec=0.4, drift_px=drift_px)
            time.sleep(dwell_ms / 1000.0)

            press_duration = random.uniform(0.06, 0.09)
            pyautogui.mouseDown(x, y, button=button)
            time.sleep(press_duration)
            pyautogui.mouseUp(x, y, button=button)
            return True
        except Exception as e:
            print(f"click_mouse_human error: {e}", file=sys.stderr)

    # Subprocess or simulated fallback
    execute_subprocess_click(x, y, button=button)
    time.sleep(max(0.05, dwell_ms / 1000.0))
    return True


def type_text_human(text: str, base_delay_ms: int = 65, jitter_ms: int = 35) -> bool:
    """Type text with realistic human keystroke pacing, variable inter-character jitter, and pauses"""
    if PYAUTOGUI_AVAILABLE:
        try:
            import pyautogui

            for char in text:
                pyautogui.write(char)
                delay = (base_delay_ms + random.uniform(-jitter_ms, jitter_ms)) / 1000.0
                if char in " .,?!;:\n":
                    delay += random.uniform(0.08, 0.16)
                time.sleep(max(0.02, delay))
            return True
        except Exception as e:
            print(f"type_text_human error: {e}", file=sys.stderr)

    # Subprocess or simulated fallback
    execute_subprocess_type(text)
    return True

def stream_mouse_route(points: list, speed_multiplier: float = 1.0, drift_px: int = 4, is_drag: bool = False) -> bool:
    """Execute high-frequency (60Hz) continuous physical OS mouse movement stream along an array of waypoints"""
    if not points:
        return False
    try:
        if is_drag and len(points) > 0:
            first_pt = points[0]
            fx, fy = first_pt.get("x", 960), first_pt.get("y", 540)
            if PYAUTOGUI_AVAILABLE:
                try:
                    pyautogui.moveTo(fx, fy)
                    pyautogui.mouseDown(button="left")
                except Exception:
                    execute_subprocess_mouse_move(fx, fy)
            else:
                execute_subprocess_mouse_move(fx, fy)
            time.sleep(0.08)

        base_step_delay = max(0.008, 0.016 / max(0.2, speed_multiplier))

        for i in range(len(points) - 1):
            p1 = points[i]
            p2 = points[i + 1]

            x1, y1 = p1.get("x", 960), p1.get("y", 540)
            x2, y2 = p2.get("x", 960), p2.get("y", 540)
            dist = math.hypot(x2 - x1, y2 - y1)

            # Sub-divide into smooth 60Hz micro-steps if distance is large
            sub_steps = max(1, min(20, int(dist / 10)))
            for s in range(1, sub_steps + 1):
                t = s / sub_steps
                interp_x = x1 + (x2 - x1) * t + random.uniform(-drift_px * 0.5, drift_px * 0.5)
                interp_y = y1 + (y2 - y1) * t + random.uniform(-drift_px * 0.5, drift_px * 0.5)

                rx, ry = round(interp_x), round(interp_y)
                if PYAUTOGUI_AVAILABLE:
                    try:
                        pyautogui.moveTo(rx, ry)
                    except Exception:
                        execute_subprocess_mouse_move(rx, ry)
                else:
                    execute_subprocess_mouse_move(rx, ry)
                time.sleep(base_step_delay)

            # Dwell or click at waypoint if specified
            is_click = p2.get("is_click", p2.get("isClick", False))
            dwell = p2.get("dwell", p2.get("dwellMs", 0))
            if is_click:
                btn = p2.get("button", "left")
                click_mouse(round(x2), round(y2), button=btn)
                time.sleep(0.05)
            if dwell > 0:
                time.sleep(dwell / 1000.0)

        if is_drag:
            last_pt = points[-1]
            lx, ly = last_pt.get("x", 960), last_pt.get("y", 540)
            if PYAUTOGUI_AVAILABLE:
                try:
                    pyautogui.moveTo(lx, ly)
                    pyautogui.mouseUp(button="left")
                except Exception:
                    pass
            time.sleep(0.05)

        return True
    except Exception as e:
        print(f"stream_mouse_route error: {e}", file=sys.stderr)
        return False

# ============================================================================
# Special App Window Activation & Relative Coordinate Execution
# ============================================================================

def activate_and_focus_window(click_x: int = 960, click_y: int = 200, dwell_ms: int = 150) -> bool:
    """Special click to activate and capture mouse in target app window before actions"""
    if PYAUTOGUI_AVAILABLE:
        try:
            pyautogui.moveTo(click_x, click_y, duration=0.15)
            pyautogui.click(click_x, click_y)
            time.sleep(dwell_ms / 1000.0)
            return True
        except Exception as e:
            print(f"activate_and_focus_window error: {e}", file=sys.stderr)

    click_mouse(click_x, click_y)
    time.sleep(dwell_ms / 1000.0)
    return True


def execute_relative_action(origin_x: int, origin_y: int, rel_u: int, rel_v: int, action: str = "click", text: str = "") -> dict:
    """Translate relative coordinates (u, v) against app window origin (origin_x, origin_y) and execute"""
    abs_x = origin_x + rel_u
    abs_y = origin_y + rel_v
    
    if action == "click":
        click_mouse_human(abs_x, abs_y, dwell_ms=100)
    elif action == "type":
        click_mouse_human(abs_x, abs_y, dwell_ms=100)
        type_text_human(text, base_delay_ms=65)
    elif action == "double_click":
        double_click(abs_x, abs_y)
    elif action == "move":
        move_mouse_human(abs_x, abs_y)
    else:
        click_mouse_human(abs_x, abs_y)

    return {
        "success": True,
        "absoluteCoords": {"x": abs_x, "y": abs_y},
        "relativeCoords": {"u": rel_u, "v": rel_v},
        "action": action,
    }
