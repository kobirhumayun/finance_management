const { query } = require('express-validator');

const summaryListValidationRules = () => [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100 records.')
        .toInt(),
    query('cursor')
        .optional()
        .isMongoId().withMessage('Cursor must be a valid identifier when provided.'),
    query('sort')
        .optional()
        .isIn(['newest', 'oldest']).withMessage('Sort must be either "newest" or "oldest".'),
    query('type')
        .optional()
        .isIn(['income', 'expense']).withMessage('Type filter must be either "income" or "expense".')
        .toLowerCase(),
    query('projectId')
        .optional()
        .isMongoId().withMessage('projectId must be a valid identifier when provided.'),
    query('search')
        .optional()
        .isString().withMessage('Search term must be a string.')
        .trim()
        .isLength({ max: 200 }).withMessage('Search term must be 200 characters or fewer.'),
    query('startDate')
        .optional()
        .isISO8601().withMessage('startDate must be a valid ISO 8601 date.')
        .trim(),
    query('endDate')
        .optional()
        .isISO8601().withMessage('endDate must be a valid ISO 8601 date.')
        .trim(),
    query('subcategory')
        .optional()
        .isString().withMessage('Subcategory filter must be a string.')
        .trim()
        .isLength({ max: 200 }).withMessage('Subcategory must be 200 characters or fewer.'),
];

const reportChartsValidationRules = () => [
    query('projectId')
        .optional()
        .isMongoId().withMessage('projectId must be a valid identifier when provided.'),
    query('type')
        .optional()
        .isIn(['income', 'expense']).withMessage('Type filter must be either "income" or "expense".')
        .toLowerCase(),
    query('startDate')
        .optional()
        .isISO8601().withMessage('startDate must be a valid ISO 8601 date.')
        .trim(),
    query('endDate')
        .optional()
        .isISO8601().withMessage('endDate must be a valid ISO 8601 date.')
        .trim(),
];

module.exports = {
    summaryListValidationRules,
    reportChartsValidationRules,
};
