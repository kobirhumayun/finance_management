# Scheduled Subscription Jobs

The subscription expiry check job (`scheduleSubscriptionExpiryCheck`) runs daily at 03:00 Asia/Dhaka time to revoke access for expired paid plans and optionally revert affected users to the free tier.

## Single-run coordination

The job now uses a MongoDB-backed advisory lock stored in the `joblocks` collection. Only the worker that successfully acquires the `subscription-expiry-check` lock proceeds with the task; all other workers log that they skipped execution.

- `JOB_INSTANCE_ID` (optional): provide a stable identifier for the worker (for example, the pod name). If omitted, the identifier defaults to `<hostname>:<pid>`.
- `SUBSCRIPTION_JOB_LOCK_TTL_MS` (optional): override the default 15-minute lock timeout (in milliseconds). Set this to a value comfortably longer than the longest expected job runtime so that locks automatically expire if a worker crashes.

Because the lock uses MongoDB, every worker that should compete for the job must share the same database. No additional infrastructure is required beyond the existing Mongo connection.

## Operational visibility

Each invocation logs the following information to confirm single-run behaviour:

- A unique run identifier (`subscription-expiry-check:<ISO timestamp>`)
- Whether the worker acquired or skipped the lock
- Total users updated and duration of the run
- Any lock release failures (which can indicate timeouts or crashes)

When deploying, ensure that exactly one type of worker process initializes the scheduler to avoid duplicate lock contention from short-lived processes (e.g., HTTP request handlers). If you need to disable the scheduler entirely for a given worker type, avoid calling `scheduleSubscriptionExpiryCheck` during bootstrap.
