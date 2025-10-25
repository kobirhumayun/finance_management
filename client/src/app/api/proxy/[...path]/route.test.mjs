import { describe, it, beforeEach, afterEach } from "node:test";
import { mock } from "node:test";
import assert from "node:assert/strict";

const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
process.env.ALLOWED_ORIGINS = "http://localhost:3000,https://app.example.com";

const {
  GET,
  OPTIONS,
  __setProxyTestOverrides,
} = await import("./route.js");

const paramsContext = (segments) => ({
  params: Promise.resolve({ path: segments }),
});

describe("proxy route origin validation", () => {
  let authStub;

  beforeEach(() => {
    authStub = mock.fn(async () => ({}));
    __setProxyTestOverrides({
      backendBaseUrl: "http://backend.test",
      auth: authStub,
    });
  });

  afterEach(() => {
    mock.restoreAll();
    __setProxyTestOverrides({ reset: true });
  });

  it("allows preflight requests from configured origins", async () => {
    const request = new Request("http://localhost/api/proxy", {
      method: "OPTIONS",
      headers: { Origin: "https://app.example.com" },
    });

    const response = await OPTIONS(request);

    assert.strictEqual(response.status, 204);
    assert.strictEqual(
      response.headers.get("access-control-allow-origin"),
      "https://app.example.com"
    );
  });

  it("rejects preflight requests from unknown origins", async () => {
    const request = new Request("http://localhost/api/proxy", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example.com" },
    });

    const response = await OPTIONS(request);

    assert.strictEqual(response.status, 403);
    const body = await response.json();
    assert.strictEqual(body.error, "OriginNotAllowed");
  });

  it("forwards authenticated requests with allowed origin", async () => {
    authStub.mock.mockImplementation(async () => ({ accessToken: "abc123" }));

    const backendResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    const fetchMock = mock.method(globalThis, "fetch", async () => backendResponse);

    const request = new Request("http://localhost/api/proxy/accounts", {
      method: "GET",
      headers: { Origin: "http://localhost:3000" },
    });
    request.nextUrl = new URL(request.url);

    const response = await GET(request, paramsContext(["accounts"]));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:3000"
    );
    assert.deepEqual(await response.json(), { ok: true });

    const [{ arguments: [calledUrl, calledOptions] }] = fetchMock.mock.calls;
    assert.strictEqual(calledUrl, "http://backend.test/accounts");
    assert.strictEqual(calledOptions.method, "GET");
  });

  it("rejects authenticated requests from disallowed origins", async () => {
    authStub.mock.mockImplementation(async () => ({ accessToken: "abc123" }));

    const request = new Request("http://localhost/api/proxy/accounts", {
      method: "GET",
      headers: { Origin: "https://evil.example.com" },
    });
    request.nextUrl = new URL(request.url);

    const response = await GET(request, paramsContext(["accounts"]));

    assert.strictEqual(response.status, 403);
    const payload = await response.json();
    assert.match(payload.message, /not allowed/i);
  });
});

if (originalAllowedOrigins === undefined) {
  delete process.env.ALLOWED_ORIGINS;
} else {
  process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
}
