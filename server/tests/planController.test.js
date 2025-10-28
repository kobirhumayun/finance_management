const { describe, test, beforeEach, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const { addPlan, updatePlan, activatedPlan, manualPaymentSubmit } = require('../controllers/planController');

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
            user: { _id: validUserId, role: 'user' },
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
            planId: { toString: () => validPlanId },
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

    test('sets invoice subscriptionEndDate to null for lifetime plans', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: validUserId, role: 'user' },
            body: { newPlanId: validPlanId, paymentId: validPaymentId },
        };

        const userDoc = {
            _id: validUserId,
            subscriptionStatus: 'inactive',
            planId: null,
            subscriptionEndDate: null,
            save: async function saveUser() { return this; },
        };

        const planDoc = {
            _id: validPlanId,
            name: 'Lifetime Access',
            slug: 'lifetime-access',
            price: 0,
            billingCycle: 'lifetime',
            isPublic: true,
        };

        const orderDoc = {
            _id: 'orderLifetime',
            status: 'pending',
            save: async function saveOrder() { return this; },
        };

        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => validUserId },
            planId: { toString: () => validPlanId },
            amount: 0,
            currency: 'USD',
            order: 'orderLifetime',
            status: 'pending',
            save: async function savePayment() { return this; },
        };

        let invoicePayload = null;
        Plan.findById = async () => planDoc;
        User.findById = async () => userDoc;
        Order.findById = async () => orderDoc;
        Payment.findById = async () => paymentDoc;
        Invoice.prototype.save = async function captureInvoice() {
            invoicePayload = this.toObject ? this.toObject() : { ...this };
            this._id = this._id || 'invoice-lifetime';
            return this;
        };

        await activatedPlan(req, res);

        assert.equal(res.statusCode, 200, 'Expected activation to succeed for lifetime plan.');
        assert.equal(invoicePayload.subscriptionEndDate, null, 'Lifetime plan invoices should not have an end date.');
    });

    test('persists lifetime plan invoices without requiring an end date', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: validUserId, role: 'user' },
            body: { newPlanId: validPlanId, paymentId: validPaymentId },
        };

        const userDoc = {
            _id: validUserId,
            subscriptionStatus: 'inactive',
            planId: null,
            subscriptionEndDate: null,
            save: async function saveUser() { return this; },
        };

        const planDoc = {
            _id: validPlanId,
            name: 'Lifetime Access',
            slug: 'lifetime-access',
            price: 0,
            billingCycle: 'lifetime',
            isPublic: true,
        };

        const orderDoc = {
            _id: 'orderLifetimePersisted',
            status: 'pending',
            save: async function saveOrder() { return this; },
        };

        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => validUserId },
            planId: { toString: () => validPlanId },
            amount: 0,
            currency: 'USD',
            order: 'orderLifetimePersisted',
            status: 'pending',
            save: async function savePayment() { return this; },
        };

        let saveCalled = 0;
        Plan.findById = async () => planDoc;
        User.findById = async () => userDoc;
        Order.findById = async () => orderDoc;
        Payment.findById = async () => paymentDoc;
        Invoice.prototype.save = async function captureInvoice() {
            saveCalled += 1;
            this._id = this._id || 'invoice-lifetime-persisted';
            return this;
        };

        await activatedPlan(req, res);

        const invoiceId = res.jsonPayload?.invoice?.id;

        assert.equal(res.statusCode, 200, 'Expected activation to succeed for lifetime plan.');
        assert.equal(saveCalled, 1, 'Lifetime plan activation should persist a single invoice.');
        assert.ok(invoiceId, 'Response should include the saved invoice identifier.');
        assert.equal(typeof invoiceId.toString, 'function', 'Invoice identifier should be serializable.');
        assert.equal(res.jsonPayload?.subscription?.endDate, null, 'Lifetime plan subscriptions should remain open-ended.');
    });

    test('rejects activation when payment belongs to a different user', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: validUserId, role: 'user' },
            body: { newPlanId: validPlanId, paymentId: validPaymentId },
        };

        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => '507f1f77bcf86cd799439099' },
            planId: { toString: () => validPlanId },
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

    test('rejects activation when payment is missing the associated plan', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: validUserId, role: 'user' },
            body: { newPlanId: validPlanId, paymentId: validPaymentId },
        };

        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => validUserId },
            planId: null,
            amount: 100,
            currency: 'USD',
            order: 'order123',
            status: 'pending',
        };

        Payment.findById = async () => paymentDoc;
        User.findById = async () => {
            throw new Error('User lookup should not occur when payment is missing a plan.');
        };
        Plan.findById = async () => {
            throw new Error('Plan lookup should not occur when payment is missing a plan.');
        };
        Order.findById = async () => {
            throw new Error('Order lookup should not occur when payment is missing a plan.');
        };

        const warnLogs = [];
        const originalWarn = console.warn;
        console.warn = (...args) => { warnLogs.push(args); };

        try {
            await activatedPlan(req, res);
        } finally {
            console.warn = originalWarn;
        }

        assert.equal(res.statusCode, 400, 'Expected bad request when payment lacks a plan.');
        assert.equal(res.jsonPayload?.message, 'Payment is missing associated plan information.');
        assert.ok(warnLogs.length > 0, 'Missing plan information should be logged.');
    });

    test('rejects activation when payment plan differs from requested plan', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: validUserId, role: 'user' },
            body: { newPlanId: validPlanId, paymentId: validPaymentId },
        };

        const mismatchedPlanId = '507f1f77bcf86cd799439099';
        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => validUserId },
            planId: { toString: () => mismatchedPlanId },
            amount: 100,
            currency: 'USD',
            order: 'order123',
            status: 'pending',
        };

        Payment.findById = async () => paymentDoc;
        User.findById = async () => {
            throw new Error('User lookup should not occur when payment plan mismatches.');
        };
        Plan.findById = async () => {
            throw new Error('Plan lookup should not occur when payment plan mismatches.');
        };
        Order.findById = async () => {
            throw new Error('Order lookup should not occur when payment plan mismatches.');
        };

        const warnLogs = [];
        const originalWarn = console.warn;
        console.warn = (...args) => { warnLogs.push(args); };

        try {
            await activatedPlan(req, res);
        } finally {
            console.warn = originalWarn;
        }

        assert.equal(res.statusCode, 403, 'Expected forbidden response when payment plan mismatches requested plan.');
        assert.equal(res.jsonPayload?.message, 'This payment is not eligible for the requested plan.');
        assert.ok(warnLogs.length > 0, 'Plan mismatches should be logged.');
    });

    test('rejects self-service activation for a non-public plan when not already subscribed', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: validUserId, role: 'user' },
            body: { newPlanId: validPlanId, paymentId: validPaymentId },
        };

        const userDoc = {
            _id: validUserId,
            subscriptionStatus: 'inactive',
            planId: new mongoose.Types.ObjectId().toString(),
            save: async function saveUser() {
                throw new Error('User should not be saved when plan is not public.');
            },
        };

        const planDoc = {
            _id: validPlanId,
            name: 'Enterprise',
            slug: 'enterprise',
            price: 100,
            billingCycle: 'monthly',
            isPublic: false,
        };

        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => validUserId },
            planId: { toString: () => validPlanId },
            amount: 100,
            currency: 'USD',
            order: 'order123',
            status: 'pending',
            save: async function savePayment() {
                throw new Error('Payment should not be saved when plan is not public.');
            },
        };

        Payment.findById = async () => paymentDoc;
        User.findById = async () => userDoc;
        Plan.findById = async () => planDoc;
        Order.findById = async () => ({
            _id: 'order123',
            status: 'pending',
            save: async function saveOrder() {
                throw new Error('Order should not be saved when plan is not public.');
            },
        });
        Invoice.prototype.save = async function saveInvoice() {
            throw new Error('Invoice should not be created when plan is not public.');
        };

        await activatedPlan(req, res);

        assert.equal(res.statusCode, 403, 'Expected forbidden response for non-public plan.');
        assert.equal(res.jsonPayload?.message, 'This plan is not publicly available.');
    });

    test('allows admin activation when payment belongs to the applied user', async () => {
        const adminUserId = '507f1f77bcf86cd799439021';
        const appliedUserId = '507f1f77bcf86cd799439031';
        const res = createResponseDouble();
        const req = {
            user: { _id: adminUserId, role: 'admin' },
            body: { newPlanId: validPlanId, paymentId: validPaymentId, appliedUserId },
        };

        const userDoc = {
            _id: appliedUserId,
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
            userId: { toString: () => appliedUserId },
            planId: { toString: () => validPlanId },
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

        assert.equal(res.statusCode, 200, 'Expected activation to succeed for admin approving another user.');
        assert.equal(paymentDoc.status, 'succeeded', 'Payment status should be updated to succeeded.');
        assert.equal(orderDoc.status, 'active', 'Order status should be set to active.');
    });

    test('allows admin activation for a non-public plan', async () => {
        const adminUserId = '507f1f77bcf86cd799439021';
        const appliedUserId = '507f1f77bcf86cd799439031';
        const res = createResponseDouble();
        const req = {
            user: { _id: adminUserId, role: 'admin' },
            body: { newPlanId: validPlanId, paymentId: validPaymentId, appliedUserId },
        };

        const userDoc = {
            _id: appliedUserId,
            subscriptionStatus: 'inactive',
            planId: null,
            save: async function saveUser() { return this; },
        };

        const planDoc = {
            _id: validPlanId,
            name: 'Enterprise',
            slug: 'enterprise',
            price: 100,
            billingCycle: 'monthly',
            isPublic: false,
        };

        const orderDoc = {
            _id: 'order123',
            status: 'pending',
            save: async function saveOrder() { return this; },
        };

        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => appliedUserId },
            planId: { toString: () => validPlanId },
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

        assert.equal(res.statusCode, 200, 'Expected admin approval to succeed for non-public plan.');
        assert.equal(paymentDoc.status, 'succeeded', 'Payment status should be updated to succeeded.');
        assert.equal(orderDoc.status, 'active', 'Order status should be set to active.');
    });

    test('rejects admin activation when payment belongs to a different user than appliedUserId', async () => {
        const adminUserId = '507f1f77bcf86cd799439021';
        const appliedUserId = '507f1f77bcf86cd799439031';
        const res = createResponseDouble();
        const req = {
            user: { _id: adminUserId, role: 'admin' },
            body: { newPlanId: validPlanId, paymentId: validPaymentId, appliedUserId },
        };

        const paymentDoc = {
            _id: validPaymentId,
            userId: { toString: () => '507f1f77bcf86cd799439099' },
            planId: { toString: () => validPlanId },
            amount: 100,
            currency: 'USD',
            order: 'order123',
            status: 'pending',
            save: async function savePayment() {
                throw new Error('Payment should not be saved when unauthorized.');
            },
        };

        Payment.findById = async () => paymentDoc;

        await activatedPlan(req, res);

        assert.equal(res.statusCode, 403, 'Expected forbidden response when payment is for a different user even for admin.');
        assert.equal(res.jsonPayload?.message, 'This payment is not eligible for this user.');
    });
});

describe('planController manualPaymentSubmit', () => {
    const validPaymentId = '507f1f77bcf86cd799439014';

    afterEach(() => {
        Payment.findById = originalPaymentFindById;
    });

    test('accepts manual payment submissions when amounts are numerically equal for the owner', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: '507f1f77bcf86cd799439001' },
            body: {
                amount: '99.99',
                currency: 'USD',
                paymentGateway: 'manual',
                gatewayTransactionId: 'txn-123',
                paymentId: validPaymentId,
            },
        };

        let saveCalled = false;
        const paymentDoc = {
            _id: validPaymentId,
            amount: mongoose.Types.Decimal128.fromString('99.99'),
            currency: 'USD',
            userId: { toString: () => '507f1f77bcf86cd799439001' },
            status: 'pending',
            paymentGateway: null,
            gatewayTransactionId: null,
            save: async function savePayment() {
                saveCalled = true;
                return this;
            },
        };

        Payment.findById = async () => paymentDoc;

        await manualPaymentSubmit(req, res);

        assert.equal(res.statusCode, 201, 'Expected a successful manual payment submission.');
        assert.equal(res.jsonPayload?.payment, paymentDoc, 'Expected the persisted payment to be returned.');
        assert.equal(paymentDoc.paymentGateway, 'manual', 'Expected payment gateway to be updated.');
        assert.equal(paymentDoc.gatewayTransactionId, 'txn-123', 'Expected gateway transaction ID to be saved.');
        assert.equal(saveCalled, true, 'Expected payment save to be invoked.');
    });

    test('rejects manual payment submissions when amounts differ', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: '507f1f77bcf86cd799439001' },
            body: {
                amount: 50,
                currency: 'USD',
                paymentGateway: 'manual',
                gatewayTransactionId: 'txn-456',
                paymentId: validPaymentId,
            },
        };

        let saveCalled = false;
        const paymentDoc = {
            _id: validPaymentId,
            amount: mongoose.Types.Decimal128.fromString('60.00'),
            currency: 'USD',
            userId: { toString: () => '507f1f77bcf86cd799439001' },
            status: 'pending',
            paymentGateway: null,
            gatewayTransactionId: null,
            save: async function savePayment() {
                saveCalled = true;
                return this;
            },
        };

        Payment.findById = async () => paymentDoc;

        await manualPaymentSubmit(req, res);

        assert.equal(res.statusCode, 400, 'Expected manual payment submission with mismatched amounts to fail.');
        assert.deepEqual(res.jsonPayload, { message: 'Invalid payment amount' }, 'Expected validation error for mismatched amounts.');
        assert.equal(saveCalled, false, 'Payment should not be saved on validation failure.');
    });

    test('rejects manual payment submissions for payments owned by a different user', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: '507f1f77bcf86cd799439001' },
            body: {
                amount: '99.99',
                currency: 'USD',
                paymentGateway: 'manual',
                gatewayTransactionId: 'txn-123',
                paymentId: validPaymentId,
            },
        };

        let saveCalled = false;
        const paymentDoc = {
            _id: validPaymentId,
            amount: mongoose.Types.Decimal128.fromString('99.99'),
            currency: 'USD',
            userId: { toString: () => '507f1f77bcf86cd799439099' },
            status: 'pending',
            paymentGateway: null,
            gatewayTransactionId: null,
            save: async function savePayment() {
                saveCalled = true;
                return this;
            },
        };

        Payment.findById = async () => paymentDoc;

        await manualPaymentSubmit(req, res);

        assert.equal(res.statusCode, 403, 'Expected manual payment submission to fail when user does not own payment.');
        assert.deepEqual(res.jsonPayload, { message: 'You are not allowed to update this payment.' });
        assert.equal(saveCalled, false, 'Payment should not be saved on authorization failure.');
    });

    test('rejects manual payment submissions when payment status is not pending', async () => {
        const res = createResponseDouble();
        const req = {
            user: { _id: '507f1f77bcf86cd799439001' },
            body: {
                amount: '99.99',
                currency: 'USD',
                paymentGateway: 'manual',
                gatewayTransactionId: 'txn-123',
                paymentId: validPaymentId,
            },
        };

        let saveCalled = false;
        const paymentDoc = {
            _id: validPaymentId,
            amount: mongoose.Types.Decimal128.fromString('99.99'),
            currency: 'USD',
            userId: { toString: () => '507f1f77bcf86cd799439001' },
            status: 'succeeded',
            paymentGateway: null,
            gatewayTransactionId: null,
            save: async function savePayment() {
                saveCalled = true;
                return this;
            },
        };

        Payment.findById = async () => paymentDoc;

        await manualPaymentSubmit(req, res);

        assert.equal(res.statusCode, 409, 'Expected manual payment submission to fail when payment is not pending.');
        assert.deepEqual(res.jsonPayload, { message: 'Payment cannot be updated in its current status.' });
        assert.equal(saveCalled, false, 'Payment should not be saved when status check fails.');
    });
});
