const DEFAULT_BACKEND_URL = "http://localhost:5000";

export function getBackendBaseUrl() {
  return (process.env.AUTH_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/$/, "");
}

export function withBackendPath(path = "") {
  const base = getBackendBaseUrl();
  return `${base}${String(path).startsWith("/") ? path : `/${path}`}`;
}
