const AppError = require('../utils/AppError');

const handleCastErrorDB = (err) => {
    const message = `Invalid ${err.path}: ${err.value}.`;
    return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
    let valueDescription;

    if (err.keyValue && typeof err.keyValue === 'object') {
        const [key, value] = Object.entries(err.keyValue)[0] || [];
        if (key !== undefined) {
            valueDescription = `${key}: ${value}`;
        }
    }

    if (!valueDescription && typeof err.message === 'string') {
        const match = err.message.match(/(["'])(\\?.)*?\1/);
        if (match && match[0]) {
            valueDescription = match[0];
        }
    }

    const message = valueDescription
        ? `Duplicate field value: ${valueDescription}. Please use another value!`
        : 'Duplicate field value detected. Please use another value!';
    return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again.', 401);

const normalizePath = (value) => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
};

const resolveRequestPath = (req) => {
    if (!req || typeof req !== 'object') {
        return undefined;
    }

    const originalPath = normalizePath(req.originalUrl);
    if (originalPath) {
        return originalPath;
    }

    const fallbackPath = normalizePath(req.url);
    if (fallbackPath) {
        return fallbackPath;
    }

    return undefined;
};

const isApiRequest = (req) => {
    const requestPath = resolveRequestPath(req);
    return typeof requestPath === 'string' && requestPath.startsWith('/api');
};

const sendErrorDev = (err, req, res) => {

    if (isApiRequest(req)) {
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack,
        });
    }

    // Programming or other unknown error: don't leak error details
    // 1) Log error
    console.error('ERROR 💥', err);
    // 2) Send generic message
    return res.status(500).json({
        status: 'error',
        message: 'Something went very wrong!',
    });
};

const sendErrorProd = (err, req, res) => {

    if (isApiRequest(req)) {
        // Operational, trusted error: send message to client
        if (err.isOperational) {
            return res.status(err.statusCode).json({
                status: err.status,
                message: err.message,
            });
        }
    }

    // Programming or other unknown error: don't leak error details
    // 1) Log error
    console.error('ERROR 💥', err);
    // 2) Send generic message
    return res.status(500).json({
        status: 'error',
        message: 'Something went very wrong!',
    });
};

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, req, res);
        return;
    }

    let error = { ...err, message: err.message, name: err.name }; // Create a shallow copy

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error); // MongoDB duplicate key
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error); // Mongoose validation
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
};