const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
    updateCurrentUserEmail,
    updateCurrentUserPassword,
    deleteCurrentUserAccount,
} = require('../controllers/user');
const User = require('../models/User');
const UsedRefreshToken = require('../models/UsedRefreshToken');

const originalFindById = User.findById;
const originalFindOne = User.findOne;
const originalDeleteMany = UsedRefreshToken.deleteMany;

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

describe('refresh token revocation for current-user flows', () => {
    afterEach(() => {
        User.findById = originalFindById;
        User.findOne = originalFindOne;
        UsedRefreshToken.deleteMany = originalDeleteMany;
    });

    test('updateCurrentUserEmail clears refresh token and marks it as modified', async () => {
        const userId = 'user-123';
        const markedFields = [];
        let deleteFilter = null;

        const userDoc = {
            _id: userId,
            email: 'old@example.com',
            isEmailVerified: true,
            isActive: true,
            refreshToken: 'existing-refresh-token',
            metadata: {},
            isPasswordCorrect: async (attempt) => attempt === 'current-password',
            save: async () => {},
            markModified: (field) => {
                markedFields.push(field);
            },
        };

        User.findById = () => ({
            select: () => Promise.resolve(userDoc),
        });

        User.findOne = () => ({
            select: () => Promise.resolve(null),
        });

        UsedRefreshToken.deleteMany = async (filter) => {
            deleteFilter = filter;
        };

        const req = {
            user: { _id: userId },
            body: {
                newEmail: 'new@example.com',
                currentPassword: 'current-password',
            },
        };

        const res = createResponseDouble();

        await updateCurrentUserEmail(req, res);

        assert.equal(res.statusCode, 200, 'Expected request to succeed.');
        assert.equal(userDoc.email, 'new@example.com', 'Expected email to be updated.');
        assert.equal(userDoc.isEmailVerified, false, 'Expected email verification to reset.');
        assert.equal(userDoc.refreshToken, undefined, 'Expected refresh token to be cleared.');
        assert.ok(markedFields.includes('refreshToken'), 'Expected refresh token to be marked as modified.');
        assert.deepEqual(deleteFilter, { userId }, 'Expected matching used tokens to be deleted.');
    });

    test('updateCurrentUserPassword clears refresh token and marks it as modified', async () => {
        const userId = 'user-456';
        const markedFields = [];
        let deleteFilter = null;

        const userDoc = {
            _id: userId,
            isActive: true,
            refreshToken: 'existing-refresh-token',
            metadata: {},
            password_hash: 'old-hash',
            isPasswordCorrect: async (attempt) => attempt === 'current-password',
            save: async () => {},
            markModified: (field) => {
                markedFields.push(field);
            },
        };

        User.findById = () => ({
            select: () => Promise.resolve(userDoc),
        });

        UsedRefreshToken.deleteMany = async (filter) => {
            deleteFilter = filter;
        };

        const req = {
            user: { _id: userId },
            body: {
                currentPassword: 'current-password',
                newPassword: 'brand-new-password',
            },
        };

        const res = createResponseDouble();

        await updateCurrentUserPassword(req, res);

        assert.equal(res.statusCode, 200, 'Expected request to succeed.');
        assert.equal(userDoc.password_hash, 'brand-new-password', 'Expected password to be updated.');
        assert.equal(userDoc.refreshToken, undefined, 'Expected refresh token to be cleared.');
        assert.ok(markedFields.includes('refreshToken'), 'Expected refresh token to be marked as modified.');
        assert.deepEqual(deleteFilter, { userId }, 'Expected matching used tokens to be deleted.');
    });

    test('deleteCurrentUserAccount clears refresh token and marks it as modified', async () => {
        const userId = 'user-789';
        const markedFields = [];
        let deleteFilter = null;

        const userDoc = {
            _id: userId,
            isActive: true,
            refreshToken: 'existing-refresh-token',
            metadata: {},
            isPasswordCorrect: async (attempt) => attempt === 'current-password',
            save: async () => {},
            markModified: (field) => {
                markedFields.push(field);
            },
        };

        User.findById = () => ({
            select: () => Promise.resolve(userDoc),
        });

        UsedRefreshToken.deleteMany = async (filter) => {
            deleteFilter = filter;
        };

        const req = {
            user: { _id: userId },
            body: {
                currentPassword: 'current-password',
                reason: 'No longer needed',
            },
        };

        const res = createResponseDouble();

        await deleteCurrentUserAccount(req, res);

        assert.equal(res.statusCode, 200, 'Expected request to succeed.');
        assert.equal(userDoc.isActive, false, 'Expected account to be deactivated.');
        assert.equal(userDoc.refreshToken, undefined, 'Expected refresh token to be cleared.');
        assert.ok(markedFields.includes('refreshToken'), 'Expected refresh token to be marked as modified.');
        assert.deepEqual(deleteFilter, { userId }, 'Expected matching used tokens to be deleted.');
    });
});
