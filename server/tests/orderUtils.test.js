const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { createOrderWithPayment } = require('../utils/order');

class FakeOrder {
    constructor(data) {
        Object.assign(this, data);
        this._id = `order-${FakeOrder._nextId += 1}`;
        this.isNew = true;
    }

    async save() {
        FakeOrder._store.set(this._id, this);
        this.isNew = false;
        return this;
    }

    static async findByIdAndDelete(id) {
        const existing = FakeOrder._store.get(id) ?? null;
        FakeOrder._store.delete(id);
        return existing;
    }

    static reset() {
        FakeOrder._store.clear();
        FakeOrder._nextId = 0;
    }

    static count() {
        return FakeOrder._store.size;
    }
}

FakeOrder._store = new Map();
FakeOrder._nextId = 0;

class FakePayment {
    constructor(data) {
        Object.assign(this, data);
        this._id = `payment-${FakePayment._nextId += 1}`;
        this.isNew = true;
    }

    async save() {
        if (FakePayment._failNextSave) {
            FakePayment._failNextSave = false;
            throw new Error('Simulated payment save failure');
        }

        FakePayment._store.set(this._id, this);
        this.isNew = false;
        return this;
    }

    static failNextSave() {
        FakePayment._failNextSave = true;
    }

    static reset() {
        FakePayment._store.clear();
        FakePayment._nextId = 0;
        FakePayment._failNextSave = false;
    }

    static count() {
        return FakePayment._store.size;
    }
}

FakePayment._store = new Map();
FakePayment._nextId = 0;
FakePayment._failNextSave = false;

const baseOrder = {
    user: 'user-1',
    plan: 'plan-1',
    amount: 99,
    currency: 'USD',
};

const basePayment = {
    userId: 'user-1',
    planId: 'plan-1',
    amount: 99,
    currency: 'USD',
    paymentGateway: 'manual',
    purpose: 'subscription',
    paymentMethodDetails: 'details',
};

describe('createOrderWithPayment (sequential fallback behaviour)', () => {
    beforeEach(() => {
        FakeOrder.reset();
        FakePayment.reset();
    });

    test('saves order and payment when both succeed', async () => {
        const result = await createOrderWithPayment(baseOrder, basePayment, {
            forceSequential: true,
            orderModel: FakeOrder,
            paymentModel: FakePayment,
        });

        assert.equal(FakeOrder.count(), 1, 'Expected one order to be stored.');
        assert.equal(FakePayment.count(), 1, 'Expected one payment to be stored.');
        assert.equal(result.order._id, [...FakeOrder._store.keys()][0], 'Expected returned order to match stored order.');
        assert.equal(result.payment._id, [...FakePayment._store.keys()][0], 'Expected returned payment to match stored payment.');
    });

    test('cleans up order if payment save fails', async () => {
        FakePayment.failNextSave();

        await assert.rejects(
            () => createOrderWithPayment(baseOrder, basePayment, {
                forceSequential: true,
                orderModel: FakeOrder,
                paymentModel: FakePayment,
            }),
            /Failed to create order and payment/i,
            'Expected helper to surface a user-friendly error.'
        );

        assert.equal(FakeOrder.count(), 0, 'Expected orphaned order to be removed when payment save fails.');
        assert.equal(FakePayment.count(), 0, 'Expected no payment documents to remain when save fails.');
    });
});
