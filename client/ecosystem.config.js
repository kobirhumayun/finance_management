// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: "next-app",
            script: "node_modules/next/dist/bin/next",
            args: "start -p 3000",
            instances: "max",                  // or a specific number
            exec_mode: "cluster",              // PM2 forks multiple Node processes
            wait_ready: false,
            listen_timeout: 10000,
            kill_timeout: 5000,
            max_memory_restart: "512M",
            env: {
                NODE_ENV: "production",
                NEXTAUTH_SECRET: "REPLACE_ME",
                AUTH_BACKEND_URL: "https://your-express.example.com",
                AUTH_REFRESH_PATH: "/api/auth/refresh",
                REDIS_URL: "redis://127.0.0.1:6379", // use rediss:// for TLS
                AUTH_REDIS_PREFIX: "auth:v1",
                AUTH_KEY_SALT: "REPLACE_ME"
            }
        }
    ]
};