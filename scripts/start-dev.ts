import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const TARGET_PORT = 3000;
const TARGET_HOST = "0.0.0.0";

interface DependencyCheckResult {
  pkg: string;
  ok: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * 1. Pre-flight dependency resolution check
 */
function verifyDependencies(): { success: boolean; failures: DependencyCheckResult[] } {
  const criticalDependencies = [
    "vite",
    "@vitejs/plugin-react-swc",
    "express",
    "@google/genai",
    "tailwindcss",
    "postcss",
    "autoprefixer",
    "react",
    "react-dom",
    "react-router-dom",
    "lucide-react",
    "clsx",
    "tailwind-merge",
  ];

  const results: DependencyCheckResult[] = [];
  const failures: DependencyCheckResult[] = [];

  for (const pkg of criticalDependencies) {
    try {
      const resolved = require.resolve(pkg, { paths: [process.cwd()] });
      results.push({ pkg, ok: true, resolvedPath: resolved });
    } catch (err: any) {
      const failure = { pkg, ok: false, error: err?.message || String(err) };
      results.push(failure);
      failures.push(failure);
    }
  }

  return {
    success: failures.length === 0,
    failures,
  };
}

/**
 * 2. Pre-flight port binding probe
 */
function probePortAvailability(port: number, host: string): Promise<{ available: boolean; error?: any }> {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once("error", (err: any) => {
      resolve({ available: false, error: err });
    });

    tester.once("listening", () => {
      tester.close(() => {
        resolve({ available: true });
      });
    });

    tester.listen(port, host);
  });
}

/**
 * Formats a clean boxed diagnostic message
 */
function printBanner(title: string, lines: string[], color: "green" | "red" | "yellow" | "cyan" = "cyan") {
  const colors = {
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    reset: "\x1b[0m",
    bold: "\x1b[1m",
  };

  const border = "═".repeat(78);
  console.log(`\n${colors[color]}${colors.bold}╔${border}╗`);
  console.log(`║  ${title.padEnd(76)}║`);
  console.log(`╠${border}╣${colors.reset}`);
  for (const line of lines) {
    console.log(`${colors[color]}║${colors.reset}  ${line.padEnd(76)}${colors[color]}║${colors.reset}`);
  }
  console.log(`${colors[color]}${colors.bold}╚${border}╝${colors.reset}\n`);
}

async function startDevServer() {
  console.log("\n🔍 Running pre-flight dev server diagnostics...\n");

  // A. Environment Variables Check
  const isHmrDisabled = process.env.DISABLE_HMR === "true";
  const nodeEnv = process.env.NODE_ENV || "development";
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  console.log(`  • Host / Port Target : ${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`  • Node Environment   : ${nodeEnv}`);
  console.log(
    `  • DISABLE_HMR Status : ${isHmrDisabled ? "TRUE (HMR paused, CPU-optimized file watcher)" : "FALSE (Live HMR active)"}`
  );
  console.log(`  • Server AI Key      : ${hasGeminiKey ? "CONFIGURED" : "FALLBACK HEURISTICS (No GEMINI_API_KEY)"}`);

  // B. Dependency Verification
  const depCheck = verifyDependencies();
  if (!depCheck.success) {
    printBanner(
      "CRITICAL STARTUP FAILURE: MISSING DEPENDENCY RESOLUTION",
      [
        "One or more required packages could not be resolved from node_modules.",
        "",
        ...depCheck.failures.map((f) => `❌ ${f.pkg}: ${f.error}`),
        "",
        "REMEDY:",
        "Run `install_applet_dependencies` or `install_applet_package` for the missing modules.",
      ],
      "red"
    );
    process.exit(1);
  }
  console.log("  ✔ All critical peer and runtime dependencies successfully resolved.");

  // C. Port Availability Check
  const portProbe = await probePortAvailability(TARGET_PORT, TARGET_HOST);
  if (!portProbe.available) {
    const errCode = portProbe.error?.code || "UNKNOWN";
    const errMsg = portProbe.error?.message || "Port is not available";

    printBanner(
      `PORT BINDING ERROR: ${errCode} ON PORT ${TARGET_PORT}`,
      [
        `Failed to bind to ${TARGET_HOST}:${TARGET_PORT}.`,
        `Details: ${errMsg}`,
        "",
        "CONTAINER INGRESS CONSTRAINTS:",
        "Port 3000 is the ONLY externally accessible port routed by the nginx proxy.",
        "Vite strictPort is enforced to prevent silent reassignment to unreachable ports.",
        "",
        "TROUBLESHOOTING STEPS:",
        "1. Check if a previous instance of node/vite is still running (`lsof -i :3000`).",
        "2. Terminate rogue background processes holding port 3000.",
        "3. Use `restart_dev_server` to cleanly restart container runtime.",
      ],
      "red"
    );
    process.exit(1);
  }
  console.log(`  ✔ Port ${TARGET_PORT} is verified free and ready for binding.`);

  // D. Launch Vite Dev Server programmatically
  try {
    const { createServer } = await import("vite");

    const server = await createServer({
      configFile: path.resolve(process.cwd(), "vite.config.ts"),
      server: {
        port: TARGET_PORT,
        host: TARGET_HOST,
        strictPort: true,
      },
    });

    await server.listen();

    printBanner(
      "VITE DEVELOPMENT SERVER STARTED SUCCESSFULLY",
      [
        `Local Access:    http://localhost:${TARGET_PORT}/`,
        `Network Access:  http://${TARGET_HOST}:${TARGET_PORT}/`,
        `HMR Setting:     ${isHmrDisabled ? "Disabled (Agent Edit Mode)" : "Active"}`,
        `File Watcher:    ${isHmrDisabled ? "Static / Optimized (watch: null)" : "Chokidar Active"}`,
        `API Endpoints:   Express mounted on /api/* (including /api/ai/refine-description)`,
      ],
      "green"
    );
  } catch (error: any) {
    const isPortError = error?.code === "EADDRINUSE" || String(error).includes("already in use");
    const isModuleError = error?.code === "ERR_MODULE_NOT_FOUND" || String(error).includes("Cannot find package");

    if (isPortError) {
      printBanner(
        "VITE RUNTIME ERROR: PORT CONFLICT (EADDRINUSE)",
        [
          `Vite could not bind to port ${TARGET_PORT}.`,
          `Error: ${error.message || error}`,
          "Another process grabbed the port during server bootstrap.",
        ],
        "red"
      );
    } else if (isModuleError) {
      printBanner(
        "VITE RUNTIME ERROR: MODULE NOT FOUND",
        [
          `Vite encountered an unresolved import in configuration or plugins:`,
          `Error: ${error.message || error}`,
          "Verify that all plugins specified in vite.config.ts are installed.",
        ],
        "red"
      );
    } else {
      printBanner(
        "VITE DEV SERVER STARTUP ERROR",
        [
          `Unexpected exception during Vite server initialization:`,
          `Message: ${error?.message || error}`,
          `Stack: ${String(error?.stack || "").split("\n").slice(0, 3).join(" ")}`,
        ],
        "red"
      );
    }

    process.exit(1);
  }
}

// Global exception guards
process.on("uncaughtException", (err) => {
  console.error("\n💥 [UNCAUGHT EXCEPTION IN STARTUP SCRIPT]:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("\n💥 [UNHANDLED REJECTION IN STARTUP SCRIPT]:", reason);
  process.exit(1);
});

startDevServer();
