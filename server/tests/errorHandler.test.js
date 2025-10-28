const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const errorHandler = require('../middleware/errorHandler');
const AppError = require('../utils/AppError');

let originalConsoleError;

before(() => {
    originalConsoleError = console.error;
    console.error = () => {};
});

after(() => {
    console.error = originalConsoleError;
});

const createResponseDouble = () => {
    const res = {};
    res.statusCode = null;
    res.jsonPayload = null;
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (payload) => {
        res.jsonPayload = payload;
        return res;
    };
    return res;
};

describe('errorHandler duplicate key handling', () => {
    const originalEnv = process.env.NODE_ENV;

    before(() => {
        process.env.NODE_ENV = 'production';
    });

    after(() => {
        process.env.NODE_ENV = originalEnv;
    });

    test('uses keyValue to build duplicate field error message', () => {
        const req = { originalUrl: '/api/test' };
        const res = createResponseDouble();
        const next = () => {};

        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        err.keyValue = { email: 'duplicate@example.com' };

        errorHandler(err, req, res, next);

        assert.equal(res.statusCode, 400);
        assert.equal(res.jsonPayload.status, 'fail');
        assert.match(res.jsonPayload.message, /duplicate@example.com/i);
    });

    test('falls back to parsing error message when keyValue is missing', () => {
        const req = { originalUrl: '/api/test' };
        const res = createResponseDouble();
        const next = () => {};

        const err = new Error('E11000 duplicate key error dup key: { username: "duplicateUser" }');
        err.code = 11000;

        errorHandler(err, req, res, next);

        assert.equal(res.statusCode, 400);
        assert.equal(res.jsonPayload.status, 'fail');
        assert.match(res.jsonPayload.message, /duplicateuser/i);
    });
});

describe('errorHandler fallback environment handling', () => {
    const originalEnv = process.env.NODE_ENV;

    before(() => {
        process.env.NODE_ENV = 'staging';
    });

    after(() => {
        process.env.NODE_ENV = originalEnv;
    });

    test('returns generic error response for non-dev/prod environments', () => {
        const req = { originalUrl: '/api/test' };
        const res = createResponseDouble();
        const next = () => {};

        const err = new Error('Unhandled error');

        errorHandler(err, req, res, next);

        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.jsonPayload, {
            status: 'error',
            message: 'Something went very wrong!',
        });
    });
});

describe('errorHandler request path resolution', () => {
    const originalEnv = process.env.NODE_ENV;

    before(() => {
        process.env.NODE_ENV = 'production';
    });

    after(() => {
        process.env.NODE_ENV = originalEnv;
    });

    test('falls back to req.url when originalUrl is unavailable', () => {
        const req = { url: '/api/test' };
        const res = createResponseDouble();
        const next = () => {};

        const err = new AppError('Handled via fallback path', 418);

        errorHandler(err, req, res, next);

        assert.equal(res.statusCode, 418);
        assert.deepEqual(res.jsonPayload, {
            status: 'fail',
            message: 'Handled via fallback path',
        });
    });

    test('falls back to baseUrl when originalUrl and url are unavailable', () => {
        const req = { baseUrl: '/api/base-only' };
        const res = createResponseDouble();
        const next = () => {};

        const err = new AppError('Handled via baseUrl', 409);

        errorHandler(err, req, res, next);

        assert.equal(res.statusCode, 409);
        assert.deepEqual(res.jsonPayload, {
            status: 'fail',
            message: 'Handled via baseUrl',
        });
    });

    test('falls back to path when no other request url fields are provided', () => {
        const req = { path: '/api/path-only' };
        const res = createResponseDouble();
        const next = () => {};

        const err = new AppError('Handled via path', 422);

        errorHandler(err, req, res, next);

        assert.equal(res.statusCode, 422);
        assert.deepEqual(res.jsonPayload, {
            status: 'fail',
            message: 'Handled via path',
        });
    });

    test('ignores whitespace-only originalUrl values when resolving API requests', () => {
        const req = { originalUrl: '   ', url: '/api/whitespace' };
        const res = createResponseDouble();
        const next = () => {};

        const err = new AppError('Handled via trimmed fallback', 409);

        errorHandler(err, req, res, next);

        assert.equal(res.statusCode, 409);
        assert.deepEqual(res.jsonPayload, {
            status: 'fail',
            message: 'Handled via trimmed fallback',
        });
    });

    test('treats non-string paths as non-API requests', () => {
        const req = { originalUrl: { path: '/api/test' } };
        const res = createResponseDouble();
        const next = () => {};

        const err = new AppError('Non API error', 400);

        errorHandler(err, req, res, next);

        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.jsonPayload, {
            status: 'error',
            message: 'Something went very wrong!',
        });
    });

    test('handles missing request object safely', () => {
        const res = createResponseDouble();
        const next = () => {};

        const err = new AppError('Missing request', 400);

        assert.doesNotThrow(() => {
            errorHandler(err, null, res, next);
        });

        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.jsonPayload, {
            status: 'error',
            message: 'Something went very wrong!',
        });
    });
});
