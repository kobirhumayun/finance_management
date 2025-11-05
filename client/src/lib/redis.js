import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let _client = globalThis.__IOREDIS_CLIENT__;
let _shutdown = globalThis.__IOREDIS_SHUTDOWN__ || false;

export function getRedis() {
  if (_client) return _client;

  _client = new Redis(REDIS_URL, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 10_000),
    retryStrategy(times) { return Math.min(50 * times, 2000); },
    reconnectOnError(err) {
      const m = String(err?.message || "");
      if (m.includes("READONLY")) return true;
      if (m.includes("ETIMEDOUT")) return true;
      if (m.includes("ECONNRESET")) return true;
      return false;
    },
  });

  _client.on("error", (e) => console.error("[ioredis] error:", e?.message || e));
  _client.on("end", () => console.warn("[ioredis] connection ended"));

  if (!_shutdown) {
    const shutdown = async () => {
      try { await _client.quit(); } catch { try { _client.disconnect(); } catch {} }
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    globalThis.__IOREDIS_SHUTDOWN__ = true;
    _shutdown = true;
  }

  globalThis.__IOREDIS_CLIENT__ = _client;
  return _client;
}