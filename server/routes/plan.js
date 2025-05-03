const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/casbinAuthorize');

// Optional: Add input validation middleware (e.g., express-validator)
// Optional: Add rate limiting middleware

// Add plan route
router.post('/plan', authenticate, authorize("admin"), planController.addPlan);

// Delete plan route
router.delete('/plan', authenticate, authorize("admin"), planController.deletePlan);

// Update plan route
router.put('/plan', authenticate, authorize("admin"), planController.updatePlan);

// Get subscription details route
router.get('/my-plan', authenticate, planController.getSubscriptionDetails);

// Change plan route
router.post('/change-plan', authenticate, authorize("admin"), planController.changePlan);

// Get all plans route
router.get('/all-plans', planController.getAllPlans);

// Create payment record route
router.post('/payment', authenticate, planController.createPaymentRecord);

// Get payments by status route
router.get('/payment', authenticate, authorize("admin"), planController.getPaymentsByStatus);

// Export the router

module.exports = router;
