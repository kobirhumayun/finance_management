const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');
const { planValidationRules } = require('../validators/planValidators');
const Plan = require('../models/Plan');

const BILLING_CYCLES = Plan.schema.path('billingCycle').enumValues;

const basePayload = {
    name: 'Basic Plan',
    slug: 'basic-plan',
    price: '25',
    features: [],
};

const runValidation = async (payload) => {
    const req = { body: payload };
    for (const rule of planValidationRules()) {
        await rule.run(req);
    }
    return validationResult(req);
};

test('planValidationRules allows every billing cycle defined in the Plan schema', async (t) => {
    for (const cycle of BILLING_CYCLES) {
        const result = await runValidation({ ...basePayload, billingCycle: cycle });
        assert.equal(result.isEmpty(), true, `Expected billing cycle "${cycle}" to pass validation.`);
    }
});

test('planValidationRules rejects unsupported billing cycles', async () => {
    const result = await runValidation({ ...basePayload, billingCycle: 'unsupported' });
    assert.equal(result.isEmpty(), false, 'Expected validation to fail for unsupported billing cycle.');
    const errors = result.array();
    const hasBillingCycleError = errors.some((error) => error.path === 'billingCycle');
    assert.ok(hasBillingCycleError, 'Expected a validation error for the billing cycle field.');
});
