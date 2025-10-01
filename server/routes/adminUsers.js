const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const adminUserController = require('../controllers/adminUserController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/casbinAuthorize');
const { handleValidationErrors } = require('../validators/validatorsIndex');

const { ACCOUNT_STATUS_CODES } = adminUserController;

const statusValidator = body('status').optional().isIn(ACCOUNT_STATUS_CODES);

router.get(
    '/',
    authenticate,
    authorize('admin'),
    [
        query('status').optional().isIn(ACCOUNT_STATUS_CODES),
        query('page').optional().isInt({ min: 1 }),
        query('pageSize').optional().isInt({ min: 1, max: 100 }),
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
    [
        body('username').optional().isString().trim().notEmpty(),
        body('email').optional().isEmail().normalizeEmail(),
        body('planId').optional().isString().trim(),
        statusValidator,
    ],
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
