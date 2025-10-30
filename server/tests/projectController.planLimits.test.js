const { describe, test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Plan = require('../models/Plan');
const Project = require('../models/Project');
const Transaction = require('../models/Transaction');
const { createProject, createTransaction } = require('../controllers/projectController');

const originalPlanFindOne = Plan.findOne;
const originalProjectFindOne = Project.findOne;
const originalProjectCountDocuments = Project.countDocuments;
const originalProjectCreate = Project.create;
const originalTransactionCountDocuments = Transaction.countDocuments;
const originalTransactionCreate = Transaction.create;

const createQueryResult = (value) => ({
    select() {
        return {
            lean: async () => value,
        };
    },
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

beforeEach(() => {
    Plan.findOne = () => createQueryResult({ slug: 'free', limits: {} });
    Project.findOne = async () => null;
    Project.countDocuments = async () => 0;
    Project.create = async (doc) => ({
        ...doc,
        _id: '507f1f77bcf86cd799439011',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: null,
    });
    Transaction.countDocuments = async () => 0;
    Transaction.create = async (doc) => ({
        ...doc,
        _id: '507f1f77bcf86cd799439012',
        createdAt: new Date('2024-01-02T00:00:00Z'),
        updatedAt: null,
    });
});

after(() => {
    Plan.findOne = originalPlanFindOne;
    Project.findOne = originalProjectFindOne;
    Project.countDocuments = originalProjectCountDocuments;
    Project.create = originalProjectCreate;
    Transaction.countDocuments = originalTransactionCountDocuments;
    Transaction.create = originalTransactionCreate;
});

describe('projectController plan limit enforcement', { concurrency: false }, () => {
    test('createProject rejects requests once the plan project limit is reached', async () => {
        Plan.findOne = () => createQueryResult({
            slug: 'pro',
            limits: { projects: { maxActive: 1 } },
        });
        Project.countDocuments = async () => 1;
        let createInvoked = false;
        Project.create = async () => {
            createInvoked = true;
            return null;
        };

        const req = {
            user: { _id: '507f1f77bcf86cd799439021', plan: 'pro' },
            body: { name: 'Budget Tracker', description: '', currency: 'usd' },
        };
        const res = createResponseDouble();

        await createProject(req, res, (error) => {
            throw error || new Error('createProject should not call next on limit enforcement');
        });

        assert.equal(res.statusCode, 403);
        assert.equal(res.jsonPayload?.limit, 1);
        assert.equal(createInvoked, false);
    });

    test('createProject allows creation when under the limit', async () => {
        Plan.findOne = () => createQueryResult({
            slug: 'enterprise',
            limits: { projects: { maxActive: 5 } },
        });
        Project.countDocuments = async () => 2;
        let createInvoked = false;
        Project.create = async (doc) => {
            createInvoked = true;
            return {
                ...doc,
                _id: '507f1f77bcf86cd799439031',
                createdAt: new Date('2024-02-01T00:00:00Z'),
                updatedAt: null,
            };
        };

        const req = {
            user: { _id: '507f1f77bcf86cd799439041', plan: 'enterprise' },
            body: { name: 'Cash Flow', description: 'Track cash', currency: 'usd' },
        };
        const res = createResponseDouble();

        await createProject(req, res, (error) => {
            throw error || new Error('createProject should not call next on success');
        });

        assert.equal(res.statusCode, 201);
        assert.equal(createInvoked, true);
        assert.equal(res.jsonPayload?.project?.name, 'Cash Flow');
    });

    test('createTransaction rejects creation when the per-project transaction cap is reached', async () => {
        Plan.findOne = () => createQueryResult({
            slug: 'professional',
            limits: { transactions: { perProject: 2 } },
        });
        const projectId = '507f1f77bcf86cd799439051';
        Project.findOne = async (query) => {
            if (query?._id?.toString() === projectId && query.user_id === '507f1f77bcf86cd799439061') {
                return {
                    _id: projectId,
                    user_id: '507f1f77bcf86cd799439061',
                    name: 'Ops',
                };
            }
            return null;
        };
        Transaction.countDocuments = async () => 2;
        let createInvoked = false;
        Transaction.create = async () => {
            createInvoked = true;
            return null;
        };

        const req = {
            user: { _id: '507f1f77bcf86cd799439061', plan: 'professional' },
            params: { projectId },
            body: {
                type: 'income',
                date: '2024-03-10',
                amount: 150,
                subcategory: 'Consulting',
                description: 'Retainer',
            },
        };
        const res = createResponseDouble();

        await createTransaction(req, res, (error) => {
            throw error || new Error('createTransaction should not call next on limit enforcement');
        });

        assert.equal(res.statusCode, 403);
        assert.equal(res.jsonPayload?.limit, 2);
        assert.equal(createInvoked, false);
    });

    test('createTransaction allows creation when under the plan transaction limit', async () => {
        Plan.findOne = () => createQueryResult({
            slug: 'enterprise',
            limits: { transactions: { perProject: 3 } },
        });
        const projectId = '507f1f77bcf86cd799439071';
        Project.findOne = async (query) => {
            if (query?._id?.toString() === projectId && query.user_id === '507f1f77bcf86cd799439081') {
                return {
                    _id: projectId,
                    user_id: '507f1f77bcf86cd799439081',
                    name: 'Marketing',
                };
            }
            return null;
        };
        Transaction.countDocuments = async () => 1;
        let createInvoked = false;
        Transaction.create = async (doc) => {
            createInvoked = true;
            return {
                ...doc,
                _id: '507f1f77bcf86cd799439082',
                createdAt: new Date('2024-03-15T00:00:00Z'),
                updatedAt: null,
            };
        };

        const req = {
            user: { _id: '507f1f77bcf86cd799439081', plan: 'enterprise' },
            params: { projectId },
            body: {
                type: 'expense',
                date: '2024-03-12',
                amount: 80,
                subcategory: 'Ads',
                description: 'Campaign spend',
            },
        };
        const res = createResponseDouble();

        await createTransaction(req, res, (error) => {
            throw error || new Error('createTransaction should not call next on success');
        });

        assert.equal(res.statusCode, 201);
        assert.equal(createInvoked, true);
        assert.equal(res.jsonPayload?.transaction?.subcategory, 'Ads');
    });
});
