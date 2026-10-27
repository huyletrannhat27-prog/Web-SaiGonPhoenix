const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const dbName = `sgp_startup_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${dbName}`;
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
const app = require('../server');
const { databaseErrorMessage, mongoUri } = require('../config/runtime');
let checks = 0;
function check(value, expected, label) { assert.deepEqual(value, expected, label); checks++; }
function child(source, overrides) {
    return new Promise((resolve, reject) => {
        const processChild = spawn(process.execPath, ['--unhandled-rejections=strict', '-e', source], {
            cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, ...overrides }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
        });
        let out = '';
        processChild.stdout.on('data', chunk => { out += chunk; }); processChild.stderr.on('data', chunk => { out += chunk; });
        const timeout = setTimeout(() => { processChild.kill(); reject(new Error('Startup test timed out')); }, 20000);
        processChild.on('error', error => { clearTimeout(timeout); reject(error); });
        processChild.on('exit', code => { clearTimeout(timeout); resolve({ code, out }); });
    });
}
let server;
async function main() {
    check((await request(app).get('/healthz')).status, 503, 'Health check fails before database is connected');
    check((await request(app).get('/')).status, 503, 'Requests do not hang while database is unavailable');
    check(databaseErrorMessage({ code: 'ENOTFOUND', message: 'mongodb+srv://user:PRIVATE_PASSWORD@missing.test' }).includes('PRIVATE_PASSWORD'), false, 'DNS diagnostic never includes credentials');
    check(databaseErrorMessage({ code: 'ENOTFOUND' }).includes('DNS SRV'), true, 'DNS failure explained');
    check(databaseErrorMessage({ code: 18 }).includes('đăng nhập'), true, 'Authentication failure distinguished from DNS');
    const original = process.env.MONGODB_URI;
    process.env.MONGODB_URI = 'mongodb+srv://user:<password>@example.test';
    assert.throws(mongoUri, { code: 'MONGODB_CONFIG' }); checks++;
    process.env.MONGODB_URI = original;
    const importOnly = await child("require('./server'); setTimeout(() => { console.log('IMPORT_OK'); process.exit(0); }, 50)", { MONGODB_URI: 'mongodb+srv://user:PRIVATE_PASSWORD@cluster.missing.invalid/test' });
    check(importOnly.code, 0, 'Import no longer starts connect-mongo DNS connection');
    check(importOnly.out.includes('IMPORT_OK'), true, 'Import completes without unhandled rejection');
    const missingEnv = await child("require('./server').start().catch(e=>{console.log(e.code);process.exit(1)})", { NODE_ENV: 'production', MONGODB_URI: '' });
    check(missingEnv.code, 1, 'Production rejects missing database env');
    check(missingEnv.out.includes('MONGODB_CONFIG'), true, 'Production never falls back to tracked local .env');
    const badDns = await child(`
        require('dns').promises.resolveSrv = async () => { const error = new Error('querySrv ENOTFOUND'); error.code = 'ENOTFOUND'; throw error; };
        const { databaseErrorMessage } = require('./config/runtime');
        require('./server').start().then(() => process.exit(2)).catch(error => { console.log('HANDLED:', databaseErrorMessage(error)); process.exit(1); });
    `, { NODE_ENV: 'production', MONGODB_URI: 'mongodb+srv://user:PRIVATE_PASSWORD@cluster.missing.invalid/test' });
    check(badDns.code, 1, 'DNS failure exits as a controlled startup error');
    check(badDns.out.includes('HANDLED:'), true, 'Startup catch receives DNS error');
    check(badDns.out.includes('DNS SRV'), true, 'DNS troubleshooting advice logged');
    check(badDns.out.includes('PRIVATE_PASSWORD'), false, 'Startup does not leak URI password');
    server = await app.start();
    check(server.address().address, '0.0.0.0', 'Render can reach bound HTTP port');
    check((await request(app).get('/healthz')).status, 200, 'Health check ready after startup');
    check((await request(app).get('/')).status, 200, 'Homepage renders after successful startup');
    const indexes = await mongoose.connection.db.collection('sessions').indexes();
    check(indexes.some(index => index.key.expires === 1 && index.expireAfterSeconds === 0), true, 'Session expiration TTL retained');
    app.locals.startupReady = false;
    check((await request(app).get('/healthz')).status, 503, 'Readiness prevents false positive before initialization');
    app.locals.startupReady = true;
    await mongoose.disconnect();
    check((await request(app).get('/healthz')).status, 503, 'Readiness fails when DB connection is lost');
    check((await request(app).get('/')).status, 503, 'DB outage returns unavailable instead of buffered requests');
    console.log(`PASS: ${checks} deployment startup and readiness checks.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (dbName.startsWith('sgp_startup_test_')) {
        if (mongoose.connection.readyState !== 1) await mongoose.connect(process.env.MONGODB_URI);
        if (mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect(); process.exit(process.exitCode || 0);
});
