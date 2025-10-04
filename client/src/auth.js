// File: src/auth.js
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { jwtDecode } from "jwt-decode";
import { randomUUID, createHmac } from "crypto";
import { getRedis } from "@/lib/redis";

const DEFAULT_TIMEOUT_MS = 8000;
const EARLY_REFRESH_WINDOW_MS = 30_000;
const REFRESH_PATH = process.env.AUTH_REFRESH_PATH || "/api/auth/refresh";
const REDIS_PREFIX = (process.env.AUTH_REDIS_PREFIX || "auth:v1").replace(/:$/, "");
const LOCK_TTL_MS = 8_000;
const WAIT_TIMEOUT_MS = 9_000;
const POLL_INTERVAL_MS = 200;
const RESULT_TTL_CAP_MS = 20_000;
const KEY_SALT = process.env.AUTH_KEY_SALT || process.env.NEXTAUTH_SECRET || "dev-salt";

function backendUrl(path = "") {
  const base = (process.env.AUTH_BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
async function safeJSON(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { cache: "no-store", ...init, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}
function expFromJwtMs(token, fallbackMs = 15 * 60 * 1000) {
  try { const d = jwtDecode(token); if (d && typeof d.exp === "number") return d.exp * 1000; } catch { }
  return Date.now() + fallbackMs;
}
function computeAccessTokenExpires(data, accessToken) {
  if (typeof data?.expiresAtMs === "number") return data.expiresAtMs;
  if (typeof data?.expiresInSec === "number") return Date.now() + data.expiresInSec * 1000;
  return expFromJwtMs(String(accessToken));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function keyId(raw) { return createHmac("sha256", KEY_SALT).update(String(raw)).digest("base64url"); }
function stableJitterMs(input) {
  const buf = createHmac("sha256", KEY_SALT).update(String(input)).digest();
  return ((buf[0] << 8) | buf[1]) % 10_000;
}
function lockKeyFor(key) { return `${REDIS_PREFIX}:refresh:lock:${key}`; }
function resultKeyFor(key) { return `${REDIS_PREFIX}:refresh:result:${key}`; }

const refreshPromisesByKey = new Map();
function refreshKeyFor(token) {
  const raw = token?.refreshToken ?? token?.sub ?? "anon";
  return keyId(raw);
}
const UNLOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

async function distributedSingleFlightRefresh(token, refreshFn) {
  let redis;
  try { redis = getRedis(); } catch { redis = null; }
  const userKey = refreshKeyFor(token);
  if (!redis) return await refreshFn(token);

  const rKey = resultKeyFor(userKey);
  const lKey = lockKeyFor(userKey);

  try {
    const cachedStr = await redis.get(rKey);
    if (cachedStr) return JSON.parse(cachedStr);
  } catch { }

  const lockId = randomUUID();
  let haveLock = false;
  try {
    const setOk = await redis.set(lKey, lockId, "PX", LOCK_TTL_MS, "NX");
    haveLock = setOk === "OK";
  } catch {
    return await refreshFn(token);
  }

  if (haveLock) {
    let keepAlive;
    try {
      keepAlive = setInterval(() => { redis.pexpire(lKey, LOCK_TTL_MS).catch(() => { }); },
        Math.max(250, Math.floor(LOCK_TTL_MS / 2)));

      const refreshed = await refreshFn(token);

      const expiresMs = Number(refreshed?.accessTokenExpires || 0);
      const msUntilEarly = Math.max(0, expiresMs - Date.now() - EARLY_REFRESH_WINDOW_MS);
      const resultTtlMs = Math.max(2_000, Math.min(RESULT_TTL_CAP_MS, msUntilEarly || RESULT_TTL_CAP_MS));
      try { await redis.set(rKey, JSON.stringify(refreshed), "PX", resultTtlMs); } catch { }

      return refreshed;
    } finally {
      try { clearInterval(keepAlive); } catch { }
      try { await redis.eval(UNLOCK_LUA, 1, lKey, lockId); } catch { }
    }
  }

  const start = Date.now();
  while (Date.now() - start < WAIT_TIMEOUT_MS) {
    try {
      const cachedStr = await redis.get(rKey);
      if (cachedStr) return JSON.parse(cachedStr);
    } catch { }
    await sleep(POLL_INTERVAL_MS);
  }

  const attempt = await refreshFn(token);
  if (attempt?.error === "RefreshAccessTokenError") {
    try {
      const cachedStr = await redis.get(rKey);
      if (cachedStr) return JSON.parse(cachedStr);
    } catch { }
  }
  return attempt;
}
async function getOrCreateRefreshPromise(token, refreshFn) {
  const key = refreshKeyFor(token);
  if (refreshPromisesByKey.has(key)) return refreshPromisesByKey.get(key);
  const p = (async () => await distributedSingleFlightRefresh(token, refreshFn))().finally(() => {
    refreshPromisesByKey.delete(key);
  });
  refreshPromisesByKey.set(key, p);
  return p;
}

async function refreshAccessToken(token) {
  try {
    const res = await fetchWithTimeout(
      backendUrl(REFRESH_PATH),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: token.refreshToken }) },
      DEFAULT_TIMEOUT_MS
    );
    const data = await safeJSON(res);
    if (!res.ok) {
      const errorToken = { ...token, error: "RefreshAccessTokenError", refreshError: { status: res.status, body: data } };
      if (res.status === 401 || res.status === 403) {
        errorToken.accessToken = undefined; errorToken.accessTokenExpires = 0;
      }
      return errorToken;
    }
    const accessToken = data.accessToken;
    if (!accessToken) {
      return { ...token, error: "RefreshAccessTokenError", refreshError: { status: res.status ?? 500, body: { message: "No accessToken in refresh response" } } };
    }
    const accessTokenExpires = computeAccessTokenExpires(data, accessToken);
    return {
      ...token,
      accessToken,
      accessTokenExpires,
      refreshToken: data.refreshToken ?? token.refreshToken,
      error: undefined,
      refreshError: undefined,
    };
  } catch (e) {
    return { ...token, error: "RefreshAccessTokenError", refreshError: { status: 0, body: { message: String(e) } } };
  }
}

export const {
  auth,
  signIn,
  signOut,
  handlers: { GET, POST },
} = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        let res;
        try {
          res = await fetchWithTimeout(
            backendUrl("/api/users/login"),
            {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ identifier: credentials.identifier, password: credentials.password })
            },
            DEFAULT_TIMEOUT_MS
          );
        } catch { return null; }
        if (!res.ok) return null;

        const data = await safeJSON(res);
        if (!data?.accessToken || !data?.refreshToken) return null;

        const accessToken = String(data.accessToken);
        const accessTokenExpires = computeAccessTokenExpires(data, accessToken);

        let decoded = {};
        try { decoded = jwtDecode(accessToken) || {}; } catch { }

        const id = (decoded?.sub ?? data?.user?.id ?? null) && String(decoded?.sub ?? data?.user?.id);
        const username = (data?.user?.username ?? decoded?.username ?? data?.user?.name ?? null) || null;
        const email = (data?.user?.email ?? decoded?.email ?? null) || null;
        const role = (data?.user?.role ?? decoded?.role ?? null) || null;

        const userKey = refreshKeyFor({ refreshToken: data.refreshToken, sub: id });
        const jitterMs = stableJitterMs(userKey);

        return {
          id, username, email, role,
          profile: data.user ?? null,
          accessToken,
          refreshToken: data.refreshToken,
          accessTokenExpires,
          refreshJitterMs: jitterMs,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id ?? token.sub;
        token.id = user.id ?? token.id ?? null;
        token.username = user.username ?? token.username ?? null;
        token.email = user.email ?? token.email ?? null;
        token.role = user.role ?? token.role ?? null;

        token.user = user.profile ?? token.user ?? null;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = user.accessTokenExpires;
        token.refreshJitterMs = user.refreshJitterMs ?? token.refreshJitterMs ?? 0;
        token.error = undefined;
        token.refreshError = undefined;
        return token;
      }

      if (token?.refreshError?.status === 401 || token?.refreshError?.status === 403) return token;

      const jitter = Number(token.refreshJitterMs || 0);
      const expires = Number(token.accessTokenExpires || 0);
      const needsRefresh = !expires || Date.now() >= (expires - (EARLY_REFRESH_WINDOW_MS + jitter));
      if (!needsRefresh) return token;

      try {
        const refreshed = await getOrCreateRefreshPromise(token, refreshAccessToken);
        return refreshed;
      } catch {
        return { ...token, error: "RefreshAccessTokenError" };
      }
    },
    async session({ session, token }) {
      if (token?.error === "RefreshAccessTokenError") {
        session.error = "RefreshAccessTokenError";
        session.refreshError = token.refreshError ?? null;
      } else {
        delete session.error;
        delete session.refreshError;
      }
      session.user = {
        id: token.id ?? token.sub ?? null,
        username: token.username ?? null,
        email: token.email ?? null,
        role: token.role ?? null,
        ...(token.user || {}),
      };
      session.accessToken = token.accessToken || null;
      session.accessTokenExpires = token.accessTokenExpires || null;
      return session;
    },
  },
  events: { async error(e) { console.error("[next-auth] error", e); } },
});