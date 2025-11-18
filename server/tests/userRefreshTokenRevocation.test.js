const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
    updateCurrentUserEmail,
    updateCurrentUserPassword,
    deleteCurrentUserAccount,
} = require('../controllers/user');
const User = require('../models/User');
const UsedRefreshToken = require('../models/UsedRefreshToken');
const Project = require('../models/Project');
const Transaction = require('../models/Transaction');
const imageService = require('../services/imageService');

const originalFindById = User.findById;
const originalFindOne = User.findOne;
const originalDeleteMany = UsedRefreshToken.deleteMany;
const originalProjectFind = Project.find;
const originalTransactionFind = Transaction.find;
const originalProjectUpdateMany = Project.updateMany;
const originalTransactionUpdateMany = Transaction.updateMany;
const originalDiscardDescriptor = imageService.discardDescriptor;

const createQueryStub = (result) => ({
    select: () => ({
        lean: () => Promise.resolve(result),
    }),
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

describe('refresh token revocation for current-user flows', () => {
    afterEach(() => {
        User.findById = originalFindById;
        User.findOne = originalFindOne;
        UsedRefreshToken.deleteMany = originalDeleteMany;
        Project.find = originalProjectFind;
        Transaction.find = originalTransactionFind;
        Project.updateMany = originalProjectUpdateMany;
        Transaction.updateMany = originalTransactionUpdateMany;
        imageService.discardDescriptor = originalDiscardDescriptor;
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

        Project.find = () => createQueryStub([]);
        Transaction.find = () => createQueryStub([]);
        Project.updateMany = async () => {};
        Transaction.updateMany = async () => {};
        imageService.discardDescriptor = async () => {};

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

    test('deleteCurrentUserAccount removes stored attachments for related records', async () => {
        const userId = 'user-attachments';
        const markedFields = [];
        let deleteFilter = null;
        const discardedDescriptors = [];
        let projectUpdateArgs = null;
        let transactionUpdateArgs = null;

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

        const projectAttachment = { filename: 'project.png', path: '/tmp/project.png' };
        const transactionAttachment = { filename: 'receipt.png', path: '/tmp/receipt.png' };

        Project.find = () => createQueryStub([
            { _id: 'project-1', attachment: projectAttachment },
            { _id: 'project-2', attachment: null },
        ]);
        Transaction.find = () => createQueryStub([
            { _id: 'transaction-1', attachment: transactionAttachment },
            { _id: 'transaction-2', attachment: null },
        ]);

        Project.updateMany = async (filter, update) => {
            projectUpdateArgs = { filter, update };
        };
        Transaction.updateMany = async (filter, update) => {
            transactionUpdateArgs = { filter, update };
        };

        imageService.discardDescriptor = async (descriptor) => {
            discardedDescriptors.push(descriptor);
        };

        const req = {
            user: { _id: userId },
            body: {
                currentPassword: 'current-password',
            },
        };

        const res = createResponseDouble();

        await deleteCurrentUserAccount(req, res);

        assert.equal(res.statusCode, 200, 'Expected request to succeed.');
        assert.equal(userDoc.isActive, false, 'Expected account to be deactivated.');
        assert.equal(userDoc.refreshToken, undefined, 'Expected refresh token to be cleared.');
        assert.ok(markedFields.includes('refreshToken'), 'Expected refresh token to be marked as modified.');
        assert.deepEqual(deleteFilter, { userId }, 'Expected matching used tokens to be deleted.');

        assert.equal(discardedDescriptors.length, 2, 'Expected all attachments to be discarded.');
        assert.ok(discardedDescriptors.some((descriptor) => descriptor === projectAttachment), 'Expected project attachment to be discarded.');
        assert.ok(discardedDescriptors.some((descriptor) => descriptor === transactionAttachment), 'Expected transaction attachment to be discarded.');

        assert.deepEqual(projectUpdateArgs, {
            filter: { _id: { $in: ['project-1'] } },
            update: { $unset: { attachment: '' } },
        }, 'Expected project attachments to be unset.');

        assert.deepEqual(transactionUpdateArgs, {
            filter: { _id: { $in: ['transaction-1'] } },
            update: { $unset: { attachment: '' } },
        }, 'Expected transaction attachments to be unset.');
    });
});
