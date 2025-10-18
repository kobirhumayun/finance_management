const { query, param } = require('express-validator');

const allowedOrderStatuses = ['active', 'inactive', 'cancelled', 'expired'];
const allowedPaymentStatuses = [
    'pending',
    'succeeded',
    'failed',
    'refunded',
    'partially_refunded',
    'requires_action',
    'canceled',
];

const allowedPaymentPurposes = [
    'subscription_initial',
    'subscription_renewal',
    'plan_upgrade',
    'plan_downgrade',
    'one_time_purchase',
    'service_fee',
    'manual_payment',
    'refund',
    'top_up',
];

const listOrdersValidationRules = () => [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('limit must be between 1 and 100 records.')
        .toInt(),
    query('cursor')
        .optional()
        .isMongoId()
        .withMessage('cursor must be a valid identifier.'),
    query('orderNumber')
        .optional()
        .isString()
        .withMessage('orderNumber must be a string.')
        .trim()
        .isLength({ min: 1, max: 64 })
        .withMessage('orderNumber must be between 1 and 64 characters long.'),
    query('status')
        .optional()
        .isIn(allowedOrderStatuses)
        .withMessage(`status must be one of: ${allowedOrderStatuses.join(', ')}.`),
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
    query('invoiceNumber')
        .optional()
        .isString()
        .withMessage('invoiceNumber must be a string.')
        .trim()
        .isLength({ min: 1, max: 64 })
        .withMessage('invoiceNumber must be between 1 and 64 characters long.'),
];

const getOrderByNumberValidationRules = () => [
    param('orderNumber')
        .exists({ checkFalsy: true })
        .withMessage('orderNumber parameter is required.')
        .isString()
        .withMessage('orderNumber must be a string.')
        .trim()
        .isLength({ min: 1, max: 64 })
        .withMessage('orderNumber must be between 1 and 64 characters long.'),
];

const orderSummaryValidationRules = () => listOrdersValidationRules();

const paymentSummaryValidationRules = () => [
    query('status')
        .optional()
        .isIn(allowedPaymentStatuses)
        .withMessage(`status must be one of: ${allowedPaymentStatuses.join(', ')}.`),
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
    query('paymentGateway')
        .optional()
        .isString()
        .withMessage('paymentGateway must be a string.')
        .trim()
        .isLength({ min: 2, max: 64 })
        .withMessage('paymentGateway must be between 2 and 64 characters long.')
        .toLowerCase(),
    query('purpose')
        .optional()
        .isIn(allowedPaymentPurposes)
        .withMessage(`purpose must be one of: ${allowedPaymentPurposes.join(', ')}.`),
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

module.exports = {
    listOrdersValidationRules,
    getOrderByNumberValidationRules,
    orderSummaryValidationRules,
    paymentSummaryValidationRules,
};

