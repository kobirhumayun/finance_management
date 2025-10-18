const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Invoice = require('../models/Invoice');

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const EMPTY_ORDER_SUMMARY = {
    totals: { totalOrders: 0, totalAmount: 0 },
    byStatus: [],
    byPaymentStatus: [],
    byPaymentGateway: [],
    byPlan: [],
    byUser: [],
    byYear: [],
    byMonth: [],
};

const EMPTY_PAYMENT_SUMMARY = {
    totals: { totalPayments: 0, totalAmount: 0 },
    byStatus: [],
    byGateway: [],
    byPurpose: [],
    byUser: [],
    byPlan: [],
    byYear: [],
    byMonth: [],
};

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

const resolvePaymentFilters = async (query) => {
    const paymentFilter = {};

    if (query.status) {
        paymentFilter.status = query.status;
    }

    if (query.userId) {
        paymentFilter.userId = query.userId;
    }

    if (query.planId) {
        paymentFilter.planId = query.planId;
    }

    if (query.paymentGateway) {
        paymentFilter.paymentGateway = query.paymentGateway;
    }

    if (query.purpose) {
        paymentFilter.purpose = query.purpose;
    }

    if (query.userEmail) {
        const user = await User.findOne({ email: query.userEmail }).select('_id').lean();

        if (!user) {
            return { empty: true };
        }

        paymentFilter.userId = user._id;
    }

    if (query.planSlug) {
        const plan = await Plan.findOne({ slug: query.planSlug }).select('_id').lean();

        if (!plan) {
            return { empty: true };
        }

        paymentFilter.planId = plan._id;
    }

    if (query.startDate || query.endDate) {
        paymentFilter.createdAt = {};

        if (query.startDate) {
            paymentFilter.createdAt.$gte = new Date(query.startDate);
        }

        if (query.endDate) {
            const endDate = new Date(query.endDate);
            endDate.setHours(23, 59, 59, 999);
            paymentFilter.createdAt.$lte = endDate;
        }
    }

    return { filter: paymentFilter };
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
            return res.json({ data: EMPTY_ORDER_SUMMARY });
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
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    amountNumber: { $toDouble: { $ifNull: ['$amount', 0] } },
                    effectiveDate: { $ifNull: ['$createdAt', '$updatedAt'] },
                },
            },
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                totalOrders: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                    ],
                    byStatus: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
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
                                totalAmount: { $sum: '$amountNumber' },
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
                                totalAmount: { $sum: '$amountNumber' },
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
                                totalAmount: { $sum: '$amountNumber' },
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
                        { $sort: { totalAmount: -1 } },
                    ],
                    byUser: [
                        {
                            $group: {
                                _id: '$user._id',
                                userId: { $first: '$user._id' },
                                userEmail: { $first: '$user.email' },
                                firstName: { $first: '$user.firstName' },
                                lastName: { $first: '$user.lastName' },
                                username: { $first: '$user.username' },
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                userId: 1,
                                userEmail: 1,
                                firstName: 1,
                                lastName: 1,
                                username: 1,
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { totalAmount: -1 } },
                    ],
                    byYear: [
                        {
                            $group: {
                                _id: { $year: '$effectiveDate' },
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                year: '$_id',
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { year: -1 } },
                    ],
                    byMonth: [
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$effectiveDate' },
                                    month: { $month: '$effectiveDate' },
                                },
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                year: '$_id.year',
                                month: '$_id.month',
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { year: -1, month: -1 } },
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
                    byUser: 1,
                    byYear: 1,
                    byMonth: 1,
                },
            },
        ];

        const summaryResults = await Order.aggregate(pipeline);
        const summary = summaryResults[0] || {};

        res.json({
            data: {
                totals: summary.totals || EMPTY_ORDER_SUMMARY.totals,
                byStatus: summary.byStatus || EMPTY_ORDER_SUMMARY.byStatus,
                byPaymentStatus: summary.byPaymentStatus || EMPTY_ORDER_SUMMARY.byPaymentStatus,
                byPaymentGateway: summary.byPaymentGateway || EMPTY_ORDER_SUMMARY.byPaymentGateway,
                byPlan: summary.byPlan || EMPTY_ORDER_SUMMARY.byPlan,
                byUser: summary.byUser || EMPTY_ORDER_SUMMARY.byUser,
                byYear: summary.byYear || EMPTY_ORDER_SUMMARY.byYear,
                byMonth: summary.byMonth || EMPTY_ORDER_SUMMARY.byMonth,
            },
        });
    } catch (error) {
        console.error('Error generating order summary:', error);
        res.status(500).json({ message: 'Failed to generate order summary.' });
    }
};

const getPaymentSummary = async (req, res) => {
    try {
        const { filter, empty } = await resolvePaymentFilters(req.query);

        if (empty) {
            return res.json({ data: EMPTY_PAYMENT_SUMMARY });
        }

        const pipeline = [
            { $match: filter },
            {
                $addFields: {
                    amountNumber: { $toDouble: { $ifNull: ['$amount', 0] } },
                    effectiveDate: { $ifNull: ['$processedAt', '$createdAt'] },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'planId',
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
                                totalPayments: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                    ],
                    byStatus: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
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
                    byGateway: [
                        {
                            $group: {
                                _id: '$paymentGateway',
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
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
                    byPurpose: [
                        {
                            $group: {
                                _id: '$purpose',
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                purpose: '$_id',
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { purpose: 1 } },
                    ],
                    byUser: [
                        {
                            $group: {
                                _id: '$user._id',
                                userId: { $first: '$user._id' },
                                userEmail: { $first: '$user.email' },
                                firstName: { $first: '$user.firstName' },
                                lastName: { $first: '$user.lastName' },
                                username: { $first: '$user.username' },
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                userId: 1,
                                userEmail: 1,
                                firstName: 1,
                                lastName: 1,
                                username: 1,
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { totalAmount: -1 } },
                    ],
                    byPlan: [
                        {
                            $group: {
                                _id: '$plan._id',
                                planId: { $first: '$plan._id' },
                                planSlug: { $first: '$plan.slug' },
                                planName: { $first: '$plan.name' },
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                planId: 1,
                                planSlug: 1,
                                planName: 1,
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { totalAmount: -1 } },
                    ],
                    byYear: [
                        {
                            $group: {
                                _id: { $year: '$effectiveDate' },
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                year: '$_id',
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { year: -1 } },
                    ],
                    byMonth: [
                        {
                            $group: {
                                _id: {
                                    year: { $year: '$effectiveDate' },
                                    month: { $month: '$effectiveDate' },
                                },
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                year: '$_id.year',
                                month: '$_id.month',
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { year: -1, month: -1 } },
                    ],
                },
            },
            {
                $project: {
                    totals: { $ifNull: [{ $arrayElemAt: ['$totals', 0] }, { totalPayments: 0, totalAmount: 0 }] },
                    byStatus: 1,
                    byGateway: 1,
                    byPurpose: 1,
                    byUser: 1,
                    byPlan: 1,
                    byYear: 1,
                    byMonth: 1,
                },
            },
        ];

        const summaryResults = await Payment.aggregate(pipeline);
        const summary = summaryResults[0] || {};

        res.json({
            data: {
                totals: summary.totals || EMPTY_PAYMENT_SUMMARY.totals,
                byStatus: summary.byStatus || EMPTY_PAYMENT_SUMMARY.byStatus,
                byGateway: summary.byGateway || EMPTY_PAYMENT_SUMMARY.byGateway,
                byPurpose: summary.byPurpose || EMPTY_PAYMENT_SUMMARY.byPurpose,
                byUser: summary.byUser || EMPTY_PAYMENT_SUMMARY.byUser,
                byPlan: summary.byPlan || EMPTY_PAYMENT_SUMMARY.byPlan,
                byYear: summary.byYear || EMPTY_PAYMENT_SUMMARY.byYear,
                byMonth: summary.byMonth || EMPTY_PAYMENT_SUMMARY.byMonth,
            },
        });
    } catch (error) {
        console.error('Error generating payment summary:', error);
        res.status(500).json({ message: 'Failed to generate payment summary.' });
    }
};

module.exports = {
    listOrders,
    getOrderByNumber,
    getOrderSummary,
    getPaymentSummary,
};

