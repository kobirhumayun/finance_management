const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const errorHandler = require('../middleware/errorHandler');

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
