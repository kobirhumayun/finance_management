const { body, param } = require('express-validator');

const projectCreateValidationRules = () => [
    body('name')
        .exists({ checkFalsy: true }).withMessage('Project name is required.')
        .isString().withMessage('Project name must be a string.')
        .trim()
        .isLength({ min: 2, max: 120 }).withMessage('Project name must be between 2 and 120 characters.'),
    body('description')
        .optional()
        .isString().withMessage('Description must be a string.')
        .trim()
        .isLength({ min: 5, max: 1024 }).withMessage('Description must be between 5 and 1024 characters.'),
    body('currency')
        .optional()
        .isString().withMessage('Currency must be a string.')
        .trim()
        .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter ISO code.')
        .toUpperCase(),
];

const projectUpdateValidationRules = () => [
    param('projectId')
        .isMongoId().withMessage('Invalid project identifier.'),
    body('name')
        .optional()
        .isString().withMessage('Project name must be a string.')
        .trim()
        .isLength({ min: 2, max: 120 }).withMessage('Project name must be between 2 and 120 characters.'),
    body('description')
        .optional()
        .isString().withMessage('Description must be a string.')
        .trim()
        .isLength({ min: 5, max: 1024 }).withMessage('Description must be between 5 and 1024 characters.'),
    body('currency')
        .optional()
        .isString().withMessage('Currency must be a string.')
        .trim()
        .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter ISO code.')
        .toUpperCase(),
    body()
        .custom((value, { req }) => {
            const provided = Object.keys(req.body || {});
            if (provided.length === 0) {
                throw new Error('At least one field must be provided for update.');
            }
            return true;
        }),
];

const transactionCreateValidationRules = () => [
    param('projectId')
        .isMongoId().withMessage('Invalid project identifier.'),
    body('date')
        .exists({ checkFalsy: true }).withMessage('Transaction date is required.')
        .isISO8601().withMessage('Transaction date must be a valid ISO 8601 date.')
        .trim(),
    body('type')
        .exists({ checkFalsy: true }).withMessage('Transaction type is required.')
        .isIn(['income', 'expense']).withMessage('Transaction type must be either "income" or "expense".')
        .toLowerCase(),
    body('amount')
        .exists({ checkFalsy: true }).withMessage('Amount is required.')
        .isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.')
        .toFloat(),
    body('subcategory')
        .exists({ checkFalsy: true }).withMessage('Subcategory is required.')
        .isString().withMessage('Subcategory must be a string.')
        .trim()
        .isLength({ min: 2, max: 120 }).withMessage('Subcategory must be between 2 and 120 characters.'),
    body('description')
        .exists({ checkFalsy: true }).withMessage('Description is required.')
        .isString().withMessage('Description must be a string.')
        .trim()
        .isLength({ min: 3, max: 1024 }).withMessage('Description must be between 3 and 1024 characters.'),
];

const transactionUpdateValidationRules = () => [
    param('projectId')
        .isMongoId().withMessage('Invalid project identifier.'),
    param('transactionId')
        .isMongoId().withMessage('Invalid transaction identifier.'),
    body('date')
        .optional()
        .isISO8601().withMessage('Transaction date must be a valid ISO 8601 date.')
        .trim(),
    body('type')
        .optional()
        .isIn(['income', 'expense']).withMessage('Transaction type must be either "income" or "expense".')
        .toLowerCase(),
    body('amount')
        .optional()
        .isFloat({ gt: 0 }).withMessage('Amount must be greater than zero.')
        .toFloat(),
    body('subcategory')
        .optional()
        .isString().withMessage('Subcategory must be a string.')
        .trim()
        .isLength({ min: 2, max: 120 }).withMessage('Subcategory must be between 2 and 120 characters.'),
    body('description')
        .optional()
        .isString().withMessage('Description must be a string.')
        .trim()
        .isLength({ min: 3, max: 1024 }).withMessage('Description must be between 3 and 1024 characters.'),
    body()
        .custom((value, { req }) => {
            const provided = Object.keys(req.body || {});
            if (provided.length === 0) {
                throw new Error('At least one field must be provided for update.');
            }
            return true;
        }),
];

module.exports = {
    projectCreateValidationRules,
    projectUpdateValidationRules,
    transactionCreateValidationRules,
    transactionUpdateValidationRules,
};
