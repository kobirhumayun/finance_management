const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createCorsOriginEvaluator } = require('./config/cors');
const connectDB = require('./config/database');
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/authRoutes');
const planRoutes = require('./routes/plan');
const orderRoutes = require('./routes/order');
const invoiceRoutes = require('./routes/invoice');
const adminUserRoutes = require('./routes/adminUsers');
const projectRoutes = require('./routes/project');
const reportRoutes = require('./routes/report');
const ticketRoutes = require('./routes/ticket');
const { initializeEnforcer } = require('./services/casbin');
const { shutdownPdfQueue } = require('./services/pdfQueue');
const { scheduleSubscriptionExpiryCheck } = require('./jobs/subscriptionJobs');
const { scheduleStaleTicketScan } = require('./jobs/ticketJobs');
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./middleware/errorHandler');
const morgan = require('morgan');
const port = process.env.PORT || 5000;

const app = express();
// Secure HTTP headers
app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                "default-src": ["'self'"],
                "img-src": ["'self'", "https:", "data:", "blob:"],
                "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                "style-src": ["'self'", "https:", "'unsafe-inline'"],
                "font-src": ["'self'", "https:", "data:"],
                "object-src": ["'self'"], // Allowed for PDF viewer
                "frame-src": ["'self'"], // Allowed for iframes
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

// Middleware
app.use(
    cors({
        origin: createCorsOriginEvaluator(),
        methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Cache-Control",
            "Expires",
            "Pragma",
        ],
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Routes
app.get('/', (req, res) => {
    res.send('Backend is running!');
});

app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tickets', ticketRoutes);


// Handle 404 Not Found for any routes not matched above
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handling Middleware (MUST BE LAST)
app.use(globalErrorHandler);

// --- Start Server Function ---
const startServer = async () => {
    try {
        // 1. Connect to Database (and wait for it)
        await connectDB();
        await initializeEnforcer();
        console.log('Authorization enforcer initialized');
        scheduleSubscriptionExpiryCheck();
        scheduleStaleTicketScan();

        // 2. Start Listening for Requests
        const server = app.listen(port, () => {
            console.log(`Server is running on port: ${port}`);
        });

    } catch (error) {
        // Catch errors during initial startup (e.g., DB connection failure handled in connectDB)
        console.error('Failed to start server:', error);
        process.exit(1); // Exit if server cannot start
    }
};

['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.once(signal, () => {
        shutdownPdfQueue().finally(() => process.exit(0));
    });
});

// --- Initialize Server ---
startServer();
