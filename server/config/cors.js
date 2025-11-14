const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://finance.localhost',
    'https://finance.localhost',
];

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
