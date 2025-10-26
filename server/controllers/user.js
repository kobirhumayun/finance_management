const mongoose = require('mongoose');
const User = require('../models/User');
const UsedRefreshToken = require('../models/UsedRefreshToken');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');
const { isValidObjectId } = mongoose;

const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const MAX_SELF_ORDER_PAGE_SIZE = 50;
const DEFAULT_SELF_ORDER_PAGE_SIZE = 20;

const normalizeDecimal = (value) => {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? value : parsed;
    }

    if (typeof value === 'object' && typeof value.toString === 'function') {
        const parsed = parseFloat(value.toString());
        return Number.isNaN(parsed) ? value : parsed;
    }

    return value;
};

const buildProfileResponse = (userDoc) => {
    if (!userDoc) {
        return null;
    }

    const planDoc = userDoc.planId && typeof userDoc.planId === 'object' && userDoc.planId !== null
        ? {
            id: userDoc.planId._id,
            name: userDoc.planId.name,
            slug: userDoc.planId.slug,
            billingCycle: userDoc.planId.billingCycle,
            price: normalizeDecimal(userDoc.planId.price),
            currency: userDoc.planId.currency,
        }
        : null;

    const metadataDisplayName = userDoc.metadata && userDoc.metadata.displayName
        ? userDoc.metadata.displayName
        : null;

    const computedDisplayName = metadataDisplayName
        || [userDoc.firstName, userDoc.lastName].filter(Boolean).join(' ')
        || userDoc.username;

    return {
        id: userDoc._id,
        username: userDoc.username,
        email: userDoc.email,
        firstName: userDoc.firstName || '',
        lastName: userDoc.lastName || '',
        displayName: computedDisplayName,
        profilePictureUrl: userDoc.profilePictureUrl || '',
        subscription: {
            plan: planDoc,
            status: userDoc.subscriptionStatus,
            startDate: userDoc.subscriptionStartDate,
            endDate: userDoc.subscriptionEndDate,
            trialEndsAt: userDoc.trialEndsAt,
            manageSubscriptionUrl: '/pricing',
        },
        contact: {
            email: userDoc.email,
        },
        activityLinks: {
            orders: '/api/users/me/orders',
        },
        metadata: {
            isEmailVerified: userDoc.isEmailVerified,
            lastLoginAt: userDoc.lastLoginAt,
            createdAt: userDoc.createdAt,
        },
    };
};

const mapOrderForUser = (order, userSummary) => {
    const plan = order.plan
        ? {
            id: order.plan._id,
            name: order.plan.name,
            slug: order.plan.slug,
            billingCycle: order.plan.billingCycle,
            price: normalizeDecimal(order.plan.price),
            currency: order.plan.currency,
        }
        : null;

    const payment = order.payment
        ? {
            id: order.payment._id,
            status: order.payment.status,
            amount: normalizeDecimal(order.payment.amount),
            refundedAmount: normalizeDecimal(order.payment.refundedAmount),
            currency: order.payment.currency,
            paymentGateway: order.payment.paymentGateway,
            gatewayTransactionId: order.payment.gatewayTransactionId,
            purpose: order.payment.purpose,
            processedAt: order.payment.processedAt,
            createdAt: order.payment.createdAt,
            updatedAt: order.payment.updatedAt,
        }
        : null;

    const invoice = order.invoice
        ? {
            id: order.invoice._id,
            invoiceNumber: order.invoice.invoiceNumber,
            status: order.invoice.status,
            issuedDate: order.invoice.issuedDate,
            dueDate: order.invoice.dueDate,
            amount: normalizeDecimal(order.invoice.amount),
            currency: order.invoice.currency,
            subscriptionStartDate: order.invoice.subscriptionStartDate,
            subscriptionEndDate: order.invoice.subscriptionEndDate,
            createdAt: order.invoice.createdAt,
            updatedAt: order.invoice.updatedAt,
        }
        : null;

    const user = userSummary
        ? {
            id: userSummary.id,
            firstName: userSummary.firstName,
            lastName: userSummary.lastName,
            username: userSummary.username,
            email: userSummary.email,
        }
        : null;

    return {
        id: order._id,
        orderNumber: order.orderID,
        status: order.status,
        amount: normalizeDecimal(order.amount),
        currency: order.currency,
        startDate: order.startDate,
        endDate: order.endDate,
        renewalDate: order.renewalDate,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        user,
        plan,
        payment,
        invoice,
    };
};

/**
 * @description Registers a new user.
 * @route POST /api/users/register
 * @access Public
 */
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please provide username, email, and password.' });
        } //

        const existingUser = await User.findOne({ $or: [{ username }, { email }] }); //
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists.' });
        }

        // Create new user instance.
        const newUser = new User({
            username,
            email,
            password_hash: password // Assign plain password
        });

        await newUser.save(); // Pre-save hook will hash password

        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        // console.error('Error registering user:', error);
        if (error.code === 11000) { // Handle duplicate key error from MongoDB
            return res.status(400).json({ message: 'Username or email already exists.' });
        }
        res.status(500).json({ message: 'Error registering user.', error: error.message });
    }
};

/**
 * @description Logs in a user.
 * @route POST /api/users/login
 * @access Public
 */
const loginUser = async (req, res) => {
    try {
        const { identifier, password } = req.body; //

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Please provide username/email and password.' });
        } //

        const trimmedIdentifier = typeof identifier === 'string' ? identifier.trim() : identifier;
        const looksLikeEmail = typeof trimmedIdentifier === 'string' && trimmedIdentifier.includes('@');
        const normalizedEmail = looksLikeEmail ? trimmedIdentifier.toLowerCase() : trimmedIdentifier;

        // Find user by username or email
        // Select '+password_hash' as it's excluded by default but needed for isPasswordCorrect method.
        // Populate 'planId' as it's used by model methods for token generation/subscription checks.
        const user = await User.findOne({
            $or: [
                { username: trimmedIdentifier },
                { email: normalizedEmail }
            ]
        }).select('+password_hash +refreshToken').populate('planId'); //

        if (!user) {
            return res.status(404).json({ message: 'Invalid credentials.' }); //
        }

        if (user.isActive === false) {
            return res.status(403).json({ message: 'Account is inactive. Please contact support.' });
        }

        // Verify password using the instance method from User model
        const isMatch = await user.isPasswordCorrect(password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' }); //
        }

        // Passwords match, record the login timestamp before generating new tokens
        user.lastLoginAt = new Date();

        // Generate tokens using the instance method. This model method also handles
        // subscription checks and saving the refresh token alongside the last login time.
        const { accessToken, refreshToken } = await user.generateAccessAndRefereshTokens();

        res.status(200).json({
            message: 'Login successful.',
            accessToken,
            refreshToken,
            user: { // Send back non-sensitive user info
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                plan: user.planId && typeof user.planId === 'object' ? user.planId.slug : (user.subscriptionStatus === 'free' ? 'free' : null),
                subscriptionStatus: user.subscriptionStatus
            }
        });

    } catch (error) {
        // console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Error logging in user.', error: error.message });
    }
};

/**
 * @description Logs out a user by clearing the refresh token.
 * @route POST /api/users/logout
 * @access Private (Requires authentication)
 */
const logoutUser = async (req, res) => {
    const userId = req.user?._id; // From auth middleware
    const incomingRefreshToken = req.body?.refreshToken; //

    try {
        // Unset the refresh token in the database
        if (userId) { // If user authenticated
            await User.updateOne({ _id: userId }, { $unset: { refreshToken: "" } }); // logic using $unset
        } else if (incomingRefreshToken) { // Fallback, less secure, if user not identified by middleware but token exists
            await User.updateOne({ refreshToken: incomingRefreshToken }, { $unset: { refreshToken: "" } });
        }

        res.status(200).json({ message: 'User logged out successfully.' }); //

    } catch (error) {
        // console.error('Error logging out user:', error);
        res.status(500).json({ message: 'Error logging out user.', error: error.message });
    }
};

/**
 * @description Refreshes the access token using a valid refresh token.
 * @route POST /api/users/refresh-token
 * @access Public (but requires a valid refresh token cookie)
 */

const refreshAccessToken = async (req, res) => {
    const incomingRefreshToken = req.body?.refreshToken;

    if (!incomingRefreshToken) {
        return res.status(401).json({ message: 'Unauthorized: No refresh token provided.' });
    }

    try {
        // 1. Verify the JWT signature and decode the payload
        const decoded = jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET);

        // 2. Find the user associated with the token
        const user = await User.findById(decoded._id)
            .select('+refreshToken') // Explicitly request the refreshToken
            .populate('planId'); // Populate necessary fields

        if (!user) {
            // console.log('User not found:', incomingRefreshToken);
            return res.status(403).json({ message: 'Forbidden: User not found.' });
        }

        if (user.isActive === false) {
            return res.status(403).json({ message: 'Forbidden: User account is inactive.' });
        }

        // 3. --- The Core Logic for Handling Race Conditions ---

        // HAPPY PATH: The token matches the current one in the DB.
        if (user.refreshToken === incomingRefreshToken) {
            // Generate new tokens
            const { accessToken, refreshToken: newRefreshToken } = await user.generateAccessAndRefereshTokens();

            // Add the just-used token to the grace period list
            await UsedRefreshToken.create({
                token: incomingRefreshToken,
                userId: user._id,
                accessToken
            });

            // Note: The `generateAccessAndRefereshTokens` method should handle saving the newRefreshToken to the user document.
            // console.log('Token sussesfully refreshed:', incomingRefreshToken);

            return res.status(200).json({
                message: 'Access token refreshed.',
                accessToken,
                refreshToken: newRefreshToken,
            });
        }

        // GRACE PERIOD PATH: The token doesn't match the current one,
        // so check if it's a recently used token.
        const isInGraceList = await UsedRefreshToken.findOne({ token: incomingRefreshToken });

        if (isInGraceList) {
            // console.log('Token sussesfully refreshed: (grace period)', incomingRefreshToken);
            // It's a concurrent request. The token is valid for this short window.
            // We issue a new access token but return the *already rotated* refresh token
            // that is now stored on the user object to keep all clients in sync.
            const accessToken = isInGraceList.accessToken;
            return res.status(200).json({
                message: 'Access token refreshed (grace period).',
                accessToken,
                refreshToken: user.refreshToken, // Send the newest token
            });
        }

        // FAILURE PATH: The token is not the current one and not in the grace list.
        // It's an old, invalid, or compromised token.
        // console.log('Token invalid:', incomingRefreshToken);
        return res.status(403).json({ message: 'Forbidden: Invalid refresh token.' });

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(403).json({ message: 'Forbidden: Refresh token expired.' });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(403).json({ message: 'Forbidden: Malformed refresh token.' });
        }
        // console.error('Error refreshing access token:', error);
        return res.status(500).json({ message: 'Internal server error.' });
    }
};

const getCurrentUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user?._id)
            .populate('planId', 'name slug billingCycle price currency')
            .lean();

        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const profile = buildProfileResponse(user);

        return res.status(200).json({
            message: 'Profile fetched successfully.',
            profile,
        });
    } catch (error) {
        console.error('Error fetching current user profile:', error);
        return res.status(500).json({ message: 'Failed to fetch profile.' });
    }
};

const updateCurrentUserProfile = async (req, res) => {
    try {
        const userId = req.user?._id;
        const {
            username,
            firstName,
            lastName,
            profilePictureUrl,
            displayName,
        } = req.body;

        const user = await User.findById(userId);

        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (username && username !== user.username) {
            const existingUsername = await User.findOne({ username, _id: { $ne: userId } }).select('_id');

            if (existingUsername) {
                return res.status(409).json({ message: 'Username is already taken.' });
            }

            user.username = username;
        }

        if (firstName !== undefined) {
            user.firstName = (firstName === null || firstName === '') ? undefined : firstName;
        }

        if (lastName !== undefined) {
            user.lastName = (lastName === null || lastName === '') ? undefined : lastName;
        }

        if (profilePictureUrl !== undefined) {
            user.profilePictureUrl = (profilePictureUrl === null || profilePictureUrl === '') ? undefined : profilePictureUrl;
        }

        if (displayName !== undefined) {
            const metadata = { ...(user.metadata || {}) };

            if (displayName === null) {
                delete metadata.displayName;
            } else {
                metadata.displayName = displayName;
            }

            user.metadata = metadata;
            user.markModified('metadata');
        }

        await user.save();
        await user.populate('planId', 'name slug billingCycle price currency');

        const profile = buildProfileResponse(user.toObject());

        return res.status(200).json({
            message: 'Profile updated successfully.',
            profile,
        });
    } catch (error) {
        console.error('Error updating current user profile:', error);
        return res.status(500).json({ message: 'Failed to update profile.' });
    }
};

const getCurrentUserSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user?._id)
            .select('email isEmailVerified preferences lastLoginAt createdAt authProvider isActive')
            .lean();

        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const preferences = user.preferences || {};

        return res.status(200).json({
            email: user.email,
            isEmailVerified: user.isEmailVerified,
            notifications: preferences.notifications || {},
            theme: preferences.theme || 'system',
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            authProvider: user.authProvider,
        });
    } catch (error) {
        console.error('Error fetching current user settings:', error);
        return res.status(500).json({ message: 'Failed to fetch settings.' });
    }
};

const updateCurrentUserEmail = async (req, res) => {
    const userId = req.user?._id;
    const { newEmail, currentPassword } = req.body;

    try {
        const user = await User.findById(userId).select('+password_hash +refreshToken email isEmailVerified isActive metadata');

        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const normalizedEmail = newEmail.toLowerCase();

        if (user.email === normalizedEmail) {
            return res.status(400).json({ message: 'The provided email matches your current email.' });
        }

        const isPasswordValid = await user.isPasswordCorrect(currentPassword);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        const duplicateEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } }).select('_id');

        if (duplicateEmail) {
            return res.status(409).json({ message: 'Email is already in use.' });
        }

        user.email = normalizedEmail;
        user.isEmailVerified = false;
        user.refreshToken = undefined;
        user.metadata = {
            ...(user.metadata || {}),
            lastEmailChangeAt: new Date(),
        };
        user.markModified('metadata');

        await user.save();
        await UsedRefreshToken.deleteMany({ userId });

        return res.status(200).json({ message: 'Email updated successfully.' });
    } catch (error) {
        console.error('Error updating user email:', error);
        return res.status(500).json({ message: 'Failed to update email.' });
    }
};

const updateCurrentUserPassword = async (req, res) => {
    const userId = req.user?._id;
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findById(userId).select('+password_hash +refreshToken isActive metadata');

        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isPasswordValid = await user.isPasswordCorrect(currentPassword);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        const isSamePassword = await user.isPasswordCorrect(newPassword);

        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from the current password.' });
        }

        user.password_hash = newPassword;
        user.refreshToken = undefined;
        user.metadata = {
            ...(user.metadata || {}),
            lastPasswordChangeAt: new Date(),
        };
        user.markModified('metadata');

        await user.save();
        await UsedRefreshToken.deleteMany({ userId });

        return res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Error updating user password:', error);
        return res.status(500).json({ message: 'Failed to update password.' });
    }
};

const deleteCurrentUserAccount = async (req, res) => {
    const userId = req.user?._id;
    const { currentPassword, reason } = req.body;

    try {
        const user = await User.findById(userId).select('+password_hash +refreshToken metadata isActive');

        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isPasswordValid = await user.isPasswordCorrect(currentPassword);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        user.isActive = false;
        user.refreshToken = undefined;
        const metadata = { ...(user.metadata || {}), deletedAt: new Date() };

        if (reason) {
            metadata.deleteReason = reason;
        } else {
            delete metadata.deleteReason;
        }

        user.metadata = metadata;
        user.markModified('metadata');

        await user.save();
        await UsedRefreshToken.deleteMany({ userId });

        return res.status(200).json({ message: 'Account deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user account:', error);
        return res.status(500).json({ message: 'Failed to delete account.' });
    }
};

const getCurrentUserPreferences = async (req, res) => {
    try {
        const user = await User.findById(req.user?._id)
            .select('preferences isActive')
            .lean();

        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const preferences = user.preferences || {};

        return res.status(200).json({
            theme: preferences.theme || 'system',
            notifications: preferences.notifications || {},
        });
    } catch (error) {
        console.error('Error fetching user preferences:', error);
        return res.status(500).json({ message: 'Failed to fetch preferences.' });
    }
};

const updateCurrentUserPreferences = async (req, res) => {
    const userId = req.user?._id;
    const { theme, notifications } = req.body;

    try {
        const user = await User.findById(userId).select('preferences isActive');

        if (!user || user.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const existingPreferences = user.preferences || {};

        if (theme !== undefined) {
            if (theme === null) {
                delete existingPreferences.theme;
            } else {
                existingPreferences.theme = theme;
            }
        }

        if (notifications !== undefined) {
            if (notifications === null) {
                delete existingPreferences.notifications;
            } else {
                existingPreferences.notifications = {
                    ...(existingPreferences.notifications || {}),
                    ...notifications,
                };
            }
        }

        user.preferences = existingPreferences;
        user.markModified('preferences');

        await user.save({ validateModifiedOnly: true });

        return res.status(200).json({
            message: 'Preferences updated successfully.',
            preferences: {
                theme: existingPreferences.theme || 'system',
                notifications: existingPreferences.notifications || {},
            },
        });
    } catch (error) {
        console.error('Error updating user preferences:', error);
        return res.status(500).json({ message: 'Failed to update preferences.' });
    }
};

const listCurrentUserOrders = async (req, res) => {
    try {
        const userId = req.user?._id;
        const userRecord = await User.findById(userId)
            .select('_id isActive username email firstName lastName')
            .lean();

        if (!userRecord || userRecord.isActive === false) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const requestedLimit = typeof req.query.limit === 'number' ? req.query.limit : DEFAULT_SELF_ORDER_PAGE_SIZE;
        const limit = Math.min(requestedLimit || DEFAULT_SELF_ORDER_PAGE_SIZE, MAX_SELF_ORDER_PAGE_SIZE);
        const cursor = req.query.cursor ? new mongoose.Types.ObjectId(req.query.cursor) : null;
        const status = req.query.status;

        const filter = { user: userId };

        if (status) {
            filter.status = status;
        }

        if (cursor) {
            filter._id = { $lt: cursor };
        }

        const orders = await Order.find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate({
                path: 'plan',
                select: 'name slug billingCycle price currency',
            })
            .populate({
                path: 'payment',
                select: 'status amount refundedAmount currency paymentGateway gatewayTransactionId purpose processedAt createdAt updatedAt',
            })
            .populate({
                path: 'invoice',
                select: 'invoiceNumber status issuedDate dueDate amount currency subscriptionStartDate subscriptionEndDate createdAt updatedAt',
            })
            .lean();

        const hasNextPage = orders.length > limit;
        const effectiveOrders = hasNextPage ? orders.slice(0, limit) : orders;

        const userSummary = {
            id: userRecord._id ? userRecord._id.toString() : undefined,
            firstName: userRecord.firstName || '',
            lastName: userRecord.lastName || '',
            username: userRecord.username || '',
            email: userRecord.email || '',
        };

        const data = effectiveOrders.map((order) => mapOrderForUser(order, userSummary));
        const nextCursor = hasNextPage ? effectiveOrders[effectiveOrders.length - 1]._id.toString() : null;

        return res.status(200).json({
            data,
            pageInfo: {
                hasNextPage,
                nextCursor,
                limit,
            },
        });
    } catch (error) {
        console.error('Error listing current user orders:', error);
        return res.status(500).json({ message: 'Failed to fetch order history.' });
    }
};

/**
 * @desc   Get user profile based on identifier
 * @route  GET /api/user-profile?identifier=your_username_or_email
 * @access Private (Adjust access control as needed, e.g., Admin only)
 * @query  identifier=your_username_or_email
 */
const getUserProfile = async (req, res) => {
    try {

        const { identifier: rawIdentifier } = req.query;
        const identifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : '';
        const normalizedIdentifier = identifier.includes('@')
            ? identifier.toLowerCase()
            : identifier;

        if (!normalizedIdentifier) {
            return res.status(400).json({ message: 'Please provide a username or email in the query parameters (e.g., /user-profile?identifier=your_username_or_email).' });
        }

        // Find user by username or email
        // Ensure you have database indexes on 'username' and 'email' fields for performance.
        const user = await User.findOne({
            $or: [{ username: normalizedIdentifier }, { email: normalizedIdentifier }]
        }).populate('planId');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({
            message: 'User profile fetched successfully.',
            user
        });

    } catch (error) {
        // Log the error for debugging purposes on the server
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Error fetching user profile.', error: error.message });
    }
}

/**
 * @desc   Update user profile based on identifier
 * @route  PATCH /api/auth/user-profile/_id
 * @access Private (Adjust access control as needed, e.g., Admin only)
 */

const updateUserProfileByAdmin = async (req, res) => {
    const { userId } = req.params;
    const updateData = req.body;

    // 1. Validate userId
    if (!isValidObjectId(userId)) {
        return res.status(400).json({ message: 'Invalid user ID format.' });
    }

    // 2. Basic Validation for updateData
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No update data provided.' });
    }

    // 3. Define allowed fields for an admin to update
    //    (Prevents unwanted fields like '_id' or 'password' from being directly updated here)
    const allowedUpdates = ['username', 'email', 'firstName', 'lastName', 'profilePictureUrl', 'planId', 'subscriptionStatus', 'subscriptionStartDate', 'subscriptionEndDate', 'trialEndsAt', 'role', 'isActive' /*, other fields as needed */];
    const requestedUpdates = Object.keys(updateData);

    const isValidOperation = requestedUpdates.every(field => allowedUpdates.includes(field));

    if (!isValidOperation) {
        return res.status(400).json({ message: 'Invalid update fields provided.' });
    }

    try {
        // 4. Check for uniqueness if username or email is being updated
        if (updateData.username) {
            const existingUserByUsername = await User.findOne({ username: updateData.username, _id: { $ne: userId } });
            if (existingUserByUsername) {
                return res.status(409).json({ message: 'Username is already taken by another user.' });
            }
        }
        if (updateData.email) {
            const existingUserByEmail = await User.findOne({ email: updateData.email, _id: { $ne: userId } });
            if (existingUserByEmail) {
                return res.status(409).json({ message: 'Email is already registered to another user.' });
            }
        }

        // 5. Find the user and update their profile
        //    - { new: true } returns the modified document rather than the original.
        //    - { runValidators: true } ensures that schema validations are applied during the update.
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData }, // Use $set to only update provided fields
            { new: true, runValidators: true, context: 'query' }
        ).select('-password'); // Exclude password from the returned user object

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({
            message: 'User profile updated successfully by admin.',
            user: updatedUser
        });

    } catch (error) {
        console.error('Error updating user profile by admin:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation error.', errors: error.errors });
        }
        // Handle other potential errors (e.g., duplicate key error if not caught above specifically)
        if (error.code === 11000) { // MongoDB duplicate key error
            return res.status(409).json({ message: 'A field (e.g., username or email) is already taken.', field: error.keyValue });
        }
        res.status(500).json({ message: 'Error updating user profile.', error: error.message });
    }
}

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUserProfile,
    updateCurrentUserProfile,
    getCurrentUserSettings,
    updateCurrentUserEmail,
    updateCurrentUserPassword,
    deleteCurrentUserAccount,
    getCurrentUserPreferences,
    updateCurrentUserPreferences,
    listCurrentUserOrders,
    getUserProfile,
    updateUserProfileByAdmin,
};