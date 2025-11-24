const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');
const { getTicketReport } = require('../controllers/ticketReportController');
const { authenticate } = require('../middleware/authMiddleware');
const {
    summaryListValidationRules,
    reportChartsValidationRules,
    handleValidationErrors,
} = require('../validators/validatorsIndex');

router.use(authenticate);

router.get('/filters', reportController.getReportFilters);

router.get(
    '/charts',
    reportChartsValidationRules(),
    handleValidationErrors,
    reportController.getCharts,
);

router.get(
    '/summary',
    summaryListValidationRules(),
    handleValidationErrors,
    reportController.getSummary,
);

router.get(
    '/summary.pdf',
    summaryListValidationRules(),
    handleValidationErrors,
    reportController.getSummaryPdf,
);

router.get(
    '/summary.xlsx',
    summaryListValidationRules(),
    handleValidationErrors,
    reportController.getSummaryXlsx,
);

router.get('/summary/filters', reportController.getSummaryFilters);

router.get('/tickets', getTicketReport);

module.exports = router;
