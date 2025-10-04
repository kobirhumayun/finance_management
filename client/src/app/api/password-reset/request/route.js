import { relayPasswordReset } from "../_relay";

export async function POST(req) {
  return relayPasswordReset(req, "/api/users/request-password-reset");
}
