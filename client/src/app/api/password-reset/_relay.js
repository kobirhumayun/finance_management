import { relayAuthRequest } from "@/lib/authRelay";

const TIMEOUT_MS = Number(process.env.PASSWORD_RESET_TIMEOUT_MS || 15_000);

export function relayPasswordReset(req, backendPath) {
  return relayAuthRequest(req, {
    endpointPath: backendPath,
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: "Password reset request timed out.",
  });
}
