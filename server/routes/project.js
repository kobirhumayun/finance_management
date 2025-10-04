const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/authMiddleware');
const {
    projectCreateValidationRules,
    projectUpdateValidationRules,
    projectIdParamValidationRules,
    projectListQueryValidationRules,
    transactionCreateValidationRules,
    transactionUpdateValidationRules,
    transactionIdParamValidationRules,
    transactionListValidationRules,
    handleValidationErrors,
} = require('../validators/validatorsIndex');

router.use(authenticate);

router.get(
    '/',
    projectListQueryValidationRules(),
    handleValidationErrors,
    projectController.getProjects,
);

router.get(
    '/:projectId',
    projectIdParamValidationRules(),
    handleValidationErrors,
    projectController.getProjectById,
);

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
    projectIdParamValidationRules(),
    handleValidationErrors,
    projectController.deleteProject,
);

router.get(
    '/:projectId/transactions',
    transactionListValidationRules(),
    handleValidationErrors,
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
    transactionIdParamValidationRules(),
    handleValidationErrors,
    projectController.deleteTransaction,
);

module.exports = router;
