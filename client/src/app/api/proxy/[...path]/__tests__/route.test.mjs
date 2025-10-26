import assert from "node:assert/strict";
import { before, after, beforeEach, afterEach, test } from "node:test";

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_BACKEND_URL = process.env.AUTH_BACKEND_URL;
const ORIGINAL_PUBLIC_PATHS = process.env.PROXY_PUBLIC_PATHS;

process.env.AUTH_BACKEND_URL = "http://backend.local";
process.env.PROXY_PUBLIC_PATHS = "/public";

const { forward } = await import("../route.js");

after(() => {
  if (ORIGINAL_BACKEND_URL === undefined) {
    delete process.env.AUTH_BACKEND_URL;
  } else {
    process.env.AUTH_BACKEND_URL = ORIGINAL_BACKEND_URL;
  }

  if (ORIGINAL_PUBLIC_PATHS === undefined) {
    delete process.env.PROXY_PUBLIC_PATHS;
  } else {
    process.env.PROXY_PUBLIC_PATHS = ORIGINAL_PUBLIC_PATHS;
  }
});

beforeEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

function makeRequest({ method, headers, search = "", body } = {}) {
  return {
    method,
    headers: new Headers(headers),
    nextUrl: { search },
    body,
  };
}

test("forwards GET requests for unauthenticated users", async () => {
  const request = makeRequest({
    method: "GET",
    headers: { Authorization: "Bearer user" },
    search: "?foo=bar",
  });

  let receivedUrl;
  let receivedOptions;

  global.fetch = async (url, options) => {
    receivedUrl = url;
    receivedOptions = options;
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const response = await forward(request, ["reports", "summary"], {
    authFn: async () => null,
  });

  assert.equal(receivedUrl, "http://backend.local/reports/summary?foo=bar");
  assert.equal(receivedOptions.headers.get("Authorization"), null);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("allows unauthenticated requests to public paths", async () => {
  const requestBody = JSON.stringify({ email: "guest@example.com" });
  const request = makeRequest({
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer guest" },
    body: requestBody,
  });

  let receivedOptions;

  global.fetch = async (url, options) => {
    receivedOptions = options;
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  const response = await forward(request, ["public", "signup"], {
    authFn: async () => null,
  });

  assert.equal(receivedOptions.headers.get("Authorization"), null);
  assert.equal(receivedOptions.body, requestBody);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
});

test("rejects protected routes when unauthenticated", async () => {
  const request = makeRequest({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  global.fetch = () => {
    throw new Error("fetch should not be called");
  };

  const response = await forward(request, ["secure", "update"], {
    authFn: async () => null,
  });

  assert.equal(response.status, 401);
  assert.equal(await response.text(), "Unauthorized");
});

test("attaches the bearer token for protected routes", async () => {
  const request = makeRequest({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  let receivedOptions;

  global.fetch = async (url, options) => {
    receivedOptions = options;
    return new Response(null, { status: 204 });
  };

  const response = await forward(request, ["secure", "update"], {
    authFn: async () => ({ accessToken: "abc123" }),
  });

  assert.equal(receivedOptions.headers.get("Authorization"), "Bearer abc123");
  assert.equal(response.status, 204);
});
