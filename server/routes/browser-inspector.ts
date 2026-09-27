/**
 * Browser Inspector Express Route Handlers
 * Lets the AI read real browser tabs and page elements (CDP or extension).
 */

import { RequestHandler } from "express";
import {
  DEFAULT_CDP_URL,
  buildBrowserContext,
  inspectBrowserTab,
  listBrowserTabs,
} from "../browser-inspector";
import { aiMonitorStore } from "../ai-monitor-store";

// 1. List the open browser tabs
export const handleGetBrowserTabs: RequestHandler = async (req, res) => {
  const cdpUrl = (req.query.cdpUrl as string) || DEFAULT_CDP_URL;
  try {
    const tabs = await listBrowserTabs(cdpUrl);
    res.json({ success: true, cdpUrl, tabs });
  } catch (err) {
    res.json({
      success: false,
      cdpUrl,
      tabs: [],
      error:
        err instanceof Error
          ? `${err.message}. Start Chrome with --remote-debugging-port=9222 to enable tab reading.`
          : String(err),
    });
  }
};

// 2. Inspect a tab's live DOM (page elements + selectors)
export const handleInspectBrowserTab: RequestHandler = async (req, res) => {
  const { tabId, cdpUrl = DEFAULT_CDP_URL } = req.body;
  try {
    const tabs = await listBrowserTabs(cdpUrl);
    if (tabs.length === 0) {
      return res.json({
        success: false,
        error: "No browser tabs found over the DevTools protocol.",
      });
    }
    const tab = tabId ? tabs.find((t) => t.id === tabId) || tabs[0] : tabs[0];
    const snapshot = await inspectBrowserTab(tab, cdpUrl);

    const context = aiMonitorStore.setBrowserContext(
      buildBrowserContext({
        source: "cdp",
        tabs: tabs.map((t) => ({
          id: t.id,
          title: t.title,
          url: t.url,
          active: t.id === tab.id,
        })),
        page: {
          title: snapshot.title,
          url: snapshot.url,
          viewport: snapshot.viewport,
        },
        elements: snapshot.elements,
      }),
    );

    aiMonitorStore.record({
      phase: "browser",
      title: `Read browser tab "${snapshot.title}"`,
      detail: `Captured ${snapshot.elements.length} page element(s) from ${snapshot.url}`,
      status: "completed",
      source: "Browser Inspector",
    });

    res.json({ success: true, context });
  } catch (err) {
    res.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// 3. Report from the bundled browser extension
export const handleBrowserExtensionReport: RequestHandler = (req, res) => {
  const { tab, tabs, page, elements } = req.body;
  if (!tab && !page && !elements) {
    return res
      .status(400)
      .json({ success: false, error: "Missing tab or page data" });
  }

  const reportedTabs = Array.isArray(tabs) && tabs.length > 0 ? tabs : tab ? [tab] : [];
  const context = aiMonitorStore.setBrowserContext(
    buildBrowserContext({
      source: "extension",
      tabs: reportedTabs,
      page: page || { title: tab?.title, url: tab?.url },
      elements: Array.isArray(elements) ? elements : [],
    }),
  );

  res.json({ success: true, elementCount: context.elements.length });
};

// 4. Last known browser context
export const handleGetBrowserContext: RequestHandler = (_req, res) => {
  res.json({
    success: true,
    context: aiMonitorStore.getBrowserContext(),
  });
};
