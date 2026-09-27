/**
 * AI Monitor Express Route Handlers
 * Live AI status, action history and CSV export (importable into Google Sheets).
 */

import { RequestHandler } from "express";
import { aiMonitorStore } from "../ai-monitor-store";

// 1. Current AI status + recent action history
export const handleGetAiMonitor: RequestHandler = (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({
    success: true,
    state: aiMonitorStore.getState(),
    history: aiMonitorStore.getHistory(limit),
  });
};

// 2. Action history only
export const handleGetActionHistory: RequestHandler = (req, res) => {
  const limit = parseInt(req.query.limit as string) || 200;
  res.json({
    success: true,
    count: aiMonitorStore.getHistory(limit).length,
    history: aiMonitorStore.getHistory(limit),
  });
};

// 3. CSV export — download and import into Google Sheets
export const handleExportActionHistoryCsv: RequestHandler = (_req, res) => {
  const csv = aiMonitorStore.toCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="ai-action-history.csv"',
  );
  res.send(csv);
};

// 4. Record an action from the client (manual or UI-driven events)
export const handleRecordAction: RequestHandler = (req, res) => {
  const { phase, title, detail, status, target, confidence, source } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: "Missing title" });
  }
  const record = aiMonitorStore.record({
    phase: phase || "system",
    title,
    detail: detail || "",
    status: status || "info",
    target,
    confidence,
    source,
  });
  res.json({ success: true, record });
};

// 5. Clear the stored history
export const handleClearActionHistory: RequestHandler = (_req, res) => {
  aiMonitorStore.clearHistory();
  aiMonitorStore.record({
    phase: "system",
    title: "Action history cleared",
    detail: "The AI action history buffer was cleared by the user.",
    status: "info",
    source: "AI Monitor",
  });
  res.json({ success: true });
};
