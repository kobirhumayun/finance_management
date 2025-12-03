const { Queue } = require('bullmq');
const { getPdfQueueConnection, getPdfQueueName } = require('../services/pdfQueue');

const queue = new Queue(getPdfQueueName(), { connection: getPdfQueueConnection() });

(async () => {
    await queue.waitUntilReady();
    await queue.getJobCounts();
    await queue.close();
    process.exit(0);
})().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('PDF worker healthcheck failed', error);
    process.exit(1);
});
