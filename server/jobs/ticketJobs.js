const cron = require('node-cron');
const Ticket = require('../models/Ticket');
const { acquireLock, releaseLock } = require('../utils/jobLock');
const { getUserNameById, notifyTicketParticipants } = require('../services/ticketNotificationService');

const STALE_TICKET_JOB_NAME = 'stale-ticket-scan';
const STALE_TICKET_AGE_DAYS = parseInt(process.env.STALE_TICKET_AGE_DAYS, 10) || 3;
const STALE_TICKET_CRON = process.env.STALE_TICKET_CRON || '0 * * * *';
const STALE_TICKET_LOCK_TTL_MS = parseInt(process.env.STALE_TICKET_LOCK_TTL_MS, 10) || (1000 * 60 * 10);
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'UTC';

const getJobInstanceId = () => {
    if (process.env.JOB_INSTANCE_ID) {
        return process.env.JOB_INSTANCE_ID;
    }

    const hostname = process.env.HOSTNAME || 'unknown-host';
    return `${hostname}:${process.pid}`;
};

const buildRunId = () => `${STALE_TICKET_JOB_NAME}:${new Date().toISOString()}`;

const markTicketAsStale = async (ticket) => {
    const cutoffDaysText = `${STALE_TICKET_AGE_DAYS} day${STALE_TICKET_AGE_DAYS === 1 ? '' : 's'}`;
    ticket.staleSince = new Date();

    if (ticket.priority !== 'urgent') {
        ticket.priority = 'urgent';
    }

    ticket.activityLog.push({
        actor: ticket.assignee || ticket.requester,
        action: 'escalated',
        message: `Marked as stale after ${cutoffDaysText} without updates.`,
    });

    await ticket.save();

    const subjectLine = `Ticket escalated: ${ticket.subject}`;
    const requesterName = await getUserNameById(ticket.requester);
    const message = `Ticket "${ticket.subject}" has been flagged as stale after ${cutoffDaysText}. ${requesterName} will be notified until it is updated.`;

    await notifyTicketParticipants({ ticket, subject: subjectLine, text: message });
};

const scheduleStaleTicketScan = () => {
    cron.schedule(
        STALE_TICKET_CRON,
        async () => {
            const runId = buildRunId();
            const owner = getJobInstanceId();
            const now = new Date();
            const cutoff = new Date(now.getTime() - STALE_TICKET_AGE_DAYS * 24 * 60 * 60 * 1000);
            console.log(`[${runId}] Triggered by ${owner}. Attempting to acquire lock...`);

            let lock;
            try {
                lock = await acquireLock(STALE_TICKET_JOB_NAME, STALE_TICKET_LOCK_TTL_MS, owner);
            } catch (lockError) {
                console.error(`[${runId}] Failed to acquire lock:`, lockError);
                return;
            }

            if (!lock) {
                console.log(`[${runId}] Skipping run. Lock held by another worker.`);
                return;
            }

            console.log(`[${runId}] Lock acquired by ${owner}. Beginning stale ticket scan.`);
            let processedCount = 0;

            try {
                const staleTicketsCursor = Ticket.find({
                    status: 'open',
                    updatedAt: { $lt: cutoff },
                    staleSince: { $exists: false },
                }).cursor();

                for await (const ticketDocument of staleTicketsCursor) {
                    await markTicketAsStale(ticketDocument);
                    processedCount += 1;
                }

                console.log(`[${runId}] Stale ticket scan complete. Processed ${processedCount} ticket(s).`);
            } catch (error) {
                console.error(`[${runId}] Error while scanning for stale tickets:`, error);
            } finally {
                const released = await releaseLock(STALE_TICKET_JOB_NAME, owner);
                if (released) {
                    console.log(`[${runId}] Lock released by ${owner}.`);
                } else {
                    console.warn(`[${runId}] Lock held by ${owner} could not be released (may have expired).`);
                }
            }
        },
        {
            scheduled: true,
            timezone: CRON_TIMEZONE,
        },
    );

    console.log('Stale ticket scan job scheduled.');
};

module.exports = {
    scheduleStaleTicketScan,
};
