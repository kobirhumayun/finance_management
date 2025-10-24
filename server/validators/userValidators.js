const { body, query } = require('express-validator');

const allowedThemes = ['light', 'dark', 'system'];
const allowedOrderStatuses = ['active', 'inactive', 'cancelled', 'expired'];

const updateProfileValidationRules = () => [
    body('username')
        .optional()
        .isString().withMessage('username must be a string.')
        .trim()
        .isLength({ min: 3, max: 30 }).withMessage('username must be between 3 and 30 characters long.')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('username may contain letters, numbers, and underscores only.')
        .escape(),
    body('firstName')
        .optional({ nullable: true })
        .isString().withMessage('firstName must be a string.')
        .trim()
        .isLength({ max: 50 }).withMessage('firstName must be 50 characters or fewer.')
        .escape(),
    body('lastName')
        .optional({ nullable: true })
        .isString().withMessage('lastName must be a string.')
        .trim()
        .isLength({ max: 50 }).withMessage('lastName must be 50 characters or fewer.')
        .escape(),
    body('profilePictureUrl')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('profilePictureUrl must be a valid URL.'),
    body('displayName')
        .optional({ nullable: true })
        .isString().withMessage('displayName must be a string.')
        .trim()
        .isLength({ min: 1, max: 80 }).withMessage('displayName must be between 1 and 80 characters long.')
        .escape(),
];

const updateEmailValidationRules = () => [
    body('newEmail')
        .exists({ checkFalsy: true }).withMessage('newEmail is required.')
        .isEmail().withMessage('newEmail must be a valid email address.')
        .normalizeEmail(),
    body('currentPassword')
        .exists({ checkFalsy: true }).withMessage('currentPassword is required.')
        .isString().withMessage('currentPassword must be a string.')
        .isLength({ min: 8, max: 128 }).withMessage('currentPassword must be between 8 and 128 characters long.'),
];

const updatePasswordValidationRules = () => [
    body('currentPassword')
        .exists({ checkFalsy: true }).withMessage('currentPassword is required.')
        .isString().withMessage('currentPassword must be a string.')
        .isLength({ min: 8, max: 128 }).withMessage('currentPassword must be between 8 and 128 characters long.'),
    body('newPassword')
        .exists({ checkFalsy: true }).withMessage('newPassword is required.')
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
        })
        .withMessage('newPassword must contain at least 8 characters, including uppercase, lowercase, number, and symbol.'),
];

const deleteAccountValidationRules = () => [
    body('currentPassword')
        .exists({ checkFalsy: true }).withMessage('currentPassword is required.')
        .isString().withMessage('currentPassword must be a string.')
        .isLength({ min: 8, max: 128 }).withMessage('currentPassword must be between 8 and 128 characters long.'),
    body('reason')
        .optional({ nullable: true, checkFalsy: true })
        .isString().withMessage('reason must be a string.')
        .trim()
        .isLength({ max: 500 }).withMessage('reason must be 500 characters or fewer.')
        .escape(),
];

const updatePreferencesValidationRules = () => [
    body('theme')
        .optional({ nullable: true })
        .isIn(allowedThemes)
        .withMessage(`theme must be one of: ${allowedThemes.join(', ')}.`),
    body('notifications')
        .optional({ nullable: true })
        .custom((value) => {
            if (value === null) {
                return true;
            }

            if (typeof value !== 'object' || Array.isArray(value)) {
                throw new Error('notifications must be an object.');
            }

            return true;
        }),
    body('notifications.*')
        .optional({ nullable: true })
        .isBoolean().withMessage('Notification preferences must be boolean values.')
        .toBoolean(),
];

const listSelfOrdersValidationRules = () => [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('limit must be between 1 and 50 records.')
        .toInt(),
    query('cursor')
        .optional()
        .isMongoId()
        .withMessage('cursor must be a valid identifier.'),
    query('status')
        .optional()
        .isIn(allowedOrderStatuses)
        .withMessage(`status must be one of: ${allowedOrderStatuses.join(', ')}.`),
];

module.exports = {
    updateProfileValidationRules,
    updateEmailValidationRules,
    updatePasswordValidationRules,
    deleteAccountValidationRules,
    updatePreferencesValidationRules,
    listSelfOrdersValidationRules,
};
