export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server.js";
import { auth } from "../../../../auth.js";
import { getBackendBaseUrl } from "../../../../lib/backend.js";

const BACKEND_BASE = getBackendBaseUrl();
const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 15_000);

const STRIP_REQ_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "accept-encoding",
  "cookie",
  "authorization",
]);
const PASS_RES_HEADERS = new Set(["content-type", "content-length", "cache-control", "etag", "last-modified", "location"]);

const PUBLIC_METHODS = new Set(["GET", "HEAD"]);
const PUBLIC_PATH_PREFIXES = (process.env.PROXY_PUBLIC_PATHS || "")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean)
  .map((path) => (path.startsWith("/") ? path : `/${path}`))
  .map((path) => (path === "/" ? path : path.replace(/\/+$/, "")));

function getPathname(pathSegments) {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) return "/";
  return "/" + pathSegments.join("/");
}

function isPublicPath(pathname) {
  if (PUBLIC_PATH_PREFIXES.length === 0) return false;
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (prefix === "/") return true;
    if (pathname === prefix) return true;
    if (pathname.startsWith(prefix + "/")) return true;
  }
  return false;
}

function isPublicRequest(method, pathname) {
  if (PUBLIC_METHODS.has(method)) return true;
  return isPublicPath(pathname);
}

// Build a backend URL from the base, path segments, and original query string.
function buildBackendUrl(req, pathSegments) {
  const pathname = getPathname(pathSegments);
  const search = req.nextUrl?.search || "";
  return BACKEND_BASE + pathname + search;
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

// Forward the incoming request to the backend. Accepts path segments rather than a params object.
export async function forward(req, pathSegments, { authFn } = {}) {
  const method = req.method.toUpperCase();
  const pathname = getPathname(pathSegments);
  const requiresAuth = !isPublicRequest(method, pathname);

  // Resolve the NextAuth session when necessary.
  const resolveAuth = typeof authFn === "function" ? authFn : auth;
  const session = await resolveAuth();
  if (requiresAuth && !session?.accessToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Construct the upstream URL.
  const url = buildBackendUrl(req, pathSegments);
  const hasBody = !["GET", "HEAD"].includes(method);

  // Prepare headers and include the bearer token.
  const headers = filterRequestHeaders(req.headers);
  if (session?.accessToken && requiresAuth) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

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

// Preflight CORS handler (unchanged).
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-max-age": "600",
    },
  });
}
