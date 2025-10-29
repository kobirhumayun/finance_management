const { 
    isNotEmptyString,
    isSlugField,
    isStringField,
    isFloatField,
    isInValues,
    isArrayOfStringsField,
    isMongoIdField,
    isLength,
} = require('./commonValidators');
const Plan = require('../models/Plan');

const BILLING_CYCLES = Plan.schema.path('billingCycle').enumValues;

const planValidationRules = () => {
    return [
        isLength('name', { min: 3, max: 100 }),
        isSlugField('slug'),
        isSlugField('targetSlug').optional(),
        isStringField('description').optional({ checkFalsy: true }), // Optional, allow empty string if provided
        isLength('description', { max: 500 }).optional({ checkFalsy: true }),
        isFloatField('price', { min: 0 }),
        isNotEmptyString('billingCycle'),
        isInValues('billingCycle', BILLING_CYCLES),
        isInValues('isPublic', ['true', 'false']).optional(),
        ...isArrayOfStringsField('features', { min: 0 }), // Spread because it returns an array of validators
    ];
};

const updatePlanValidationRules = () => {
    const optionalFeaturesValidators = isArrayOfStringsField('features', { min: 0 }).map((validator) => validator.optional());

    return [
        isSlugField('targetSlug'),
        isLength('name', { min: 3, max: 100 }).optional(),
        isSlugField('slug').optional(),
        isStringField('description').optional({ checkFalsy: true }),
        isLength('description', { max: 500 }).optional({ checkFalsy: true }),
        isFloatField('price', { min: 0 }).optional(),
        isInValues('billingCycle', BILLING_CYCLES).optional(),
        isInValues('isPublic', ['true', 'false']).optional(),
        ...optionalFeaturesValidators,
    ];
};

const planValidationSlugOnlyRules = () => {
    return [
        isSlugField('slug'),
    ];
};

const changePlanValidationRules = () => {
    return [
        isMongoIdField('appliedUserId'),
        isMongoIdField('newPlanId'),
        isMongoIdField('paymentId'),
    ];
};

const rejectPaymentValidationRules = () => {
    return [
        isMongoIdField('paymentId'),
        isMongoIdField('appliedUserId'),
        isLength('comment', { max: 500 }).optional({ checkFalsy: true }),
    ];
};

module.exports = {
    planValidationRules,
    updatePlanValidationRules,
    planValidationSlugOnlyRules,
    changePlanValidationRules,
    rejectPaymentValidationRules,
};