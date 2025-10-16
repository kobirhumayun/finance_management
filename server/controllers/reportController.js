const Project = require('../models/Project');
const Transaction = require('../models/Transaction');

const {
    clampLimit,
    escapeRegex,
    toObjectIdOrNull,
    mapTransaction,
    buildTransactionCursorFilter,
    toStorageType,
    parseTransactionDate,
    toResponseDate,
} = require('../utils/transactionQueryHelpers');

const monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
});

const formatMonthLabel = (year, month) => {
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return '';
    }

    const date = new Date(Date.UTC(year, month - 1, 1));
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return monthFormatter.format(date);
};

const toSafeNumber = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const getReportFilters = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const userIdentifier = toObjectIdOrNull(userId) ?? userId;

        const [projects, rangeAggregation] = await Promise.all([
            Project.find({ user_id: userIdentifier })
                .select({ name: 1 })
                .sort({ name: 1 })
                .lean(),
            Transaction.aggregate([
                { $match: { user_id: userIdentifier } },
                {
                    $group: {
                        _id: null,
                        earliest: { $min: '$transaction_date' },
                        latest: { $max: '$transaction_date' },
                    },
                },
            ]),
        ]);

        const rangeResult = rangeAggregation[0] || {};
        const earliest = rangeResult.earliest ? toResponseDate(rangeResult.earliest) : null;
        const latest = rangeResult.latest ? toResponseDate(rangeResult.latest) : null;

        res.status(200).json({
            projects: projects.map((project) => ({
                id: project._id.toString(),
                name: project.name,
                label: project.name,
                value: project._id.toString(),
            })),
            transactionTypes: [
                { label: 'Income', value: 'income' },
                { label: 'Expense', value: 'expense' },
            ],
            dateRange: {
                earliest,
                latest,
            },
        });
    } catch (error) {
        next(error);
    }
};

const getCharts = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { projectId, type, startDate, endDate } = req.query;

        const userIdentifier = toObjectIdOrNull(userId) ?? userId;
        const filters = [{ user_id: userIdentifier }];

        if (projectId) {
            const projectFilter = toObjectIdOrNull(projectId);
            if (!projectFilter) {
                return res.status(400).json({ message: 'Invalid project identifier provided.' });
            }
            filters.push({ project_id: projectFilter });
        }

        let storageType = null;
        if (type) {
            storageType = toStorageType(type);
            if (!storageType) {
                return res.status(400).json({ message: 'Invalid transaction type filter provided.' });
            }
            filters.push({ type: storageType });
        }

        let parsedStartDate = null;
        let parsedEndDate = null;
        if (startDate || endDate) {
            const dateFilter = {};
            if (startDate) {
                parsedStartDate = parseTransactionDate(startDate);
                if (!parsedStartDate) {
                    return res.status(400).json({ message: 'Invalid startDate provided.' });
                }
                dateFilter.$gte = parsedStartDate;
            }
            if (endDate) {
                parsedEndDate = parseTransactionDate(endDate);
                if (!parsedEndDate) {
                    return res.status(400).json({ message: 'Invalid endDate provided.' });
                }
                dateFilter.$lte = parsedEndDate;
            }

            if (dateFilter.$gte && dateFilter.$lte && dateFilter.$gte > dateFilter.$lte) {
                return res.status(400).json({ message: 'startDate cannot be later than endDate.' });
            }

            filters.push({ transaction_date: dateFilter });
        }

        const matchStage = filters.length > 1 ? { $and: filters } : filters[0];

        const [monthlyAggregation, categoryAggregation, statsAggregation] = await Promise.all([
            Transaction.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: {
                            year: { $year: '$transaction_date' },
                            month: { $month: '$transaction_date' },
                        },
                        income: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'cash_in'] }, '$amount', 0],
                            },
                        },
                        expense: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'cash_out'] }, '$amount', 0],
                            },
                        },
                    },
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
            ]),
            Transaction.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: '$subcategory',
                        income: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'cash_in'] }, '$amount', 0],
                            },
                        },
                        expense: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'cash_out'] }, '$amount', 0],
                            },
                        },
                    },
                },
            ]),
            Transaction.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        income: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'cash_in'] }, '$amount', 0],
                            },
                        },
                        expense: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'cash_out'] }, '$amount', 0],
                            },
                        },
                        incomeCount: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'cash_in'] }, 1, 0],
                            },
                        },
                        expenseCount: {
                            $sum: {
                                $cond: [{ $eq: ['$type', 'cash_out'] }, 1, 0],
                            },
                        },
                        totalCount: { $sum: 1 },
                        earliest: { $min: '$transaction_date' },
                        latest: { $max: '$transaction_date' },
                    },
                },
            ]),
        ]);

        const incomeVsExpense = monthlyAggregation
            .map((item) => {
                const year = item._id?.year;
                const month = item._id?.month;
                const label = formatMonthLabel(year, month);

                if (!label) {
                    return null;
                }

                return {
                    month: label,
                    income: toSafeNumber(item.income),
                    expense: toSafeNumber(item.expense),
                };
            })
            .filter(Boolean);

        const cashFlow = incomeVsExpense.map((item) => ({
            month: item.month,
            cashIn: item.income,
            cashOut: item.expense,
        }));

        const expenseByCategory = categoryAggregation
            .map((item) => {
                const name = typeof item._id === 'string' ? item._id.trim() : '';
                const value = toSafeNumber(item.expense);

                if (!name || value <= 0) {
                    return null;
                }

                return { name, value };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (b.value === a.value) {
                    return a.name.localeCompare(b.name);
                }
                return b.value - a.value;
            });

        const incomeByCategory = categoryAggregation
            .map((item) => {
                const name = typeof item._id === 'string' ? item._id.trim() : '';
                const value = toSafeNumber(item.income);

                if (!name || value <= 0) {
                    return null;
                }

                return { name, value };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (b.value === a.value) {
                    return a.name.localeCompare(b.name);
                }
                return b.value - a.value;
            });

        const stats = statsAggregation[0] || {};
        const totalIncome = toSafeNumber(stats.income);
        const totalExpense = toSafeNumber(stats.expense);
        const incomeCount = toSafeNumber(stats.incomeCount);
        const expenseCount = toSafeNumber(stats.expenseCount);
        const totalCount = toSafeNumber(stats.totalCount);

        const appliedStart = parsedStartDate || stats.earliest || null;
        const appliedEnd = parsedEndDate || stats.latest || null;

        res.status(200).json({
            incomeVsExpense,
            expenseByCategory,
            incomeByCategory,
            cashFlow,
            summary: {
                income: totalIncome,
                expense: totalExpense,
                balance: totalIncome - totalExpense,
                counts: {
                    income: toSafeNumber(incomeCount),
                    expense: toSafeNumber(expenseCount),
                    total: toSafeNumber(totalCount),
                },
            },
            dateRange: {
                start: appliedStart ? toResponseDate(appliedStart) : null,
                end: appliedEnd ? toResponseDate(appliedEnd) : null,
            },
            filters: {
                projectId: projectId ?? null,
                type: type ?? null,
                storageType,
            },
        });
    } catch (error) {
        next(error);
    }
};

const getSummary = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const {
            limit: limitParam,
            cursor,
            sort,
            type,
            projectId,
            search,
            startDate,
            endDate,
            subcategory,
        } = req.query;

        const userIdentifier = toObjectIdOrNull(userId) ?? userId;
        const filters = [{ user_id: userIdentifier }];

        if (projectId) {
            const projectFilter = toObjectIdOrNull(projectId);
            if (!projectFilter) {
                return res.status(400).json({ message: 'Invalid project identifier provided.' });
            }
            filters.push({ project_id: projectFilter });
        }

        if (type) {
            const storageType = toStorageType(type);
            if (!storageType) {
                return res.status(400).json({ message: 'Invalid transaction type filter provided.' });
            }
            filters.push({ type: storageType });
        }

        if (search) {
            const expression = new RegExp(escapeRegex(search.trim()), 'i');
            filters.push({
                $or: [
                    { description: { $regex: expression } },
                    { subcategory: { $regex: expression } },
                ],
            });
        }

        if (subcategory) {
            const trimmed = subcategory.trim();
            if (trimmed.length === 0) {
                return res.status(400).json({ message: 'Subcategory filter cannot be empty.' });
            }
            filters.push({ subcategory: trimmed });
        }

        if (startDate || endDate) {
            const dateFilter = {};
            if (startDate) {
                const parsedStart = parseTransactionDate(startDate);
                if (!parsedStart) {
                    return res.status(400).json({ message: 'Invalid startDate provided.' });
                }
                dateFilter.$gte = parsedStart;
            }
            if (endDate) {
                const parsedEnd = parseTransactionDate(endDate);
                if (!parsedEnd) {
                    return res.status(400).json({ message: 'Invalid endDate provided.' });
                }
                dateFilter.$lte = parsedEnd;
            }

            if (dateFilter.$gte && dateFilter.$lte && dateFilter.$gte > dateFilter.$lte) {
                return res.status(400).json({ message: 'startDate cannot be later than endDate.' });
            }

            filters.push({ transaction_date: dateFilter });
        }

        const limit = clampLimit(limitParam, { defaultValue: 20 });
        const sortDirection = sort === 'oldest' ? 1 : -1;

        const queryFilters = [...filters];

        if (cursor) {
            const cursorTransaction = await Transaction.findOne({
                _id: cursor,
                user_id: userIdentifier,
            })
                .select({ transaction_date: 1 })
                .lean();

            if (!cursorTransaction) {
                return res.status(400).json({ message: 'Cursor transaction could not be found.' });
            }

            queryFilters.push(buildTransactionCursorFilter(sortDirection, cursorTransaction));
        }

        const query = queryFilters.length > 1 ? { $and: queryFilters } : queryFilters[0];

        const transactions = await Transaction.find(query)
            .sort({ transaction_date: sortDirection, _id: sortDirection })
            .limit(limit + 1)
            .populate({ path: 'project_id', select: 'name' })
            .lean();

        const hasNextPage = transactions.length > limit;
        const trimmedTransactions = hasNextPage ? transactions.slice(0, -1) : transactions;
        const nextCursor = hasNextPage
            ? trimmedTransactions[trimmedTransactions.length - 1]?._id?.toString() ?? null
            : null;

        const summaryFilters = filters.length > 1 ? { $and: filters } : filters[0];

        const totals = await Transaction.aggregate([
            { $match: summaryFilters },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);

        const summary = totals.reduce(
            (accumulator, item) => {
                if (item._id === 'cash_in') {
                    accumulator.income += item.total;
                    accumulator.counts.income += item.count;
                }
                if (item._id === 'cash_out') {
                    accumulator.expense += item.total;
                    accumulator.counts.expense += item.count;
                }
                return accumulator;
            },
            { income: 0, expense: 0, counts: { income: 0, expense: 0 } },
        );

        const balance = summary.income - summary.expense;

        const projectBreakdownAggregation = await Transaction.aggregate([
            { $match: summaryFilters },
            {
                $group: {
                    _id: '$project_id',
                    income: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'cash_in'] }, '$amount', 0],
                        },
                    },
                    expense: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'cash_out'] }, '$amount', 0],
                        },
                    },
                    transactionCount: { $sum: 1 },
                },
            },
        ]);

        const projectIds = projectBreakdownAggregation
            .map((item) => item._id)
            .filter(Boolean)
            .map((id) => id.toString());

        let projectNameById = {};
        if (projectIds.length > 0) {
            const uniqueProjectIds = Array.from(new Set(projectIds));
            const relatedProjects = await Project.find({ _id: { $in: uniqueProjectIds } })
                .select({ name: 1 })
                .lean();

            projectNameById = relatedProjects.reduce((accumulator, project) => {
                accumulator[project._id.toString()] = project.name;
                return accumulator;
            }, {});
        }

        const projectBreakdown = projectBreakdownAggregation.map((item) => {
            const projectKey = item._id ? item._id.toString() : '';
            const incomeTotal = item.income || 0;
            const expenseTotal = item.expense || 0;

            return {
                projectId: projectKey,
                projectName: projectNameById[projectKey] ?? null,
                income: incomeTotal,
                expense: expenseTotal,
                balance: incomeTotal - expenseTotal,
                transactionCount: item.transactionCount || 0,
            };
        });

        projectBreakdown.sort((a, b) => {
            const nameA = a.projectName || '';
            const nameB = b.projectName || '';

            if (!nameA && !nameB) {
                return a.projectId.localeCompare(b.projectId);
            }
            if (!nameA) {
                return 1;
            }
            if (!nameB) {
                return -1;
            }
            return nameA.localeCompare(nameB);
        });

        const counts = {
            income: summary.counts.income,
            expense: summary.counts.expense,
            total: summary.counts.income + summary.counts.expense,
        };

        const formattedTransactions = trimmedTransactions.map((transaction) => {
            const mapped = mapTransaction(transaction);
            return {
                id: mapped.id,
                projectId: mapped.projectId,
                projectName: mapped.projectName,
                date: mapped.date,
                type: mapped.type,
                subcategory: mapped.subcategory,
                amount: mapped.amount,
                description: mapped.description,
            };
        });

        const totalCount = counts.total;

        res.status(200).json({
            transactions: formattedTransactions,
            summary: {
                income: summary.income,
                expense: summary.expense,
                balance,
                counts,
            },
            pageInfo: {
                hasNextPage,
                nextCursor,
                limit,
            },
            totalCount,
            aggregates: {
                byProject: projectBreakdown,
            },
        });
    } catch (error) {
        next(error);
    }
};

const getSummaryFilters = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const userIdentifier = toObjectIdOrNull(userId) ?? userId;

        const projects = await Project.find({ user_id: userIdentifier })
            .select({ name: 1 })
            .sort({ name: 1 })
            .lean();

        const rawSubcategories = await Transaction.distinct('subcategory', { user_id: userIdentifier });
        const normalizedSubcategories = Array.from(
            new Set(
                rawSubcategories
                    .filter((value) => typeof value === 'string')
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0),
            ),
        ).sort((a, b) => a.localeCompare(b));

        res.status(200).json({
            projects: projects.map((project) => ({
                id: project._id.toString(),
                name: project.name,
                label: project.name,
                value: project._id.toString(),
            })),
            transactionTypes: [
                { label: 'Income', value: 'income' },
                { label: 'Expense', value: 'expense' },
            ],
            subcategories: normalizedSubcategories.map((name) => ({ label: name, value: name })),
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getReportFilters,
    getCharts,
    getSummary,
    getSummaryFilters,
};
