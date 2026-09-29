/**
 * High-fidelity Simulated Mobile and Desktop Frame Generator
 * Provides pixel-perfect 1080x1920 phone screens and 1920x1080 desktop screens
 * for AI Vision analysis, OCR detection, tactile HUD touch coordinates, and instant preview.
 */

export function generateDefaultMobileFrame(options?: {
  title?: string;
  appName?: string;
  subText?: string;
  activeTab?: string;
}): string {
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // 1. Sleek Background Wallpaper (Deep indigo & cyan mesh gradient)
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
  bgGrad.addColorStop(0, "#080d1a");
  bgGrad.addColorStop(0.3, "#0f172a");
  bgGrad.addColorStop(0.7, "#1e1b4b");
  bgGrad.addColorStop(1, "#090d16");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle ambient glow
  const radialGlow = ctx.createRadialGradient(540, 600, 50, 540, 600, 600);
  radialGlow.addColorStop(0, "rgba(56, 189, 248, 0.12)");
  radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, 1080, 1920);

  // 2. Modern Smartphone Status Bar
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, 1080, 70);

  // Status Bar: Time
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("09:41", 60, 48);

  // Status Bar: Camera Punch-Hole Notch
  ctx.fillStyle = "#020617";
  ctx.beginPath();
  ctx.arc(540, 35, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Status Bar: 5G, Wi-Fi, Battery Icons
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 24px monospace";
  ctx.fillText("5G  WiFi  99% 🔋", 800, 48);

  // 3. Top App Header Bar
  const headerGrad = ctx.createLinearGradient(0, 70, 0, 190);
  headerGrad.addColorStop(0, "rgba(15, 23, 42, 0.95)");
  headerGrad.addColorStop(1, "rgba(30, 41, 59, 0.85)");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 70, 1080, 120);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 70, 1080, 120);

  // App Header Title & Badges
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("📱 SIGHTLINE MOBILE AI REMOTE", 50, 145);

  ctx.fillStyle = "#10b981";
  ctx.font = "bold 20px monospace";
  ctx.fillText("● LIVE BRIDGE", 880, 142);

  // 4. Search / Action Command Bar
  ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
  ctx.beginPath();
  ctx.roundRect(50, 220, 980, 80, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "26px monospace";
  ctx.fillText("🔍  Tap / Swipe anywhere to automate", 85, 270);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 22px monospace";
  ctx.fillText("REC ●", 930, 270);

  // 5. Active Feature Card: Automation Target
  const cardGrad = ctx.createLinearGradient(50, 330, 1030, 680);
  cardGrad.addColorStop(0, "rgba(30, 41, 59, 0.9)");
  cardGrad.addColorStop(1, "rgba(15, 23, 42, 0.95)");
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(50, 330, 980, 360, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(129, 140, 248, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Card Header
  ctx.fillStyle = "#818cf8";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("🚀 Mobile Workflow Stage #1", 90, 395);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px sans-serif";
  ctx.fillText("Real Hardware Touch & Gesture Synthesis Active", 90, 440);

  // Primary Action Button on Mobile Screen (High contrast for click placement)
  ctx.fillStyle = "#0284c7";
  ctx.beginPath();
  ctx.roundRect(90, 480, 420, 90, 18);
  ctx.fill();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("⚡ Execute Step", 180, 537);

  // Secondary Action Button
  ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
  ctx.beginPath();
  ctx.roundRect(550, 480, 430, 90, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(52, 211, 153, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#34d399";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("✓ Verify State", 660, 537);

  // Card status tag
  ctx.fillStyle = "#64748b";
  ctx.font = "20px monospace";
  ctx.fillText("TARGET: X: 540 Y: 960 (Native 1080x1920 Res)", 90, 630);

  // 6. Interactive App Icons Grid (4 columns x 3 rows)
  const appIcons = [
    { name: "Chrome", color: "#ea4335", icon: "🌐" },
    { name: "Sightline", color: "#06b6d4", icon: "👁️" },
    { name: "Settings", color: "#64748b", icon: "⚙️" },
    { name: "Camera", color: "#10b981", icon: "📷" },
    { name: "Files", color: "#f59e0b", icon: "📁" },
    { name: "Terminal", color: "#6366f1", icon: "💻" },
    { name: "Gallery", color: "#ec4899", icon: "🖼️" },
    { name: "Play Store", color: "#3b82f6", icon: "▶️" },
  ];

  const gridStartY = 730;
  const colWidth = 245;
  const rowHeight = 220;

  appIcons.forEach((app, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = 65 + col * colWidth;
    const y = gridStartY + row * rowHeight;

    // Icon Container
    ctx.fillStyle = "rgba(30, 41, 59, 0.7)";
    ctx.beginPath();
    ctx.roundRect(x + 20, y, 140, 140, 32);
    ctx.fill();
    ctx.strokeStyle = app.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Emoji icon
    ctx.font = "60px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(app.icon, x + 90, y + 95);

    // Label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(app.name, x + 90, y + 175);
    ctx.textAlign = "left";
  });

  // 7. Live Widget Box: Camera / Stream Feed Inset
  const widgetY = 1220;
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.beginPath();
  ctx.roundRect(50, widgetY, 980, 420, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("📷 Live Touch & Optical Sensor Feed", 90, widgetY + 55);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "20px monospace";
  ctx.fillText("FPS: 60 • Latency: <12ms • Device: Android Remote Bridge", 90, widgetY + 95);

  // Inset visual simulation window
  ctx.fillStyle = "#020617";
  ctx.beginPath();
  ctx.roundRect(90, widgetY + 120, 900, 250, 16);
  ctx.fill();
  ctx.strokeStyle = "#1e293b";
  ctx.stroke();

  // Draw simulated sensor waveform or grid
  ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let gx = 100; gx < 980; gx += 60) {
    ctx.moveTo(gx, widgetY + 120);
    ctx.lineTo(gx, widgetY + 370);
  }
  for (let gy = widgetY + 130; gy < widgetY + 370; gy += 40) {
    ctx.moveTo(90, gy);
    ctx.lineTo(990, gy);
  }
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 24px monospace";
  ctx.fillText("● TOUCH SENSING ACTIVE • READY FOR AI TAP / SWIPE", 140, widgetY + 250);

  // 8. Bottom Navigation Dock
  const dockY = 1680;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.beginPath();
  ctx.roundRect(40, dockY, 1000, 120, 36);
  ctx.fill();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const dockIcons = ["📞 Phone", "💬 Chat", "🌐 Browser", "⚙️ Tools"];
  dockIcons.forEach((d, i) => {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(d, 80 + i * 240, dockY + 70);
  });

  // 9. Android 3-Button Navigation Bar
  ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
  ctx.fillRect(0, 1820, 1080, 100);

  // Back triangle
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(250, 1870);
  ctx.lineTo(280, 1850);
  ctx.lineTo(280, 1890);
  ctx.closePath();
  ctx.fill();

  // Home Circle
  ctx.beginPath();
  ctx.arc(540, 1870, 18, 0, Math.PI * 2);
  ctx.fill();

  // Recents Square
  ctx.beginPath();
  ctx.roundRect(800, 1855, 30, 30, 4);
  ctx.fill();

  return canvas.toDataURL("image/jpeg", 0.92);
}

export function generateDefaultDesktopFrame(title?: string): string {
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, 1920, 1080);

  // Header Bar
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, 1920, 70);
  ctx.strokeStyle = "#1e293b";
  ctx.strokeRect(0, 0, 1920, 70);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 24px monospace";
  ctx.fillText(`⚡ SIGHTLINE AUTONOMOUS WORKSPACE • ${title || "LIVE DESKTOP MIRROR [60FPS]"}`, 40, 45);

  ctx.fillStyle = "#10b981";
  ctx.font = "bold 16px monospace";
  ctx.fillText("● SYSTEM ONLINE", 1720, 45);

  // Left Sidebar
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 70, 320, 1010);
  ctx.strokeStyle = "#1e293b";
  ctx.strokeRect(0, 70, 320, 1010);

  const navItems = ["📊 Dashboard", "🤖 AI Perception", "🎯 Vision HUD", "📱 Phone Bridge", "⚡ PyAutoGUI", "📋 Task Ledger"];
  navItems.forEach((item, idx) => {
    ctx.fillStyle = idx === 2 ? "#0284c7" : "#1e293b";
    ctx.beginPath();
    ctx.roundRect(20, 110 + idx * 60, 280, 46, 8);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(item, 40, 140 + idx * 60);
  });

  // Main Workspace Area
  // Search Bar
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(380, 110, 600, 48, 8);
  ctx.fill();
  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "18px monospace";
  ctx.fillText("🔍 Search workspace elements: #search-filter", 405, 142);

  // Records Table
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(380, 190, 960, 280, 12);
  ctx.fill();
  ctx.strokeStyle = "#334155";
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("Target Execution Elements Table", 410, 235);

  const rows = [
    { name: "Step #1: Login Auth Verify", coord: "(X: 420, Y: 180)", status: "Ready" },
    { name: "Step #2: Export Action Ledger", coord: "(X: 680, Y: 320)", status: "Pending" },
    { name: "Step #3: Sync Mobile Bridge State", coord: "(X: 920, Y: 540)", status: "Completed" },
  ];
  rows.forEach((r, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? "rgba(15, 23, 42, 0.6)" : "rgba(30, 41, 59, 0.4)";
    ctx.fillRect(400, 260 + idx * 55, 920, 45);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "16px sans-serif";
    ctx.fillText(r.name, 420, 290 + idx * 55);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "15px monospace";
    ctx.fillText(r.coord, 780, 290 + idx * 55);
    ctx.fillStyle = "#34d399";
    ctx.fillText(r.status, 1180, 290 + idx * 55);
  });

  // Action Buttons
  ctx.fillStyle = "#0284c7";
  ctx.beginPath();
  ctx.roundRect(380, 520, 220, 55, 10);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("⚡ Run Sequence", 420, 555);

  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.roundRect(630, 520, 220, 55, 10);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("📱 Phone Forward", 665, 555);

  return canvas.toDataURL("image/jpeg", 0.9);
}
