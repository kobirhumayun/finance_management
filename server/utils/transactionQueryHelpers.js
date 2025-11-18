const mongoose = require('mongoose');

const { Types } = mongoose;

const clampLimit = (value, { min = 1, max = 100, defaultValue = 20 } = {}) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return defaultValue;
    }
    return Math.min(Math.max(parsed, min), max);
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectIdOrNull = (value) => {
    if (!value) {
        return null;
    }
    if (value instanceof Types.ObjectId) {
        return value;
    }
    if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
        return new Types.ObjectId(value);
    }
    return null;
};

const isValidObjectId = (value) => Types.ObjectId.isValid(value);

const toResponseDate = (date) => {
    if (!date) {
        return null;
    }
    try {
        return date.toISOString().slice(0, 10);
    } catch (error) {
        return null;
    }
};

const extractProjectReference = (project) => {
    if (!project) {
        return { projectId: '', projectName: null };
    }

    if (typeof project === 'string') {
        return { projectId: project, projectName: null };
    }

    if (project instanceof Types.ObjectId) {
        return { projectId: project.toString(), projectName: null };
    }

    if (typeof project === 'object') {
        const identifier = project._id || project.id || project;
        const projectId = identifier ? identifier.toString() : '';
        const projectName = typeof project.name === 'string' ? project.name : null;
        return { projectId, projectName };
    }

    return { projectId: '', projectName: null };
};

const buildTransactionAttachmentUrl = (projectId, transactionId) => {
    if (!projectId || !transactionId) {
        return '';
    }
    return `/api/projects/${projectId}/transactions/${transactionId}/attachment`;
};

const mapAttachment = (attachment, { projectId, transactionId } = {}) => {
    if (!attachment || typeof attachment !== 'object') {
        return null;
    }

    const transactionAttachmentUrl = (attachment.path && projectId && transactionId)
        ? buildTransactionAttachmentUrl(projectId, transactionId)
        : (attachment.url || '');

    return {
        filename: attachment.filename || '',
        mimeType: attachment.mimeType || '',
        size: typeof attachment.size === 'number' ? attachment.size : null,
        width: typeof attachment.width === 'number' ? attachment.width : null,
        height: typeof attachment.height === 'number' ? attachment.height : null,
        url: transactionAttachmentUrl,
        uploadedAt: attachment.uploadedAt
            ? new Date(attachment.uploadedAt).toISOString()
            : null,
    };
};

const mapTransaction = (transaction) => {
    const { projectId, projectName } = extractProjectReference(transaction.project_id);

    const transactionId = transaction._id ? transaction._id.toString() : '';

    return {
        id: transaction._id ? transaction._id.toString() : '',
        projectId,
        projectName,
        date: toResponseDate(transaction.transaction_date),
        type: transaction.type === 'cash_out' ? 'Expense' : 'Income',
        amount: transaction.amount,
        subcategory: transaction.subcategory,
        description: transaction.description || '',
        attachment: mapAttachment(transaction.attachment, { projectId, transactionId }),
        createdAt: transaction.createdAt ? transaction.createdAt.toISOString() : null,
        updatedAt: transaction.updatedAt ? transaction.updatedAt.toISOString() : null,
    };
};

const buildTransactionCursorFilter = (direction, cursorDoc) => {
    if (!cursorDoc?.transaction_date) {
        return {};
    }

    const comparisonOperator = direction === 1 ? '$gt' : '$lt';
    const equalityOperator = direction === 1 ? '$gt' : '$lt';

    return {
        $or: [
            { transaction_date: { [comparisonOperator]: cursorDoc.transaction_date } },
            {
                transaction_date: cursorDoc.transaction_date,
                _id: { [equalityOperator]: cursorDoc._id },
            },
        ],
    };
};

const toStorageType = (type) => {
    if (type === 'income') {
        return 'cash_in';
    }
    if (type === 'expense') {
        return 'cash_out';
    }
    return null;
};

const parseTransactionDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
};

module.exports = {
    clampLimit,
    escapeRegex,
    toObjectIdOrNull,
    isValidObjectId,
    toResponseDate,
    mapTransaction,
    buildTransactionCursorFilter,
    toStorageType,
    parseTransactionDate,
};
