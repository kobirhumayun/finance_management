const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { generateOtp } = require('../utils/otpUtils');

describe('generateOtp', () => {
    test('returns a numeric string with the requested length', () => {
        const otp = generateOtp(8);

        assert.equal(typeof otp, 'string');
        assert.equal(otp.length, 8);
        assert.match(otp, /^\d+$/);
    });

    test('produces varied values across multiple invocations', () => {
        const otps = Array.from({ length: 200 }, () => generateOtp());
        const uniqueOtps = new Set(otps);

        assert.ok(uniqueOtps.size > 1, 'Expected more than one unique OTP value.');
    });

    test('throws an error when an invalid length is provided', () => {
        assert.throws(() => generateOtp(0), /OTP length must be a positive number/);
    });
});
