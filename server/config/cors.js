const STATIC_DEFAULT_ORIGINS = [
    'http://localhost:3000',
    'http://finance.localhost',
    'https://finance.localhost',
];

const sanitizeDomain = (value) => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim().replace(/^\.+|\.+$/g, '');

    return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeOrigin = (origin) => {
    if (typeof origin !== 'string') {
        return undefined;
    }

    const trimmed = origin.trim();

    if (!trimmed) {
        return undefined;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
        return undefined;
    }

    try {
        const url = new URL(trimmed);
        return `${url.protocol}//${url.host}`;
    } catch (error) {
        return undefined;
    }
};

const fromBaseUrl = () => {
    const baseUrl = normalizeOrigin(process.env.BASE_URL);
    return baseUrl ? [baseUrl] : [];
};

const fromSubdomain = () => {
    const domain = sanitizeDomain(process.env.BASE_DOMAIN);

    if (!domain) {
        return [];
    }

    const subdomain = sanitizeDomain(process.env.APP_SUBDOMAIN);
    const host = subdomain ? `${subdomain}.${domain}` : domain;

    return [`http://${host}`, `https://${host}`];
};

const computeDefaultOrigins = () => {
    const defaults = new Set(STATIC_DEFAULT_ORIGINS);

    for (const origin of [...fromBaseUrl(), ...fromSubdomain()]) {
        const normalized = normalizeOrigin(origin);
        if (normalized) {
            defaults.add(normalized);
        }
    }

    return Array.from(defaults);
};

const parseOrigins = (rawOrigins) =>
    rawOrigins
        .split(',')
        .map((origin) => normalizeOrigin(origin) || origin.trim())
        .filter((origin) => origin.length > 0);

const mergeOrigins = (defaults, overrides) => {
    const set = new Set(defaults);

    for (const origin of overrides) {
        const normalized = normalizeOrigin(origin) || origin;
        if (normalized === '*') {
            return ['*'];
        }

        set.add(normalized);
    }

    return Array.from(set);
};

const getAllowedOrigins = () => {
    const defaults = computeDefaultOrigins();
    const rawOrigins = process.env.CORS_ALLOWED_ORIGINS;

    if (!rawOrigins || rawOrigins.trim().length === 0) {
        return defaults;
    }

    const parsed = parseOrigins(rawOrigins);

    return parsed.length > 0 ? mergeOrigins(defaults, parsed) : defaults;
};

const createCorsOriginEvaluator = () => {
    const allowedOrigins = getAllowedOrigins();
    const allowAll = allowedOrigins.includes('*');

    return (origin, callback) => {
        if (!origin || allowAll || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    };
};

module.exports = {
    getAllowedOrigins,
    createCorsOriginEvaluator,
};
