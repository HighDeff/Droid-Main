# Base44 Dev Environment

## Architecture
- **Single-origin Vite + React + Express app.** The Express API is mounted as Vite dev-server middleware (see `vite.config.ts` `api-server-middleware` plugin), so frontend and API share port 3000. No separate backend service or database is needed.
- Dev entry: `npx tsx scripts/start-dev.ts` (programmatic Vite launch with pre-flight checks). Equivalent to `npm run dev`.
- Storage is in-memory / versioned JSON files (`ASSISTANT_STORAGE_PATH`). No DB to migrate or seed.
- The `python-service/` directory (pyautogui, screen capture) is for desktop automation and is **not** needed for the web preview.

## Setup quirks
- **`npm install --legacy-peer-deps` is required.** `@vitejs/plugin-react@6` declares `peer vite@^8` but the project pins `vite@^7`. The project actually uses `@vitejs/plugin-react-swc` (not plugin-react), so the conflict is harmless but npm refuses to install without `--legacy-peer-deps`.
- `node_modules` is a named Docker volume (not bind-mounted) to keep host/container platform binaries separate.

## Secrets
- `GEMINI_API_KEY` — **optional at boot.** The app falls back to heuristic mock responses without it, but all AI features (screen analysis, task planning, description refinement) require a real key. Get one at https://aistudio.google.com/apikey.
- Firebase config is hardcoded in `firebase-applet-config.json` (used only by the `/drive` route). No secret needed.

## Verify it works
- `curl http://localhost:3000/api/health` → `{"status":"ok",...}`
- Preview loads at `/` and redirects to `/dashboard`.
