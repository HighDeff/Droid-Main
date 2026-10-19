import json
import sys

from coordinate_guard import align_pointer


def main():
    request = json.load(sys.stdin)
    import pyautogui as gui

    gui.FAILSAFE = True
    width, height = gui.size()
    frame_width = request["frameWidth"]
    frame_height = request["frameHeight"]
    x = max(0, min(width - 1, round(request["x"] * width / frame_width)))
    y = max(0, min(height - 1, round(request["y"] * height / frame_height)))
    action = request["action"]
    position_check = None

    if action in ("click", "double_click", "right_click", "drag", "swipe_up", "swipe_down", "swipe_left", "swipe_right"):
        position_check = align_pointer(gui, x, y)
        if not position_check["aligned"]:
            print(json.dumps({"success": False, "error": "Pointer did not align with the intended position; action was not executed.", "positionCheck": position_check}))
            sys.exit(2)

    if action == "click":
        gui.click(x, y)
    elif action == "double_click":
        gui.doubleClick(x, y, interval=0.1)
    elif action == "right_click":
        gui.rightClick(x, y)
    elif action == "drag":
        end_x = max(0, min(width - 1, round(request["toX"] * width / frame_width)))
        end_y = max(0, min(height - 1, round(request["toY"] * height / frame_height)))
        gui.dragTo(end_x, end_y, duration=0.25)
    elif action == "type":
        gui.write(request["text"], interval=0.01)
    elif action == "press_key":
        gui.press(request["key"].lower())
    elif action == "hotkey":
        gui.hotkey(*request["hotkey"].split("+"))
    elif action == "swipe_up":
        gui.scroll(3, x=x, y=y)
    elif action == "swipe_down":
        gui.scroll(-3, x=x, y=y)
    elif action == "swipe_left":
        gui.hscroll(-3, x=x, y=y)
    elif action == "swipe_right":
        gui.hscroll(3, x=x, y=y)
    else:
        raise ValueError("Unsupported desktop action")

    print(json.dumps({"success": True, "action": action, "targetPosition": {"x": x, "y": y}, "positionCheck": position_check, "screenResolution": {"width": width, "height": height}}))


try:
    main()
except Exception as error:
    print(json.dumps({"success": False, "error": str(error)}))
    sys.exit(1)
