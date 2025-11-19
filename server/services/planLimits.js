const Plan = require('../models/Plan');
const User = require('../models/User');

const DEFAULT_PLAN_LIMITS = Object.freeze({
    projects: { maxActive: null },
    transactions: { perProject: 1000, allowAttachments: true },
    summary: { allowFilters: true, allowPagination: true, allowExport: true },
});

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseOptionalInteger = (value, fieldName) => {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return null;
        }
        const numeric = Number(trimmed);
        if (!Number.isFinite(numeric) || numeric < 0) {
            throw new Error(`${fieldName} must be a non-negative number.`);
        }
        return Math.floor(numeric);
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`${fieldName} must be a non-negative number.`);
        }
        return Math.floor(value);
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        throw new Error(`${fieldName} must be a non-negative number.`);
    }

    return Math.floor(numeric);
};

const parseOptionalBoolean = (value, fieldName) => {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'n'].includes(normalized)) {
            return false;
        }
    }

    throw new Error(`${fieldName} must be a boolean value.`);
};

const sanitizePlanLimitsInput = (raw) => {
    if (raw === undefined) {
        return undefined;
    }

    if (raw === null) {
        return {};
    }

    if (!isPlainObject(raw)) {
        throw new Error('limits must be an object.');
    }

    const sanitized = {};

    if (Object.prototype.hasOwnProperty.call(raw, 'projects')) {
        const projects = raw.projects;
        if (projects === null) {
            sanitized.projects = { maxActive: null };
        } else if (isPlainObject(projects)) {
            const maxActiveInput = Object.prototype.hasOwnProperty.call(projects, 'maxActive')
                ? projects.maxActive
                : projects.maxProjects;
            const maxActive = parseOptionalInteger(maxActiveInput, 'limits.projects.maxActive');
            if (maxActive !== undefined) {
                sanitized.projects = { maxActive };
            }
        } else {
            throw new Error('limits.projects must be an object.');
        }
    }

    if (Object.prototype.hasOwnProperty.call(raw, 'transactions')) {
        const transactions = raw.transactions;
        if (transactions === null) {
            sanitized.transactions = { perProject: null, allowAttachments: null };
        } else if (isPlainObject(transactions)) {
            const perProject = parseOptionalInteger(transactions.perProject, 'limits.transactions.perProject');
            const allowAttachments = parseOptionalBoolean(transactions.allowAttachments, 'limits.transactions.allowAttachments');
            const transactionValues = {};
            if (perProject !== undefined) {
                transactionValues.perProject = perProject;
            }
            if (allowAttachments !== undefined) {
                transactionValues.allowAttachments = allowAttachments;
            }
            if (Object.keys(transactionValues).length > 0) {
                sanitized.transactions = transactionValues;
            }
        } else {
            throw new Error('limits.transactions must be an object.');
        }
    }

    if (Object.prototype.hasOwnProperty.call(raw, 'summary')) {
        const summary = raw.summary;
        if (summary === null) {
            sanitized.summary = {};
        } else if (isPlainObject(summary)) {
            const allowFilters = parseOptionalBoolean(summary.allowFilters, 'limits.summary.allowFilters');
            const allowPagination = parseOptionalBoolean(summary.allowPagination, 'limits.summary.allowPagination');
            const allowExport = parseOptionalBoolean(summary.allowExport, 'limits.summary.allowExport');
            const summaryValues = {};
            if (allowFilters !== undefined) {
                summaryValues.allowFilters = allowFilters;
            }
            if (allowPagination !== undefined) {
                summaryValues.allowPagination = allowPagination;
            }
            if (allowExport !== undefined) {
                summaryValues.allowExport = allowExport;
            }
            if (Object.keys(summaryValues).length > 0) {
                sanitized.summary = summaryValues;
            }
        } else {
            throw new Error('limits.summary must be an object.');
        }
    }

    if (sanitized.projects && Object.keys(sanitized.projects).length === 0) {
        delete sanitized.projects;
    }
    if (sanitized.transactions && Object.keys(sanitized.transactions).length === 0) {
        delete sanitized.transactions;
    }
    if (sanitized.summary && Object.keys(sanitized.summary).length === 0) {
        delete sanitized.summary;
    }

    return sanitized;
};

const mergePlanLimits = (current = {}, updates = {}) => {
    const base = sanitizePlanLimitsInput(current) ?? {};
    const next = sanitizePlanLimitsInput(updates);

    if (next === undefined) {
        return base;
    }

    const merged = { ...base };

    ['projects', 'transactions', 'summary'].forEach((section) => {
        if (Object.prototype.hasOwnProperty.call(next, section)) {
            const value = next[section];
            if (!value || Object.keys(value).length === 0) {
                delete merged[section];
            } else {
                merged[section] = value;
            }
        }
    });

    return merged;
};

const applyPlanLimitDefaults = (limits) => {
    const sanitized = sanitizePlanLimitsInput(limits) ?? {};

    return {
        projects: { maxActive: sanitized.projects?.maxActive ?? DEFAULT_PLAN_LIMITS.projects.maxActive },
        transactions: {
            perProject: sanitized.transactions?.perProject ?? DEFAULT_PLAN_LIMITS.transactions.perProject,
            allowAttachments: sanitized.transactions?.allowAttachments ?? DEFAULT_PLAN_LIMITS.transactions.allowAttachments,
        },
        summary: {
            allowFilters: sanitized.summary?.allowFilters ?? DEFAULT_PLAN_LIMITS.summary.allowFilters,
            allowPagination: sanitized.summary?.allowPagination ?? DEFAULT_PLAN_LIMITS.summary.allowPagination,
            allowExport: sanitized.summary?.allowExport ?? DEFAULT_PLAN_LIMITS.summary.allowExport,
        },
    };
};

const getPlanLimitsForUser = async ({ userId, planSlug } = {}) => {
    const normalizedSlug = typeof planSlug === 'string' ? planSlug.trim().toLowerCase() : null;

    let planRecord = null;

    if (normalizedSlug) {
        planRecord = await Plan.findOne({ slug: normalizedSlug })
            .select({ slug: 1, limits: 1 })
            .lean();
    }

    if (!planRecord && userId) {
        const user = await User.findById(userId)
            .select({ planId: 1 })
            .populate({ path: 'planId', select: 'slug limits' });

        if (user?.planId) {
            planRecord = {
                slug: user.planId.slug,
                limits: user.planId.limits,
            };
        }
    }

    if (!planRecord && normalizedSlug !== 'free') {
        planRecord = await Plan.findOne({ slug: 'free' })
            .select({ slug: 1, limits: 1 })
            .lean();
    }

    const limits = applyPlanLimitDefaults(planRecord?.limits);

    return {
        slug: planRecord?.slug ?? normalizedSlug ?? 'free',
        limits,
    };
};

module.exports = {
    DEFAULT_PLAN_LIMITS,
    sanitizePlanLimitsInput,
    mergePlanLimits,
    applyPlanLimitDefaults,
    getPlanLimitsForUser,
};
