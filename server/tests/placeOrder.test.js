const { describe, test, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Plan = require('../models/Plan');

const {
    placeOrder,
    __test__: { setCreateOrderWithPayment, resetCreateOrderWithPayment },
} = require('../controllers/planController');

const originalFindById = Plan.findById;

const createResponseDouble = (options = {}) => {
    const res = {};
    const throwOnStatus = options.throwOnStatus ?? null;
    res.statusCode = null;
    res.jsonPayload = null;
    res.status = (code) => {
        res.statusCode = code;
        if (throwOnStatus) {
            const key = String(code);
            if (Object.prototype.hasOwnProperty.call(throwOnStatus, key)) {
                const errorToThrow = throwOnStatus[key];
                throw errorToThrow instanceof Error ? errorToThrow : new Error(String(errorToThrow));
            }
        }
        return res;
    };
    res.json = (payload) => {
        res.jsonPayload = payload;
        return res;
    };
    return res;
};

describe('planController placeOrder', () => {
    let receivedOrderData;
    let receivedPaymentData;
    let createOrderCallCount;

    beforeEach(() => {
        receivedOrderData = null;
        receivedPaymentData = null;
        createOrderCallCount = 0;
        setCreateOrderWithPayment(async (orderData, paymentData) => {
            createOrderCallCount += 1;
            receivedOrderData = orderData;
            receivedPaymentData = paymentData;
            return {
                order: { orderID: 'order-123' },
                payment: { _id: 'payment-456' },
            };
        });
    });

    afterEach(() => {
        resetCreateOrderWithPayment();
        Plan.findById = originalFindById;
    });

    after(() => {
        resetCreateOrderWithPayment();
        Plan.findById = originalFindById;
    });

    test('allows ordering zero-cost plans', async () => {
        const planObjectId = '507f191e810c19729de860ea';
        Plan.findById = async () => ({
            _id: planObjectId,
            price: 0,
            currency: 'USD',
        });

        const req = {
            body: {
                amount: 0,
                currency: 'usd',
                paymentGateway: 'manual',
                paymentMethodDetails: 'manual',
                purpose: 'subscription',
                planId: planObjectId,
            },
            user: {
                _id: '507f191e810c19729de860eb',
            },
        };
        const res = createResponseDouble();

        await placeOrder(req, res);

        assert.equal(res.statusCode, 201, 'Expected successful response when placing a free plan order.');
        assert.equal(res.jsonPayload?.status, 'To confirm order pay manually', 'Expected manual payment processor response.');
        assert.equal(receivedOrderData?.amount, 0, 'Expected order to record zero amount.');
        assert.equal(receivedPaymentData?.amount, 0, 'Expected payment to record zero amount.');
        assert.equal(receivedOrderData?.currency, 'USD', 'Expected order currency to match the plan currency.');
        assert.equal(receivedPaymentData?.currency, 'USD', 'Expected payment currency to match the plan currency.');
    });

    test('invokes payment handler based on normalized gateway when details is an object', async () => {
        const planObjectId = '507f191e810c19729de860ec';
        Plan.findById = async () => ({
            _id: planObjectId,
            price: 25,
            currency: 'EUR',
        });

        const paymentDetails = { instructions: 'Call support before paying.' };

        const req = {
            body: {
                amount: 25,
                currency: 'eur',
                paymentGateway: 'Manual',
                paymentMethodDetails: paymentDetails,
                purpose: 'subscription',
                planId: planObjectId,
            },
            user: {
                _id: '507f191e810c19729de860ed',
            },
        };
        const res = createResponseDouble();

        await placeOrder(req, res);

        assert.equal(res.statusCode, 201, 'Expected successful response when placing order with manual gateway.');
        assert.equal(res.jsonPayload?.status, 'To confirm order pay manually', 'Expected manual payment processor response.');
        assert.equal(receivedPaymentData?.paymentGateway, 'manual', 'Expected payment gateway to be normalized.');
        assert.deepEqual(receivedPaymentData?.paymentMethodDetails, paymentDetails, 'Expected payment details to remain unchanged.');
    });

    test('rejects unsupported gateways before creating order/payment records', async () => {
        const planObjectId = '507f191e810c19729de860ee';
        Plan.findById = async () => ({
            _id: planObjectId,
            price: 50,
            currency: 'USD',
        });

        const req = {
            body: {
                amount: 50,
                currency: 'usd',
                paymentGateway: 'mystery-gateway',
                paymentMethodDetails: 'details',
                purpose: 'subscription',
                planId: planObjectId,
            },
            user: {
                _id: '507f191e810c19729de860ef',
            },
        };
        const res = createResponseDouble();

        await placeOrder(req, res);

        assert.equal(res.statusCode, 400, 'Expected 400 response for unsupported payment gateway.');
        assert.match(res.jsonPayload?.error ?? '', /unsupported payment gateway/i, 'Expected unsupported gateway error message.');
        assert.equal(createOrderCallCount, 0, 'Expected order/payment creation to be skipped for unsupported gateways.');
    });

    test('rejects orders when currency does not match plan currency', async () => {
        const planObjectId = '507f191e810c19729de860f0';
        Plan.findById = async () => ({
            _id: planObjectId,
            price: 30,
            currency: 'USD',
        });

        const req = {
            body: {
                amount: 30,
                currency: 'eur',
                paymentGateway: 'manual',
                paymentMethodDetails: 'details',
                purpose: 'subscription',
                planId: planObjectId,
            },
            user: {
                _id: '507f191e810c19729de860f1',
            },
        };
        const res = createResponseDouble();

        await placeOrder(req, res);

        assert.equal(res.statusCode, 400, 'Expected 400 response when currency mismatches plan currency.');
        assert.match(res.jsonPayload?.message ?? '', /currency/i, 'Expected error message to reference currency mismatch.');
        assert.equal(createOrderCallCount, 0, 'Expected order/payment creation to be skipped when currency mismatches.');
    });

    test('surfaces payment handler rejections as HTTP errors', async () => {
        const planObjectId = '507f191e810c19729de860f2';
        Plan.findById = async () => ({
            _id: planObjectId,
            price: 40,
            currency: 'USD',
        });

        const rejectionError = new Error('Payment gateway unavailable');

        const req = {
            body: {
                amount: 40,
                currency: 'usd',
                paymentGateway: 'manual',
                paymentMethodDetails: 'details',
                purpose: 'subscription',
                planId: planObjectId,
            },
            user: {
                _id: '507f191e810c19729de860f3',
            },
        };

        const res = createResponseDouble({
            throwOnStatus: { 201: rejectionError },
        });

        await placeOrder(req, res);

        assert.equal(res.statusCode, 500, 'Expected controller to respond with 500 when payment handler rejects.');
        assert.equal(res.jsonPayload?.message, rejectionError.message, 'Expected rejection message to be surfaced in response.');
    });
});
