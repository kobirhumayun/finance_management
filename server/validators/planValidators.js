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

const planValidationRules = () => {
    return [
        isLength('name', { min: 3, max: 100 }),
        isSlugField('slug'),
        isSlugField('targetSlug').optional(),
        isStringField('description').optional({ checkFalsy: true }), // Optional, allow empty string if provided
        isLength('description', { max: 500 }).optional({ checkFalsy: true }),
        isFloatField('price', { min: 0 }),
        isNotEmptyString('billingCycle'),
        isInValues('billingCycle', ['monthly', 'yearly', 'one-time']),
        isInValues('isPublic', ['true', 'false']).optional(),
        ...isArrayOfStringsField('features', { min: 0 }), // Spread because it returns an array of validators
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

module.exports = {
    planValidationRules,
    planValidationSlugOnlyRules,
    changePlanValidationRules,
};