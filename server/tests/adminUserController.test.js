const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { mapUserToResponse } = require('../controllers/adminUserController');

describe('adminUserController mapUserToResponse', () => {
    test('returns the plan identifier and exposes plan slug separately when populated', () => {
        const response = mapUserToResponse({
            _id: { toString: () => 'user-123' },
            username: 'demo-user',
            email: 'demo@example.com',
            planId: {
                _id: { toString: () => 'plan-abc-123' },
                name: 'Pro Plan',
                slug: 'pro-plan',
            },
            metadata: { accountStatus: 'active' },
        });

        assert.equal(response.planId, 'plan-abc-123');
        assert.equal(response.planSlug, 'pro-plan');
        assert.notEqual(response.planId, response.planSlug);
    });

    test('uses the raw plan identifier when not populated but keeps any slug hint', () => {
        const response = mapUserToResponse({
            _id: { toString: () => 'user-456' },
            username: 'other-user',
            email: 'other@example.com',
            planId: { toString: () => 'plan-raw-789' },
            planSlug: 'starter',
            metadata: { accountStatus: 'active' },
        });

        assert.equal(response.planId, 'plan-raw-789');
        assert.equal(response.planSlug, 'starter');
    });
});
