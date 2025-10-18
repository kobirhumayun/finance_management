const mongoose = require('mongoose');
const { query, param } = require('express-validator');

const allowedInvoiceStatuses = ['paid', 'unpaid', 'cancelled'];
const allowedPaymentStatuses = [
    'pending',
    'succeeded',
    'failed',
    'refunded',
    'partially_refunded',
    'requires_action',
    'canceled',
];

const MAX_USER_BUCKET_LIMIT = 200;

const isValidByUserCursor = (value) => {
    try {
        const decoded = Buffer.from(value, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);

        if (!parsed || typeof parsed !== 'object') {
            return false;
        }

        if (parsed.totalAmount === undefined || parsed.userId === undefined) {
            return false;
        }

        if (Number.isNaN(Number(parsed.totalAmount))) {
            return false;
        }

        if (!mongoose.Types.ObjectId.isValid(parsed.userId)) {
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
};

const listInvoicesValidationRules = () => [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('limit must be between 1 and 100 records.')
        .toInt(),
    query('cursor')
        .optional()
        .isMongoId()
        .withMessage('cursor must be a valid identifier.'),
    query('invoiceNumber')
        .optional()
        .isString()
        .withMessage('invoiceNumber must be a string.')
        .trim()
        .isLength({ min: 1, max: 64 })
        .withMessage('invoiceNumber must be between 1 and 64 characters long.'),
    query('status')
        .optional()
        .isIn(allowedInvoiceStatuses)
        .withMessage(`status must be one of: ${allowedInvoiceStatuses.join(', ')}.`),
    query('userId')
        .optional()
        .isMongoId()
        .withMessage('userId must be a valid identifier.'),
    query('userEmail')
        .optional()
        .isEmail()
        .withMessage('userEmail must be a valid email address.')
        .normalizeEmail(),
    query('planId')
        .optional()
        .isMongoId()
        .withMessage('planId must be a valid identifier.'),
    query('planSlug')
        .optional()
        .isString()
        .withMessage('planSlug must be a string.')
        .trim()
        .toLowerCase(),
    query('paymentStatus')
        .optional()
        .isIn(allowedPaymentStatuses)
        .withMessage(`paymentStatus must be one of: ${allowedPaymentStatuses.join(', ')}.`),
    query('paymentGateway')
        .optional()
        .isString()
        .withMessage('paymentGateway must be a string.')
        .trim()
        .isLength({ min: 2, max: 64 })
        .withMessage('paymentGateway must be between 2 and 64 characters long.')
        .toLowerCase(),
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('startDate must be a valid ISO 8601 date.')
        .toDate(),
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('endDate must be a valid ISO 8601 date.')
        .toDate(),
];

const getInvoiceByNumberValidationRules = () => [
    param('invoiceNumber')
        .exists({ checkFalsy: true })
        .withMessage('invoiceNumber parameter is required.')
        .isString()
        .withMessage('invoiceNumber must be a string.')
        .trim()
        .isLength({ min: 1, max: 64 })
        .withMessage('invoiceNumber must be between 1 and 64 characters long.'),
];

const invoiceSummaryValidationRules = () => [
    ...listInvoicesValidationRules(),
    query('byUserLimit')
        .optional()
        .isInt({ min: 1, max: MAX_USER_BUCKET_LIMIT })
        .withMessage(`byUserLimit must be between 1 and ${MAX_USER_BUCKET_LIMIT} records.`)
        .toInt(),
    query('byUserCursor')
        .optional()
        .isBase64()
        .withMessage('byUserCursor must be a valid cursor string.')
        .custom((value) => {
            if (!isValidByUserCursor(value)) {
                throw new Error('byUserCursor is malformed.');
            }

            return true;
        }),
];

module.exports = {
    listInvoicesValidationRules,
    getInvoiceByNumberValidationRules,
    invoiceSummaryValidationRules,
};
