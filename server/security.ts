import type { NextFunction, Request, RequestHandler, Response } from "express";
import cors from "cors";
import crypto from "crypto";
import net from "net";

/** Returns true when the request originated from localhost (IPv4 or IPv6). */
function isLoopback(req: Request): boolean {
  const address = req.ip?.replace(/^::ffff:/, "");
  return address === "127.0.0.1" || address === "::1";
}

/** Returns the configured API key from `ASSISTANT_API_KEY`, if set. */
function configuredApiKey(): string | undefined {
  const key = process.env.ASSISTANT_API_KEY?.trim();
  return key || undefined;
}

/**
 * Checks the request's `x-api-key` or `Authorization: Bearer` header against
 * `expected` using a constant-time comparison.
 */
function hasValidApiKey(req: Request, expected: string): boolean {
  const supplied =
    req.header("x-api-key") ??
    req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied || supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

/**
 * Express middleware enforcing API access control: allows health-check
 * paths, valid API keys, and (outside production, when no key is
 * configured) loopback requests; otherwise responds with 401.
 */
export const requireApiAccess: RequestHandler = (req, res, next) => {
  if (res.locals?.apiAuthenticated === true) return next();
  if (req.path === "/ping" || req.path === "/demo") return next();
  const expected = configuredApiKey();
  if (expected && hasValidApiKey(req, expected)) return next();

  // Local development remains convenient, but never silently exposes the control plane.
  if (process.env.NODE_ENV !== "production" && !expected && isLoopback(req))
    return next();

  res.status(401).json({ success: false, error: "Authentication required" });
};

/**
 * Builds a CORS middleware that only allows origins listed in the
 * `CORS_ORIGINS` environment variable; disables cross-origin requests
 * entirely when no origins are configured.
 */
export function createCorsMiddleware(): RequestHandler {
  const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return cors({
    origin: configuredOrigins.length
      ? (origin, callback) => {
          if (!origin || configuredOrigins.includes(origin))
            return callback(null, true);
          return callback(new Error("Origin is not allowed"));
        }
      : false,
    credentials: false,
  });
}

/**
 * Builds a simple fixed-window, in-memory rate-limiting middleware keyed by
 * request IP, responding with 429 and a `Retry-After` header once the
 * window's request count exceeds `maxRequests`.
 */
export function createApiRateLimiter(
  windowMs = 60_000,
  maxRequests = 120,
): RequestHandler {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const current = requests.get(key);
    if (!current || current.resetAt <= now) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > maxRequests) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      return res
        .status(429)
        .json({ success: false, error: "Rate limit exceeded" });
    }
    return next();
  };
}

/**
 * Validates that `ip`/`port` form a usable ADB endpoint, throwing if the IP
 * is not a valid IPv4 address or the port is out of range.
 */
export function validateAdbEndpoint(ip: unknown, port: unknown): string {
  if (typeof ip !== "string" || net.isIP(ip) !== 4) {
    throw new Error("A valid IPv4 address is required");
  }
  const numericPort = Number(port);
  if (
    !Number.isInteger(numericPort) ||
    numericPort < 1 ||
    numericPort > 65535
  ) {
    throw new Error("A valid port is required");
  }
  return `${ip}:${numericPort}`;
}

/**
 * Recursively redacts values of keys that look sensitive (passwords,
 * tokens, secrets, API keys, authorization headers, codes) in an object or
 * array, leaving other values unchanged.
 */
export function redactSensitive(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) =>
      /password|token|secret|api[-_]?key|authorization|code/i.test(key)
        ? [key, "[REDACTED]"]
        : [key, redactSensitive(child)],
    ),
  );
}
