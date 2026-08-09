const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
const ejsMate = require('ejs-mate');
require('dotenv').config();

const connectDB = require('./config/database');
const routes = require('./routes');
const { seedInitialData } = require('./config/seed');
const SiteSettings = require('./models/SiteSettings');
const { archiveOverdueBookings } = require('./services/bookingLifecycle');
const { syncActiveFlights } = require('./services/flightTracker');

const app = express();
const PORT = process.env.PORT || 3000;
const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/SaiGonPhoenix';

// Render terminates HTTPS at its reverse proxy. Trust the first proxy so
// secure session cookies are issued correctly in production.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl, collectionName: 'sessions' }),
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(flash());
app.use((req, res, next) => {
    res.locals.flash = req.flash();
    res.locals.session = req.session;
    res.locals.currentPath = req.path;
    res.locals.title = 'SaiGonPhoenix';
    next();
});
app.use(async (req, res, next) => {
    const fallbackZaloPhone = process.env.ZALO_PHONE || '';
    res.locals.supportContact = {
        hotline: process.env.HOTLINE || '0900 000 000',
        zaloPhone: fallbackZaloPhone,
        zaloUrl: process.env.ZALO_OA_URL || (fallbackZaloPhone ? `https://zalo.me/${fallbackZaloPhone.replace(/\D/g, '')}` : '#'),
        supportHours: 'Hỗ trợ 24/7', wechat: '', whatsapp: '', facebook: '', tiktok: '', line: '', viber: '', x: '', instagram: '', telegram: ''
    };
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
            x: settings?.x || '', instagram: settings?.instagram || '', telegram: settings?.telegram || ''
            ,autoReplyEnabled: settings?.autoReplyEnabled !== false
            ,autoReplyTemplates: settings?.autoReplyTemplates || SiteSettings.defaultAutoReplyTemplates
        };
        next();
    } catch (error) { next(error); }
});

app.use('/', routes);
app.use((req, res) => res.status(404).render('404', { title: 'Không tìm thấy trang' }));
app.use((err, req, res, next) => {
    console.error(err);
    if (req.path.startsWith('/api/') || req.path.startsWith('/chat-media/')) return res.status(err.status || 500).json({ error: err.message || 'Có lỗi xảy ra.' });
    res.status(err.status || 500).render('error', { title: 'Có lỗi xảy ra', error: process.env.NODE_ENV === 'production' ? null : err });
});

async function start() {
    await connectDB();
    await seedInitialData();
    app.listen(PORT, () => console.log(`SaiGonPhoenix: http://localhost:${PORT}`));
    const maintenanceMinutes = Math.max(Number(process.env.MAINTENANCE_INTERVAL_MINUTES || 10), 2);
    const runMaintenance = async () => {
        try { await archiveOverdueBookings(); await syncActiveFlights(); }
        catch (error) { console.error('Tác vụ nền:', error.message); }
    };
    runMaintenance();
    setInterval(runMaintenance, maintenanceMinutes * 60 * 1000).unref();
}

if (require.main === module) start().catch(error => { console.error(error); process.exit(1); });
module.exports = app;
