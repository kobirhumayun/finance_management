const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];

const normalizeOrigin = (origin) => {
    if (!origin) {
        return origin;
    }

    try {
        const url = new URL(origin);
        return `${url.protocol}//${url.hostname}`;
    } catch (error) {
        return origin;
    }
};

const parseOrigins = (rawOrigins) =>
    rawOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

const getAllowedOrigins = () => {
    const rawOrigins = process.env.CORS_ALLOWED_ORIGINS;

    if (!rawOrigins || rawOrigins.trim().length === 0) {
        return DEFAULT_ALLOWED_ORIGINS;
    }

    const parsed = parseOrigins(rawOrigins);

    return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
};

const createCorsOriginEvaluator = () => {
    const allowedOrigins = getAllowedOrigins();
    const allowAll = allowedOrigins.includes('*');

    const allowedOriginSet = new Set();
    allowedOrigins.forEach((origin) => {
        allowedOriginSet.add(origin);
        allowedOriginSet.add(normalizeOrigin(origin));
    });

    return (origin, callback) => {
        const normalizedOrigin = normalizeOrigin(origin);

        if (
            !origin ||
            allowAll ||
            allowedOriginSet.has(origin) ||
            allowedOriginSet.has(normalizedOrigin)
        ) {
            return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    };
};

module.exports = {
    getAllowedOrigins,
    createCorsOriginEvaluator,
};
