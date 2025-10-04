import { NextResponse } from "next/server";

const BACKEND_BASE = (process.env.AUTH_BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.REGISTER_TIMEOUT_MS || 15_000);

export async function POST(req) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(`${BACKEND_BASE}/api/users/register`, {
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
      return new NextResponse(null, init);
    }

    if (typeof data === "object") {
      return NextResponse.json(data, init);
    }

    return new NextResponse(String(data), init);
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "Registration request timed out."
        : "Unable to reach authentication service.";
    return NextResponse.json({ message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
