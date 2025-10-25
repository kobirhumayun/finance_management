# Backend Setup

## Environment Variables

Create a `.env` file in this directory using [`.env.example`](./.env.example) as a template. Key variables include:

- `MONGO_URI`: MongoDB connection string.
- `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET`: Secrets used for signing JWTs.
- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`: Credentials and sender information for transactional emails.
- `OTP_EXPIRY_MINUTES`: Minutes before OTP codes expire.
- `ADMIN_RECENT_LOGIN_LIMIT`: Number of recent admin logins to persist.
- `DEFAULT_PASSWORD_RESET_REDIRECT`: Frontend URL that receives password reset requests.
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for API calls. When unset, the server allows `http://localhost:3000` for development.

Update the values to match your environment before starting the server.
