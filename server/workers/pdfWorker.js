const dotenv = require('dotenv');

dotenv.config();

const { Worker } = require('bullmq');
const { buildSummaryHtml } = require('../services/summaryReportHtml');
const { withPage, shutdownPlaywright, initializePlaywright } = require('../services/playwrightPool');
const { getPdfQueueConnection, getPdfQueueName, shutdownPdfQueue } = require('../services/pdfQueue');

const queueConnection = getPdfQueueConnection();
const queueName = getPdfQueueName();

const pdfWorker = new Worker(
    queueName,
    async (job) => {
        const {
            transactions = [],
            summaryTotals = {},
            balance = 0,
            counts = {},
            projectBreakdown = [],
            generatedAt,
        } = job.data || {};

        const html = buildSummaryHtml({
            transactions,
            summaryTotals,
            balance,
            counts,
            projectBreakdown,
            generatedAt: generatedAt ? new Date(generatedAt) : new Date(),
        });

        await initializePlaywright();
        const pdfBuffer = await withPage(async ({ page }) => {
            await page.setContent(html, { waitUntil: 'networkidle' });
            return page.pdf({ format: 'A4', printBackground: true });
        });

        return pdfBuffer.toString('base64');
    },
    {
        connection: queueConnection,
    },
);

pdfWorker.on('failed', (job, error) => {
    // eslint-disable-next-line no-console
    console.error(`PDF job ${job?.id ?? '<unknown>'} failed:`, error);
});

pdfWorker.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('PDF worker encountered an error:', error);
});

const shutdown = async () => {
    await Promise.allSettled([
        pdfWorker.close(),
        shutdownPlaywright(),
        shutdownPdfQueue(),
    ]);
};

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
    process.once(signal, () => {
        shutdown().finally(() => process.exit(0));
    });
});
