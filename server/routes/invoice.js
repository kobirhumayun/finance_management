const express = require('express');
const router = express.Router();

const invoiceController = require('../controllers/invoiceController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/casbinAuthorize');
const {
    listInvoicesValidationRules,
    getInvoiceByNumberValidationRules,
    invoiceSummaryValidationRules,
    handleValidationErrors,
} = require('../validators/validatorsIndex');

router.use(authenticate);
router.use(authorize('invoices'));

router.get(
    '/',
    listInvoicesValidationRules(),
    handleValidationErrors,
    invoiceController.listInvoices,
);

router.get(
    '/summary',
    invoiceSummaryValidationRules(),
    handleValidationErrors,
    invoiceController.getInvoiceSummary,
);

router.get(
    '/:invoiceNumber',
    getInvoiceByNumberValidationRules(),
    handleValidationErrors,
    invoiceController.getInvoiceByNumber,
);

module.exports = router;
