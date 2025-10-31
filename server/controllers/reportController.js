const Project = require('../models/Project');
const Transaction = require('../models/Transaction');
const ExcelJS = require('exceljs');
const { getPlanLimitsForUser } = require('../services/planLimits');
const { withPage } = require('../services/playwrightPool');

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
const {
    buildSummaryQuery,
    SummaryQueryError,
    applyPaginationFilter,
} = require('../utils/summaryQueryBuilder');

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

const handleSummaryError = (error, res, next) => {
    if (error instanceof SummaryQueryError) {
        res.status(error.status).json({ message: error.message });
        return;
    }

    next(error);
};

const aggregateSummaryData = async (filter) => {
    const totals = await Transaction.aggregate([
        { $match: filter },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
            },
        },
    ]);

    const summaryTotals = totals.reduce(
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

    summaryTotals.counts.total = summaryTotals.counts.income + summaryTotals.counts.expense;
    const balance = summaryTotals.income - summaryTotals.expense;

    const projectBreakdownAggregation = await Transaction.aggregate([
        { $match: filter },
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

    return { summaryTotals, balance, projectBreakdown };
};

const mapSummaryTransaction = (transaction) => {
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
};

const mapSummaryTransactions = (transactions) => transactions.map(mapSummaryTransaction);

const escapeHtml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const amountFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const formatAmount = (value) => amountFormatter.format(toSafeNumber(value));

const buildSummaryHtml = ({
    transactions,
    summaryTotals,
    balance,
    counts,
    projectBreakdown,
    generatedAt,
}) => {
    const transactionRows = transactions
        .map(
            (transaction) => `
                <tr>
                    <td>${escapeHtml(transaction.date)}</td>
                    <td>${escapeHtml(transaction.projectName || transaction.projectId || '')}</td>
                    <td>${escapeHtml(transaction.type)}</td>
                    <td>${escapeHtml(transaction.subcategory || '')}</td>
                    <td class="numeric">${escapeHtml(formatAmount(transaction.amount))}</td>
                    <td>${escapeHtml(transaction.description || '')}</td>
                </tr>
            `,
        )
        .join('');

    const projectRows = projectBreakdown
        .map(
            (project) => `
                <tr>
                    <td>${escapeHtml(project.projectName || project.projectId || '')}</td>
                    <td class="numeric">${escapeHtml(formatAmount(project.income))}</td>
                    <td class="numeric">${escapeHtml(formatAmount(project.expense))}</td>
                    <td class="numeric">${escapeHtml(formatAmount(project.balance))}</td>
                    <td class="numeric">${escapeHtml(project.transactionCount)}</td>
                </tr>
            `,
        )
        .join('');

    const generatedLabel = generatedAt ? dateTimeFormatter.format(generatedAt) : '';

    return `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <title>Summary Report</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 24px;
                        color: #0f172a;
                    }
                    h1, h2 {
                        margin-bottom: 8px;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin-bottom: 24px;
                    }
                    th, td {
                        border: 1px solid #cbd5f5;
                        padding: 8px;
                        font-size: 12px;
                    }
                    th {
                        background-color: #e2e8f0;
                        text-align: left;
                    }
                    td.numeric, th.numeric {
                        text-align: right;
                    }
                    .meta {
                        font-size: 12px;
                        color: #475569;
                        margin-bottom: 16px;
                    }
                </style>
            </head>
            <body>
                <h1>Transaction Summary</h1>
                <div class="meta">Generated ${escapeHtml(generatedLabel)}</div>
                <section>
                    <h2>Totals</h2>
                    <table>
                        <tbody>
                            <tr><th>Total Income</th><td class="numeric">${escapeHtml(formatAmount(summaryTotals.income))}</td></tr>
                            <tr><th>Total Expense</th><td class="numeric">${escapeHtml(formatAmount(summaryTotals.expense))}</td></tr>
                            <tr><th>Balance</th><td class="numeric">${escapeHtml(formatAmount(balance))}</td></tr>
                        </tbody>
                    </table>
                </section>
                <section>
                    <h2>Counts</h2>
                    <table>
                        <tbody>
                            <tr><th>Income Transactions</th><td class="numeric">${escapeHtml(counts.income)}</td></tr>
                            <tr><th>Expense Transactions</th><td class="numeric">${escapeHtml(counts.expense)}</td></tr>
                            <tr><th>Total Transactions</th><td class="numeric">${escapeHtml(counts.total)}</td></tr>
                        </tbody>
                    </table>
                </section>
                <section>
                    <h2>By Project</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th class="numeric">Income</th>
                                <th class="numeric">Expense</th>
                                <th class="numeric">Balance</th>
                                <th class="numeric">Transactions</th>
                            </tr>
                        </thead>
                        <tbody>${projectRows}</tbody>
                    </table>
                </section>
                <section>
                    <h2>Transactions</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Project</th>
                                <th>Type</th>
                                <th>Subcategory</th>
                                <th class="numeric">Amount</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>${transactionRows}</tbody>
                    </table>
                </section>
            </body>
        </html>
    `;
};

const fetchAllSummaryTransactions = async (filter, sort) => {
    const cursor = Transaction.find(filter)
        .sort(sort)
        .populate({ path: 'project_id', select: 'name' })
        .lean()
        .cursor();

    const transactions = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const doc of cursor) {
        transactions.push(mapSummaryTransaction(doc));
    }

    return transactions;
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

        const { limits: planLimits } = await getPlanLimitsForUser({
            userId,
            planSlug: req.user?.plan,
        });

        const allowFilters = planLimits.summary?.allowFilters !== false;
        const allowPagination = planLimits.summary?.allowPagination !== false;

        const queryConfig = await buildSummaryQuery({
            req,
            userId,
            allowFilters,
            allowPagination,
        });

        const listFilter = applyPaginationFilter(queryConfig.filter, queryConfig.pagination);

        const transactions = await Transaction.find(listFilter)
            .sort(queryConfig.sort)
            .limit(queryConfig.pagination.fetchLimit)
            .populate({ path: 'project_id', select: 'name' })
            .lean();

        const hasNextPage =
            allowPagination && transactions.length > queryConfig.pagination.limit;
        const trimmedTransactions = hasNextPage ? transactions.slice(0, -1) : transactions;
        const nextCursor = hasNextPage
            ? trimmedTransactions[trimmedTransactions.length - 1]?._id?.toString() ?? null
            : null;

        const { summaryTotals, balance, projectBreakdown } = await aggregateSummaryData(
            queryConfig.filter,
        );

        const counts = {
            income: summaryTotals.counts.income,
            expense: summaryTotals.counts.expense,
            total: summaryTotals.counts.total,
        };

        res.status(200).json({
            transactions: mapSummaryTransactions(trimmedTransactions),
            summary: {
                income: summaryTotals.income,
                expense: summaryTotals.expense,
                balance,
                counts,
            },
            pageInfo: {
                hasNextPage,
                nextCursor,
                limit: queryConfig.pagination.limit,
            },
            totalCount: counts.total,
            aggregates: {
                byProject: projectBreakdown,
            },
            capabilities: {
                filters: allowFilters,
                pagination: allowPagination,
            },
        });
    } catch (error) {
        handleSummaryError(error, res, next);
    }
};

const getSummaryPdf = async (req, res, next) => {
    try {
        const userId = req.user?._id;

        const { limits: planLimits } = await getPlanLimitsForUser({
            userId,
            planSlug: req.user?.plan,
        });

        const allowFilters = planLimits.summary?.allowFilters !== false;
        const allowPagination = planLimits.summary?.allowPagination !== false;

        const queryConfig = await buildSummaryQuery({
            req,
            userId,
            allowFilters,
            allowPagination,
        });

        const { summaryTotals, balance, projectBreakdown } = await aggregateSummaryData(
            queryConfig.filter,
        );

        const counts = {
            income: summaryTotals.counts.income,
            expense: summaryTotals.counts.expense,
            total: summaryTotals.counts.total,
        };

        const transactions = await fetchAllSummaryTransactions(
            queryConfig.filter,
            queryConfig.sort,
        );

        const html = buildSummaryHtml({
            transactions,
            summaryTotals,
            balance,
            counts,
            projectBreakdown,
            generatedAt: new Date(),
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="summary.pdf"');
        res.status(200);

        await withPage(async ({ page }) => {
            await page.setContent(html, { waitUntil: 'networkidle' });
            const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
            res.end(pdfBuffer);
        });
    } catch (error) {
        handleSummaryError(error, res, next);
    }
};

const getSummaryXlsx = async (req, res, next) => {
    try {
        const userId = req.user?._id;

        const { limits: planLimits } = await getPlanLimitsForUser({
            userId,
            planSlug: req.user?.plan,
        });

        const allowFilters = planLimits.summary?.allowFilters !== false;
        const allowPagination = planLimits.summary?.allowPagination !== false;

        const queryConfig = await buildSummaryQuery({
            req,
            userId,
            allowFilters,
            allowPagination,
        });

        const { summaryTotals, balance, projectBreakdown } = await aggregateSummaryData(
            queryConfig.filter,
        );

        const counts = {
            income: summaryTotals.counts.income,
            expense: summaryTotals.counts.expense,
            total: summaryTotals.counts.total,
        };

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', 'attachment; filename="summary.xlsx"');
        res.status(200);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });

        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.addRow(['Metric', 'Value']).commit();
        summarySheet.addRow(['Total Income', toSafeNumber(summaryTotals.income)]).commit();
        summarySheet.addRow(['Total Expense', toSafeNumber(summaryTotals.expense)]).commit();
        summarySheet.addRow(['Balance', toSafeNumber(balance)]).commit();
        summarySheet.addRow([]).commit();
        summarySheet.addRow(['Income Count', counts.income]).commit();
        summarySheet.addRow(['Expense Count', counts.expense]).commit();
        summarySheet.addRow(['Total Count', counts.total]).commit();
        await summarySheet.commit();

        const projectSheet = workbook.addWorksheet('By Project');
        projectSheet.columns = [
            { header: 'Project', key: 'project', width: 32 },
            { header: 'Income', key: 'income', width: 18 },
            { header: 'Expense', key: 'expense', width: 18 },
            { header: 'Balance', key: 'balance', width: 18 },
            { header: 'Transactions', key: 'transactions', width: 16 },
        ];

        projectBreakdown.forEach((project) => {
            projectSheet
                .addRow({
                    project: project.projectName || project.projectId || '',
                    income: toSafeNumber(project.income),
                    expense: toSafeNumber(project.expense),
                    balance: toSafeNumber(project.balance),
                    transactions: project.transactionCount,
                })
                .commit();
        });
        await projectSheet.commit();

        const transactionsSheet = workbook.addWorksheet('Transactions');
        transactionsSheet.columns = [
            { header: 'Date', key: 'date', width: 14 },
            { header: 'Project Name', key: 'projectName', width: 32 },
            { header: 'Project ID', key: 'projectId', width: 24 },
            { header: 'Type', key: 'type', width: 12 },
            { header: 'Subcategory', key: 'subcategory', width: 24 },
            { header: 'Amount', key: 'amount', width: 14 },
            { header: 'Description', key: 'description', width: 48 },
        ];

        const cursor = Transaction.find(queryConfig.filter)
            .sort(queryConfig.sort)
            .populate({ path: 'project_id', select: 'name' })
            .lean()
            .cursor();

        // eslint-disable-next-line no-restricted-syntax
        for await (const doc of cursor) {
            const mapped = mapSummaryTransaction(doc);
            transactionsSheet
                .addRow({
                    date: mapped.date,
                    projectName: mapped.projectName || '',
                    projectId: mapped.projectId,
                    type: mapped.type,
                    subcategory: mapped.subcategory || '',
                    amount: toSafeNumber(mapped.amount),
                    description: mapped.description || '',
                })
                .commit();
        }

        await transactionsSheet.commit();
        await workbook.commit();

        if (!res.writableEnded) {
            res.end();
        }
    } catch (error) {
        handleSummaryError(error, res, next);
    }
};

const getSummaryFilters = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { limits: planLimits } = await getPlanLimitsForUser({
            userId,
            planSlug: req.user?.plan,
        });

        const allowFilters = planLimits.summary?.allowFilters !== false;

        if (!allowFilters) {
            return res.status(200).json({
                capabilities: { filters: false },
                projects: [],
                transactionTypes: [],
                subcategories: [],
                dateRange: { earliest: null, latest: null },
            });
        }

        const userIdentifier = toObjectIdOrNull(userId) ?? userId;

        const [projects, rawSubcategories, rangeAggregation] = await Promise.all([
            Project.find({ user_id: userIdentifier })
                .select({ name: 1 })
                .sort({ name: 1 })
                .lean(),
            Transaction.distinct('subcategory', { user_id: userIdentifier }),
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

        const normalizedSubcategories = Array.from(
            new Set(
                rawSubcategories
                    .filter((value) => typeof value === 'string')
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0),
            ),
        ).sort((a, b) => a.localeCompare(b));

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
            subcategories: normalizedSubcategories.map((name) => ({ label: name, value: name })),
            dateRange: {
                earliest,
                latest,
            },
            capabilities: { filters: true },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getReportFilters,
    getCharts,
    getSummary,
    getSummaryPdf,
    getSummaryXlsx,
    getSummaryFilters,
};
