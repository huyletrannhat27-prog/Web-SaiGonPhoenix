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

app.use('/', routes);
app.use((req, res) => res.status(404).render('404', { title: 'Không tìm thấy trang' }));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).render('error', { title: 'Có lỗi xảy ra', error: process.env.NODE_ENV === 'production' ? null : err });
});

async function start() {
    await connectDB();
    await seedInitialData();
    app.listen(PORT, () => console.log(`SaiGonPhoenix: http://localhost:${PORT}`));
}

if (require.main === module) start().catch(error => { console.error(error); process.exit(1); });
module.exports = app;
