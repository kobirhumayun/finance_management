const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/authMiddleware');
const {
    summaryListValidationRules,
    handleValidationErrors,
} = require('../validators/validatorsIndex');

router.use(authenticate);

router.get(
    '/summary',
    summaryListValidationRules(),
    handleValidationErrors,
    reportController.getSummary,
);

router.get('/summary/filters', reportController.getSummaryFilters);

module.exports = router;
