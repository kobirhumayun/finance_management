const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const normalize = (value) => value?.split(path.sep).join('/');

const originalModuleLoad = Module._load;

const createdWorkbooks = [];

const planLimitsDelegate = {
    limits: {
        summary: {
            allowFilters: true,
            allowPagination: true,
            allowExport: true,
        },
    },
};

const playwrightPoolDelegate = {
    handler: async () => {
        throw new Error('Playwright pool stub not configured.');
    },
};

const playwrightPoolModuleStub = {
    withPage: (...args) => playwrightPoolDelegate.handler(...args),
    initializePlaywright: async () => {},
    shutdownPlaywright: async () => {},
};

class WorksheetMock {
    constructor(name) {
        this.name = name;
        this.rows = [];
        this._columns = null;
        this.committed = false;
    }

    set columns(value) {
        this._columns = value;
    }

    get columns() {
        return this._columns;
    }

    addRow(data) {
        const rowRecord = { values: data, committed: false };
        this.rows.push(rowRecord);
        return {
            commit: () => {
                rowRecord.committed = true;
                return rowRecord;
            },
        };
    }

    async commit() {
        this.committed = true;
    }
}

class WorkbookWriterMock {
    constructor({ stream }) {
        this.stream = stream;
        this.worksheets = [];
        this.committed = false;
        createdWorkbooks.push(this);
    }

    addWorksheet(name) {
        const worksheet = new WorksheetMock(name);
        this.worksheets.push(worksheet);
        return worksheet;
    }

    async commit() {
        this.committed = true;
    }
}

before(() => {
    Module._load = (request, parent, isMain) => {
        if (request === 'exceljs') {
            return {
                stream: {
                    xlsx: {
                        WorkbookWriter: WorkbookWriterMock,
                    },
                },
            };
        }
        if (request === 'playwright') {
            return {
                chromium: {
                    launch: async () => ({
                        newContext: async () => ({
                            newPage: async () => ({
                                setContent: async () => {},
                                pdf: async () => Buffer.from(''),
                                close: async () => {},
                            }),
                            close: async () => {},
                        }),
                        close: async () => {},
                    }),
                },
            };
        }
        if (request.endsWith('/services/planLimits')) {
            if (normalize(parent?.filename)?.includes('/controllers/reportController')) {
                return {
                    getPlanLimitsForUser: async () => ({
                        limits: JSON.parse(JSON.stringify(planLimitsDelegate.limits)),
                    }),
                };
            }
        }
        if (
            request.endsWith('/services/playwrightPool') &&
            (normalize(parent?.filename)?.includes('/controllers/reportController') ||
                normalize(parent?.filename)?.includes('reportSummaryExports.test.js'))
        ) {
            return playwrightPoolModuleStub;
        }
        return originalModuleLoad(request, parent, isMain);
    };
});

after(() => {
    Module._load = originalModuleLoad;
});

describe('report summary exports', () => {
    let reportController;
    let Transaction;
    let Project;
    let playwrightPool;
    let originalAggregate;
    let originalFind;
    let originalProjectFind;

    before(() => {
        reportController = require('../controllers/reportController');
        Transaction = require('../models/Transaction');
        Project = require('../models/Project');
        playwrightPool = require('../services/playwrightPool');
    });

    beforeEach(() => {
        originalAggregate = Transaction.aggregate;
        originalFind = Transaction.find;
        originalProjectFind = Project.find;
        createdWorkbooks.splice(0, createdWorkbooks.length);
        playwrightPoolDelegate.handler = async () => {
            throw new Error('Playwright pool stub not configured.');
        };
        planLimitsDelegate.limits = {
            summary: {
                allowFilters: true,
                allowPagination: true,
                allowExport: true,
            },
        };
    });

    afterEach(() => {
        Transaction.aggregate = originalAggregate;
        Transaction.find = originalFind;
        Project.find = originalProjectFind;
        playwrightPoolDelegate.handler = async () => {
            throw new Error('Playwright pool stub not configured.');
        };
        createdWorkbooks.splice(0, createdWorkbooks.length);
    });

    const createResponseDouble = () => {
        const headers = {};
        const res = {
            headers,
            statusCode: null,
            ended: false,
            payload: null,
            writableEnded: false,
        };
        res.setHeader = (name, value) => {
            headers[name.toLowerCase()] = value;
        };
        res.status = (code) => {
            res.statusCode = code;
            return res;
        };
        res.json = (payload) => {
            res.payload = payload;
            res.ended = true;
            res.writableEnded = true;
            return res;
        };
        res.end = (payload) => {
            res.ended = true;
            res.payload = payload;
            res.writableEnded = true;
            return res;
        };
        return res;
    };

    test('getSummaryPdf streams pdf output with expected html', async () => {
        let aggregateCall = 0;
        Transaction.aggregate = async (pipeline) => {
            aggregateCall += 1;
            if (aggregateCall === 1) {
                assert.ok(pipeline[0].$match.user_id, 'summary aggregation should filter by user');
                return [
                    { _id: 'cash_in', total: 1500, count: 2 },
                    { _id: 'cash_out', total: 500, count: 1 },
                ];
            }
            if (aggregateCall === 2) {
                return [
                    {
                        _id: {
                            toString: () => 'project-1',
                        },
                        income: 1500,
                        expense: 500,
                        transactionCount: 3,
                    },
                ];
            }
            throw new Error('Unexpected aggregate call in test.');
        };

        Project.find = () => ({
            select: () => ({
                lean: async () => [
                    {
                        _id: {
                            toString: () => 'project-1',
                        },
                        name: 'Operations',
                    },
                ],
            }),
        });

        const sampleTransactions = [
            {
                _id: 't-1',
                transaction_date: new Date('2024-01-15'),
                type: 'cash_in',
                amount: 1000,
                subcategory: 'Sales',
                description: 'Invoice #1',
                project_id: { _id: 'project-1', name: 'Operations' },
            },
            {
                _id: 't-2',
                transaction_date: new Date('2024-01-20'),
                type: 'cash_out',
                amount: 500,
                subcategory: 'Supplies',
                description: 'Office supplies',
                project_id: { _id: 'project-1', name: 'Operations' },
            },
        ];

        Transaction.find = () => ({
            sort() {
                return this;
            },
            limit() {
                return this;
            },
            populate() {
                return this;
            },
            lean() {
                return this;
            },
            cursor() {
                async function* iterator() {
                    for (const doc of sampleTransactions) {
                        yield doc;
                    }
                }
                return iterator();
            },
        });

        let capturedHtml = null;
        let pdfOptions = null;
        playwrightPoolDelegate.handler = async (handler) => {
            const page = {
                setContent: async (html) => {
                    capturedHtml = html;
                },
                pdf: async (options) => {
                    pdfOptions = options;
                    return Buffer.from('pdf-bytes');
                },
            };
            return handler({ page, context: {}, browser: {} });
        };

        const req = {
            query: {},
            user: { _id: 'user-123', plan: 'pro' },
        };
        const res = createResponseDouble();

        await reportController.getSummaryPdf(req, res, (error) => {
            throw error;
        });

        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], 'application/pdf');
        assert.equal(res.headers['content-disposition'], 'attachment; filename="summary.pdf"');
        assert.ok(Buffer.isBuffer(res.payload));
        assert.equal(res.payload.toString(), 'pdf-bytes');
        assert.ok(capturedHtml.includes('Transaction Summary'));
        assert.ok(capturedHtml.includes('Operations'));
        assert.deepEqual(pdfOptions, { format: 'A4', printBackground: true });
    });

    test('getSummaryXlsx streams workbook with summary and transactions', async () => {
        let aggregateCall = 0;
        Transaction.aggregate = async () => {
            aggregateCall += 1;
            if (aggregateCall === 1) {
                return [
                    { _id: 'cash_in', total: 2000, count: 2 },
                    { _id: 'cash_out', total: 800, count: 1 },
                ];
            }
            if (aggregateCall === 2) {
                return [
                    {
                        _id: {
                            toString: () => 'project-2',
                        },
                        income: 2000,
                        expense: 800,
                        transactionCount: 3,
                    },
                ];
            }
            throw new Error('Unexpected aggregate call in test.');
        };

        Project.find = () => ({
            select: () => ({
                lean: async () => [
                    {
                        _id: {
                            toString: () => 'project-2',
                        },
                        name: 'Marketing',
                    },
                ],
            }),
        });

        const sampleTransactions = [
            {
                _id: 't-10',
                transaction_date: new Date('2024-02-10'),
                type: 'cash_in',
                amount: 1200,
                subcategory: 'Services',
                description: 'Consulting',
                project_id: { _id: 'project-2', name: 'Marketing' },
            },
            {
                _id: 't-11',
                transaction_date: new Date('2024-02-11'),
                type: 'cash_in',
                amount: 800,
                subcategory: 'Licensing',
                description: 'License fee',
                project_id: { _id: 'project-2', name: 'Marketing' },
            },
        ];

        Transaction.find = () => ({
            sort() {
                return this;
            },
            limit() {
                return this;
            },
            populate() {
                return this;
            },
            lean() {
                return this;
            },
            cursor() {
                async function* iterator() {
                    for (const doc of sampleTransactions) {
                        yield doc;
                    }
                }
                return iterator();
            },
        });

        const req = {
            query: {},
            user: { _id: 'user-456', plan: 'pro' },
        };

        const res = createResponseDouble();
        res.writableEnded = false;

        await reportController.getSummaryXlsx(req, res, (error) => {
            throw error;
        });

        assert.equal(res.statusCode, 200);
        assert.equal(
            res.headers['content-type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        assert.equal(res.headers['content-disposition'], 'attachment; filename="summary.xlsx"');
        assert.ok(res.ended, 'response should be ended');
        assert.ok(createdWorkbooks[0].committed, 'workbook should be committed');

        const [summarySheet, projectSheet, transactionsSheet] = createdWorkbooks[0].worksheets;

        assert.equal(summarySheet.name, 'Summary');
        assert.ok(summarySheet.rows.some((row) => Array.isArray(row.values) && row.values[0] === 'Total Income'));
        assert.equal(projectSheet.name, 'By Project');
        assert.ok(projectSheet.rows.find((row) => row.values.project === 'Marketing'));
        assert.equal(transactionsSheet.name, 'Transactions');
        assert.equal(transactionsSheet.rows.length, sampleTransactions.length);
    });

    test('summary exports return 403 when plan disallows exporting', async () => {
        planLimitsDelegate.limits = {
            summary: {
                allowFilters: true,
                allowPagination: true,
                allowExport: false,
            },
        };

        const req = {
            query: {},
            user: { _id: 'user-789', plan: 'starter' },
        };

        const pdfRes = createResponseDouble();
        await reportController.getSummaryPdf(req, pdfRes, (error) => {
            throw error;
        });
        assert.equal(pdfRes.statusCode, 403);
        assert.deepEqual(pdfRes.payload, {
            message: 'Summary exports are not available for your plan.',
        });

        const xlsxRes = createResponseDouble();
        await reportController.getSummaryXlsx(req, xlsxRes, (error) => {
            throw error;
        });
        assert.equal(xlsxRes.statusCode, 403);
        assert.deepEqual(xlsxRes.payload, {
            message: 'Summary exports are not available for your plan.',
        });
    });
});
