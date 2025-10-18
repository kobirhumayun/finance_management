const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Invoice = require('../models/Invoice');

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const parseDecimal = (value) => {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        return parseFloat(value);
    }

    if (value && typeof value.toString === 'function') {
        const parsed = parseFloat(value.toString());
        return Number.isNaN(parsed) ? value : parsed;
    }

    return value;
};

const attachInvoiceData = async (orders) => {
    const paymentIds = orders
        .map((order) => order.payment?._id)
        .filter(Boolean);

    if (paymentIds.length === 0) {
        return orders;
    }

    const invoices = await Invoice.find({ payment: { $in: paymentIds } })
        .select('payment invoiceNumber status issuedDate dueDate amount currency subscriptionStartDate subscriptionEndDate createdAt updatedAt')
        .lean();

    const invoiceMap = new Map(invoices.map((invoice) => [invoice.payment.toString(), invoice]));

    return orders.map((order) => {
        if (order.payment) {
            const paymentId = order.payment._id.toString();
            const invoice = invoiceMap.get(paymentId) || null;
            order.invoice = invoice;

            if (order.payment.amount !== undefined) {
                order.payment.amount = parseDecimal(order.payment.amount);
            }

            if (order.payment.refundedAmount !== undefined) {
                order.payment.refundedAmount = parseDecimal(order.payment.refundedAmount);
            }
        } else {
            order.invoice = null;
        }

        return order;
    });
};

const resolveOrderFilters = async (query) => {
    const orderFilter = {};

    if (query.orderNumber) {
        orderFilter.orderID = query.orderNumber;
    }

    if (query.status) {
        orderFilter.status = query.status;
    }

    if (query.userId) {
        orderFilter.user = query.userId;
    }

    if (query.planId) {
        orderFilter.plan = query.planId;
    }

    if (query.startDate || query.endDate) {
        orderFilter.createdAt = {};

        if (query.startDate) {
            orderFilter.createdAt.$gte = new Date(query.startDate);
        }

        if (query.endDate) {
            const endDate = new Date(query.endDate);
            endDate.setHours(23, 59, 59, 999);
            orderFilter.createdAt.$lte = endDate;
        }
    }

    if (query.userEmail) {
        const user = await User.findOne({ email: query.userEmail }).select('_id').lean();

        if (!user) {
            return { empty: true };
        }

        orderFilter.user = user._id;
    }

    if (query.planSlug) {
        const plan = await Plan.findOne({ slug: query.planSlug }).select('_id').lean();

        if (!plan) {
            return { empty: true };
        }

        orderFilter.plan = plan._id;
    }

    let paymentQuery = null;

    if (query.paymentStatus || query.paymentGateway || query.invoiceNumber) {
        paymentQuery = {};

        if (query.paymentStatus) {
            paymentQuery.status = query.paymentStatus;
        }

        if (query.paymentGateway) {
            paymentQuery.paymentGateway = query.paymentGateway;
        }

        if (query.invoiceNumber) {
            const invoice = await Invoice.findOne({ invoiceNumber: query.invoiceNumber })
                .select('payment')
                .lean();

            if (!invoice || !invoice.payment) {
                return { empty: true };
            }

            paymentQuery._id = invoice.payment;
        }

        const payments = await Payment.find(paymentQuery).select('_id').lean();

        if (!payments.length) {
            return { empty: true };
        }

        orderFilter.payment = { $in: payments.map((payment) => payment._id) };
    }

    return { filter: orderFilter };
};

const listOrders = async (req, res) => {
    try {
        const requestedLimit = typeof req.query.limit === 'number' ? req.query.limit : DEFAULT_PAGE_SIZE;
        const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);
        const cursor = req.query.cursor ? new mongoose.Types.ObjectId(req.query.cursor) : null;

        const { filter, empty } = await resolveOrderFilters(req.query);

        if (empty) {
            return res.json({
                data: [],
                pageInfo: {
                    nextCursor: null,
                    hasNextPage: false,
                },
            });
        }

        if (cursor) {
            filter._id = { $lt: cursor };
        }

        const orders = await Order.find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate({
                path: 'user',
                select: 'username email firstName lastName role subscriptionStatus subscriptionEndDate subscriptionStartDate',
            })
            .populate({
                path: 'plan',
                select: 'name slug billingCycle price currency',
            })
            .populate({
                path: 'payment',
                select: 'status amount currency paymentGateway gatewayTransactionId purpose invoiceId processedAt createdAt updatedAt',
            })
            .lean();

        const hasNextPage = orders.length > limit;
        const trimmedOrders = hasNextPage ? orders.slice(0, limit) : orders;

        const enrichedOrders = await attachInvoiceData(trimmedOrders);

        const nextCursor = hasNextPage ? trimmedOrders[trimmedOrders.length - 1]._id.toString() : null;

        res.json({
            data: enrichedOrders,
            pageInfo: {
                nextCursor,
                hasNextPage,
            },
        });
    } catch (error) {
        console.error('Error listing orders:', error);
        res.status(500).json({ message: 'Failed to retrieve orders.' });
    }
};

const getOrderByNumber = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        let order = null;

        if (mongoose.Types.ObjectId.isValid(orderNumber)) {
            order = await Order.findById(orderNumber)
                .populate({
                    path: 'user',
                    select: 'username email firstName lastName role subscriptionStatus subscriptionEndDate subscriptionStartDate',
                })
                .populate({
                    path: 'plan',
                    select: 'name slug billingCycle price currency',
                })
                .populate({
                    path: 'payment',
                    select: 'status amount currency paymentGateway gatewayTransactionId purpose invoiceId processedAt createdAt updatedAt',
                })
                .lean();
        }

        if (!order) {
            order = await Order.findOne({ orderID: orderNumber })
                .populate({
                    path: 'user',
                    select: 'username email firstName lastName role subscriptionStatus subscriptionEndDate subscriptionStartDate',
                })
                .populate({
                    path: 'plan',
                    select: 'name slug billingCycle price currency',
                })
                .populate({
                    path: 'payment',
                    select: 'status amount currency paymentGateway gatewayTransactionId purpose invoiceId processedAt createdAt updatedAt',
                })
                .lean();
        }

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const [enrichedOrder] = await attachInvoiceData([order]);

        res.json({ data: enrichedOrder });
    } catch (error) {
        console.error('Error fetching order by number:', error);
        res.status(500).json({ message: 'Failed to retrieve order details.' });
    }
};

const getOrderSummary = async (req, res) => {
    try {
        const { filter, empty } = await resolveOrderFilters(req.query);

        if (empty) {
            return res.json({
                data: {
                    totals: { totalOrders: 0, totalAmount: 0 },
                    byStatus: [],
                    byPaymentStatus: [],
                    byPaymentGateway: [],
                    byPlan: [],
                },
            });
        }

        const pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: 'payments',
                    localField: 'payment',
                    foreignField: '_id',
                    as: 'payment',
                },
            },
            { $unwind: { path: '$payment', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'plan',
                    foreignField: '_id',
                    as: 'plan',
                },
            },
            { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                totalOrders: { $sum: 1 },
                                totalAmount: { $sum: '$amount' },
                            },
                        },
                    ],
                    byStatus: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amount' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                status: '$_id',
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { status: 1 } },
                    ],
                    byPaymentStatus: [
                        {
                            $group: {
                                _id: '$payment.status',
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amount' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                paymentStatus: '$_id',
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { paymentStatus: 1 } },
                    ],
                    byPaymentGateway: [
                        {
                            $group: {
                                _id: '$payment.paymentGateway',
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amount' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                paymentGateway: '$_id',
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { paymentGateway: 1 } },
                    ],
                    byPlan: [
                        {
                            $group: {
                                _id: '$plan._id',
                                planSlug: { $first: '$plan.slug' },
                                planName: { $first: '$plan.name' },
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amount' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                planId: '$_id',
                                planSlug: 1,
                                planName: 1,
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { planName: 1 } },
                    ],
                },
            },
            {
                $project: {
                    totals: { $ifNull: [{ $arrayElemAt: ['$totals', 0] }, { totalOrders: 0, totalAmount: 0 }] },
                    byStatus: 1,
                    byPaymentStatus: 1,
                    byPaymentGateway: 1,
                    byPlan: 1,
                },
            },
        ];

        const summaryResults = await Order.aggregate(pipeline);
        const summary = summaryResults[0] || {
            totals: { totalOrders: 0, totalAmount: 0 },
            byStatus: [],
            byPaymentStatus: [],
            byPaymentGateway: [],
            byPlan: [],
        };

        res.json({ data: summary });
    } catch (error) {
        console.error('Error generating order summary:', error);
        res.status(500).json({ message: 'Failed to generate order summary.' });
    }
};

module.exports = {
    listOrders,
    getOrderByNumber,
    getOrderSummary,
};

