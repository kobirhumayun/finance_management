const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const orderController = require('../controllers/orderController');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

const createRes = () => {
    const res = {};
    res.statusCode = 200;
    res.jsonData = undefined;
    res.status = function status(code) {
        this.statusCode = code;
        return this;
    };
    res.json = function json(data) {
        this.jsonData = data;
        return this;
    };
    return res;
};

test('listOrders exposes payment owner fields and pagination limit', { concurrency: false }, async () => {
    const originalAggregate = Order.aggregate;
    const originalFind = Order.find;

    const orderId = new mongoose.Types.ObjectId();
    const paymentUserId = new mongoose.Types.ObjectId();
    const paymentPlanId = new mongoose.Types.ObjectId();

    Order.aggregate = async () => [{ _id: orderId }];

    Order.find = () => {
        return {
            sort() {
                return this;
            },
            populate() {
                return this;
            },
            lean: async () => [
                {
                    _id: orderId,
                    payment: {
                        userId: paymentUserId,
                        planId: paymentPlanId,
                        amount: 100,
                        refundedAmount: 0,
                    },
                    invoice: null,
                },
            ],
        };
    };

    const req = { query: {} };
    const res = createRes();

    try {
        await orderController.listOrders(req, res);
    } finally {
        Order.aggregate = originalAggregate;
        Order.find = originalFind;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.pageInfo.limit, 20);
    assert.equal(res.jsonData.data[0].payment.userId.toString(), paymentUserId.toString());
    assert.equal(res.jsonData.data[0].payment.planId.toString(), paymentPlanId.toString());
});

test('getOrderByNumber surfaces payment owner references', { concurrency: false }, async () => {
    const originalFindById = Order.findById;
    const originalFindOne = Order.findOne;

    const orderId = new mongoose.Types.ObjectId();
    const paymentUserId = new mongoose.Types.ObjectId();
    const paymentPlanId = new mongoose.Types.ObjectId();

    Order.findById = () => ({
        populate() {
            return this;
        },
        lean: async () => ({
            _id: orderId,
            payment: {
                userId: paymentUserId,
                planId: paymentPlanId,
                amount: 150,
                refundedAmount: 0,
            },
            invoice: null,
        }),
    });

    Order.findOne = () => ({
        populate() {
            return this;
        },
        lean: async () => null,
    });

    const req = { params: { orderNumber: orderId.toString() } };
    const res = createRes();

    try {
        await orderController.getOrderByNumber(req, res);
    } finally {
        Order.findById = originalFindById;
        Order.findOne = originalFindOne;
    }

    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.payment.userId.toString(), paymentUserId.toString());
    assert.equal(res.jsonData.data.payment.planId.toString(), paymentPlanId.toString());
});

test('getOrderSummary returns currency breakdowns', { concurrency: false }, async () => {
    const originalAggregate = Order.aggregate;
    const byUserId = new mongoose.Types.ObjectId();
    let capturedPipeline;

    Order.aggregate = async (pipelineArg) => {
        capturedPipeline = pipelineArg;
        return [
            {
                totals: {
                    totalOrders: 2,
                    totalAmount: 300,
                    currencyBreakdown: [
                        { currency: 'USD', totalOrders: 2, totalAmount: 300 },
                    ],
                },
                byStatus: [
                    {
                        status: 'active',
                        count: 2,
                        totalAmount: 300,
                        currencyBreakdown: [
                            { currency: 'USD', count: 2, totalAmount: 300 },
                        ],
                    },
                ],
                byPaymentStatus: [],
                byPaymentGateway: [],
                byPlan: [],
                byUser: [
                    {
                        userId: byUserId,
                        userEmail: 'investigator@example.com',
                        firstName: 'Investigative',
                        lastName: 'Admin',
                        username: 'invest-admin',
                        count: 2,
                        totalAmount: 300,
                        currencyBreakdown: [
                            { currency: 'USD', count: 2, totalAmount: 300 },
                        ],
                        userIdString: byUserId.toString(),
                    },
                ],
                byYear: [],
                byMonth: [],
            },
        ];
    };

    const req = { query: {} };
    const res = createRes();

    try {
        await orderController.getOrderSummary(req, res);
    } finally {
        Order.aggregate = originalAggregate;
    }

    assert.ok(JSON.stringify(capturedPipeline).includes('currencyBreakdown'));
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.totals.currencyBreakdown[0].currency, 'USD');
    assert.equal(res.jsonData.data.byStatus[0].currencyBreakdown[0].currency, 'USD');
    assert.equal(res.jsonData.data.byUser[0].currencyBreakdown[0].currency, 'USD');
});

test('getPaymentSummary returns currency breakdowns', { concurrency: false }, async () => {
    const originalAggregate = Payment.aggregate;
    const byUserId = new mongoose.Types.ObjectId();
    let capturedPipeline;

    Payment.aggregate = async (pipelineArg) => {
        capturedPipeline = pipelineArg;
        return [
            {
                totals: {
                    totalPayments: 1,
                    totalAmount: 120,
                    currencyBreakdown: [
                        { currency: 'USD', totalPayments: 1, totalAmount: 120 },
                    ],
                },
                byStatus: [
                    {
                        status: 'succeeded',
                        count: 1,
                        totalAmount: 120,
                        currencyBreakdown: [
                            { currency: 'USD', count: 1, totalAmount: 120 },
                        ],
                    },
                ],
                byGateway: [],
                byPurpose: [],
                byUser: [
                    {
                        userId: byUserId,
                        userEmail: 'payments@example.com',
                        firstName: 'Paying',
                        lastName: 'Customer',
                        username: 'payer',
                        count: 1,
                        totalAmount: 120,
                        currencyBreakdown: [
                            { currency: 'USD', count: 1, totalAmount: 120 },
                        ],
                        userIdString: byUserId.toString(),
                    },
                ],
                byPlan: [],
                byYear: [],
                byMonth: [],
            },
        ];
    };

    const req = { query: {} };
    const res = createRes();

    try {
        await orderController.getPaymentSummary(req, res);
    } finally {
        Payment.aggregate = originalAggregate;
    }

    assert.ok(JSON.stringify(capturedPipeline).includes('currencyBreakdown'));
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.totals.currencyBreakdown[0].currency, 'USD');
    assert.equal(res.jsonData.data.byStatus[0].currencyBreakdown[0].currency, 'USD');
    assert.equal(res.jsonData.data.byUser[0].currencyBreakdown[0].currency, 'USD');
});
