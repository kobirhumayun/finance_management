const Plan = require('../models/Plan');
const User = require('../models/User');

const DEFAULT_PLAN_LIMITS = Object.freeze({
    projects: { maxActive: null },
    transactions: { perProject: 1000 },
    summary: { allowFilters: true, allowPagination: true },
});

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseOptionalNonNegativeInteger = (value, fieldName) => {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        throw new Error(`${fieldName} must be a non-negative integer.`);
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
        if (["true", "1", "yes", "y"].includes(normalized)) {
            return true;
        }
        if (["false", "0", "no", "n"].includes(normalized)) {
            return false;
        }
    }

    throw new Error(`${fieldName} must be a boolean value.`);
};

const coercePlanLimitsInput = (raw) => {
    if (raw === undefined) {
        return undefined;
    }

    if (raw === null) {
        return {};
    }

    if (!isPlainObject(raw)) {
        throw new Error('limits must be an object.');
    }

    const result = {};

    if (Object.prototype.hasOwnProperty.call(raw, 'projects')) {
        const projects = raw.projects;
        if (projects === null) {
            result.projects = { maxActive: null };
        } else {
            if (!isPlainObject(projects)) {
                throw new Error('limits.projects must be an object.');
            }
            const maxActiveInput = Object.prototype.hasOwnProperty.call(projects, 'maxActive')
                ? projects.maxActive
                : projects.maxProjects;
            const maxActive = parseOptionalNonNegativeInteger(maxActiveInput, 'limits.projects.maxActive');
            if (maxActive !== undefined) {
                result.projects = { maxActive };
            }
        }
    }

    if (Object.prototype.hasOwnProperty.call(raw, 'transactions')) {
        const transactions = raw.transactions;
        if (transactions === null) {
            result.transactions = { perProject: null };
        } else {
            if (!isPlainObject(transactions)) {
                throw new Error('limits.transactions must be an object.');
            }
            const perProject = parseOptionalNonNegativeInteger(
                transactions.perProject,
                'limits.transactions.perProject',
            );
            if (perProject !== undefined) {
                result.transactions = { perProject };
            }
        }
    }

    if (Object.prototype.hasOwnProperty.call(raw, 'summary')) {
        const summary = raw.summary;
        if (summary === null) {
            result.summary = { allowFilters: null, allowPagination: null };
        } else {
            if (!isPlainObject(summary)) {
                throw new Error('limits.summary must be an object.');
            }
            const allowFilters = parseOptionalBoolean(summary.allowFilters, 'limits.summary.allowFilters');
            const allowPagination = parseOptionalBoolean(summary.allowPagination, 'limits.summary.allowPagination');
            const summaryResult = {};
            if (allowFilters !== undefined) {
                summaryResult.allowFilters = allowFilters;
            }
            if (allowPagination !== undefined) {
                summaryResult.allowPagination = allowPagination;
            }
            if (Object.keys(summaryResult).length > 0) {
                result.summary = summaryResult;
            }
        }
    }

    return result;
};

const prunePlanLimits = (limits) => {
    if (!isPlainObject(limits)) {
        return {};
    }

    const pruned = {};

    if (isPlainObject(limits.projects) && Object.prototype.hasOwnProperty.call(limits.projects, 'maxActive')) {
        pruned.projects = { maxActive: limits.projects.maxActive };
    }

    if (isPlainObject(limits.transactions) && Object.prototype.hasOwnProperty.call(limits.transactions, 'perProject')) {
        pruned.transactions = { perProject: limits.transactions.perProject };
    }

    if (isPlainObject(limits.summary)) {
        const summary = {};
        if (Object.prototype.hasOwnProperty.call(limits.summary, 'allowFilters')) {
            summary.allowFilters = limits.summary.allowFilters;
        }
        if (Object.prototype.hasOwnProperty.call(limits.summary, 'allowPagination')) {
            summary.allowPagination = limits.summary.allowPagination;
        }
        if (Object.keys(summary).length > 0) {
            pruned.summary = summary;
        }
    }

    return pruned;
};

const mergePlanLimits = (currentLimits = {}, updates = {}) => {
    const base = isPlainObject(currentLimits) ? { ...currentLimits } : {};
    const result = {};

    if (isPlainObject(base.projects)) {
        result.projects = { ...base.projects };
    }
    if (isPlainObject(base.transactions)) {
        result.transactions = { ...base.transactions };
    }
    if (isPlainObject(base.summary)) {
        result.summary = { ...base.summary };
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'projects')) {
        const updateProjects = updates.projects;
        if (updateProjects === null) {
            delete result.projects;
        } else if (isPlainObject(updateProjects)) {
            result.projects = result.projects || {};
            if (Object.prototype.hasOwnProperty.call(updateProjects, 'maxActive')) {
                const value = updateProjects.maxActive;
                if (value === undefined) {
                    // Ignore undefined values to keep existing data intact.
                } else {
                    result.projects.maxActive = value;
                }
            }
        }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'transactions')) {
        const updateTransactions = updates.transactions;
        if (updateTransactions === null) {
            delete result.transactions;
        } else if (isPlainObject(updateTransactions)) {
            result.transactions = result.transactions || {};
            if (Object.prototype.hasOwnProperty.call(updateTransactions, 'perProject')) {
                const value = updateTransactions.perProject;
                if (value === undefined) {
                    // Ignore undefined values.
                } else {
                    result.transactions.perProject = value;
                }
            }
        }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'summary')) {
        const updateSummary = updates.summary;
        if (updateSummary === null) {
            delete result.summary;
        } else if (isPlainObject(updateSummary)) {
            result.summary = result.summary || {};
            if (Object.prototype.hasOwnProperty.call(updateSummary, 'allowFilters')) {
                const value = updateSummary.allowFilters;
                if (value === undefined) {
                    // Ignore undefined values.
                } else {
                    result.summary.allowFilters = value;
                }
            }
            if (Object.prototype.hasOwnProperty.call(updateSummary, 'allowPagination')) {
                const value = updateSummary.allowPagination;
                if (value === undefined) {
                    // Ignore undefined values.
                } else {
                    result.summary.allowPagination = value;
                }
            }
        }
    }

    if (result.projects && Object.keys(result.projects).length === 0) {
        delete result.projects;
    }
    if (result.transactions && Object.keys(result.transactions).length === 0) {
        delete result.transactions;
    }
    if (result.summary && Object.keys(result.summary).length === 0) {
        delete result.summary;
    }

    return result;
};

const applyPlanLimitDefaults = (limits = {}) => {
    const projects = isPlainObject(limits.projects) ? limits.projects : {};
    const transactions = isPlainObject(limits.transactions) ? limits.transactions : {};
    const summary = isPlainObject(limits.summary) ? limits.summary : {};

    const maxActiveRaw = projects.maxActive;
    const maxActive = maxActiveRaw === null
        ? null
        : (Number.isInteger(maxActiveRaw) && maxActiveRaw >= 0 ? maxActiveRaw : undefined);

    const perProjectRaw = transactions.perProject;
    const perProject = perProjectRaw === null
        ? null
        : (Number.isInteger(perProjectRaw) && perProjectRaw >= 0 ? perProjectRaw : undefined);

    const allowFilters = typeof summary.allowFilters === 'boolean'
        ? summary.allowFilters
        : DEFAULT_PLAN_LIMITS.summary.allowFilters;

    const allowPagination = typeof summary.allowPagination === 'boolean'
        ? summary.allowPagination
        : DEFAULT_PLAN_LIMITS.summary.allowPagination;

    return {
        projects: { maxActive: maxActive !== undefined ? maxActive : DEFAULT_PLAN_LIMITS.projects.maxActive },
        transactions: { perProject: perProject !== undefined ? perProject : DEFAULT_PLAN_LIMITS.transactions.perProject },
        summary: { allowFilters, allowPagination },
    };
};

const safeCoerceStoredLimits = (limits) => {
    try {
        const coerced = coercePlanLimitsInput(limits);
        if (coerced === undefined) {
            return {};
        }
        return prunePlanLimits(coerced);
    } catch (error) {
        return {};
    }
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
        const fallback = await Plan.findOne({ slug: 'free' })
            .select({ slug: 1, limits: 1 })
            .lean();
        if (fallback) {
            planRecord = fallback;
        }
    }

    const sanitizedLimits = safeCoerceStoredLimits(planRecord?.limits);
    const limitsWithDefaults = applyPlanLimitDefaults(sanitizedLimits);

    return {
        slug: planRecord?.slug || normalizedSlug || 'free',
        limits: limitsWithDefaults,
    };
};

module.exports = {
    DEFAULT_PLAN_LIMITS,
    coercePlanLimitsInput,
    prunePlanLimits,
    mergePlanLimits,
    applyPlanLimitDefaults,
    getPlanLimitsForUser,
};
