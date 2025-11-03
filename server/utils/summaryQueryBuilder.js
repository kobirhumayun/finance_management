const Transaction = require('../models/Transaction');
const {
    clampLimit,
    escapeRegex,
    toObjectIdOrNull,
    buildTransactionCursorFilter,
    toStorageType,
    parseTransactionDate,
} = require('./transactionQueryHelpers');

class SummaryQueryError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'SummaryQueryError';
        this.status = status;
    }
}

const applyPaginationFilter = (filter, pagination) => {
    if (pagination?.cursorQuery) {
        return { $and: [filter, pagination.cursorQuery] };
    }
    return filter;
};

const buildSummaryQuery = async ({
    req,
    userId,
    allowFilters = true,
    allowPagination = true,
    transactionModel = Transaction,
}) => {
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
    } = req.query || {};

    const userIdentifier = toObjectIdOrNull(userId) ?? userId;
    if (!userIdentifier) {
        throw new SummaryQueryError(400, 'Unable to determine the current user.');
    }

    const filters = [{ user_id: userIdentifier }];

    if (allowFilters && projectId) {
        const projectFilter = toObjectIdOrNull(projectId);
        if (!projectFilter) {
            throw new SummaryQueryError(400, 'Invalid project identifier provided.');
        }
        filters.push({ project_id: projectFilter });
    }

    if (allowFilters && type) {
        const storageType = toStorageType(type);
        if (!storageType) {
            throw new SummaryQueryError(400, 'Invalid transaction type filter provided.');
        }
        filters.push({ type: storageType });
    }

    if (allowFilters && search) {
        const trimmed = search.trim();
        if (trimmed) {
            const expression = new RegExp(escapeRegex(trimmed), 'i');
            filters.push({
                $or: [
                    { description: { $regex: expression } },
                    { subcategory: { $regex: expression } },
                ],
            });
        }
    }

    if (allowFilters && subcategory) {
        const trimmed = subcategory.trim();
        if (trimmed.length === 0) {
            throw new SummaryQueryError(400, 'Subcategory filter cannot be empty.');
        }
        filters.push({ subcategory: trimmed });
    }

    if (allowFilters && (startDate || endDate)) {
        const dateFilter = {};
        let startBoundary = null;
        let endBoundaryExclusive = null;

        if (startDate) {
            const parsedStart = parseTransactionDate(startDate);
            if (!parsedStart) {
                throw new SummaryQueryError(400, 'Invalid startDate provided.');
            }
            startBoundary = parsedStart;
            dateFilter.$gte = parsedStart;
        }
        if (endDate) {
            const parsedEnd = parseTransactionDate(endDate);
            if (!parsedEnd) {
                throw new SummaryQueryError(400, 'Invalid endDate provided.');
            }
            const exclusiveEnd = new Date(parsedEnd.getTime());
            exclusiveEnd.setUTCHours(0, 0, 0, 0);
            exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
            endBoundaryExclusive = exclusiveEnd;
            dateFilter.$lt = exclusiveEnd;
        }

        if (startBoundary && endBoundaryExclusive && startBoundary >= endBoundaryExclusive) {
            throw new SummaryQueryError(400, 'startDate cannot be later than endDate.');
        }

        filters.push({ transaction_date: dateFilter });
    }

    const baseFilter = filters.length > 1 ? { $and: filters } : filters[0];
    const sortDirection = sort === 'oldest' ? 1 : -1;
    const sortSpec = { transaction_date: sortDirection, _id: sortDirection };

    const limit = allowPagination ? clampLimit(limitParam, { defaultValue: 20 }) : 0;
    const pagination = {
        enabled: allowPagination,
        limit,
        cursor: null,
        fetchLimit: allowPagination ? limit + 1 : 0,
        cursorQuery: null,
    };

    if (allowPagination && cursor) {
        const cursorDoc = await transactionModel
            .findOne({ _id: cursor, user_id: userIdentifier })
            .select({ transaction_date: 1 })
            .lean();

        if (!cursorDoc) {
            throw new SummaryQueryError(400, 'Cursor transaction could not be found.');
        }

        pagination.cursor = cursor;
        pagination.cursorQuery = buildTransactionCursorFilter(sortDirection, cursorDoc);
    }

    return {
        filter: baseFilter,
        projection: null,
        sort: sortSpec,
        pagination,
    };
};

module.exports = {
    buildSummaryQuery,
    SummaryQueryError,
    applyPaginationFilter,
};
