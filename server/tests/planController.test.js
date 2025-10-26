const { describe, test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Plan = require('../models/Plan');
const { addPlan, updatePlan } = require('../controllers/planController');

const BILLING_CYCLES = Plan.schema.path('billingCycle').enumValues;

const originalFindOne = Plan.findOne;
const originalFindOneAndUpdate = Plan.findOneAndUpdate;
const originalSave = Plan.prototype.save;

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
    Plan.findOne = async () => null;
    Plan.findOneAndUpdate = async () => null;
    Plan.prototype.save = async function saveOverride() {
        const doc = this.toObject ? this.toObject() : { ...this };
        return { ...doc, _id: 'generated-id' };
    };
});

after(() => {
    Plan.findOne = originalFindOne;
    Plan.findOneAndUpdate = originalFindOneAndUpdate;
    Plan.prototype.save = originalSave;
});

describe('planController addPlan', () => {
    for (const cycle of BILLING_CYCLES) {
        test(`successfully creates a plan with billing cycle "${cycle}"`, async () => {
            const req = {
                body: {
                    name: `Basic ${cycle}`,
                    slug: `basic-${cycle}`,
                    price: 49,
                    billingCycle: cycle,
                },
            };
            const res = createResponseDouble();

            await addPlan(req, res);

            assert.equal(res.statusCode, 201, 'Expected a 201 status for successful plan creation.');
            assert.ok(res.jsonPayload?.plan, 'Expected response payload to contain the plan.');
            assert.equal(res.jsonPayload.plan.billingCycle, cycle, 'Expected billing cycle to be preserved.');
        });
    }
});

describe('planController updatePlan', () => {
    for (const cycle of BILLING_CYCLES) {
        test(`successfully updates a plan to billing cycle "${cycle}"`, async () => {
            const existingPlan = {
                _id: `plan-${cycle}`,
                name: 'Basic plan',
                slug: `basic-${cycle}`,
            };

            Plan.findOne = async () => existingPlan;
            Plan.findOneAndUpdate = async (_, update) => ({
                ...existingPlan,
                ...update.$set,
            });

            const req = {
                body: {
                    targetSlug: `basic-${cycle}`,
                    billingCycle: cycle,
                },
            };
            const res = createResponseDouble();

            await updatePlan(req, res);

            assert.equal(res.statusCode, 200, 'Expected a 200 status for successful plan update.');
            assert.ok(res.jsonPayload?.plan, 'Expected response payload to contain the updated plan.');
            assert.equal(res.jsonPayload.plan.billingCycle, cycle, 'Expected billing cycle to be updated.');
        });
    }
});
