const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Relays authentication-related requests to the upstream backend.
 *
 * @param {Request} req Incoming Next.js request object.
 * @param {object} options Relay configuration.
 * @param {string} options.endpointPath Backend endpoint path starting with a slash.
 * @param {number} [options.timeoutMs] Timeout in milliseconds before aborting the request.
 * @param {string} [options.timeoutMessage] Error message returned when the request times out.
 * @returns {Promise<Response>}
 */
export async function relayAuthRequest(req, { endpointPath, timeoutMs, timeoutMessage }) {
  const controller = new AbortController();
  const timeoutDuration = Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutDuration);
  const backendBase = (process.env.AUTH_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

  try {
    const upstream = await fetch(`${backendBase}${endpointPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await req.text(),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await upstream.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    const init = { status: upstream.status };
    if (data === null) {
      return new Response(null, init);
    }

    if (typeof data === "object") {
      return Response.json(data, init);
    }

    return new Response(String(data), init);
  } catch (error) {
    const message = error.name === "AbortError"
      ? timeoutMessage ?? "Request to authentication service timed out."
      : "Unable to reach authentication service.";
    return Response.json({ message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
