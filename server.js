/* ============================================================
   BudgetWise — Express Server Entry Point
   ============================================================ */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { initDatabase } = require('./server/config/db');
const { initDuo } = require('./server/config/duo');

// ─── Import Routes ───
const authRoutes = require('./server/routes/auth');
const transactionRoutes = require('./server/routes/transactions');
const budgetRoutes = require('./server/routes/budgets');
const categoryRoutes = require('./server/routes/categories');
const challengeRoutes = require('./server/routes/challenge');
const settingsRoutes = require('./server/routes/settings');
const chatRoutes = require('./server/routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — prevent abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many login attempts, please try again later.' }
});
app.use('/api/auth/', authLimiter);

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/chat', chatRoutes);

// ─── Block access to sensitive server files ───
app.use((req, res, next) => {
    const p = req.path.toLowerCase();
    if (p.startsWith('/server/') || p.startsWith('/data/') || p.startsWith('/node_modules/') ||
        p.startsWith('/sample_data/') || p.startsWith('/docs/') || p.startsWith('/.') ||
        p === '/server.js' || p === '/package.json' || p === '/package-lock.json' ||
        p.startsWith('/test_duo') || p === '/test_duo.js' || p === '/test_duo_error.js' ||
        p === '/test_duo_params.js') {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
});

// ─── Serve Static Frontend Files ───
app.use(express.static(path.join(__dirname, '.')));

// Fallback — serve index.html for any non-API route
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// ─── Start Server ───
async function start() {
    try {
        await initDatabase();
        console.log('✅ Database initialised');

        initDuo();

        app.listen(PORT, () => {
            console.log('');
            console.log('='.repeat(50));
            console.log(`  🚀 BudgetWise server running`);
            console.log(`  📍 http://localhost:${PORT}`);
            console.log(`  📍 http://localhost:${PORT}/login.html`);
            console.log('='.repeat(50));
            console.log('');
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        process.exit(1);
    }
}

start();

module.exports = app;
