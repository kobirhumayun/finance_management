const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/authMiddleware');
const {
    projectCreateValidationRules,
    projectUpdateValidationRules,
    transactionCreateValidationRules,
    transactionUpdateValidationRules,
    handleValidationErrors,
} = require('../validators/validatorsIndex');

router.use(authenticate);

router.get('/', projectController.getProjects);

router.post(
    '/',
    projectCreateValidationRules(),
    handleValidationErrors,
    projectController.createProject,
);

router.put(
    '/:projectId',
    projectUpdateValidationRules(),
    handleValidationErrors,
    projectController.updateProject,
);

router.delete(
    '/:projectId',
    projectController.deleteProject,
);

router.get(
    '/:projectId/transactions',
    projectController.getTransactions,
);

router.post(
    '/:projectId/transactions',
    transactionCreateValidationRules(),
    handleValidationErrors,
    projectController.createTransaction,
);

router.put(
    '/:projectId/transactions/:transactionId',
    transactionUpdateValidationRules(),
    handleValidationErrors,
    projectController.updateTransaction,
);

router.delete(
    '/:projectId/transactions/:transactionId',
    projectController.deleteTransaction,
);

module.exports = router;
