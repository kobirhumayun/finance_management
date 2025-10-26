const {
    isFloatField,
    isNotEmptyString,
    isInValues,
    isMongoIdField,
    isObjectField,
    isLength,
} = require('./commonValidators');

const paymentValidationRules = () => {
    return [
        isFloatField('amount', { min: 0 }),
        isNotEmptyString('currency'),
        isInValues('currency', ['USD', 'EUR', 'BDT']), // Example currencies
        isNotEmptyString('paymentGateway'),
        isNotEmptyString('gatewayTransactionId'),
        isMongoIdField('paymentId')
    ];
};

module.exports = {
    paymentValidationRules,
};