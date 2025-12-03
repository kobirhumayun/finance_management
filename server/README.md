# Backend Setup

## Environment Variables

Create a `.env` file in this directory using [`.env.example`](./.env.example) as a template. Key variables include:

- `MONGO_URI`: MongoDB connection string without the database component (host + credentials + query string).
- `MONGO_DB` / `MONGO_DATABASE`: Database name to append to `MONGO_URI` at runtime.
- `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET`: Secrets used for signing JWTs.
- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`: Credentials and sender information for transactional emails.
- `OTP_EXPIRY_MINUTES`: Minutes before OTP codes expire.
- `ADMIN_RECENT_LOGIN_LIMIT`: Number of recent admin logins to persist.
- `DEFAULT_PASSWORD_RESET_REDIRECT`: Frontend URL that receives password reset requests.
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for API calls. When unset, the server allows `http://localhost:3000` for development.

Update the values to match your environment before starting the server.

## Report summary exports

The summary report supports streaming exports in addition to the JSON API:

- `GET /api/reports/summary.pdf`
- `GET /api/reports/summary.xlsx`

Both endpoints reuse the same query parameters and validation rules as `GET /api/reports/summary`. Filters for project, type, search, date range, and pagination are subject to the caller's plan capabilities.

### PDF export

- **Response headers**: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="summary.pdf"`
- Streams a server-rendered HTML summary (totals, counts, project breakdown, and the filtered transaction list) through Playwright's headless Chromium print-to-PDF pipeline.
- Pagination cursors are ignored; all matching rows are fetched via a MongoDB cursor to ensure exports stay consistent with the on-screen filters.

### Excel export

- **Response headers**: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="summary.xlsx"`
- Uses `exceljs` `WorkbookWriter` to stream a workbook with three worksheets:
  1. `Summary` – totals and transaction counts.
  2. `By Project` – income/expense/balance grouped per project.
  3. `Transactions` – the full filtered transaction list.
- Exports are streamed directly to the response; avoid applying extremely broad filters on large datasets to keep memory pressure predictable.
