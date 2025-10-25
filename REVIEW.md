# Repository Review

## Backend

### Strengths
- Comprehensive request validation for auth and user profile flows using shared validator utilities, which helps reject malformed payloads early before they reach the controllers. 【F:server/routes/user.js†L27-L101】【F:server/validators/validatorsIndex.js†L1-L63】
- Token lifecycle management covers generation, rotation, and short-lived grace periods to handle refresh-token race conditions, reducing replay risks during concurrent requests. 【F:server/controllers/user.js†L227-L344】【F:server/models/UsedRefreshToken.js†L1-L26】

### Risks & Opportunities
1. CORS is locked to `http://localhost:3000`, which will block legitimate clients in other environments and forces credentialed browsers to share cookies with an origin that might not match production domains. Externalizing this to configuration (or reflecting the request origin against an allow‑list) would make deployments safer and more flexible. 【F:server/server.js†L29-L42】
2. Outbound email is hard-wired to Gmail's SMTP service with username/password credentials. This approach won't scale well, and failing to disable `rejectUnauthorized` could expose credentials on compromised networks. Moving transport details to configuration and supporting API-key based providers (SendGrid, SES, etc.) would be more resilient. 【F:server/services/emailService.js†L1-L29】
3. The cron job that normalizes expired subscriptions runs unconditionally on every instance. In a horizontally scaled environment the duplicated work can thrash the database. Consider protecting the schedule with a leader election or moving it to an external worker. 【F:server/jobs/subscriptionJobs.js†L1-L69】

## Frontend

### Strengths
- The NextAuth credentials provider is wrapped with redis-backed single-flight refresh logic, preventing stampedes when many tabs attempt to rotate the same refresh token. 【F:client/src/auth.js†L43-L172】
- The API proxy enforces authenticated access server-side, strips hop-by-hop headers, and mirrors only a safe subset of upstream headers back to the browser, which reduces header-based attack surface. 【F:client/src/app/api/proxy/[...path]/route.js†L1-L87】

### Risks & Opportunities
1. The proxy's preflight response uses a permissive `Access-Control-Allow-Origin: *`, but the authenticated routes omit matching CORS headers. Browsers making cross-origin calls straight to `/api/proxy/*` will pass the preflight yet fail the actual request. Aligning the simple/actual responses or tightening the preflight policy will avoid confusing integration failures. 【F:client/src/app/api/proxy/[...path]/route.js†L88-L106】
2. Middleware guards treat any token with a plan string containing `"free"` as a free-tier user, even if the backend assigns semantic slugs such as `free-trial` or `freemium-plus`. Normalizing against explicit values from the backend would avoid accidentally gating paid plans. 【F:client/src/middleware.js†L11-L40】
3. Registration and password-reset relays duplicate JSON parsing and timeout handling; factoring them into a shared helper (or reusing the proxy with relaxed auth) would reduce maintenance overhead. 【F:client/src/app/api/register/route.js†L1-L36】【F:client/src/app/api/password-reset/_relay.js†L1-L36】

## General Suggestions
- Add health checks and readiness endpoints to both services so orchestration platforms can manage rollouts safely.
- Introduce automated tests (unit/integration) around token refresh and reporting queries; these are complex enough that regressions are easy to introduce.
- Document required environment variables (MongoDB URI, JWT secrets, email/redis settings) centrally for quicker onboarding.
