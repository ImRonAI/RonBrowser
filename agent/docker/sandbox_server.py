"""Sandbox API - receives use_computer commands and executes them in the virtual desktop."""
import base64
import io
from typing import Optional, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pyautogui

app = FastAPI(title="Ron Desktop Sandbox")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Disable pyautogui failsafe for container use
pyautogui.FAILSAFE = False


class ComputerAction(BaseModel):
    action: str
    x: Optional[int] = None
    y: Optional[int] = None
    text: Optional[str] = None
    key: Optional[str] = None
    button: Optional[str] = "left"
    clicks: Optional[int] = 1
    dx: Optional[int] = None
    dy: Optional[int] = None


class ActionResult(BaseModel):
    success: bool
    screenshot_b64: Optional[str] = None
    error: Optional[str] = None
    data: Optional[Any] = None


def take_screenshot() -> str:
    """Take screenshot and return as base64."""
    img = pyautogui.screenshot()
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@app.post("/action", response_model=ActionResult)
def execute_action(action: ComputerAction):
    """Execute a computer action in the virtual desktop."""
    try:
        result_data = None

        if action.action == "screenshot":
            return ActionResult(success=True, screenshot_b64=take_screenshot())

        elif action.action == "click":
            pyautogui.click(action.x, action.y, clicks=action.clicks, button=action.button)

        elif action.action == "double_click":
            pyautogui.doubleClick(action.x, action.y)

        elif action.action == "right_click":
            pyautogui.rightClick(action.x, action.y)

        elif action.action == "type":
            pyautogui.typewrite(action.text, interval=0.02)

        elif action.action == "type_text":
            # For unicode/special chars
            pyautogui.write(action.text)

        elif action.action == "key":
            pyautogui.press(action.key)

        elif action.action == "hotkey":
            keys = action.key.split("+")
            pyautogui.hotkey(*keys)

        elif action.action == "mouse_move":
            pyautogui.moveTo(action.x, action.y)

        elif action.action == "drag":
            pyautogui.drag(action.dx or 0, action.dy or 0)

        elif action.action == "drag_to":
            pyautogui.moveTo(action.x, action.y)
            pyautogui.drag(action.dx or 0, action.dy or 0)

        elif action.action == "scroll":
            pyautogui.scroll(action.dy or 0, x=action.x, y=action.y)

        elif action.action == "screen_size":
            w, h = pyautogui.size()
            result_data = {"width": w, "height": h}

        elif action.action == "mouse_position":
            x, y = pyautogui.position()
            result_data = {"x": x, "y": y}

        else:
            raise ValueError(f"Unknown action: {action.action}")

        # Return screenshot after action
        return ActionResult(
            success=True,
            screenshot_b64=take_screenshot(),
            data=result_data
        )

    except Exception as e:
        return ActionResult(success=False, error=str(e))


@app.get("/health")
def health():
    return {"status": "ok", "display": ":1"}


@app.get("/screenshot")
def get_screenshot():
    """Get current screenshot."""
    return ActionResult(success=True, screenshot_b64=take_screenshot())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
