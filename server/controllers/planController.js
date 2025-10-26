const User = require('../models/User');
const Plan = require('../models/Plan');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
let { createOrderWithPayment } = require('../utils/order');
const defaultCreateOrderWithPayment = createOrderWithPayment;

/**
 * @desc   Add a new subscription plan (Admin only)
 * @route  POST /api/plans
 * @access Private/Admin
 * @body   { name, slug, description?, price, billingCycle, currency?, features?, limits?, isPublic?, displayOrder?, stripePriceId? }
 */
const addPlan = async (req, res) => {
    // Destructure expected fields from request body
    const {
        name,
        slug,
        description,
        price,
        billingCycle,
        features, // Optional, defaults in schema
        // currency, // Optional, defaults in schema
        // limits,   // Optional, defaults in schema
        isPublic, // Optional, defaults in schema
        // displayOrder, // Optional, defaults in schema
        // stripePriceId // Optional
    } = req.body;

    // Basic validation for required fields (Schema also validates, but good for early exit)
    if (!name || !slug || price === undefined || !billingCycle) {
        return res.status(400).json({ message: 'Please provide name, slug, price, and billingCycle for the plan.' });
    }

    try {
        // Check if a plan with the same name or slug already exists
        // Mongoose unique index handles this, but pre-checking gives specific errors
        const existingPlan = await Plan.findOne({ $or: [{ name }, { slug }] });
        if (existingPlan) {
            let conflictField = existingPlan.name === name ? 'name' : 'slug';
            return res.status(409).json({ message: `A plan with this ${conflictField} already exists.` });
        }

        // Create new plan instance
        const newPlan = new Plan({
            name,
            slug: slug.toLowerCase().trim(), // Ensure slug is lowercase and trimmed
            description,
            price,
            billingCycle,
            features, // Let schema default handle if undefined
            // currency, // Let schema default handle if undefined
            // limits,   // Let schema default handle if undefined
            isPublic, // Let schema default handle if undefined
            // displayOrder, // Let schema default handle if undefined
            // stripePriceId
        });

        // Save the new plan to the database
        const savedPlan = await newPlan.save();

        res.status(201).json({ // 201 Created status
            message: 'Plan created successfully.',
            plan: savedPlan
        });

    } catch (error) {
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            // Extract specific validation messages
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Validation failed', errors: messages });
        }
        // Handle duplicate key error (if pre-check somehow missed it or during race condition)
        if (error.code === 11000) {
            // Determine which field caused the duplicate error
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({ message: `A plan with this ${field} already exists.` });
        }

        // Generic server error
        console.error('Error adding plan:', error);
        res.status(500).json({ message: 'Server error while creating plan.' });
    }
};

/**
 * @desc   Update a subscription plan identified by its slug in the request body (Admin only)
 * @route  PUT /api/plans  <-- Route no longer needs :slug param
 * @access Private/Admin
 * @body   { targetSlug: string, name?, slug?, description?, price?, billingCycle?, currency?, features?, limits?, isPublic?, displayOrder?, stripePriceId? } - targetSlug identifies the plan, other fields are updates.
 */
const updatePlan = async (req, res) => {
    // Get the slug of the plan to update AND the update data from the request body
    const { targetSlug, ...updateData } = req.body;

    // Basic validation: Check if targetSlug is provided in the body
    if (!targetSlug) {
        return res.status(400).json({ message: 'targetSlug is required in the request body to identify the plan.' });
    }

    // Check if there's any actual update data provided (besides targetSlug)
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No update data provided (besides targetSlug).' });
    }

    // Sanitize the potential new slug if provided in updateData
    if (updateData.slug) {
        updateData.slug = updateData.slug.toLowerCase().trim();
    }

    try {
        // Find the plan by its target slug first to ensure it exists
        const planToUpdate = await Plan.findOne({ slug: targetSlug.toLowerCase().trim() });

        if (!planToUpdate) {
            return res.status(404).json({ message: `Plan with slug '${targetSlug}' not found.` });
        }

        // --- Conflict Check (if name or new slug is being updated) ---
        // Check if the new name or new slug conflicts with another existing plan
        const conflictQuery = [];
        if (updateData.name && updateData.name !== planToUpdate.name) {
            conflictQuery.push({ name: updateData.name });
        }
        // Check if a *new* slug is provided and it's different from the *original* slug
        if (updateData.slug && updateData.slug !== planToUpdate.slug) {
            conflictQuery.push({ slug: updateData.slug });
        }

        if (conflictQuery.length > 0) {
            const conflictingPlan = await Plan.findOne({
                _id: { $ne: planToUpdate._id }, // Exclude the current plan itself
                $or: conflictQuery
            });

            if (conflictingPlan) {
                let conflictField = (conflictingPlan.name === updateData.name) ? 'name' : 'slug';
                return res.status(409).json({ message: `Another plan with the proposed ${conflictField} already exists.` });
            }
        }
        // --- End Conflict Check ---

        // Find the plan by the original target slug and update it with the new data
        // { new: true } returns the updated document
        // { runValidators: true } ensures schema validations run on the update
        const updatedPlan = await Plan.findOneAndUpdate(
            { slug: targetSlug.toLowerCase().trim() }, // Find by original target slug from body
            { $set: updateData }, // Apply the updates
            { new: true, runValidators: true, context: 'query' } // Options
        );

        // Although checked existence earlier, findOneAndUpdate could potentially fail
        // (e.g., race condition where it was deleted between the findOne and findOneAndUpdate).
        // It returns null if no document was found *to update*.
        if (!updatedPlan) {
            // This case is less likely given the initial check, but good for robustness
            return res.status(404).json({ message: `Plan with slug '${targetSlug}' not found during update attempt.` });
        }

        res.status(200).json({
            message: 'Plan updated successfully.',
            plan: updatedPlan
        });

    } catch (error) {
        // Handle Mongoose validation errors during update
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Validation failed during update', errors: messages });
        }
        // Handle duplicate key error during update (if conflict check somehow missed it or race condition)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({ message: `Update failed: A plan with this ${field} already exists.` });
        }

        // Generic server error
        console.error(`Error updating plan identified by slug '${targetSlug}':`, error);
        res.status(500).json({ message: 'Server error while updating plan.' });
    }
};

/**
 * @desc   Get all available subscription plans
 * @route  GET /api/all-plans
 * @access Public or Private (depending on filtering logic, if added)
 * @query  (Optional query params for filtering/sorting could be added later)
 */
// Controller factory: pass an optional planFilter when wiring up the route
// Usage:
//   router.get('/plans', getPlans()); // no filter
//   router.get('/plans/public', getPlans({ isPublic: true })); // filter by isPublic

const getPlans = (planFilter = {}) => async (req, res) => {
  try {
    const shouldFilterPublic = planFilter?.isPublic === true;
    const query = shouldFilterPublic ? { isPublic: true } : {};

    const plans = await Plan.find(query)
      .sort({ price: 1 })
      .select('-__v'); // Exclude the version key

    res.status(200).json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ message: 'Server error while fetching plans.' });
  }
};


/**
 * @desc   Delete a subscription plan by its slug (Admin only)
 * @route  DELETE /api/plans
 * @access Private/Admin
 * @param  {string} slug - The unique slug of the plan to delete
 */
const deletePlan = async (req, res) => {
    // Get the plan slug from the route parameters
    const { slug } = req.body;

    // Basic validation: Check if slug is provided
    if (!slug) {
        // Although the route matching usually handles this, it's good practice
        return res.status(400).json({ message: 'Plan slug is required.' });
    }

    try {
        // Find the plan by its unique slug and delete it
        // findOneAndDelete returns the deleted document or null if not found
        // Ensure the slug is matched case-insensitively
        // Assuming slugs are stored lowercase and trimmed (as done in addPlan)
        const deletedPlan = await Plan.findOneAndDelete({ slug: slug.toLowerCase().trim() });

        // Check if a plan was actually found and deleted
        if (!deletedPlan) {
            return res.status(404).json({ message: `Plan with slug '${slug}' not found.` });
        }

        // Respond with success message
        res.status(200).json({
            message: 'Plan deleted successfully.',
            deletedSlug: slug // Return the slug that was used for deletion
        });

    } catch (error) {
        // Log the error for server-side debugging
        console.error(`Error deleting plan with slug '${slug}':`, error);

        // Generic server error response
        res.status(500).json({ message: 'Server error while deleting plan.' });
    }
};

// Helper function to calculate next billing date (simplified)
const calculateNextBillingDate = (startingDate, billingCycle) => {
    const now = new Date(startingDate);
    if (billingCycle === 'monthly') {
        now.setMonth(now.getMonth() + 1);
    } else if (billingCycle === 'annually') {
        now.setFullYear(now.getFullYear() + 1);
    } else {
        // For 'free', 'lifetime', or unknown cycles, set no specific end date
        return null;
    }
    return now;
};

/**
 * @desc   Change the user's current subscription plan
 * @route  POST /api/users/change-plan (Example route, adjust as needed)
 * @access Private
 * @body   { newPlanId: string, paymentId: string }
 * @notes  The authenticated user is derived from req.user.
 */
const activatedPlan = async (req, res) => {
    const { newPlanId, paymentId, appliedUserId } = req.body;
    const requestUserId = req.user?._id;
    const requestUserRole = req.user?.role;
    const isAdmin = requestUserRole === 'admin';

    if (!requestUserId) {
        return res.status(401).json({ message: 'Authentication error: User not identified.' });
    }

    if (!mongoose.Types.ObjectId.isValid(newPlanId)) {
        return res.status(400).json({ message: 'Invalid Plan ID format.' });
    }

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
        return res.status(400).json({ message: 'Invalid Payment ID format.' });
    }

    if (isAdmin) {
        if (!appliedUserId) {
            return res.status(400).json({ message: 'appliedUserId is required for admin approvals.' });
        }

        if (!mongoose.Types.ObjectId.isValid(appliedUserId)) {
            return res.status(400).json({ message: 'Invalid appliedUserId format.' });
        }
    }

    try {
        const payment = await Payment.findById(paymentId);

        if (!payment) {
            return res.status(404).json({ message: `Payment record with ID '${paymentId}' not found.` });
        }

        if (!payment.userId) {
            console.warn('[planController] Payment is missing an associated user.', { paymentId });
            return res.status(404).json({ message: 'Payment is missing associated user information.' });
        }

        const targetUserId = isAdmin && appliedUserId
            ? appliedUserId
            : requestUserId;

        if (!targetUserId) {
            return res.status(401).json({ message: 'Authentication error: User not identified.' });
        }

        if (!isAdmin && appliedUserId && appliedUserId.toString?.() !== requestUserId.toString()) {
            console.warn('[planController] Non-admin attempted to approve another user.', {
                paymentId,
                requestUserId: requestUserId.toString(),
                appliedUserId: appliedUserId.toString?.(),
            });
            return res.status(403).json({ message: 'This payment is not eligible for this user.' });
        }

        if (payment.userId.toString() !== targetUserId.toString()) {
            console.warn('[planController] Unauthorized payment activation attempt.', {
                paymentId,
                requestUserId: requestUserId.toString(),
                targetUserId: targetUserId.toString(),
                paymentUserId: payment.userId.toString(),
            });
            return res.status(403).json({ message: 'This payment is not eligible for this user.' });
        }

        const [user, newPlan] = await Promise.all([
            User.findById(targetUserId),
            Plan.findById(newPlanId),
        ]);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!newPlan) {
            return res.status(404).json({ message: `Plan with ID '${newPlanId}' not found.` });
        }

        if (!payment.order) {
            return res.status(400).json({ message: 'No order is associated with this payment.' });
        }

        const order = await Order.findById(payment.order);

        if (!order) {
            return res.status(404).json({ message: 'Associated order not found.' });
        }

        if (payment.invoiceId) {
            return res.status(409).json({ message: 'This payment has already been finalized.' });
        }

        if (user._id.toString() !== payment.userId.toString()) {
            return res.status(403).json({ message: 'This payment is not eligible for this user.' });
        }

        let paymentAmount = typeof payment.amount === 'number'
            ? payment.amount
            : parseFloat(payment.amount?.toString?.() || '0');

        if (!Number.isFinite(paymentAmount)) {
            paymentAmount = newPlan.price;
        }

        if (newPlan.price !== 0 && Math.abs(paymentAmount - newPlan.price) > 0.0001) {
            return res.status(403).json({
                message: `This payment amount ${paymentAmount} does not match the plan price ${newPlan.price}.`,
            });
        }

        const currentPlanIdString = user.planId?.toString();
        if (!newPlan.isPublic && currentPlanIdString !== newPlanId) {
            return res.status(403).json({ message: 'This plan is not publicly available.' });
        }

        const isRenewalOfSamePlan =
            currentPlanIdString === newPlanId && user.subscriptionStatus === 'active';
        const subscriptionStartDate = isRenewalOfSamePlan && user.subscriptionEndDate
            ? user.subscriptionEndDate
            : new Date();
        const calculatedEndDate = calculateNextBillingDate(subscriptionStartDate, newPlan.billingCycle);
        const subscriptionEndDate = calculatedEndDate ?? null;

        user.planId = newPlan._id;
        user.subscriptionStatus = newPlan.price === 0 ? 'free' : 'active';
        user.subscriptionStartDate = subscriptionStartDate;
        user.subscriptionEndDate = calculatedEndDate;
        user.trialEndsAt = null;

        const invoice = new Invoice({
            user: user._id,
            payment: payment._id,
            plan: newPlan._id,
            amount: paymentAmount,
            currency: payment.currency,
            status: 'paid',
            subscriptionStartDate,
            subscriptionEndDate,
        });

        order.status = 'active';
        order.startDate = subscriptionStartDate;
        order.endDate = calculatedEndDate;
        order.renewalDate = calculatedEndDate;
        order.amount = paymentAmount;
        order.currency = payment.currency;
        order.invoice = invoice._id;

        payment.status = 'succeeded';
        payment.planId = newPlan._id;
        payment.processedAt = payment.processedAt || new Date();

        const savedInvoice = await invoice.save();

        order.invoice = savedInvoice._id;
        payment.invoiceId = savedInvoice._id;

        await Promise.all([
            user.save(),
            order.save(),
            payment.save(),
        ]);

        res.status(200).json({
            message: 'Subscription plan activated successfully.',
            subscription: {
                plan: {
                    _id: newPlan._id,
                    name: newPlan.name,
                    slug: newPlan.slug,
                    price: newPlan.price,
                    billingCycle: newPlan.billingCycle,
                },
                status: user.subscriptionStatus,
                startDate: user.subscriptionStartDate,
                endDate: user.subscriptionEndDate,
            },
            order: {
                id: order._id,
                orderNumber: order.orderID,
                status: order.status,
                startDate: order.startDate,
                endDate: order.endDate,
                invoice: order.invoice,
            },
            payment: {
                id: payment._id,
                status: payment.status,
                invoiceId: payment.invoiceId ? payment.invoiceId.toString() : null,
            },
            invoice: {
                id: savedInvoice._id,
                invoiceNumber: savedInvoice.invoiceNumber,
                status: savedInvoice.status,
                amount: savedInvoice.amount,
                currency: savedInvoice.currency,
                issuedDate: savedInvoice.issuedDate,
                dueDate: savedInvoice.dueDate,
            },
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: 'Validation failed during update', errors: messages });
        }
        console.error('Error activating plan:', error);
        res.status(500).json({ message: 'Server error while changing subscription plan.' });
    }
};

/**
 * @desc   Get current user's subscription details
 * @route  GET /api/subscriptions/my-details
 * @access Private
 */
const getSubscriptionDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('planId'); // Populate plan details

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            plan: user.planId,
            status: user.subscriptionStatus,
            startDate: user.subscriptionStartDate,
            endDate: user.subscriptionEndDate,
            trialEndsAt: user.trialEndsAt,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};


/**
 * Express middleware to process payments based on the method specified in the request body.
 *
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
const normalizeToNumber = (value) => {
    if (value == null) {
        return NaN;
    }

    if (typeof value === 'number') {
        return value;
    }

    if (mongoose.Types.Decimal128 && value instanceof mongoose.Types.Decimal128) {
        return Number(value.toString());
    }

    if (typeof value === 'string') {
        return Number(value);
    }

    const valueOf = typeof value.valueOf === 'function' ? value.valueOf() : value;

    if (typeof valueOf === 'number') {
        return valueOf;
    }

    if (typeof valueOf === 'string') {
        return Number(valueOf);
    }

    if (typeof value.toString === 'function') {
        return Number(value.toString());
    }

    return NaN;
};

const amountsAreEqual = (a, b) => {
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= tolerance;
};

const manualPaymentSubmit = async (req, res) => {
    const {
        amount,
        currency,
        paymentGateway,
        gatewayTransactionId,
        paymentId
    } = req.body;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
    }

    if (!req.user || !payment.userId || payment.userId.toString() !== req.user._id?.toString()) {
        return res.status(403).json({ message: 'You are not allowed to update this payment.' });
    }

    if (payment.status && payment.status !== 'pending') {
        return res.status(409).json({ message: 'Payment cannot be updated in its current status.' });
    }

    const storedAmount = normalizeToNumber(payment.amount);
    const requestedAmount = normalizeToNumber(amount);

    if (!Number.isFinite(requestedAmount)) {
        return res.status(400).json({ message: 'Invalid payment amount' });
    }

    if (!Number.isFinite(storedAmount) || !amountsAreEqual(storedAmount, requestedAmount)) {
        return res.status(400).json({ message: 'Invalid payment amount' });
    }
    if (payment.currency !== currency) {
        return res.status(400).json({ message: 'Invalid payment currency' });
    }

    payment.paymentGateway = paymentGateway;
    payment.gatewayTransactionId = gatewayTransactionId;
    await payment.save();

    res.status(201).json({
        message: 'Wait for confirmation from admin',
        payment: payment,
    });
};


/**
 * @desc   Get payment records based on status
 * @route  GET /api/payments?status=<status_value>&page=<page_number>&limit=<limit_value>
 * @access Private (Adjust access control as needed, e.g., Admin only)
 * @query  status (optional), userId (optional), planId (optional), order (optional), gatewayTransactionId (optional), page (optional, default 1), limit (optional, default 10)
 */
const getPaymentsByStatus = async (req, res) => {
    const { status, userId, planId, order, gatewayTransactionId } = req.query;
    const page = parseInt(req.query.page, 10) || 1; // Default to page 1
    const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page
    const skip = (page - 1) * limit;

    const filters = {};

    // --- Validate Status ---
    if (status) {
        // Get allowed enum values from the schema
        const allowedStatuses = Payment.schema.path('status').enumValues;
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: `Invalid status value. Allowed values are: ${allowedStatuses.join(', ')}`
            });
        }

        filters.status = status;
    }

    if (userId) {
        filters.userId = userId;
    }

    if (planId) {
        filters.planId = planId;
    }

    if (order) {
        filters.order = order;
    }

    if (gatewayTransactionId) {
        filters.gatewayTransactionId = gatewayTransactionId;
    }

    // --- Query Database ---
    try {
        // Find payments matching the status with pagination
        const payments = await Payment.find(filters)
            .sort({ createdAt: -1 }) // Sort by creation date, newest first (optional)
            .skip(skip)
            .limit(limit)
            .populate('userId', 'email username firstName lastName') // Example: Populate user email/name
            .populate('planId', 'name slug') // Example: Populate plan name/slug
            .exec(); // Execute the query

        // Get total count for pagination metadata
        const totalPayments = await Payment.countDocuments(filters);

        // --- Send Response ---
        res.status(200).json({
            message: status ? `Successfully retrieved payments with status: ${status}` : 'Successfully retrieved payments',
            data: payments,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPayments / limit),
                totalItems: totalPayments,
                itemsPerPage: limit
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching payments.' });
    }
};

const processManualPayment = async (req, res, order, payment) => {
    res.status(201).json({
        message: 'Order created successfully',
        status: 'To confirm order pay manually',
        orderId: order.orderID,
        paymentId: payment._id
    });

}

const processSslcommerzPayment = async (req, res, order, payment) => {
    res.status(201).json({
        message: 'Order created successfully',
        status: 'payment processing by sslcommerz',
        orderId: order.orderID,
        paymentId: payment._id
    });
}

const processPayPalPayment = async (req, res, order, payment) => {
    res.status(201).json({
        message: 'Order created successfully',
        status: 'payment processing by paypal',
        orderId: order.orderID,
        paymentId: payment._id
    });
}

const processStripePayment = async (req, res, order, payment) => {
    res.status(201).json({
        message: 'Order created successfully',
        status: 'payment processing by stripe',
        orderId: order.orderID,
        paymentId: payment._id
    });
}

// A mapping of payment method names to their functions
const paymentMethods = {
    'manual': processManualPayment,
    'sslcommerz': processSslcommerzPayment,
    'paypal': processPayPalPayment,
    'stripe': processStripePayment,
};

const placeOrder = async (req, res) => {
    try {
        const {
            amount,
            currency,
            paymentGateway,
            paymentMethodDetails,
            purpose,
            planId
        } = req.body;

        const userId = req.user._id

        // --- Basic Input Validation (Optional but Recommended) ---
        if (!userId || amount == null || !currency || !paymentGateway || !paymentMethodDetails || !purpose || !planId) {
            return res.status(400).json({ message: 'Missing required order fields.' });
        }

        // Validate ObjectIds if provided
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID format.' });
        }
        if (planId && !mongoose.Types.ObjectId.isValid(planId)) {
            return res.status(400).json({ message: 'Invalid Plan ID format.' });
        }

        const normalizedAmount = typeof amount === 'number' ? amount : Number(amount);
        if (Number.isNaN(normalizedAmount)) {
            return res.status(400).json({ message: 'Invalid amount. Please provide a numeric value.' });
        }

        const plan = await Plan.findById(planId);

        if (!plan) {
            return res.status(404).json({ message: `Plan with ID '${planId}' not found.` });
        }

        const planPrice = typeof plan.price === 'number' ? plan.price : Number(plan.price);
        if (Number.isNaN(planPrice)) {
            return res.status(500).json({ message: 'Invalid plan price configured for this plan.' });
        }

        if (planPrice !== normalizedAmount) {
            return res.status(400).json({ message: `Plan price ${planPrice} does not match the order amount ${normalizedAmount}.` });
        }

        // --- Create and Save Order Document ---
        const orderData = {
            user: userId,
            plan: planId,
            amount: planPrice,
            currency: currency.toUpperCase(),
        };

        const paymentData = {
            userId: userId,
            planId: planId,
            amount: planPrice,
            currency: currency.toUpperCase(),
            paymentGateway: paymentGateway.toLowerCase(),
            purpose,
            paymentMethodDetails,
            processedAt: new Date(),
        };

        const { order, payment } = await createOrderWithPayment(orderData, paymentData);

        const paymentFunction = paymentMethods[paymentMethodDetails];

        if (!paymentFunction) {
            return res.status(400).json({ error: `Unsupported payment method: ${paymentMethodDetails}` });
        }

        paymentFunction(req, res, order, payment)

    } catch (error) {
        // The error thrown from the service will be caught here.
        res.status(500).json({ message: error.message || 'An internal server error occurred.' });
    }
}


const setCreateOrderWithPayment = (fn) => {
    createOrderWithPayment = fn;
};

const resetCreateOrderWithPayment = () => {
    createOrderWithPayment = defaultCreateOrderWithPayment;
};


module.exports = {
    addPlan,
    updatePlan,
    deletePlan,
    activatedPlan,
    getSubscriptionDetails,
    getPlans,
    getPaymentsByStatus,
    manualPaymentSubmit,
    placeOrder,
    __test__: {
        setCreateOrderWithPayment,
        resetCreateOrderWithPayment,
    },
};
