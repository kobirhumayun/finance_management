# Developer Notes

## Free-tier plan slugs

The middleware gate that restricts access to premium-only routes relies on the list of free-tier plan slugs defined in [`client/src/config/plans.js`](../client/src/config/plans.js). These values must mirror the canonical slugs emitted by the backend when it signs JWTs (see [`server/models/User.js`](../server/models/User.js)) and any logic that reassigns users to the free offering (for example [`server/jobs/subscriptionJobs.js`](../server/jobs/subscriptionJobs.js)).

Whenever the backend introduces, renames, or removes a free-tier plan slug, update the `FREE_PLAN_SLUGS` export so the client continues to recognize tokens from that tier correctly.
