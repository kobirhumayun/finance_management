const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Token = require('../models/Token');
const { generateOtp } = require('../utils/otpUtils');
const { sendNotification } = require('../services/notificationService');

const ACCOUNT_STATUS_CODES = ['active', 'invited', 'suspended', 'disabled'];
const SUBSCRIPTION_STATUS_CODES =
    (User.schema.path('subscriptionStatus') && User.schema.path('subscriptionStatus').enumValues) || [];
const USER_ROLE_OPTIONS =
    (User.schema.path('role') && User.schema.path('role').enumValues) || [];
const STATUS_LABELS = {
    active: 'Active',
    invited: 'Invited',
    suspended: 'Suspended',
    disabled: 'Disabled',
};

const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

const formatDate = (value) => {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString().split('T')[0];
};

const toDateOrNull = (value) => {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const resolveLastLoginDate = (user) => {
    if (!user) {
        return null;
    }

    return (
        toDateOrNull(user.lastLoginAt)
        || toDateOrNull(user.metadata?.lastLoginAt)
        || toDateOrNull(user.updatedAt)
        || toDateOrNull(user.createdAt)
    );
};

const normalizeStatusCode = (user) => {
    const metadataStatus = user?.metadata?.accountStatus;
    if (metadataStatus && ACCOUNT_STATUS_CODES.includes(metadataStatus)) {
        return metadataStatus;
    }

    if (user?.isActive === false) {
        return 'disabled';
    }

    return 'active';
};

const buildStatusUpdate = (statusCode) => {
    const update = { 'metadata.accountStatus': statusCode };

    if (statusCode === 'suspended' || statusCode === 'disabled') {
        update.isActive = false;
    } else {
        update.isActive = true;
    }

    return update;
};

const humanizeStatus = (statusCode) => STATUS_LABELS[statusCode] || statusCode;

const mapUserToResponse = (user, { includeRaw = false } = {}) => {
    const statusCode = normalizeStatusCode(user);
    const planDetails = user.planId && typeof user.planId === 'object'
        ? user.planId
        : null;

    const lastLoginDate = resolveLastLoginDate(user);
    const lastLoginAtISO = lastLoginDate ? lastLoginDate.toISOString() : null;
    const lastLoginAtSortValueRaw = typeof lastLoginAtISO === 'string' ? Date.parse(lastLoginAtISO) : null;
    const lastLoginAtSortValue = Number.isNaN(lastLoginAtSortValueRaw) ? null : lastLoginAtSortValueRaw;

    const response = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        planId: planDetails ? planDetails.slug : null,
        plan: planDetails ? planDetails.name : null,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        profilePictureUrl: user.profilePictureUrl || null,
        subscriptionStatus: user.subscriptionStatus || null,
        subscriptionStartDate: formatDate(user.subscriptionStartDate),
        subscriptionEndDate: formatDate(user.subscriptionEndDate),
        trialEndsAt: formatDate(user.trialEndsAt),
        role: user.role || null,
        isActive: typeof user.isActive === 'boolean' ? user.isActive : null,
        statusCode,
        status: humanizeStatus(statusCode),
        registeredAt: formatDate(user.createdAt),
        lastLoginAt: lastLoginDate ? formatDate(lastLoginDate) : null,
        lastLoginAtISO,
        lastLoginAtSortValue,
    };

    if (includeRaw) {
        response.raw = user;
    }

    return response;
};

const resolvePlanIdentifier = async (planIdentifier) => {
    if (!planIdentifier) {
        return null;
    }

    if (mongoose.Types.ObjectId.isValid(planIdentifier)) {
        const planById = await Plan.findById(planIdentifier).select('_id name slug');
        if (planById) {
            return planById;
        }
    }

    const planBySlug = await Plan.findOne({ slug: planIdentifier }).select('_id name slug');
    return planBySlug;
};

const buildStatusFilterCondition = (statusCode) => {
    switch (statusCode) {
        case 'active':
            return {
                $or: [
                    { 'metadata.accountStatus': 'active' },
                    {
                        'metadata.accountStatus': { $exists: false },
                        isActive: { $ne: false },
                    },
                    {
                        'metadata.accountStatus': { $in: [null, ''] },
                        isActive: { $ne: false },
                    },
                ],
            };
        case 'invited':
            return { 'metadata.accountStatus': 'invited' };
        case 'suspended':
            return { 'metadata.accountStatus': 'suspended' };
        case 'disabled':
            return {
                $or: [
                    { 'metadata.accountStatus': 'disabled' },
                    { isActive: false },
                ],
            };
        default:
            return {};
    }
};

const generateRandomPassword = () => {
    const candidate = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    if (candidate.length >= 12) {
        return candidate.slice(0, 16);
    }
    return crypto.randomBytes(8).toString('hex');
};

const createPasswordResetToken = async (userId) => {
    await Token.deleteMany({ userId, type: 'passwordReset' });
    const otp = generateOtp(6);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
    const token = new Token({
        userId,
        token: otp,
        type: 'passwordReset',
        expiresAt,
    });
    await token.save();
    return otp;
};

const listUsers = async (req, res) => {
    try {
        const {
            search,
            status,
            planId: planIdentifier,
            page: pageParam,
            pageSize: pageSizeParam,
        } = req.query;

        const filters = [];

        if (search) {
            const regex = new RegExp(search, 'i');
            filters.push({
                $or: [
                    { username: regex },
                    { email: regex },
                ],
            });
        }

        if (status) {
            if (!ACCOUNT_STATUS_CODES.includes(status)) {
                return res.status(400).json({ message: `Invalid status filter '${status}'.` });
            }
            filters.push(buildStatusFilterCondition(status));
        }

        if (planIdentifier) {
            const plan = await resolvePlanIdentifier(planIdentifier);
            if (!plan) {
                return res.status(400).json({ message: `Plan '${planIdentifier}' not found.` });
            }
            filters.push({ planId: plan._id });
        }

        const page = Math.max(parseInt(pageParam, 10) || 1, 1);
        const pageSizeRaw = parseInt(pageSizeParam, 10) || 25;
        const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);

        const query = filters.length > 0 ? { $and: filters } : {};

        const totalItems = await User.countDocuments(query);
        const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
        const skip = (page - 1) * pageSize;

        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .populate('planId', 'name slug')
            .lean({ virtuals: true });

        const items = users.map((user) => mapUserToResponse(user));

        const statusAggregation = await User.aggregate([
            {
                $addFields: {
                    metadataStatus: '$metadata.accountStatus',
                },
            },
            {
                $addFields: {
                    computedStatus: {
                        $switch: {
                            branches: [
                                {
                                    case: { $in: ['$metadataStatus', ACCOUNT_STATUS_CODES] },
                                    then: '$metadataStatus',
                                },
                                {
                                    case: { $eq: ['$isActive', false] },
                                    then: 'disabled',
                                },
                            ],
                            default: 'active',
                        },
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    statuses: { $addToSet: '$computedStatus' },
                },
            },
        ]);

        const aggregatedStatuses = new Set(statusAggregation[0]?.statuses || []);
        const availableStatuses = ACCOUNT_STATUS_CODES.filter((code) => aggregatedStatuses.has(code));

        return res.status(200).json({
            items,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: pageSize,
            },
            availableStatuses,
        });
    } catch (error) {
        console.error('Error listing admin users:', error);
        return res.status(500).json({ message: 'Failed to list users.' });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID.' });
        }

        const user = await User.findById(userId)
            .populate('planId', 'name slug')
            .lean({ virtuals: true });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        return res.status(200).json(mapUserToResponse(user, { includeRaw: true }));
    } catch (error) {
        console.error('Error fetching admin user profile:', error);
        return res.status(500).json({ message: 'Failed to fetch user profile.' });
    }
};

const createUser = async (req, res) => {
    try {
        const { username, email, password, planId: planIdentifier, status } = req.body;

        if (!username || !email) {
            return res.status(400).json({ message: 'Username and email are required.' });
        }

        if (await User.exists({ username })) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        if (await User.exists({ email })) {
            return res.status(409).json({ message: 'Email already exists.' });
        }

        const statusCode = status && ACCOUNT_STATUS_CODES.includes(status) ? status : 'active';
        let resolvedPlan = null;

        if (planIdentifier) {
            resolvedPlan = await resolvePlanIdentifier(planIdentifier);
            if (!resolvedPlan) {
                return res.status(400).json({ message: `Plan '${planIdentifier}' not found.` });
            }
        }

        if (!password && statusCode !== 'invited') {
            return res.status(400).json({ message: 'Password is required unless creating an invited user.' });
        }

        const passwordToStore = password || generateRandomPassword();

        const newUser = new User({
            username,
            email,
            password_hash: passwordToStore,
            planId: resolvedPlan ? resolvedPlan._id : undefined,
            metadata: {
                ...(statusCode ? { accountStatus: statusCode } : {}),
            },
            isActive: statusCode === 'suspended' || statusCode === 'disabled' ? false : true,
        });

        await newUser.save();

        const savedUser = await User.findById(newUser._id)
            .populate('planId', 'name slug')
            .lean({ virtuals: true });

        return res.status(201).json(mapUserToResponse(savedUser));
    } catch (error) {
        console.error('Error creating admin user:', error);
        return res.status(500).json({ message: 'Failed to create user.' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            username,
            email,
            firstName,
            lastName,
            profilePictureUrl,
            planId: planIdentifier,
            subscriptionStatus,
            subscriptionStartDate,
            subscriptionEndDate,
            trialEndsAt,
            role,
            isActive,
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID.' });
        }

        const updates = {};

        const assignIfDefined = (field, value) => {
            if (typeof value !== 'undefined') {
                updates[field] = value;
            }
        };

        if (username) {
            const existingUsername = await User.findOne({ username, _id: { $ne: userId } });
            if (existingUsername) {
                return res.status(409).json({ message: 'Username already exists.' });
            }
            updates.username = username;
        }

        if (email) {
            const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
            if (existingEmail) {
                return res.status(409).json({ message: 'Email already exists.' });
            }
            updates.email = email;
        }

        assignIfDefined('firstName', firstName);
        assignIfDefined('lastName', lastName);
        assignIfDefined('profilePictureUrl', profilePictureUrl);

        if (planIdentifier) {
            const resolvedPlan = await resolvePlanIdentifier(planIdentifier);
            if (!resolvedPlan) {
                return res.status(400).json({ message: `Plan '${planIdentifier}' not found.` });
            }
            updates.planId = resolvedPlan._id;
        }

        if (typeof subscriptionStatus !== 'undefined') {
            if (!SUBSCRIPTION_STATUS_CODES.includes(subscriptionStatus)) {
                return res.status(400).json({ message: `Invalid subscription status '${subscriptionStatus}'.` });
            }
            updates.subscriptionStatus = subscriptionStatus;
        }

        assignIfDefined('subscriptionStartDate', subscriptionStartDate);
        assignIfDefined('subscriptionEndDate', subscriptionEndDate);
        assignIfDefined('trialEndsAt', trialEndsAt);

        if (typeof role !== 'undefined') {
            if (USER_ROLE_OPTIONS.length && !USER_ROLE_OPTIONS.includes(role)) {
                return res.status(400).json({ message: `Invalid role '${role}'.` });
            }
            updates.role = role;
        }

        if (typeof isActive !== 'undefined') {
            updates.isActive = isActive;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true, context: 'query' },
        )
            .populate('planId', 'name slug')
            .lean({ virtuals: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        return res.status(200).json(mapUserToResponse(updatedUser));
    } catch (error) {
        console.error('Error updating admin user:', error);
        return res.status(500).json({ message: 'Failed to update user.' });
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID.' });
        }

        if (!status || !ACCOUNT_STATUS_CODES.includes(status)) {
            return res.status(400).json({ message: 'A valid status is required.' });
        }

        const statusUpdate = buildStatusUpdate(status);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: statusUpdate },
            { new: true, runValidators: true, context: 'query' },
        )
            .lean({ virtuals: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const statusCode = normalizeStatusCode(updatedUser);

        return res.status(200).json({
            id: updatedUser._id.toString(),
            statusCode,
            status: humanizeStatus(statusCode),
        });
    } catch (error) {
        console.error('Error updating admin user status:', error);
        return res.status(500).json({ message: 'Failed to update user status.' });
    }
};

const triggerPasswordReset = async (req, res) => {
    try {
        const { userId } = req.params;
        const { redirectUri } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID.' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const resetToken = await createPasswordResetToken(user._id);

        const resetLink = redirectUri || process.env.DEFAULT_PASSWORD_RESET_REDIRECT;

        let messageBody = `A password reset was requested by an administrator. Use OTP: ${resetToken}.`;

        if (resetLink) {
            messageBody += `\nAfter resetting the password, you will be redirected to: ${resetLink}`;
        }

        const notificationScheduled = await sendNotification({
            method: 'email',
            user,
            subject: 'Password Reset Requested',
            text: messageBody,
        });

        if (!notificationScheduled) {
            return res.status(500).json({ message: 'Failed to schedule password reset email.' });
        }

        return res.status(202).json({ message: 'Password reset email scheduled' });
    } catch (error) {
        console.error('Error triggering password reset for admin user:', error);
        return res.status(500).json({ message: 'Failed to trigger password reset.' });
    }
};

module.exports = {
    listUsers,
    getUserProfile,
    createUser,
    updateUser,
    updateUserStatus,
    triggerPasswordReset,
    ACCOUNT_STATUS_CODES,
    SUBSCRIPTION_STATUS_CODES,
    USER_ROLE_OPTIONS,
};
