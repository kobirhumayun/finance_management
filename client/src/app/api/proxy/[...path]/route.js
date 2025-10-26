export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server.js";
import { getBackendBaseUrl } from "../../../../lib/backend.js";
import originsConfig from "../../../../../../shared/allowed-origins.cjs";

const { findAllowedOrigin } = originsConfig;

let backendBaseUrl = getBackendBaseUrl();
let authProvider = null;
let authLoader = () => import("../../../../auth.js").then((mod) => mod.auth);
const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 15_000);

const STRIP_REQ_HEADERS = new Set(["connection", "content-length", "host", "accept-encoding", "cookie"]);
const PASS_RES_HEADERS = new Set(["content-type", "content-length", "cache-control", "etag", "last-modified", "location"]);

// Build a backend URL from the base, path segments, and original query string.
function buildBackendUrl(req, pathSegments) {
  const pathname = "/" + (Array.isArray(pathSegments) ? pathSegments.join("/") : "");
  const search = req.nextUrl.search || "";
  return backendBaseUrl + pathname + search;
}

// Drop hop‑by‑hop headers and cookies when forwarding the request.
function filterRequestHeaders(reqHeaders) {
  const out = new Headers();
  for (const [k, v] of reqHeaders.entries()) {
    if (!STRIP_REQ_HEADERS.has(k.toLowerCase())) out.set(k, v);
  }
  return out;
}

// Copy only safe response headers back to the client.
function copyResponseHeaders(from, to) {
  for (const [k, v] of from.entries()) {
    if (PASS_RES_HEADERS.has(k.toLowerCase())) to.set(k, v);
  }
}

function extractOrigin(req) {
  const headerOrigin = req.headers.get("origin");
  if (headerOrigin) return headerOrigin;

  const referer = req.headers.get("referer");
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch (error) {
    return null;
  }
}

function resolveAllowedOrigin(req) {
  const origin = extractOrigin(req);
  if (!origin) return { origin: null, error: "MissingOrigin" };

  const canonical = findAllowedOrigin(origin);
  if (canonical) return { origin: canonical, error: null };

  return { origin, error: "DisallowedOrigin" };
}

function rejectOrigin(origin, code) {
  const message =
    code === "MissingOrigin"
      ? "Origin header is required"
      : `Origin ${origin} is not allowed`;

  const headers = new Headers({ "vary": "Origin" });
  return NextResponse.json(
    { error: "OriginNotAllowed", message },
    { status: 403, headers }
  );
}

function applyCorsHeaders(headers, origin) {
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  const existing = headers.get("vary");
  headers.set("vary", existing ? `${existing}, Origin` : "Origin");
}

// Forward the incoming request to the backend. Accepts path segments rather than a params object.
async function forward(req, pathSegments) {
  const { origin: allowedOrigin, error: originError } = resolveAllowedOrigin(req);
  if (originError) return rejectOrigin(allowedOrigin, originError);

  // Resolve the NextAuth session and reject if none.
  const session = await (await getAuth())();
  if (!session?.accessToken) return new NextResponse("Unauthorized", { status: 401 });

  // Construct the upstream URL.
  const url = buildBackendUrl(req, pathSegments);
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  // Prepare headers and include the bearer token.
  const headers = filterRequestHeaders(req.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);

  // Implement a timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let fres;
  try {
    fres = await fetch(url, {
      method,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      ...(hasBody ? { body: req.body, duplex: "half" } : null),
    });
  } catch (e) {
    clearTimeout(timeout);
    return NextResponse.json(
      { error: "UpstreamError", message: String(e) },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }

  // Relay the backend response and filter its headers.
  const resHeaders = new Headers();
  copyResponseHeaders(fres.headers, resHeaders);
  applyCorsHeaders(resHeaders, allowedOrigin);
  return new NextResponse(fres.body, { status: fres.status, headers: resHeaders });
}

// Each handler awaits ctx.params to extract path segments.
export async function GET(req, ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}
export async function POST(req, ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}
export async function PUT(req, ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}
export async function PATCH(req, ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}
export async function DELETE(req, ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}
export async function HEAD(req, ctx) {
  const { path } = await ctx.params;
  return forward(req, path);
}

// Preflight CORS handler.
export async function OPTIONS(req) {
  const { origin: allowedOrigin, error: originError } = resolveAllowedOrigin(req);
  if (originError) return rejectOrigin(allowedOrigin, originError);

  const requestedHeaders = req.headers
    .get("access-control-request-headers")
    ?.trim();
  const allowHeaders = requestedHeaders || "content-type,authorization";

  const headers = new Headers({
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
    "access-control-allow-headers": allowHeaders,
    "access-control-max-age": "600",
  });
  applyCorsHeaders(headers, allowedOrigin);

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

export { resolveAllowedOrigin };

export function __setProxyTestOverrides(overrides) {
  if (overrides?.reset) {
    backendBaseUrl = getBackendBaseUrl();
    authProvider = null;
    authLoader = () => import("../../../../auth.js").then((mod) => mod.auth);
    return;
  }

  if (Object.prototype.hasOwnProperty.call(overrides ?? {}, "backendBaseUrl")) {
    backendBaseUrl = overrides.backendBaseUrl;
  }
  if (overrides?.auth) {
    authProvider = overrides.auth;
  }
  if (overrides?.authLoader) {
    authLoader = overrides.authLoader;
  }
}

async function getAuth() {
  if (authProvider) return authProvider;
  if (!authLoader) throw new Error("Auth provider loader not configured");
  authProvider = await authLoader();
  return authProvider;
}
