const { describe, test, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Plan = require('../models/Plan');

const {
    placeOrder,
    __test__: { setCreateOrderWithPayment, resetCreateOrderWithPayment },
} = require('../controllers/planController');

const originalFindById = Plan.findById;

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

describe('planController placeOrder', () => {
    let receivedOrderData;
    let receivedPaymentData;

    beforeEach(() => {
        receivedOrderData = null;
        receivedPaymentData = null;
        setCreateOrderWithPayment(async (orderData, paymentData) => {
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
        assert.equal(receivedOrderData?.currency, 'USD', 'Expected currency to be normalized to uppercase.');
    });

    test('invokes payment handler based on normalized gateway when details is an object', async () => {
        const planObjectId = '507f191e810c19729de860ec';
        Plan.findById = async () => ({
            _id: planObjectId,
            price: 25,
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
});
