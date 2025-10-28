import { NextResponse } from "next/server.js";

const DEFAULT_BACKEND_BASE = (
  process.env.AUTH_BACKEND_URL || "http://localhost:5000"
).replace(/\/$/, "");

const DEFAULT_CONFIG = {
  auth: undefined,
  backendBase: DEFAULT_BACKEND_BASE,
  fetch: (...args) => fetch(...args),
};

let activeConfig = { ...DEFAULT_CONFIG };
let cachedDefaultAuth;

export function __setProxyTestOverrides(overrides = {}) {
  if (Object.prototype.hasOwnProperty.call(overrides, "auth")) {
    activeConfig.auth = overrides.auth ?? DEFAULT_CONFIG.auth;
  }
  if (Object.prototype.hasOwnProperty.call(overrides, "backendBase")) {
    activeConfig.backendBase = overrides.backendBase ?? DEFAULT_CONFIG.backendBase;
  }
  if (Object.prototype.hasOwnProperty.call(overrides, "fetch")) {
    activeConfig.fetch = overrides.fetch ?? DEFAULT_CONFIG.fetch;
  }
}

export function __resetProxyTestOverrides() {
  activeConfig = { ...DEFAULT_CONFIG };
  cachedDefaultAuth = undefined;
}

const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 15_000);

const STRIP_REQ_HEADERS = new Set(["connection", "content-length", "host", "accept-encoding", "cookie"]);
const PASS_RES_HEADERS = new Set([
  "content-type",
  "content-length",
  "cache-control",
  "etag",
  "last-modified",
  "location",
  "set-cookie",
]);

function buildBackendUrl(req, pathSegments) {
  const pathname = "/" + (Array.isArray(pathSegments) ? pathSegments.join("/") : "");
  const search = req.nextUrl.search || "";
  return activeConfig.backendBase + pathname + search;
}

function filterRequestHeaders(reqHeaders) {
  const out = new Headers();
  for (const [k, v] of reqHeaders.entries()) {
    if (!STRIP_REQ_HEADERS.has(k.toLowerCase())) out.set(k, v);
  }
  return out;
}

function copyResponseHeaders(from, to) {
  const seenCookies = new Set();

  for (const [k, v] of from.entries()) {
    const lower = k.toLowerCase();
    if (!PASS_RES_HEADERS.has(lower)) continue;

    if (lower === "set-cookie") {
      to.append(k, v);
      seenCookies.add(v);
    } else {
      to.set(k, v);
    }
  }

  if (PASS_RES_HEADERS.has("set-cookie")) {
    const cookies =
      typeof from.getSetCookie === "function"
        ? from.getSetCookie()
        : typeof from.raw === "function"
          ? from.raw()["set-cookie"]
          : undefined;

    if (Array.isArray(cookies)) {
      for (const cookie of cookies) {
        if (!seenCookies.has(cookie)) to.append("set-cookie", cookie);
      }
    }
  }
}

async function resolveAuthFn() {
  if (activeConfig.auth) return activeConfig.auth;
  if (!cachedDefaultAuth) {
    ({ auth: cachedDefaultAuth } = await import("@/auth"));
  }
  return cachedDefaultAuth;
}

async function forward(req, pathSegments) {
  const authFn = await resolveAuthFn();
  const session = await authFn();
  if (!session?.accessToken) return new NextResponse("Unauthorized", { status: 401 });

  const url = buildBackendUrl(req, pathSegments);
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  const headers = filterRequestHeaders(req.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let fres;
  try {
    fres = await activeConfig.fetch(url, {
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

  const resHeaders = new Headers();
  copyResponseHeaders(fres.headers, resHeaders);
  return new NextResponse(fres.body, { status: fres.status, headers: resHeaders });
}

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

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    },
  });
}
