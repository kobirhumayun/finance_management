const parseAllowedOrigins = (value) => {
  if (!value) return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

let cachedAllowedOrigins = null;

const loadAllowedOrigins = () => {
  if (cachedAllowedOrigins) return cachedAllowedOrigins;

  const parsed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  cachedAllowedOrigins = parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
  return cachedAllowedOrigins;
};

const getAllowedOrigins = () => [...loadAllowedOrigins()];

const findAllowedOrigin = (origin) => {
  if (!origin) return null;

  const lower = origin.toLowerCase();
  return loadAllowedOrigins().find((allowed) => allowed.toLowerCase() === lower) ?? null;
};

const isOriginAllowed = (origin) => Boolean(findAllowedOrigin(origin));

const refreshAllowedOrigins = () => {
  cachedAllowedOrigins = null;
  return loadAllowedOrigins();
};

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  findAllowedOrigin,
  getAllowedOrigins,
  isOriginAllowed,
  parseAllowedOrigins,
  refreshAllowedOrigins,
};
