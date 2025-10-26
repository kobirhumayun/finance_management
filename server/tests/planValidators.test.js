const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');
const { planValidationRules, updatePlanValidationRules } = require('../validators/planValidators');
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

const runUpdateValidation = async (payload) => {
    const req = { body: payload };
    for (const rule of updatePlanValidationRules()) {
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

test('updatePlanValidationRules allows partial updates when targetSlug is provided', async () => {
    const result = await runUpdateValidation({
        targetSlug: 'basic-plan',
        description: 'Updated description only.',
    });

    assert.equal(result.isEmpty(), true, 'Expected partial update with only description to pass validation.');
});

test('updatePlanValidationRules rejects requests without targetSlug', async () => {
    const result = await runUpdateValidation({ description: 'Missing slug' });

    assert.equal(result.isEmpty(), false, 'Expected validation to fail when targetSlug is missing.');
    const errors = result.array();
    const hasTargetSlugError = errors.some((error) => error.path === 'targetSlug');
    assert.ok(hasTargetSlugError, 'Expected a validation error for the targetSlug field.');
});

test('updatePlanValidationRules still enforces slug format and billing cycle enums when provided', async () => {
    const invalidSlugResult = await runUpdateValidation({
        targetSlug: 'basic-plan',
        slug: 'Invalid Slug',
    });

    assert.equal(invalidSlugResult.isEmpty(), false, 'Expected validation to fail for invalid slug value.');
    const slugErrors = invalidSlugResult.array().filter((error) => error.path === 'slug');
    assert.ok(slugErrors.length > 0, 'Expected a validation error for the slug field.');

    const invalidBillingCycleResult = await runUpdateValidation({
        targetSlug: 'basic-plan',
        billingCycle: 'unsupported',
    });

    assert.equal(invalidBillingCycleResult.isEmpty(), false, 'Expected validation to fail for unsupported billing cycle.');
    const billingCycleErrors = invalidBillingCycleResult.array().filter((error) => error.path === 'billingCycle');
    assert.ok(billingCycleErrors.length > 0, 'Expected a validation error for the billing cycle field.');
});
