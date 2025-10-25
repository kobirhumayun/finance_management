const { getTransporter } = require('./emailTransport');
/**
 * Sends an email. To be replace with actual email sending implementation.
 * @param {object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - Optional HTML body
 */
const sendEmail = async ({ to, subject, text, html }) => {
    const transporter = getTransporter();

    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
        html,
    });

    return true;
};

module.exports = {
    sendEmail,
};
