import { relayAuthRequest } from "@/lib/authRelay";

const TIMEOUT_MS = Number(process.env.REGISTER_TIMEOUT_MS || 15_000);

export async function POST(req) {
  return relayAuthRequest(req, {
    endpointPath: "/api/users/register",
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: "Registration request timed out.",
  });
}
