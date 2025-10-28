import assert from "node:assert/strict";
import { test } from "node:test";

const cookies = [
  "session=abc123; Path=/; HttpOnly",
  "prefs=dark; Path=/; SameSite=Lax",
];

test("forwards multiple set-cookie headers from the upstream response", async (t) => {
  const routeModule = await import("../[...path]/proxy.mjs");
  t.after(() => {
    routeModule.__resetProxyTestOverrides();
  });

  let receivedUrl;
  let receivedInit;

  routeModule.__setProxyTestOverrides({
    auth: async () => ({ accessToken: "token-123" }),
    backendBase: "https://backend.example",
    fetch: async (url, init) => {
      receivedUrl = url;
      receivedInit = init;

      return new Response("proxied", {
        status: 200,
        headers: [
          ["set-cookie", cookies[0]],
          ["set-cookie", cookies[1]],
          ["content-type", "text/plain"],
        ],
      });
    },
  });

  const { GET } = routeModule;
  const request = new Request("https://app.local/api/proxy/cookies");
  request.nextUrl = new URL(request.url);

  const response = await GET(request, { params: Promise.resolve({ path: ["cookies"] }) });

  assert.equal(receivedUrl, "https://backend.example/cookies");
  assert.equal(receivedInit.method, "GET");
  const authHeader =
    (typeof receivedInit.headers?.get === "function"
      ? receivedInit.headers.get("authorization")
      : receivedInit.headers?.authorization) ?? undefined;
  assert.equal(authHeader, "Bearer token-123");

  let errorPayload;
  if (response.status !== 200) {
    const text = await response.text();
    try {
      errorPayload = JSON.parse(text);
    } catch {
      errorPayload = text;
    }
  }

  assert.equal(
    response.status,
    200,
    errorPayload ? JSON.stringify(errorPayload) : "expected upstream proxy to succeed",
  );
  const forwardedCookies =
    response.headers.getSetCookie?.() ?? response.headers.raw?.()["set-cookie"] ?? [];
  assert.deepEqual(forwardedCookies, cookies);

  assert.equal(response.headers.get("content-type"), "text/plain");
});
