import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";

// Global uncaught error handler to prevent silent blank screens
window.addEventListener("error", (event) => {
  console.error("Global uncaught window error:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Global unhandled promise rejection:", event.reason);
});

const container = document.getElementById("root");
if (container) {
  try {
    const root = createRoot(container);
    root.render(<App />);
  } catch (err) {
    console.error("Failed to render App:", err);
    container.innerHTML = `
      <div style="display:flex;min-height:100vh;align-items:center;justify-content:center;background:#090d16;color:#f87171;font-family:sans-serif;padding:20px;text-align:center;">
        <div>
          <h2 style="font-size:20px;margin-bottom:8px;color:#fff;">AI Studio Workspace Recovery</h2>
          <p style="font-size:14px;color:#94a3b8;margin-bottom:16px;">Click below to reset cache and reload the application.</p>
          <button onclick="localStorage.clear();sessionStorage.clear();window.location.reload();" style="padding:10px 20px;background:#06b6d4;color:#000;font-weight:bold;border:none;border-radius:6px;cursor:pointer;">
            Clear Cache & Reload
          </button>
        </div>
      </div>
    `;
  }
}
