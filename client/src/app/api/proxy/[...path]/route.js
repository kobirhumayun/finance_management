export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const BACKEND_BASE = (process.env.AUTH_BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 15_000);

const STRIP_REQ_HEADERS = new Set(["connection", "content-length", "host", "accept-encoding", "cookie"]);
const PASS_RES_HEADERS = new Set(["content-type", "content-length", "cache-control", "etag", "last-modified", "location"]);

// Build a backend URL from the base, path segments, and original query string.
function buildBackendUrl(req, pathSegments) {
  const pathname = "/" + (Array.isArray(pathSegments) ? pathSegments.join("/") : "");
  const search = req.nextUrl.search || "";
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
async function forward(req, pathSegments) {
  // Resolve the NextAuth session and reject if none.
  const session = await auth();
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
