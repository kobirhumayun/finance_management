// lib/api.js
function isServer() { return typeof window === "undefined"; }

function buildAbs(urlOrPath, base) {
  const s = String(urlOrPath || "");
  if (/^https?:\/\//i.test(s)) return s;
  return `${base}${s.startsWith("/") ? s : `/${s}`}`;
}

function normalizeHeaders(hdrs) {
  const out = {};
  if (!hdrs) return out;
  if (hdrs instanceof Headers) { hdrs.forEach((v, k) => { out[k] = v; }); return out; }
  if (Array.isArray(hdrs)) { for (const [k, v] of hdrs) out[k] = v; return out; }
  return { ...hdrs };
}

function prepareInit(init, bearer, { skipAuth = false } = {}) {
  const final = { cache: "no-store", ...init };
  const h = normalizeHeaders(final.headers);
  if (!skipAuth && bearer) {
    const lower = Object.keys(h).reduce((m, k) => (m[k.toLowerCase()] = k, m), {});
    if (!("authorization" in lower)) h.Authorization = `Bearer ${bearer}`;
  }
  const body = final.body;
  const isPO = body && typeof body === "object" &&
    !(body instanceof FormData) && !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) && !(body instanceof ReadableStream);
  if (isPO) {
    h["Content-Type"] = h["Content-Type"] || "application/json";
    final.body = JSON.stringify(body);
  }
  // Use cookies when running in the browser; omit them on the server
  if (final.credentials === undefined) {
    final.credentials = isServer() ? "omit" : "same-origin";
  }
  final.headers = h;
  return final;
}

async function markDynamicIfServer() {
  if (!isServer()) return;
  try {
    const mod = await import("next/headers");
    void mod.headers(); // mark route dynamic for fetch caching
  } catch { }
}

export async function apiRequest(input, init = {}) {
  await markDynamicIfServer();

  if (isServer()) {
    const base = (process.env.AUTH_BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");
    const { auth } = await import("@/auth");
    const session = await auth();                  // pulls fresh access token
    const bearer = session?.accessToken || null;
    return fetch(buildAbs(input, base), {
      ...prepareInit(init, bearer),
      signal: init.signal,                          // ← AbortSignal support
    });
  }

  // Browser → go through server proxy (injects Bearer server-side)
  const path = String(input || "");
  const url = path.startsWith("/api/proxy/") ? path : `/api/proxy${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...prepareInit(init, null, { skipAuth: true }), signal: init.signal });
}

export async function apiJSON(input, init = {}) {
  const res = await apiRequest(input, init);
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status; err.body = data;
    throw err;
  }
  return data;
}