const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

/**
 * Creates an order and its corresponding payment information in a single atomic unit of work.
 * The helper prefers using a MongoDB transaction when available and falls back to sequential
 * writes with cleanup to avoid orphaned records if transactions are unsupported.
 *
 * @param {object} orderData - The data for the new order.
 * @param {object} paymentData - The data for the new payment.
 * @param {object} [options]
 * @param {mongoose.ClientSession} [options.session] - An existing session to participate in.
 * @param {boolean} [options.forceSequential=false] - Forces the sequential fallback logic (primarily for testing).
 * @param {mongoose.Model} [options.orderModel=Order] - Order model override for testing.
 * @param {mongoose.Model} [options.paymentModel=Payment] - Payment model override for testing.
 * @returns {Promise<{order: object, payment: object}>} - The newly created order and payment documents.
 * @throws {Error} - Throws an error if the operation fails.
 */
const createOrderWithPayment = async (orderData, paymentData, options = {}) => {
    const {
        session: externalSession,
        forceSequential = false,
        orderModel = Order,
        paymentModel = Payment,
    } = options;

    const linkDocuments = () => {
        const order = new orderModel(orderData);
        const payment = new paymentModel(paymentData);

        order.payment = payment._id;
        payment.order = order._id;

        return { order, payment };
    };

    const saveSequentiallyWithCleanup = async () => {
        const { order, payment } = linkDocuments();
        let savedOrder;

        try {
            savedOrder = await order.save();
            const savedPayment = await payment.save();
            return { order: savedOrder, payment: savedPayment };
        } catch (error) {
            if (savedOrder?._id) {
                try {
                    await orderModel.findByIdAndDelete(savedOrder._id);
                } catch (cleanupError) {
                    console.error('Failed to clean up orphaned order after payment save failure:', cleanupError);
                }
            }
            throw error;
        }
    };

    if (forceSequential) {
        try {
            return await saveSequentiallyWithCleanup();
        } catch (error) {
            console.error('Error creating order with payment (sequential mode):', error);
            throw new Error('Failed to create order and payment. Please try again.');
        }
    }

    const transactionNotSupported = (error) =>
        typeof error?.message === 'string'
        && error.message.includes('Transaction numbers are only allowed on a replica set member or mongos');

    let session = externalSession;
    let ownsSession = false;
    let startedTransaction = false;

    try {
        if (!session) {
            session = await mongoose.startSession();
            ownsSession = true;
        }

        if (!session.inTransaction()) {
            await session.startTransaction();
            startedTransaction = true;
        }

        const { order, payment } = linkDocuments();
        const savedOrder = await order.save({ session });
        const savedPayment = await payment.save({ session });

        if (startedTransaction) {
            await session.commitTransaction();
        }

        return { order: savedOrder, payment: savedPayment };
    } catch (error) {
        if (startedTransaction) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error('Failed to abort transaction during order/payment creation:', abortError);
            }
        }

        if (ownsSession && session) {
            await session.endSession();
            ownsSession = false;
            session = null;
        }

        if (transactionNotSupported(error)) {
            try {
                return await saveSequentiallyWithCleanup();
            } catch (fallbackError) {
                console.error('Error creating order with payment (fallback sequential mode):', fallbackError);
                throw new Error('Failed to create order and payment. Please try again.');
            }
        }

        console.error('Error creating order with payment:', error);
        throw new Error('Failed to create order and payment. Please try again.');
    } finally {
        if (ownsSession && session) {
            await session.endSession();
        }
    }
}

module.exports = { createOrderWithPayment };
