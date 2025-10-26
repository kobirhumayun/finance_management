import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { relayAuthRequest } from "../authRelay.js";

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ENV_URL = process.env.AUTH_BACKEND_URL;

beforeEach(() => {
  process.env.AUTH_BACKEND_URL = "http://auth.local";
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_ENV_URL === undefined) {
    delete process.env.AUTH_BACKEND_URL;
  } else {
    process.env.AUTH_BACKEND_URL = ORIGINAL_ENV_URL;
  }
});

test("translates JSON responses from the backend", async () => {
  const reqBody = JSON.stringify({ email: "user@example.com" });
  const request = { text: async () => reqBody };

  let receivedUrl;
  let receivedOptions;

  global.fetch = async (url, options) => {
    receivedUrl = url;
    receivedOptions = options;

    return {
      status: 201,
      async text() {
        return JSON.stringify({ message: "Created" });
      },
    };
  };

  const response = await relayAuthRequest(request, {
    endpointPath: "/api/users/register",
    timeoutMs: 100,
    timeoutMessage: "should not trigger",
  });

  assert.equal(receivedUrl, "http://auth.local/api/users/register");
  assert.equal(receivedOptions.method, "POST");
  assert.equal(receivedOptions.headers["Content-Type"], "application/json");
  assert.equal(receivedOptions.body, reqBody);

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { message: "Created" });
  assert.equal(response.headers.get("content-type"), "application/json");
});

test("returns a 502 response when the relay times out", async () => {
  const request = { text: async () => "{}" };

  global.fetch = (url, options) =>
    new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      });
    });

  const response = await relayAuthRequest(request, {
    endpointPath: "/api/users/register",
    timeoutMs: 10,
    timeoutMessage: "Custom timeout message.",
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    message: "Custom timeout message.",
  });
});
