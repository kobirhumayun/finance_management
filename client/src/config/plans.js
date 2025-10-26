// File: client/src/config/plans.js
// Plan-related configuration shared across the client.
//
// KEEP IN SYNC WITH BACKEND ENUMERATIONS:
// - server/models/User.js (JWT payload uses `planId.slug` with 'free' fallback)
// - server/jobs/subscriptionJobs.js (fallback when reverting users to the free plan)
//
// Update this list whenever the backend introduces or renames free-tier plan slugs.

export const FREE_PLAN_SLUGS = Object.freeze([
  "free"
]);
