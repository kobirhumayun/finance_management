const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Plan = require('../models/Plan');

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_USER_BUCKET_LIMIT = 25;
const MAX_USER_BUCKET_LIMIT = 200;
const NULL_USER_OBJECT_ID = new mongoose.Types.ObjectId('000000000000000000000000');

const decodeUserSummaryCursor = (cursor) => {
    if (!cursor) {
        return null;
    }

    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Cursor payload is malformed.');
    }

    const { totalAmount, userId } = parsed;

    if (totalAmount === undefined || userId === undefined) {
        throw new Error('Cursor payload is missing required fields.');
    }

    const numericTotal = Number(totalAmount);

    if (Number.isNaN(numericTotal)) {
        throw new Error('Cursor totalAmount is not numeric.');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Cursor userId is invalid.');
    }

    return {
        totalAmount: numericTotal,
        userId: new mongoose.Types.ObjectId(userId),
    };
};

const encodeUserSummaryCursor = (bucket) => {
    if (!bucket) {
        return null;
    }

    const sortUserId = bucket.sortUserId || bucket.userId || NULL_USER_OBJECT_ID;

    return Buffer.from(
        JSON.stringify({
            totalAmount: Number(bucket.totalAmount) || 0,
            userId: sortUserId.toString(),
        }),
    ).toString('base64');
};

const parseDecimal = (value) => {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? value : parsed;
    }

    if (value && typeof value.toString === 'function') {
        const parsed = parseFloat(value.toString());
        return Number.isNaN(parsed) ? value : parsed;
    }

    return value;
};

const normalizeInvoices = (invoices) =>
    invoices.map((invoice) => {
        if (invoice.payment) {
            if (invoice.payment.amount !== undefined) {
                invoice.payment.amount = parseDecimal(invoice.payment.amount);
            }

            if (invoice.payment.refundedAmount !== undefined) {
                invoice.payment.refundedAmount = parseDecimal(invoice.payment.refundedAmount);
            }
        }

        return invoice;
    });

const resolveInvoiceFilters = async (query) => {
    const invoiceFilter = {};

    if (query.invoiceNumber) {
        invoiceFilter.invoiceNumber = query.invoiceNumber;
    }

    if (query.status) {
        invoiceFilter.status = query.status;
    }

    if (query.userId) {
        invoiceFilter.user = query.userId;
    }

    if (query.planId) {
        invoiceFilter.plan = query.planId;
    }

    if (query.startDate || query.endDate) {
        invoiceFilter.issuedDate = {};

        if (query.startDate) {
            invoiceFilter.issuedDate.$gte = new Date(query.startDate);
        }

        if (query.endDate) {
            const endDate = new Date(query.endDate);
            endDate.setHours(23, 59, 59, 999);
            invoiceFilter.issuedDate.$lte = endDate;
        }
    }

    if (query.userEmail) {
        const user = await User.findOne({ email: query.userEmail }).select('_id').lean();

        if (!user) {
            return { empty: true };
        }

        invoiceFilter.user = user._id;
    }

    if (query.planSlug) {
        const plan = await Plan.findOne({ slug: query.planSlug }).select('_id').lean();

        if (!plan) {
            return { empty: true };
        }

        invoiceFilter.plan = plan._id;
    }

    if (query.paymentStatus || query.paymentGateway) {
        const paymentQuery = {};

        if (query.paymentStatus) {
            paymentQuery.status = query.paymentStatus;
        }

        if (query.paymentGateway) {
            paymentQuery.paymentGateway = query.paymentGateway;
        }

        const payments = await Payment.find(paymentQuery).select('_id').lean();

        if (!payments.length) {
            return { empty: true };
        }

        invoiceFilter.payment = { $in: payments.map((payment) => payment._id) };
    }

    return { filter: invoiceFilter };
};

const listInvoices = async (req, res) => {
    try {
        const requestedLimit = typeof req.query.limit === 'number' ? req.query.limit : DEFAULT_PAGE_SIZE;
        const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);
        const cursor = req.query.cursor ? new mongoose.Types.ObjectId(req.query.cursor) : null;

        const { filter, empty } = await resolveInvoiceFilters(req.query);

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

        const invoices = await Invoice.find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate({
                path: 'user',
                select: 'username email firstName lastName',
            })
            .populate({
                path: 'plan',
                select: 'name slug billingCycle price currency',
            })
            .populate({
                path: 'payment',
                select: 'status amount currency paymentGateway gatewayTransactionId purpose processedAt createdAt updatedAt',
            })
            .lean();

        const hasNextPage = invoices.length > limit;
        const trimmedInvoices = hasNextPage ? invoices.slice(0, limit) : invoices;
        const normalizedInvoices = normalizeInvoices(trimmedInvoices);
        const nextCursor = hasNextPage ? trimmedInvoices[trimmedInvoices.length - 1]._id.toString() : null;

        res.json({
            data: normalizedInvoices,
            pageInfo: {
                nextCursor,
                hasNextPage,
            },
        });
    } catch (error) {
        console.error('Error listing invoices:', error);
        res.status(500).json({ message: 'Failed to retrieve invoices.' });
    }
};

const getInvoiceByNumber = async (req, res) => {
    try {
        const { invoiceNumber } = req.params;

        let invoice = null;

        if (mongoose.Types.ObjectId.isValid(invoiceNumber)) {
            invoice = await Invoice.findById(invoiceNumber)
                .populate({
                    path: 'user',
                    select: 'username email firstName lastName',
                })
                .populate({
                    path: 'plan',
                    select: 'name slug billingCycle price currency',
                })
                .populate({
                    path: 'payment',
                    select: 'status amount currency paymentGateway gatewayTransactionId purpose processedAt createdAt updatedAt',
                })
                .lean();
        }

        if (!invoice) {
            invoice = await Invoice.findOne({ invoiceNumber })
                .populate({
                    path: 'user',
                    select: 'username email firstName lastName',
                })
                .populate({
                    path: 'plan',
                    select: 'name slug billingCycle price currency',
                })
                .populate({
                    path: 'payment',
                    select: 'status amount currency paymentGateway gatewayTransactionId purpose processedAt createdAt updatedAt',
                })
                .lean();
        }

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found.' });
        }

        const [normalizedInvoice] = normalizeInvoices([invoice]);

        res.json({ data: normalizedInvoice });
    } catch (error) {
        console.error('Error fetching invoice by number:', error);
        res.status(500).json({ message: 'Failed to retrieve invoice details.' });
    }
};

const getInvoiceSummary = async (req, res) => {
    try {
        const requestedByUserLimit = req.query.byUserLimit || DEFAULT_USER_BUCKET_LIMIT;
        const byUserLimit = Math.min(
            Math.max(requestedByUserLimit, 1),
            MAX_USER_BUCKET_LIMIT,
        );

        let byUserCursor;

        try {
            byUserCursor = decodeUserSummaryCursor(req.query.byUserCursor);
        } catch (cursorError) {
            return res.status(400).json({ message: 'Invalid byUserCursor parameter.' });
        }

        const { filter, empty } = await resolveInvoiceFilters(req.query);

        if (empty) {
            return res.json({
                data: {
                    totals: { totalInvoices: 0, totalAmount: 0 },
                    byStatus: [],
                    byPaymentStatus: [],
                    byPaymentGateway: [],
                    byCurrency: [],
                    byPlan: [],
                    byUser: {
                        nodes: [],
                        pageInfo: {
                            nextCursor: null,
                            hasNextPage: false,
                        },
                    },
                    byYear: [],
                    byMonth: [],
                },
            });
        }

        const byUserFacet = [
            {
                $group: {
                    _id: { $ifNull: ['$user._id', NULL_USER_OBJECT_ID] },
                    sortUserId: { $first: { $ifNull: ['$user._id', NULL_USER_OBJECT_ID] } },
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
                    sortUserId: 1,
                    userEmail: 1,
                    firstName: 1,
                    lastName: 1,
                    username: 1,
                    count: 1,
                    totalAmount: 1,
                },
            },
        ];

        if (byUserCursor) {
            byUserFacet.push({
                $match: {
                    $expr: {
                        $or: [
                            { $lt: ['$totalAmount', byUserCursor.totalAmount] },
                            {
                                $and: [
                                    { $eq: ['$totalAmount', byUserCursor.totalAmount] },
                                    { $gt: ['$sortUserId', byUserCursor.userId] },
                                ],
                            },
                        ],
                    },
                },
            });
        }

        byUserFacet.push({ $sort: { totalAmount: -1, sortUserId: 1 } }, { $limit: byUserLimit + 1 });

        const pipeline = [
            { $match: filter },
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
                    from: 'payments',
                    localField: 'payment',
                    foreignField: '_id',
                    as: 'payment',
                },
            },
            { $unwind: { path: '$payment', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    amountNumber: { $toDouble: { $ifNull: ['$amount', 0] } },
                    effectiveIssuedDate: { $ifNull: ['$issuedDate', '$createdAt'] },
                },
            },
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                totalInvoices: { $sum: 1 },
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
                    byCurrency: [
                        {
                            $group: {
                                _id: '$currency',
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amountNumber' },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                currency: '$_id',
                                count: 1,
                                totalAmount: 1,
                            },
                        },
                        { $sort: { currency: 1 } },
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
                    byUser: byUserFacet,
                    byYear: [
                        {
                            $group: {
                                _id: { $year: '$effectiveIssuedDate' },
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
                                    year: { $year: '$effectiveIssuedDate' },
                                    month: { $month: '$effectiveIssuedDate' },
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
                    totals: { $ifNull: [{ $arrayElemAt: ['$totals', 0] }, { totalInvoices: 0, totalAmount: 0 }] },
                    byStatus: 1,
                    byPaymentStatus: 1,
                    byPaymentGateway: 1,
                    byCurrency: 1,
                    byPlan: 1,
                    byUser: 1,
                    byYear: 1,
                    byMonth: 1,
                },
            },
        ];

        const summaryResults = await Invoice.aggregate(pipeline);
        const summary = summaryResults[0] || {};

        const byUserBuckets = Array.isArray(summary.byUser) ? summary.byUser : [];
        const hasNextPage = byUserBuckets.length > byUserLimit;
        const limitedByUserBuckets = hasNextPage
            ? byUserBuckets.slice(0, byUserLimit)
            : byUserBuckets;
        const nextCursor = hasNextPage
            ? encodeUserSummaryCursor(limitedByUserBuckets[limitedByUserBuckets.length - 1])
            : null;

        const byUserNodes = limitedByUserBuckets.map((bucket) => {
            const { sortUserId, ...rest } = bucket;

            return {
                ...rest,
                userId: rest.userId ? rest.userId.toString() : null,
            };
        });

        res.json({
            data: {
                totals: summary.totals || { totalInvoices: 0, totalAmount: 0 },
                byStatus: summary.byStatus || [],
                byPaymentStatus: summary.byPaymentStatus || [],
                byPaymentGateway: summary.byPaymentGateway || [],
                byCurrency: summary.byCurrency || [],
                byPlan: summary.byPlan || [],
                byUser: {
                    nodes: byUserNodes,
                    pageInfo: {
                        nextCursor,
                        hasNextPage,
                    },
                },
                byYear: summary.byYear || [],
                byMonth: summary.byMonth || [],
            },
        });
    } catch (error) {
        console.error('Error generating invoice summary:', error);
        res.status(500).json({ message: 'Failed to generate invoice summary.' });
    }
};

module.exports = {
    listInvoices,
    getInvoiceByNumber,
    getInvoiceSummary,
};
