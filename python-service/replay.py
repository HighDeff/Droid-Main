"""Strict desktop adapter. No simulated fallback or automatic retry."""
import base64
import io
import json
import sys
import time

from coordinate_guard import align_pointer

try:
    import pyautogui as gui
    gui.FAILSAFE = True
    request = json.load(sys.stdin)
    if request["operation"] == "capture":
        image = gui.screenshot()
        output = io.BytesIO()
        image.save(output, format="PNG")
        print(json.dumps({"success": True, "image": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode(), "width": image.width, "height": image.height}))
    elif request["operation"] == "position_check":
        check = align_pointer(gui, request["step"]["x"], request["step"]["y"])
        print(json.dumps({"success": True, "positionCheck": check}))
    else:
        step = request["step"]
        action = step["action"]
        x, y = step["x"], step["y"]
        width, height = gui.size()
        if not (0 <= x < width and 0 <= y < height):
            raise ValueError("Coordinates outside the desktop")
        text = step.get("text", "")
        if any(ord(char) < 32 or ord(char) > 126 for char in text):
            raise ValueError("Desktop typing supports printable ASCII only")
        keys = step.get("keyPayload", "").lower().split("+")
        if action in ("press_key", "hotkey") and any(key not in gui.KEYBOARD_KEYS for key in keys):
            raise ValueError("Unsupported keyboard key")
        position_check = None
        if action in ("click", "double_click", "right_click", "clear_and_type", "type_text", "press_key", "hotkey", "scroll"):
            position_check = align_pointer(gui, x, y)
            if not position_check["aligned"]:
                raise ValueError("Pointer did not align with the intended target; action was not executed")
        if action == "click": gui.click(x, y)
        elif action == "double_click": gui.doubleClick(x, y, interval=0.1)
        elif action == "right_click": gui.rightClick(x, y)
        elif action == "type_text": gui.write(text, interval=0.001)
        elif action == "clear_and_type":
            gui.click(x, y)
            gui.hotkey("command" if sys.platform == "darwin" else "ctrl", "a")
            gui.write(text, interval=0.001)
        elif action == "press_key": gui.press(keys[0])
        elif action == "hotkey": gui.hotkey(*keys)
        elif action == "scroll":
            if keys[0] not in ("up", "down"): raise ValueError("Scroll key must be up or down")
            gui.scroll(3 if keys[0] == "up" else -3, x=x, y=y)
        elif action == "wait": time.sleep(step["delayMs"] / 1000)
        else: raise ValueError("Unsupported action")
        print(json.dumps({"success": True, "positionCheck": position_check}))
except Exception as error:
    print(json.dumps({"success": False, "error": str(error)}))
    sys.exit(1)
