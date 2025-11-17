const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const loadCorsModule = () => {
    delete require.cache[require.resolve('../config/cors')];
    return require('../config/cors');
};

const assertOriginAllowed = (evaluator, origin) =>
    new Promise((resolve, reject) => {
        evaluator(origin, (err, allowed) => {
            try {
                assert.ifError(err);
                assert.equal(allowed, true);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });

describe('createCorsOriginEvaluator origin normalization', () => {
    const originalEnv = process.env.CORS_ALLOWED_ORIGINS;

    afterEach(() => {
        if (typeof originalEnv === 'undefined') {
            delete process.env.CORS_ALLOWED_ORIGINS;
        } else {
            process.env.CORS_ALLOWED_ORIGINS = originalEnv;
        }
        delete require.cache[require.resolve('../config/cors')];
    });

    test('allows localhost without port when default origins are used', async () => {
        delete process.env.CORS_ALLOWED_ORIGINS;
        const { createCorsOriginEvaluator } = loadCorsModule();
        const evaluator = createCorsOriginEvaluator();

        await assertOriginAllowed(evaluator, 'http://localhost');
    });

    test('allows origins that match after removing ports', async () => {
        process.env.CORS_ALLOWED_ORIGINS = 'http://example.com:4000';
        const { createCorsOriginEvaluator } = loadCorsModule();
        const evaluator = createCorsOriginEvaluator();

        await assertOriginAllowed(evaluator, 'http://example.com');
    });
});
