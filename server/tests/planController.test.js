const { describe, test, beforeEach, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Plan = require('../models/Plan');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const { addPlan, updatePlan, activatedPlan } = require('../controllers/planController');

const BILLING_CYCLES = Plan.schema.path('billingCycle').enumValues;

const originalFindOne = Plan.findOne;
const originalFindOneAndUpdate = Plan.findOneAndUpdate;
const originalPlanFindById = Plan.findById;
const originalUserFindById = User.findById;
const originalPaymentFindById = Payment.findById;
const originalOrderFindById = Order.findById;
const originalInvoiceSave = Invoice.prototype.save;
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
    Plan.findById = originalPlanFindById;
    User.findById = originalUserFindById;
    Payment.findById = originalPaymentFindById;
    Order.findById = originalOrderFindById;
    Invoice.prototype.save = originalInvoiceSave;
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

describe('planController activatedPlan authorization', () => {
    const validUserId = '507f1f77bcf86cd799439011';
    const validPlanId = '507f1f77bcf86cd799439012';
    const validPaymentId = '507f1f77bcf86cd799439013';

    afterEach(() => {
        Plan.findById = originalPlanFindById;
        User.findById = originalUserFindById;
        Payment.findById = originalPaymentFindById;
        Order.findById = originalOrderFindById;
        Invoice.prototype.save = originalInvoiceSave;
    });

    test('allows activation when payment belongs to the authenticated user', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: validUserId },
            body: { newPlanId: validPlanId, paymentId: validPaymentId },
        };

        const userDoc = {
            _id: validUserId,
            subscriptionStatus: 'inactive',
            planId: null,
            save: async function saveUser() { return this; },
        };

        const planDoc = {
            _id: validPlanId,
            name: 'Pro',
            slug: 'pro',
            price: 100,
            billingCycle: 'monthly',
            isPublic: true,
        };

        const orderDoc = {
            _id: 'order123',
            status: 'pending',
            save: async function saveOrder() { return this; },
        };

        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => validUserId },
            amount: 100,
            currency: 'USD',
            order: 'order123',
            status: 'pending',
            save: async function savePayment() { return this; },
        };

        Plan.findById = async () => planDoc;
        User.findById = async () => userDoc;
        Order.findById = async () => orderDoc;
        Payment.findById = async () => paymentDoc;
        Invoice.prototype.save = async function saveInvoice() {
            this._id = this._id || 'invoice-generated';
            return this;
        };

        await activatedPlan(req, res);

        assert.equal(res.statusCode, 200, 'Expected activation to succeed for authorized payment.');
        assert.equal(paymentDoc.status, 'succeeded', 'Payment status should be updated to succeeded.');
        assert.equal(orderDoc.status, 'active', 'Order status should be set to active.');
    });

    test('rejects activation when payment belongs to a different user', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: validUserId },
            body: { newPlanId: validPlanId, paymentId: validPaymentId },
        };

        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => '507f1f77bcf86cd799439099' },
            amount: 100,
            currency: 'USD',
            order: 'order123',
            status: 'pending',
            save: async function savePayment() {
                throw new Error('Payment should not be saved when unauthorized.');
            },
        };

        Payment.findById = async () => paymentDoc;
        User.findById = async () => {
            throw new Error('User lookup should not occur for unauthorized payments.');
        };
        Plan.findById = async () => {
            throw new Error('Plan lookup should not occur for unauthorized payments.');
        };
        Order.findById = async () => {
            throw new Error('Order lookup should not occur for unauthorized payments.');
        };

        const warnLogs = [];
        const originalWarn = console.warn;
        console.warn = (...args) => { warnLogs.push(args); };

        try {
            await activatedPlan(req, res);
        } finally {
            console.warn = originalWarn;
        }

        assert.equal(res.statusCode, 403, 'Expected forbidden response when payment is for a different user.');
        assert.equal(res.jsonPayload?.message, 'This payment is not eligible for this user.');
        assert.ok(warnLogs.length > 0, 'Unauthorized attempts should be logged.');
    });
});
