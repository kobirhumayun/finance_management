const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/casbinAuthorize');
const {
    listOrdersValidationRules,
    getOrderByNumberValidationRules,
    orderSummaryValidationRules,
    handleValidationErrors,
} = require('../validators/validatorsIndex');

router.use(authenticate);
router.use(authorize('orders'));

router.get(
    '/',
    listOrdersValidationRules(),
    handleValidationErrors,
    orderController.listOrders,
);

router.get(
    '/summary',
    orderSummaryValidationRules(),
    handleValidationErrors,
    orderController.getOrderSummary,
);

router.get(
    '/:orderNumber',
    getOrderByNumberValidationRules(),
    handleValidationErrors,
    orderController.getOrderByNumber,
);

module.exports = router;

