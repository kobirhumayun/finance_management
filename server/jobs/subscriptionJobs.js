// jobs/subscription.jobs.js
const cron = require('node-cron');
const User = require('../models/User');
const Plan = require('../models/Plan');
const { acquireLock, releaseLock } = require('../utils/jobLock');

const DEFAULT_EXPIRED_STATUS = 'canceled'; // Or 'past_due', 'free'
const REVERT_TO_FREE_PLAN_ON_EXPIRY = true; // Set to true to move expired users to the 'free' plan
const SUBSCRIPTION_JOB_NAME = 'subscription-expiry-check';
const LOCK_TTL_MS = parseInt(process.env.SUBSCRIPTION_JOB_LOCK_TTL_MS, 10) || (1000 * 60 * 15);

const getJobInstanceId = () => {
    if (process.env.JOB_INSTANCE_ID) {
        return process.env.JOB_INSTANCE_ID;
    }

    const hostname = process.env.HOSTNAME || 'unknown-host';
    return `${hostname}:${process.pid}`;
};

/**
 * Scheduled task to check for expired subscriptions and update user status.
 * Runs daily at 3:00 AM server time. Adjust schedule as needed.
 */
const scheduleSubscriptionExpiryCheck = () => {
    // Run daily at 3:00 AM ('0 3 * * *')
    // For testing, run every minute: ('* * * * *')
    cron.schedule('0 3 * * *', async () => {
        const now = new Date();
        const runId = `${SUBSCRIPTION_JOB_NAME}:${now.toISOString()}`;
        const owner = getJobInstanceId();
        console.log(`[${runId}] Trigger received by ${owner}. Attempting to acquire lock...`);

        let lock;
        try {
            lock = await acquireLock(SUBSCRIPTION_JOB_NAME, LOCK_TTL_MS, owner);
        } catch (lockError) {
            console.error(`[${runId}] Failed to acquire lock due to error:`, lockError);
            return;
        }

        if (!lock) {
            console.log(`[${runId}] Skipping run. Another instance currently holds the lock.`);
            return;
        }

        console.log(`[${runId}] Lock acquired by ${owner}. Proceeding with subscription expiry check.`);

        const runStartTime = Date.now();
        let updatedCount = 0;
        let freePlanId = null;

        try {
            // Find the default 'free' plan ID if we need to revert users
            if (REVERT_TO_FREE_PLAN_ON_EXPIRY) {
                const freePlan = await Plan.findOne({ slug: 'free' }).select('_id');
                if (freePlan) {
                    freePlanId = freePlan._id;
                } else {
                    console.warn('Scheduled Job: Default "free" plan not found. Cannot revert expired users to free plan.');
                }
            }

            // Find users whose active/trial subscription end date is in the past
            const expiredUsersCursor = User.find({
                $or: [
                    { subscriptionEndDate: { $lt: now }, subscriptionStatus: 'active' },
                    { trialEndsAt: { $lt: now }, subscriptionStatus: 'trialing' }
                ]
            }).cursor(); // Use cursor for potentially large numbers of users

            // Prepare bulk operations array
            const bulkOps = [];

            for await (const user of expiredUsersCursor) {
                console.log(`Found expired subscription for user: ${user.email} (ID: ${user._id}), End Date: ${user.subscriptionEndDate || user.trialEndsAt}`);

                const updateData = {
                    subscriptionStatus: DEFAULT_EXPIRED_STATUS,
                    // Clear dates or set based on new status if needed
                    subscriptionEndDate: null,
                    trialEndsAt: null,
                };

                // If reverting to free plan is enabled and found
                if (REVERT_TO_FREE_PLAN_ON_EXPIRY && freePlanId) {
                    updateData.planId = freePlanId;
                    updateData.subscriptionStatus = 'free'; // Override default expired status
                    updateData.subscriptionStartDate = now; // Set start date for free plan
                    updateData.subscriptionEndDate = null; // Free plan has no end date
                    updateData.trialEndsAt = null;
                }

                bulkOps.push({
                    updateOne: {
                        filter: { _id: user._id },
                        update: { $set: updateData }
                    }
                });

                // Execute in batches to avoid large bulk operation payload issues
                if (bulkOps.length >= 500) {
                    console.log(`Executing bulk update for ${bulkOps.length} users...`);
                    const result = await User.bulkWrite(bulkOps);
                    updatedCount += result.modifiedCount;
                    bulkOps.length = 0; // Clear the array
                    console.log(`Batch update complete. Modified: ${result.modifiedCount}`);
                }
            }

            // Execute any remaining operations
            if (bulkOps.length > 0) {
                console.log(`Executing final bulk update for ${bulkOps.length} users...`);
                const result = await User.bulkWrite(bulkOps);
                updatedCount += result.modifiedCount;
                console.log(`Final batch update complete. Modified: ${result.modifiedCount}`);
            }


            const runtimeMs = Date.now() - runStartTime;
            console.log(`[${runId}] Scheduled Job Finished. Total users updated: ${updatedCount}. Duration: ${runtimeMs}ms.`);

        } catch (error) {
            console.error(`[${runId}] Error during scheduled subscription check:`, error);
        } finally {
            const released = await releaseLock(SUBSCRIPTION_JOB_NAME, owner);
            if (released) {
                console.log(`[${runId}] Lock released by ${owner}.`);
            } else {
                console.warn(`[${runId}] Lock held by ${owner} could not be released (it may have expired).`);
            }
        }
    }, {
        scheduled: true,
        timezone: "Asia/Dhaka" // Set your server's timezone or user's timezone if applicable
    });

    console.log('Subscription expiry check job scheduled.');
};

module.exports = {
    scheduleSubscriptionExpiryCheck
};