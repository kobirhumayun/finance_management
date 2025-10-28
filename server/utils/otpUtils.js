
/**
 * Generates a random numeric OTP of a specified length.
 * @param {number} length The desired length of the OTP (default: 6).
 * @returns {string} The generated OTP as a string.
 */
const { randomInt } = require('node:crypto');

const generateOtp = (length = 6) => {
    if (length <= 0) {
        throw new Error("OTP length must be a positive number.");
    }
    let otp = '';
    for (let i = 0; i < length; i += 1) {
        otp += randomInt(0, 10).toString();
    }
    return otp;
};

module.exports = {
    generateOtp,
};