const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const normalize = (value) => value?.split(path.sep).join('/') ?? '';

const originalModuleLoad = Module._load;

const planLimitsDelegate = {
    limits: {
        summary: {
            allowFilters: true,
            allowPagination: true,
            allowExport: true,
        },
    },
};

const setPlanLimits = ({ allowFilters = true, allowPagination = true, allowExport = true } = {}) => {
    planLimitsDelegate.limits = {
        summary: { allowFilters, allowPagination, allowExport },
    };
};

const createQuery = (results) => {
    return {
        sortArg: null,
        limitCalls: [],
        populateArg: null,
        sort(sortSpec) {
            this.sortArg = sortSpec;
            return this;
        },
        limit(value) {
            this.limitCalls.push(value);
            return this;
        },
        populate(populateArg) {
            this.populateArg = populateArg;
            return this;
        },
        async lean() {
            return results;
        },
    };
};

const createProjectQuery = (resultsPromise) => {
    return {
        selectArgs: [],
        select(spec) {
            this.selectArgs.push(spec);
            return this;
        },
        async lean() {
            return await Promise.resolve(resultsPromise);
        },
    };
};

before(() => {
    Module._load = (request, parent, isMain) => {
        const normalizedRequest = normalize(request);
        if (normalizedRequest.endsWith('/services/planLimits')) {
            const normalizedParent = normalize(parent?.filename);
            if (normalizedParent.includes('/controllers/reportController')) {
                return {
                    getPlanLimitsForUser: async () => ({
                        limits: JSON.parse(JSON.stringify(planLimitsDelegate.limits)),
                    }),
                };
            }
        }
        return originalModuleLoad(request, parent, isMain);
    };
});

after(() => {
    Module._load = originalModuleLoad;
});

describe('report summary controller', () => {
    let reportController;
    let Transaction;
    let Project;

    let originalAggregate;
    let originalFind;
    let originalProjectFind;

    let aggregateResponses;
    let aggregateCalls;
    let transactionFindDelegate;
    let projectFindDelegate;
    let capturedFilter;
    let lastQuery;
    let projectFilter;
    let lastProjectQuery;

    before(() => {
        reportController = require('../controllers/reportController');
        Transaction = require('../models/Transaction');
        Project = require('../models/Project');
    });

    beforeEach(() => {
        aggregateResponses = [];
        aggregateCalls = [];
        capturedFilter = null;
        lastQuery = null;
        projectFilter = null;
        lastProjectQuery = null;
        transactionFindDelegate = { handler: null };
        projectFindDelegate = { handler: async () => [] };

        originalAggregate = Transaction.aggregate;
        originalFind = Transaction.find;
        originalProjectFind = Project.find;

        Transaction.aggregate = async (pipeline) => {
            aggregateCalls.push(pipeline);
            if (aggregateResponses.length === 0) {
                return [];
            }
            const response = aggregateResponses.shift();
            return typeof response === 'function' ? response(pipeline) : response;
        };

        Transaction.find = (filter) => {
            capturedFilter = filter;
            if (!transactionFindDelegate.handler) {
                throw new Error('Transaction.find stub not configured.');
            }
            return transactionFindDelegate.handler(filter);
        };

        Project.find = (filter) => {
            if (!projectFindDelegate.handler) {
                throw new Error('Project.find stub not configured.');
            }
            projectFilter = filter;
            const result = projectFindDelegate.handler(filter);
            lastProjectQuery = createProjectQuery(result);
            return lastProjectQuery;
        };
    });

    afterEach(() => {
        Transaction.aggregate = originalAggregate;
        Transaction.find = originalFind;
        Project.find = originalProjectFind;
    });

    const createResponse = () => {
        const res = {
            statusCode: null,
            jsonPayload: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.jsonPayload = payload;
                return this;
            },
        };
        return res;
    };

    const createRequest = ({ userId = 'user-1', plan = 'pro', query = {} } = {}) => ({
        user: { _id: userId, plan },
        query,
    });

    test('returns all transactions when pagination is disabled', async () => {
        setPlanLimits({ allowFilters: true, allowPagination: false, allowExport: true });

        const totalsAggregation = [
            { _id: 'cash_in', total: 300, count: 2 },
            { _id: 'cash_out', total: 100, count: 1 },
        ];
        const projectAggregation = [
            { _id: 'proj-1', income: 200, expense: 0, transactionCount: 2 },
            { _id: 'proj-2', income: 100, expense: 100, transactionCount: 1 },
        ];
        aggregateResponses = [totalsAggregation, projectAggregation];

        projectFindDelegate.handler = async () => [
            { _id: 'proj-1', name: 'Project One' },
            { _id: 'proj-2', name: 'Project Two' },
        ];

        const transactionsData = [
            {
                _id: 'txn-1',
                project_id: { _id: 'proj-1', name: 'Project One' },
                transaction_date: new Date('2024-01-01T00:00:00.000Z'),
                type: 'cash_in',
                amount: 150,
                subcategory: 'Sales',
                description: 'Payment received',
                createdAt: new Date('2024-01-01T00:00:00.000Z'),
                updatedAt: new Date('2024-01-01T00:00:00.000Z'),
            },
            {
                _id: 'txn-2',
                project_id: { _id: 'proj-1', name: 'Project One' },
                transaction_date: new Date('2024-01-02T00:00:00.000Z'),
                type: 'cash_in',
                amount: 150,
                subcategory: 'Sales',
                description: 'Second payment',
                createdAt: new Date('2024-01-02T00:00:00.000Z'),
                updatedAt: new Date('2024-01-02T00:00:00.000Z'),
            },
            {
                _id: 'txn-3',
                project_id: { _id: 'proj-2', name: 'Project Two' },
                transaction_date: new Date('2024-01-03T00:00:00.000Z'),
                type: 'cash_out',
                amount: 100,
                subcategory: 'Supplies',
                description: 'Materials',
                createdAt: new Date('2024-01-03T00:00:00.000Z'),
                updatedAt: new Date('2024-01-03T00:00:00.000Z'),
            },
        ];

        transactionFindDelegate.handler = () => {
            lastQuery = createQuery(transactionsData);
            return lastQuery;
        };

        const req = createRequest();
        const res = createResponse();

        await reportController.getSummary(req, res, (error) => {
            if (error) throw error;
        });

        assert.equal(res.statusCode, 200);
        assert.ok(res.jsonPayload, 'response payload should be present');
        assert.equal(res.jsonPayload.transactions.length, transactionsData.length);
        assert.equal(res.jsonPayload.capabilities.pagination, false);
        assert.equal(res.jsonPayload.pageInfo.limit, 0);
        assert.equal(res.jsonPayload.pageInfo.hasNextPage, false);
        assert.equal(res.jsonPayload.pageInfo.nextCursor, null);
        assert.equal(res.jsonPayload.totalCount, 3);
        assert.deepEqual(res.jsonPayload.summary, {
            income: 300,
            expense: 100,
            balance: 200,
            counts: { income: 2, expense: 1, total: 3 },
        });
        assert.ok(Array.isArray(res.jsonPayload.aggregates.byProject));
        assert.equal(lastQuery.limitCalls.length, 0, 'limit should not be invoked when pagination is disabled');
        assert.deepEqual(capturedFilter, { user_id: req.user._id });
        assert.deepEqual(projectFilter, { _id: { $in: ['proj-1', 'proj-2'] } });
        assert.deepEqual(lastProjectQuery?.selectArgs, [{ name: 1 }]);
        assert.equal(aggregateCalls.length, 2);
    });

    test('paginates transactions when pagination is enabled', async () => {
        setPlanLimits({ allowFilters: true, allowPagination: true, allowExport: true });

        const totalsAggregation = [
            { _id: 'cash_in', total: 2100, count: 15 },
            { _id: 'cash_out', total: 400, count: 6 },
        ];
        const projectAggregation = [];
        aggregateResponses = [totalsAggregation, projectAggregation];

        projectFindDelegate.handler = async () => [];

        const transactionsData = Array.from({ length: 21 }, (_, index) => {
            const counter = index + 1;
            return {
                _id: `txn-${counter}`,
                project_id: { _id: 'proj-1', name: 'Project One' },
                transaction_date: new Date(`2024-02-${String(Math.min(counter, 28)).padStart(2, '0')}T00:00:00.000Z`),
                type: counter % 2 === 0 ? 'cash_out' : 'cash_in',
                amount: counter * 10,
                subcategory: 'General',
                description: `Transaction ${counter}`,
                createdAt: new Date(`2024-02-${String(Math.min(counter, 28)).padStart(2, '0')}T00:00:00.000Z`),
                updatedAt: new Date(`2024-02-${String(Math.min(counter, 28)).padStart(2, '0')}T00:00:00.000Z`),
            };
        });

        transactionFindDelegate.handler = () => {
            lastQuery = createQuery(transactionsData);
            return lastQuery;
        };

        const req = createRequest({ query: {} });
        const res = createResponse();

        await reportController.getSummary(req, res, (error) => {
            if (error) throw error;
        });

        assert.equal(res.statusCode, 200);
        assert.ok(res.jsonPayload, 'response payload should be present');
        assert.equal(res.jsonPayload.transactions.length, 20, 'should return one page of results');
        assert.equal(res.jsonPayload.capabilities.pagination, true);
        assert.equal(res.jsonPayload.pageInfo.limit, 20);
        assert.equal(res.jsonPayload.pageInfo.hasNextPage, true);
        assert.equal(res.jsonPayload.pageInfo.nextCursor, 'txn-20');
        assert.equal(lastQuery.limitCalls.length, 1, 'limit should be invoked when pagination is enabled');
        assert.equal(lastQuery.limitCalls[0], 21);
        assert.deepEqual(capturedFilter, { user_id: req.user._id });
        assert.equal(res.jsonPayload.totalCount, 21);
        assert.deepEqual(res.jsonPayload.summary, {
            income: 2100,
            expense: 400,
            balance: 1700,
            counts: { income: 15, expense: 6, total: 21 },
        });
    });

    test('includes boundary transactions when filtering by start and end dates', async () => {
        setPlanLimits({ allowFilters: true, allowPagination: true, allowExport: true });

        const userId = 'user-1';
        const monthEndDate = new Date('2024-05-31T23:45:00.000Z');
        const currentDayDate = new Date('2024-06-01T15:30:00.000Z');
        const expectedStart = new Date('2024-05-01T00:00:00.000Z');
        const expectedExclusiveEnd = new Date('2024-06-02T00:00:00.000Z');

        const seededTransactions = [
            {
                _id: 'txn-month-end',
                user_id: userId,
                project_id: { _id: 'proj-1', name: 'Project One' },
                transaction_date: monthEndDate,
                type: 'cash_out',
                amount: 200,
                subcategory: 'Operations',
                description: 'Month-end expense',
                createdAt: monthEndDate,
                updatedAt: monthEndDate,
            },
            {
                _id: 'txn-current-day',
                user_id: userId,
                project_id: { _id: 'proj-2', name: 'Project Two' },
                transaction_date: currentDayDate,
                type: 'cash_in',
                amount: 500,
                subcategory: 'Sales',
                description: 'Current day income',
                createdAt: currentDayDate,
                updatedAt: currentDayDate,
            },
        ];

        const matchesFilter = (filter, transaction) => {
            if (!filter) {
                return true;
            }

            if (filter.$and) {
                return filter.$and.every((clause) => matchesFilter(clause, transaction));
            }

            if (filter.user_id) {
                return transaction.user_id === filter.user_id;
            }

            if (filter.transaction_date) {
                const { $gte, $lte, $lt } = filter.transaction_date;
                if ($gte && transaction.transaction_date < $gte) {
                    return false;
                }
                if ($lte && transaction.transaction_date > $lte) {
                    return false;
                }
                if ($lt && transaction.transaction_date >= $lt) {
                    return false;
                }
            }

            return true;
        };

        const filterTransactions = (filter) =>
            seededTransactions.filter((transaction) => matchesFilter(filter, transaction));

        transactionFindDelegate.handler = (filter) => {
            const filtered = filterTransactions(filter)
                .slice()
                .sort((a, b) => {
                    const timeDifference = b.transaction_date.getTime() - a.transaction_date.getTime();
                    if (timeDifference !== 0) {
                        return timeDifference;
                    }
                    return b._id.localeCompare(a._id);
                });
            lastQuery = createQuery(filtered);
            return lastQuery;
        };

        aggregateResponses = [
            (pipeline) => {
                const matchStage = pipeline.find((stage) => stage.$match)?.$match ?? {};
                const filtered = filterTransactions(matchStage);
                const groupedByType = filtered.reduce((accumulator, transaction) => {
                    if (!accumulator[transaction.type]) {
                        accumulator[transaction.type] = { total: 0, count: 0 };
                    }
                    accumulator[transaction.type].total += transaction.amount;
                    accumulator[transaction.type].count += 1;
                    return accumulator;
                }, {});
                return Object.entries(groupedByType).map(([type, values]) => ({
                    _id: type,
                    total: values.total,
                    count: values.count,
                }));
            },
            (pipeline) => {
                const matchStage = pipeline.find((stage) => stage.$match)?.$match ?? {};
                const filtered = filterTransactions(matchStage);
                const groupedByProject = filtered.reduce((accumulator, transaction) => {
                    const projectId = transaction.project_id?._id ?? '';
                    if (!accumulator[projectId]) {
                        accumulator[projectId] = { income: 0, expense: 0, transactionCount: 0 };
                    }
                    if (transaction.type === 'cash_in') {
                        accumulator[projectId].income += transaction.amount;
                    } else if (transaction.type === 'cash_out') {
                        accumulator[projectId].expense += transaction.amount;
                    }
                    accumulator[projectId].transactionCount += 1;
                    return accumulator;
                }, {});
                return Object.entries(groupedByProject).map(([projectId, values]) => ({
                    _id: projectId,
                    income: values.income,
                    expense: values.expense,
                    transactionCount: values.transactionCount,
                }));
            },
        ];

        projectFindDelegate.handler = async () => [
            { _id: 'proj-1', name: 'Project One' },
            { _id: 'proj-2', name: 'Project Two' },
        ];

        const req = createRequest({
            userId,
            query: {
                startDate: '2024-05-01',
                endDate: '2024-06-01',
            },
        });
        const res = createResponse();

        await reportController.getSummary(req, res, (error) => {
            if (error) throw error;
        });

        assert.equal(res.statusCode, 200);
        assert.ok(res.jsonPayload, 'response payload should be present');
        assert.equal(res.jsonPayload.transactions.length, 2);
        const returnedIds = new Set(res.jsonPayload.transactions.map((transaction) => transaction.id));
        assert.deepEqual(returnedIds, new Set(['txn-month-end', 'txn-current-day']));

        assert.deepEqual(res.jsonPayload.summary, {
            income: 500,
            expense: 200,
            balance: 300,
            counts: { income: 1, expense: 1, total: 2 },
        });

        const dateClause =
            capturedFilter.$and?.find((clause) => clause.transaction_date)?.transaction_date ?? {};
        assert.ok(dateClause.$lt, 'Expected the filter to use an exclusive upper bound for the end date.');
        assert.equal(dateClause.$gte.toISOString(), expectedStart.toISOString());
        assert.equal(dateClause.$lt.toISOString(), expectedExclusiveEnd.toISOString());

        const aggregateMatchStage = aggregateCalls[0]?.find((stage) => stage.$match)?.$match ?? {};
        const aggregateDateClause =
            aggregateMatchStage.$and?.find((clause) => clause.transaction_date)?.transaction_date ?? {};
        assert.ok(
            aggregateDateClause.$lt,
            'Expected the aggregate pipeline to apply the exclusive end date boundary.',
        );
        assert.equal(aggregateDateClause.$lt.toISOString(), expectedExclusiveEnd.toISOString());
    });

    test('preserves explicit end date time components when filtering', async () => {
        setPlanLimits({ allowFilters: true, allowPagination: true, allowExport: true });

        const userId = 'user-explicit-time';
        const explicitStartIso = '2024-06-15T09:00:00.000Z';
        const explicitEndIso = '2024-06-15T12:30:00.000Z';
        const explicitEndDate = new Date(explicitEndIso);

        const seededTransactions = [
            {
                _id: 'txn-morning',
                user_id: userId,
                project_id: { _id: 'proj-time', name: 'Project Time' },
                transaction_date: new Date('2024-06-15T10:15:00.000Z'),
                type: 'cash_in',
                amount: 200,
                subcategory: 'Consulting',
                description: 'Morning income',
                createdAt: new Date('2024-06-15T10:15:00.000Z'),
                updatedAt: new Date('2024-06-15T10:15:00.000Z'),
            },
            {
                _id: 'txn-boundary',
                user_id: userId,
                project_id: { _id: 'proj-time', name: 'Project Time' },
                transaction_date: explicitEndDate,
                type: 'cash_out',
                amount: 75,
                subcategory: 'Supplies',
                description: 'Boundary expense',
                createdAt: explicitEndDate,
                updatedAt: explicitEndDate,
            },
            {
                _id: 'txn-afternoon',
                user_id: userId,
                project_id: { _id: 'proj-time', name: 'Project Time' },
                transaction_date: new Date('2024-06-15T13:00:00.000Z'),
                type: 'cash_in',
                amount: 125,
                subcategory: 'Consulting',
                description: 'Afternoon income',
                createdAt: new Date('2024-06-15T13:00:00.000Z'),
                updatedAt: new Date('2024-06-15T13:00:00.000Z'),
            },
        ];

        const matchesFilter = (filter, transaction) => {
            if (!filter) {
                return true;
            }

            if (filter.$and) {
                return filter.$and.every((clause) => matchesFilter(clause, transaction));
            }

            if (filter.user_id) {
                return transaction.user_id === filter.user_id;
            }

            if (filter.transaction_date) {
                const { $gte, $lte, $lt } = filter.transaction_date;
                if ($gte && transaction.transaction_date < $gte) {
                    return false;
                }
                if ($lte && transaction.transaction_date > $lte) {
                    return false;
                }
                if ($lt && transaction.transaction_date >= $lt) {
                    return false;
                }
            }

            return true;
        };

        const filterTransactions = (filter) =>
            seededTransactions.filter((transaction) => matchesFilter(filter, transaction));

        transactionFindDelegate.handler = (filter) => {
            const filtered = filterTransactions(filter)
                .slice()
                .sort((a, b) => {
                    const timeDifference = b.transaction_date.getTime() - a.transaction_date.getTime();
                    if (timeDifference !== 0) {
                        return timeDifference;
                    }
                    return b._id.localeCompare(a._id);
                });
            lastQuery = createQuery(filtered);
            return lastQuery;
        };

        aggregateResponses = [
            (pipeline) => {
                const matchStage = pipeline.find((stage) => stage.$match)?.$match ?? {};
                const filtered = filterTransactions(matchStage);
                const groupedByType = filtered.reduce((accumulator, transaction) => {
                    if (!accumulator[transaction.type]) {
                        accumulator[transaction.type] = { total: 0, count: 0 };
                    }
                    accumulator[transaction.type].total += transaction.amount;
                    accumulator[transaction.type].count += 1;
                    return accumulator;
                }, {});
                return Object.entries(groupedByType).map(([type, values]) => ({
                    _id: type,
                    total: values.total,
                    count: values.count,
                }));
            },
            (pipeline) => {
                const matchStage = pipeline.find((stage) => stage.$match)?.$match ?? {};
                const filtered = filterTransactions(matchStage);
                if (filtered.length === 0) {
                    return [];
                }
                const groupedByProject = filtered.reduce((accumulator, transaction) => {
                    const projectId = transaction.project_id._id;
                    if (!accumulator[projectId]) {
                        accumulator[projectId] = { income: 0, expense: 0, transactionCount: 0 };
                    }
                    if (transaction.type === 'cash_in') {
                        accumulator[projectId].income += transaction.amount;
                    } else if (transaction.type === 'cash_out') {
                        accumulator[projectId].expense += transaction.amount;
                    }
                    accumulator[projectId].transactionCount += 1;
                    return accumulator;
                }, {});
                return Object.entries(groupedByProject).map(([projectId, values]) => ({
                    _id: projectId,
                    income: values.income,
                    expense: values.expense,
                    transactionCount: values.transactionCount,
                }));
            },
        ];

        projectFindDelegate.handler = async () => [{ _id: 'proj-time', name: 'Project Time' }];

        const req = createRequest({
            userId,
            query: {
                startDate: explicitStartIso,
                endDate: explicitEndIso,
            },
        });
        const res = createResponse();

        await reportController.getSummary(req, res, (error) => {
            if (error) throw error;
        });

        assert.equal(res.statusCode, 200);
        assert.ok(res.jsonPayload, 'response payload should be present');
        assert.equal(res.jsonPayload.transactions.length, 2);
        const returnedIds = new Set(res.jsonPayload.transactions.map((transaction) => transaction.id));
        assert.deepEqual(returnedIds, new Set(['txn-morning', 'txn-boundary']));

        assert.deepEqual(res.jsonPayload.summary, {
            income: 200,
            expense: 75,
            balance: 125,
            counts: { income: 1, expense: 1, total: 2 },
        });

        const dateClause =
            capturedFilter.$and?.find((clause) => clause.transaction_date)?.transaction_date ?? {};
        assert.ok(dateClause.$lte, 'Expected the filter to retain an inclusive end date when time is specified.');
        assert.equal(dateClause.$gte.toISOString(), new Date(explicitStartIso).toISOString());
        assert.equal(dateClause.$lte.toISOString(), explicitEndDate.toISOString());

        const aggregateMatchStage = aggregateCalls[0]?.find((stage) => stage.$match)?.$match ?? {};
        const aggregateDateClause =
            aggregateMatchStage.$and?.find((clause) => clause.transaction_date)?.transaction_date ?? {};
        assert.ok(
            aggregateDateClause.$lte,
            'Expected the aggregate pipeline to apply the inclusive end date boundary when a time is supplied.',
        );
        assert.equal(aggregateDateClause.$lte.toISOString(), explicitEndDate.toISOString());
    });
});
