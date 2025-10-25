# Deployment Guide

## Email transport configuration

The server email service now uses a configurable transport factory that supports both SMTP credentials and API-key-based providers. Configure the transport by defining the following environment variables in your deployment:

| Variable | Required | Description |
| --- | --- | --- |
| `EMAIL_PROVIDER` | Yes | Name of the email provider. Use `smtp` for traditional SMTP servers or a provider identifier (e.g. `sendgrid`) when authenticating with an API key. |
| `EMAIL_HOST` | SMTP only | Hostname of the SMTP or API gateway. Optional for API-based providers that expose a service integration. |
| `EMAIL_PORT` | SMTP only | Port number for the SMTP/API gateway. Optional for API-based providers when the SDK manages the connection. |
| `EMAIL_USER` | SMTP, optional for API | Username for SMTP authentication. Also used as the API username when `EMAIL_API_USER` is not provided. |
| `EMAIL_PASS` | SMTP only | Password for SMTP authentication. |
| `EMAIL_API_KEY` | API providers | API key or token used by non-SMTP providers. |
| `EMAIL_API_USER` | API providers | Optional override for the username used with the API key (defaults to `EMAIL_USER` or `apikey`). |
| `EMAIL_SERVICE` | Optional | Overrides the Nodemailer `service` value for API providers. |
| `EMAIL_FROM` | Yes | Default sender email address used when dispatching messages. |
| `EMAIL_SECURE` | Optional | Set to `true` to force a secure (TLS) connection. |
| `EMAIL_REQUIRE_TLS` | Optional | Set to `true` to require TLS even if the server does not advertise STARTTLS. |
| `EMAIL_TLS_REJECT_UNAUTHORIZED` | Optional | Set to `false` to allow self-signed certificates (defaults to rejecting unauthorized certificates). |
| `EMAIL_TLS_MIN_VERSION` | Optional | Minimum TLS version to use when connecting. |
| `EMAIL_TLS_CIPHERS` | Optional | Comma-delimited list of TLS ciphers. |

### Migrating from the legacy Gmail configuration

Previous deployments relied on Gmail-specific credentials (`EMAIL_USER`/`EMAIL_PASS`) defined directly in `emailService.js`. To migrate:

1. Add `EMAIL_PROVIDER=smtp` to your environment.
2. Specify the SMTP host and port that Gmail (or your new provider) exposes, for example `EMAIL_HOST=smtp.gmail.com` and `EMAIL_PORT=465`.
3. Keep the existing `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_FROM` values.
4. For providers that require TLS tweaks (self-signed certs, minimum TLS version), provide the optional TLS variables listed above.

To integrate with an API-key-based provider (e.g. SendGrid):

1. Set `EMAIL_PROVIDER=sendgrid` (or the provider identifier your Nodemailer integration expects).
2. Provide the API token via `EMAIL_API_KEY` and optionally set `EMAIL_API_USER` if the provider requires a specific username (default is `apikey`).
3. Remove any unused SMTP password (`EMAIL_PASS`) if it is no longer necessary.
4. Configure `EMAIL_FROM` to the verified sender identity in your provider.
5. Add any provider-specific host or port values if required.

Apply these changes to your environment configuration files (`.env`, Docker secrets, CI/CD variables, etc.) before deploying the updated server.
