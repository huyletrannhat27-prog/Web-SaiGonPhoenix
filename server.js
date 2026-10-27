const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
const ejsMate = require('ejs-mate');
const { databaseErrorMessage } = require('./config/runtime');
const mongoose = require('mongoose');

const connectDB = require('./config/database');
const routes = require('./routes');
const { seedInitialData } = require('./config/seed');
const SiteSettings = require('./models/SiteSettings');
const { archiveOverdueBookings } = require('./services/bookingLifecycle');
const { syncActiveFlights } = require('./services/flightTracker');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for Next.js Frontend
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Keep EJS for Admin/Internal legacy views if needed, but we move towards API
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/healthz', (req, res) => {
    const ready = mongoose.connection.readyState === 1 && app.locals.startupReady !== false;
    res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
});
app.use(express.static(path.join(__dirname, 'public')));

// Reuse the connected Mongoose client. Never start a second, unawaited DNS
// connection at module load (connect-mongo's mongoUrl option does that).
let sessionMiddlewarePromise;
function initializeSession() {
    if (!sessionMiddlewarePromise) {
        sessionMiddlewarePromise = (async () => {
            await mongoose.connection.db.collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
            const store = MongoStore.create({ client: mongoose.connection.getClient(), dbName: mongoose.connection.name, collectionName: 'sessions', autoRemove: 'disabled' });
            store.on('error', error => console.error(databaseErrorMessage(error)));
            return session({
                secret: process.env.SESSION_SECRET || 'change-this-secret',
                resave: false,
                saveUninitialized: false,
                store,
                cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
            });
        })().catch(error => { sessionMiddlewarePromise = null; throw error; });
    }
    return sessionMiddlewarePromise;
}
app.use((req, res, next) => {
    if (mongoose.connection.readyState !== 1 || app.locals.startupReady === false) {
        res.set('Retry-After', '10');
        return res.status(503).send('Dịch vụ đang kết nối cơ sở dữ liệu. Vui lòng thử lại sau.');
    }
    initializeSession().then(middleware => middleware(req, res, next)).catch(next);
});
app.use(flash());
app.use((req, res, next) => {
    res.locals.flash = req.flash();
    res.locals.session = req.session;
    res.locals.currentPath = req.path;
    res.locals.title = 'SaiGonPhoenix';
    res.locals.supportContact = { hotline: '0900 000 000', supportHours: 'Hỗ trợ 24/7', zaloUrl: '#' };
    next();
});

// Global support contact middleware
app.use(async (req, res, next) => {
    try {
        const settings = await SiteSettings.findOne({ key: 'support-contact' }).lean();
        const zaloPhone = settings?.zaloPhone || process.env.ZALO_PHONE || '';
        res.locals.supportContact = {
            hotline: settings?.hotline || process.env.HOTLINE || '0900 000 000',
            zaloPhone,
            zaloUrl: settings?.zaloUrl || process.env.ZALO_OA_URL || (zaloPhone ? `https://zalo.me/${zaloPhone.replace(/\D/g, '')}` : '#'),
            supportHours: settings?.supportHours || 'Hỗ trợ 24/7',
            wechat: settings?.wechat || '', whatsapp: settings?.whatsapp || '', facebook: settings?.facebook || '',
            tiktok: settings?.tiktok || '', line: settings?.line || '', viber: settings?.viber || '',
            x: settings?.x || '', instagram: settings?.instagram || '', telegram: settings?.telegram || '',
            autoReplyEnabled: settings?.autoReplyEnabled !== false,
            autoReplyTemplates: settings?.autoReplyTemplates || SiteSettings.defaultAutoReplyTemplates
        };
        next();
    } catch (error) { next(error); }
});

// Routes
app.use('/', routes);
app.use((req, res) => req.path.startsWith('/api/')
    ? res.status(404).json({ error: 'Không tìm thấy tài nguyên.' })
    : res.status(404).render('404', { title: 'Không tìm thấy trang' }));

// API-first Error Handling
app.use((err, req, res, next) => {
    console.error(err);
    // If request is API or from Frontend, always return JSON
    if (req.path.startsWith('/api/') || req.headers['accept'] === 'application/json' || req.path.startsWith('/chat-media/')) {
        return res.status(err.status || 500).json({
            error: err.message || 'Có lỗi xảy ra trong hệ thống.',
            status: err.status || 500
        });
    }
    res.status(err.status || 500).render('error', { title: 'Có lỗi xảy ra', error: process.env.NODE_ENV === 'production' ? null : err });
});

async function start() {
    app.locals.startupReady = false;
    const server = await new Promise((resolve, reject) => {
        const listener = app.listen(PORT, '0.0.0.0', () => {
            console.log(`HTTP listening on 0.0.0.0:${listener.address().port}; waiting for MongoDB.`);
            resolve(listener);
        });
        listener.once('error', reject);
    });
    try {
        await connectDB();
        await initializeSession();
        await seedInitialData();
        app.locals.startupReady = true;
        console.log('SaiGonPhoenix ready. Health check: /healthz');
    } catch (error) {
        server.close();
        await mongoose.disconnect().catch(() => {});
        throw error;
    }

    const maintenanceMinutes = Math.max(Number(process.env.MAINTENANCE_INTERVAL_MINUTES || 10), 2);
    const runMaintenance = async () => {
        try { await archiveOverdueBookings(); await syncActiveFlights(); }
        catch (error) { console.error('Tác vụ nền:', error.message); }
    };
    runMaintenance();
    const maintenanceTimer = setInterval(runMaintenance, maintenanceMinutes * 60 * 1000);
    maintenanceTimer.unref();
    server.once('close', () => clearInterval(maintenanceTimer));
    return server;
}

if (require.main === module) start().catch(error => {
    console.error(`Startup failed: ${error.code === 'EADDRINUSE' ? 'Cổng HTTP đang được sử dụng.' : databaseErrorMessage(error)}`);
    process.exit(1);
});
module.exports = app;
module.exports.start = start;
