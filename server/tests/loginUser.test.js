const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { loginUser } = require('../controllers/user');
const User = require('../models/User');

const originalFindOne = User.findOne;

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

describe('loginUser', () => {
    afterEach(() => {
        User.findOne = originalFindOne;
    });

    test('successfully logs in with a mixed-case email identifier', async () => {
        let capturedQuery = null;

        const fakeUser = {
            _id: 'user-id-123',
            username: 'testuser',
            email: 'mixedcase@example.com',
            role: 'user',
            subscriptionStatus: 'free',
            planId: { slug: 'free' },
            isActive: true,
            isPasswordCorrect: async (attempt) => attempt === 'secret-password',
            generateAccessAndRefereshTokens: async () => ({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            }),
        };

        User.findOne = (query) => {
            capturedQuery = query;
            return {
                select: () => ({
                    populate: async () => fakeUser,
                }),
            };
        };

        const req = {
            body: {
                identifier: ' MixedCase@Example.Com ',
                password: 'secret-password',
            },
        };
        const res = createResponseDouble();

        await loginUser(req, res);

        assert.equal(res.statusCode, 200, 'Expected login to succeed with mixed-case email.');
        assert.ok(res.jsonPayload?.accessToken, 'Expected an access token in the response payload.');
        assert.ok(res.jsonPayload?.refreshToken, 'Expected a refresh token in the response payload.');

        assert.ok(capturedQuery?.$or, 'Expected the query to contain an $or clause.');
        assert.deepEqual(capturedQuery.$or[0], { username: 'MixedCase@Example.Com' }, 'Username branch should use the trimmed identifier preserving case.');
        assert.deepEqual(capturedQuery.$or[1], { email: 'mixedcase@example.com' }, 'Email branch should use the lowercased identifier.');
    });
});
