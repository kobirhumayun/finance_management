const parseAllowedOrigins = (value) => {
  if (!value) return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

const allowedOrigins = (() => {
  const parsed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
})();

const isOriginAllowed = (origin) => {
  if (!origin) return false;
  return allowedOrigins.some((allowed) => allowed.toLowerCase() === origin.toLowerCase());
};

module.exports = {
  allowedOrigins,
  isOriginAllowed,
  parseAllowedOrigins,
  DEFAULT_ALLOWED_ORIGINS,
};
