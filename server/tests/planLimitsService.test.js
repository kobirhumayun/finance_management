const { describe, test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Plan = require('../models/Plan');
const User = require('../models/User');
const {
    sanitizePlanLimitsInput,
    mergePlanLimits,
    applyPlanLimitDefaults,
    getPlanLimitsForUser,
} = require('../services/planLimits');

const originalPlanFindOne = Plan.findOne;
const originalUserFindById = User.findById;

const createQueryResult = (value) => ({
    select() {
        return {
            lean: async () => value,
        };
    },
});

beforeEach(() => {
    Plan.findOne = () => createQueryResult(null);
    User.findById = () => ({
        select() {
            return this;
        },
        populate() {
            return Promise.resolve(null);
        },
    });
});

after(() => {
    Plan.findOne = originalPlanFindOne;
    User.findById = originalUserFindById;
});

describe('planLimits service sanitization utilities', { concurrency: false }, () => {
    test('sanitizePlanLimitsInput normalizes numeric and boolean fields', () => {
        const sanitized = sanitizePlanLimitsInput({
            projects: { maxActive: ' 10 ' },
            transactions: { perProject: '200 ' },
            summary: { allowFilters: 'false', allowPagination: 'yes' },
        });

        assert.deepEqual(sanitized, {
            projects: { maxActive: 10 },
            transactions: { perProject: 200 },
            summary: { allowFilters: false, allowPagination: true },
        });
    });

    test('mergePlanLimits applies updates without mutating the original object', () => {
        const current = { projects: { maxActive: 5 }, summary: { allowFilters: false } };
        const updates = { projects: { maxActive: 15 }, transactions: { perProject: 500 } };

        const merged = mergePlanLimits(current, updates);

        assert.deepEqual(merged, {
            projects: { maxActive: 15 },
            summary: { allowFilters: false },
            transactions: { perProject: 500 },
        });
        assert.deepEqual(current, { projects: { maxActive: 5 }, summary: { allowFilters: false } });
    });

    test('applyPlanLimitDefaults fills in missing values from defaults', () => {
        const applied = applyPlanLimitDefaults({
            projects: { maxActive: 25 },
            summary: { allowFilters: false },
        });

        assert.deepEqual(applied, {
            projects: { maxActive: 25 },
            transactions: { perProject: 1000 },
            summary: { allowFilters: false, allowPagination: true },
        });
    });
});

describe('planLimits service getPlanLimitsForUser', { concurrency: false }, () => {
    test('returns limits for the provided plan slug when a matching plan exists', async () => {
        const planRecords = {
            pro: { slug: 'pro', limits: { projects: { maxActive: 50 } } },
        };

        Plan.findOne = (query) => createQueryResult(planRecords[query.slug] || null);

        const result = await getPlanLimitsForUser({ planSlug: 'pro' });

        assert.equal(result.slug, 'pro');
        assert.deepEqual(result.limits.projects, { maxActive: 50 });
        assert.deepEqual(result.limits.transactions, { perProject: 1000 });
        assert.deepEqual(result.limits.summary, { allowFilters: true, allowPagination: true });
    });

    test('falls back to the free plan when the requested plan does not exist', async () => {
        const planRecords = {
            free: { slug: 'free', limits: { transactions: { perProject: 750 } } },
        };
        const requestedSlugs = [];

        Plan.findOne = (query) => {
            requestedSlugs.push(query.slug);
            return createQueryResult(planRecords[query.slug] || null);
        };

        const result = await getPlanLimitsForUser({ planSlug: 'nonexistent' });

        assert.deepEqual(requestedSlugs, ['nonexistent', 'free']);
        assert.equal(result.slug, 'free');
        assert.deepEqual(result.limits.transactions, { perProject: 750 });
    });

    test('derives limits from the user document when a plan slug is not provided', async () => {
        const userPlan = { slug: 'enterprise', limits: { summary: { allowPagination: false } } };

        Plan.findOne = () => createQueryResult(null);
        User.findById = () => ({
            select() {
                return this;
            },
            populate() {
                return Promise.resolve({ planId: userPlan });
            },
        });

        const result = await getPlanLimitsForUser({ userId: '507f1f77bcf86cd799439011' });

        assert.equal(result.slug, 'enterprise');
        assert.deepEqual(result.limits.summary, { allowFilters: true, allowPagination: false });
        assert.deepEqual(result.limits.transactions, { perProject: 1000 });
    });
});
