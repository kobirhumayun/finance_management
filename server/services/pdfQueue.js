const { Queue, QueueEvents } = require('bullmq');

const DEFAULT_QUEUE_NAME = process.env.PDF_QUEUE_NAME || 'summary-pdf';
const DEFAULT_RESPONSE_TIMEOUT_MS = Number(process.env.PDF_JOB_RESPONSE_TIMEOUT_MS || 45000);
const DEFAULT_PROCESS_TIMEOUT_MS = Number(process.env.PDF_JOB_PROCESS_TIMEOUT_MS || 120000);

const parseRedisUrl = (value) => {
    const redisUrl = value || process.env.PDF_QUEUE_REDIS_URL || process.env.REDIS_URL || 'redis://finance-management-redis:6379';
    const parsed = new URL(redisUrl);

    const preferredContainerHost = process.env.PDF_QUEUE_SERVICE_HOST || 'finance-management-redis';
    const parsedHostname = parsed.hostname;
    const isLoopbackHost = ['127.0.0.1', 'localhost', '0.0.0.0', 'host.docker.internal'].includes(parsedHostname);

    const connection = {
        host: isLoopbackHost ? preferredContainerHost : parsedHostname,
        port: Number(parsed.port) || 6379,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    };

    if (parsed.username) {
        connection.username = parsed.username;
    }
    if (parsed.password) {
        connection.password = parsed.password;
    }
    if (parsed.protocol === 'rediss:') {
        connection.tls = {};
    }

    return connection;
};

const connectionOptions = parseRedisUrl();
const queue = new Queue(DEFAULT_QUEUE_NAME, { connection: connectionOptions });
const queueEvents = new QueueEvents(DEFAULT_QUEUE_NAME, { connection: connectionOptions });

const readinessPromise = Promise.all([queue.waitUntilReady(), queueEvents.waitUntilReady()]);

const enqueueSummaryPdfJob = async (payload) => {
    await readinessPromise;
    return queue.add('build-summary-pdf', payload, {
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: 50,
        timeout: DEFAULT_PROCESS_TIMEOUT_MS,
    });
};

const waitForJobResult = async (job) => {
    const timeoutMs = Number.isFinite(DEFAULT_RESPONSE_TIMEOUT_MS) ? DEFAULT_RESPONSE_TIMEOUT_MS : 45000;

    const completionPromise = job.waitUntilFinished(queueEvents);
    const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('PDF generation timed out.'));
        }, timeoutMs);
        completionPromise.finally(() => clearTimeout(timer));
    });

    return Promise.race([completionPromise, timeoutPromise]);
};

const shutdownPdfQueue = async () => {
    await Promise.allSettled([queue.close(), queueEvents.close()]);
};

process.once('exit', () => {
    shutdownPdfQueue();
});

module.exports = {
    enqueueSummaryPdfJob,
    getPdfQueueConnection: () => ({ ...connectionOptions }),
    getPdfQueueName: () => DEFAULT_QUEUE_NAME,
    shutdownPdfQueue,
    waitForJobResult,
};
