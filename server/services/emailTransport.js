const nodemailer = require('nodemailer');

let transporterInstance;

const parseBoolean = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
        return false;
    }

    return null;
};

const buildTlsOptions = () => {
    const tlsOptions = {};

    const rejectUnauthorized = parseBoolean(process.env.EMAIL_TLS_REJECT_UNAUTHORIZED);
    if (rejectUnauthorized !== null) {
        tlsOptions.rejectUnauthorized = rejectUnauthorized;
    }

    if (process.env.EMAIL_TLS_MIN_VERSION) {
        tlsOptions.minVersion = process.env.EMAIL_TLS_MIN_VERSION;
    }

    if (process.env.EMAIL_TLS_CIPHERS) {
        tlsOptions.ciphers = process.env.EMAIL_TLS_CIPHERS;
    }

    return Object.keys(tlsOptions).length > 0 ? tlsOptions : undefined;
};

const buildBaseOptions = () => {
    const baseOptions = {};

    const secure = parseBoolean(process.env.EMAIL_SECURE);
    if (secure !== null) {
        baseOptions.secure = secure;
    }

    const requireTLS = parseBoolean(process.env.EMAIL_REQUIRE_TLS);
    if (requireTLS !== null) {
        baseOptions.requireTLS = requireTLS;
    }

    const tlsOptions = buildTlsOptions();
    if (tlsOptions) {
        baseOptions.tls = tlsOptions;
    }

    return baseOptions;
};

const buildSmtpOptions = (baseOptions) => {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host) {
        throw new Error('EMAIL_HOST must be defined when using SMTP transport.');
    }

    if (!port || Number.isNaN(port)) {
        throw new Error('EMAIL_PORT must be defined as a number when using SMTP transport.');
    }

    if (!user || !pass) {
        throw new Error('EMAIL_USER and EMAIL_PASS must be defined when using SMTP transport.');
    }

    return {
        ...baseOptions,
        host,
        port,
        auth: {
            user,
            pass,
        },
    };
};

const buildApiOptions = (baseOptions, provider) => {
    const apiKey = process.env.EMAIL_API_KEY;
    if (!apiKey) {
        throw new Error(`EMAIL_API_KEY must be defined when using the ${provider} transport.`);
    }

    const serviceName = process.env.EMAIL_SERVICE || provider;
    const authUser = process.env.EMAIL_API_USER || process.env.EMAIL_USER || 'apikey';

    const options = {
        ...baseOptions,
        service: serviceName,
        auth: {
            user: authUser,
            pass: apiKey,
        },
    };

    const host = process.env.EMAIL_HOST;
    if (host) {
        options.host = host;
    }

    const portValue = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined;
    if (portValue && !Number.isNaN(portValue)) {
        options.port = portValue;
    }

    return options;
};

const createTransporter = () => {
    const provider = (process.env.EMAIL_PROVIDER || 'smtp').trim().toLowerCase();
    const baseOptions = buildBaseOptions();

    const transportOptions = provider === 'smtp'
        ? buildSmtpOptions(baseOptions)
        : buildApiOptions(baseOptions, provider);

    return nodemailer.createTransport(transportOptions);
};

const getTransporter = () => {
    if (!transporterInstance) {
        transporterInstance = createTransporter();
    }

    return transporterInstance;
};

module.exports = {
    getTransporter,
};
