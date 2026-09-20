import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "./index";

const originalApiKey = process.env.ASSISTANT_API_KEY;
const originalNodeEnv = process.env.NODE_ENV;
const originalPublicOrigin = process.env.ASSISTANT_PUBLIC_ORIGIN;
const originalTrustProxy = process.env.TRUST_PROXY_HTTPS;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.ASSISTANT_API_KEY;
  else process.env.ASSISTANT_API_KEY = originalApiKey;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalPublicOrigin === undefined) delete process.env.ASSISTANT_PUBLIC_ORIGIN;
  else process.env.ASSISTANT_PUBLIC_ORIGIN = originalPublicOrigin;
  if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY_HTTPS;
  else process.env.TRUST_PROXY_HTTPS = originalTrustProxy;
});

describe("API authentication", () => {
  it("requires credentials even when callers claim to be same-origin", async () => {
    process.env.ASSISTANT_API_KEY = "test-only-key";
    process.env.NODE_ENV = "production";
    const browserSessionToken = "test-browser-session";
    const server = createServer({ browserSessionToken }).listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const external = await fetch(`${baseUrl}/api/capture-screen`);
      expect(external.status).toBe(401);

      const crossSite = await fetch(`${baseUrl}/api/capture-screen`, {
        headers: {
          origin: "https://untrusted.example",
          "sec-fetch-site": "cross-site",
        },
      });
      expect(crossSite.status).toBe(401);

      const browser = await fetch(`${baseUrl}/api/capture-screen`, {
        headers: {
          referer: `${baseUrl}/automation`,
          "sec-fetch-site": "same-origin",
        },
      });
      expect(browser.status).toBe(401);

      const browserSession = await fetch(`${baseUrl}/api/capture-screen`, {
        headers: {
          cookie: `droid_browser_session=${browserSessionToken}`,
          referer: `${baseUrl}/automation`,
        },
      });
      expect(browserSession.status).toBe(200);

      const exchange = await fetch(`${baseUrl}/api/browser-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: baseUrl,
        },
        body: JSON.stringify({ apiKey: "test-only-key" }),
      });
      expect(exchange.status).toBe(200);
      expect(exchange.headers.get("set-cookie")).toContain("droid_browser_session=");

      const crossSiteSession = await fetch(`${baseUrl}/api/capture-screen`, {
        headers: {
          cookie: `droid_browser_session=${browserSessionToken}`,
          referer: "https://untrusted.example/",
        },
      });
      expect(crossSiteSession.status).toBe(401);

      const siblingSiteSession = await fetch(`${baseUrl}/api/capture-screen`, {
        headers: {
          cookie: `droid_browser_session=${browserSessionToken}`,
          referer: "https://sibling.example.test/",
        },
      });
      expect(siblingSiteSession.status).toBe(401);

      process.env.TRUST_PROXY_HTTPS = "true";
      delete process.env.ASSISTANT_PUBLIC_ORIGIN;
      const spoofedProxySession = await fetch(`${baseUrl}/api/capture-screen`, {
        headers: {
          cookie: `droid_browser_session=${browserSessionToken}`,
          referer: "https://untrusted.example/",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "untrusted.example",
        },
      });
      expect(spoofedProxySession.status).toBe(401);

      process.env.ASSISTANT_PUBLIC_ORIGIN = baseUrl;
      const configuredProxySession = await fetch(`${baseUrl}/api/capture-screen`, {
        headers: {
          cookie: `droid_browser_session=${browserSessionToken}`,
          referer: `${baseUrl}/automation`,
          "x-forwarded-proto": "https",
          "x-forwarded-host": "untrusted.example",
        },
      });
      expect(configuredProxySession.status).toBe(200);

      const malformedSession = await fetch(`${baseUrl}/api/capture-screen`, {
        headers: {
          cookie: "droid_browser_session=%E0%A4%A",
          referer: `${baseUrl}/automation`,
        },
      });
      expect(malformedSession.status).toBe(401);

      const authenticated = await fetch(`${baseUrl}/api/capture-screen`, {
        headers: { "x-assistant-api-key": "test-only-key" },
      });
      expect(authenticated.status).toBe(200);
      const body = await authenticated.json();
      expect(body.success).toBe(true);
      expect(body.ageMs).toBeGreaterThanOrEqual(0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
