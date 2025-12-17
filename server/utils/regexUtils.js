
/**
 * Escapes a string for use in a regular expression.
 * Used to prevent ReDoS (Regular Expression Denial of Service) attacks
 * when creating regexes from user input.
 *
 * @param {string} value - The string to escape.
 * @returns {string} - The escaped string safe for regex usage.
 */
const escapeRegex = (value = '') => {
    if (typeof value !== 'string') {
        return '';
    }
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = {
    escapeRegex,
};
