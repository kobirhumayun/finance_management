const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const adminUserController = require('../controllers/adminUserController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/casbinAuthorize');
const { handleValidationErrors } = require('../validators/validatorsIndex');

const {
    ACCOUNT_STATUS_CODES,
    SUBSCRIPTION_STATUS_CODES,
    USER_ROLE_OPTIONS,
} = adminUserController;

const statusValidator = body('status').optional().isIn(ACCOUNT_STATUS_CODES);

const updateUserValidators = [
    body('username').optional().isString().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('firstName').optional({ nullable: true }).isString().trim().notEmpty(),
    body('lastName').optional({ nullable: true }).isString().trim().notEmpty(),
    body('profilePictureUrl').optional({ nullable: true }).isString().trim().isURL(),
    body('planId').optional().isString().trim().notEmpty(),
    body('subscriptionStatus').optional().isIn(SUBSCRIPTION_STATUS_CODES),
    body('subscriptionStartDate').optional({ nullable: true }).isISO8601().toDate(),
    body('subscriptionEndDate').optional({ nullable: true }).isISO8601().toDate(),
    body('trialEndsAt').optional({ nullable: true }).isISO8601().toDate(),
    body('role').optional().isIn(USER_ROLE_OPTIONS),
    body('isActive').optional().isBoolean().toBoolean(),
];

router.get(
    '/',
    authenticate,
    authorize('admin'),
    [
        query('status').optional().isIn(ACCOUNT_STATUS_CODES),
        query('page').optional().isInt({ min: 1 }),
        query('pageSize').optional().isInt({ min: 1, max: 100 }),
        query('recent').optional().toLowerCase().isIn(['asc', 'desc']),
    ],
    handleValidationErrors,
    adminUserController.listUsers,
);

router.get(
    '/:userId',
    authenticate,
    authorize('admin'),
    adminUserController.getUserProfile,
);

router.post(
    '/',
    [
        body('username').isString().trim().notEmpty(),
        body('email').isEmail().normalizeEmail(),
        body('password').optional().isString().isLength({ min: 6 }),
        body('planId').optional().isString().trim(),
        statusValidator,
    ],
    handleValidationErrors,
    authenticate,
    authorize('admin'),
    adminUserController.createUser,
);

router.patch(
    '/:userId',
    updateUserValidators,
    handleValidationErrors,
    authenticate,
    authorize('admin'),
    adminUserController.updateUser,
);

router.patch(
    '/:userId/status',
    [
        body('status').exists().isIn(ACCOUNT_STATUS_CODES),
    ],
    handleValidationErrors,
    authenticate,
    authorize('admin'),
    adminUserController.updateUserStatus,
);

router.post(
    '/:userId/reset-password',
    [
        body('redirectUri').optional().isURL(),
    ],
    handleValidationErrors,
    authenticate,
    authorize('admin'),
    adminUserController.triggerPasswordReset,
);

module.exports = router;
