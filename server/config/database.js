const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Payment = require('../models/Payment');

dotenv.config();

const mongoUri = process.env.MONGO_URI;
const mongoDb = process.env.MONGO_DB || process.env.MONGO_DATABASE;

const parseInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const MAX_RETRIES = parseInteger(process.env.MONGO_CONNECT_MAX_RETRIES, 5);
const RETRY_DELAY_MS = parseInteger(process.env.MONGO_CONNECT_RETRY_DELAY_MS, 5000);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildMongoUri = (baseUri, databaseName) => {
    if (!baseUri) {
        throw new Error('MONGO_URI is not defined in the environment variables.');
    }

    if (!databaseName) {
        throw new Error('MONGO_DB (or MONGO_DATABASE) is not defined in the environment variables.');
    }

    const [uriWithoutQuery, queryPart] = baseUri.split('?');
    const authorityIndex = uriWithoutQuery.indexOf('//');
    const authorityAndPath = authorityIndex >= 0 ? uriWithoutQuery.slice(authorityIndex + 2) : uriWithoutQuery;
    const firstPathSlash = authorityAndPath.indexOf('/');
    const hasDatabasePath = firstPathSlash !== -1 && authorityAndPath.slice(firstPathSlash + 1).length > 0;

    if (hasDatabasePath) {
        return queryPart ? `${uriWithoutQuery}?${queryPart}` : uriWithoutQuery;
    }

    const normalizedBase = uriWithoutQuery.endsWith('/') ? uriWithoutQuery.slice(0, -1) : uriWithoutQuery;
    const queryString = queryPart ? `?${queryPart}` : '';

    return `${normalizedBase}/${databaseName}${queryString}`;
};

let fullMongoUri;

try {
    fullMongoUri = buildMongoUri(mongoUri, mongoDb);
} catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
}

// Keep track of the connection state to avoid multiple connection attempts
let connectionPromise = null;

/**
 * Establishes and manages the MongoDB connection using Mongoose.
 * Implements a singleton pattern to ensure only one connection is attempted/established.
 * Includes enhanced error handling and reconnection logging.
 */
const connectDB = async () => {
    // If a connection attempt is already in progress or established, return it
    if (connectionPromise) {
        return connectionPromise;
    }

    // Start a new connection attempt with retries
    connectionPromise = (async () => {
        let attempt = 0;
        let lastError;

        while (attempt <= MAX_RETRIES) {
            try {
                console.log(
                    `Attempting to connect to MongoDB (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`
                );

                const conn = await mongoose.connect(fullMongoUri, {
                    // Mongoose 6 defaults are generally good.
                    // autoIndex: true, // Consider 'false' in production for performance, manage indexes manually.
                    // bufferCommands: true, // Default, useful but can hide connection issues.
                });

                console.log(`MongoDB Connected: ${conn.connection.host}`);

                try {
                    await Payment.syncIndexes();
                    console.log('Payment collection indexes synced.');
                } catch (indexError) {
                    console.error('Failed to sync Payment indexes:', indexError);
                    throw indexError;
                }

                return conn;
            } catch (error) {
                lastError = error;
                attempt += 1;
                console.error(`MongoDB connection attempt ${attempt} failed: ${error.message}`);

                if (attempt > MAX_RETRIES) {
                    connectionPromise = null;
                    throw lastError;
                }

                const backoffDelay = RETRY_DELAY_MS * attempt;
                console.log(
                    `Retrying MongoDB connection in ${backoffDelay / 1000} seconds... (retry ${attempt}/${
                        MAX_RETRIES
                    })`
                );
                await delay(backoffDelay);
            }
        }

        connectionPromise = null;
        throw lastError;
    })();

    return connectionPromise;
};

// --- Connection Event Listeners ---

// Fired when the connection is established
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to DB.');
});

// Fired if an error occurs after the initial connection
mongoose.connection.on('error', (err) => {
    console.error(`Mongoose connection error: ${err.message}`);
    // Consider logging or alerting systems here. Mongoose will attempt to reconnect.
});

// Fired when the connection is lost
mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected. Attempting to reconnect...');
    // Mongoose handles basic reconnection. You might add custom logic or alerts here.
});

// Fired when Mongoose re-establishes a connection
mongoose.connection.on('reconnected', () => {
    console.log('Mongoose reconnected to DB.');
});

// --- Graceful Shutdown ---

/**
 * Closes the Mongoose connection gracefully.
 */
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Closing MongoDB connection...`);
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
        process.exit(0);
    } catch (err) {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
    }
};

// Listen for termination signals (e.g., from Ctrl+C or deployment tools)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectDB;
