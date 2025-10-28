import assert from "node:assert/strict";
import { test } from "node:test";
import { relayAuthRequest } from "../authRelay.mjs";

class MockRequest {
  constructor(body) {
    this._body = body;
  }

  async text() {
    return this._body;
  }
}

test("returns backend JSON payloads", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await relayAuthRequest(new MockRequest("{}"), { endpointPath: "/login" });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("converts timeout aborts into friendly errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    throw new DOMException("The operation was aborted.", "AbortError");
  };

  try {
    const result = await relayAuthRequest(new MockRequest("{}"), {
      endpointPath: "/login",
      timeoutMs: 1,
      timeoutMessage: "Too slow!",
    });
    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { message: "Too slow!" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
