// Isolated local integration tests. Never use or clear the application's database.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const mongoose = require('mongoose');
const { JSDOM } = require('jsdom');
const databaseName = `sgp_calendar_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${databaseName}`;
process.env.NODE_ENV = 'test';
const app = require('../server');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = request.agent(app), other = request.agent(app), admin = request.agent(app);
    const password = crypto.randomBytes(18).toString('hex');
    const registration = await user.post('/register').type('form').send({ username: 'Calendar Test', email: 'calendar-test@example.test', phone: '0900000000', password, confirmPassword: password });
    check(registration.status, 302, 'Registration still supports server-rendered forms');
    await User.create({ username: 'Other user', email: 'other@example.test', phone: '0900000001', password });
    await User.create({ username: 'Admin test', email: 'admin-test@example.test', phone: '0900000002', password, role: 'admin' });
    check((await user.post('/login').type('form').send({ email: 'calendar-test@example.test', password: 'incorrect' })).status, 401, 'Wrong password rejected');
    await user.get('/login?next=/calendar');
    const login = await user.post('/login').type('form').send({ email: 'calendar-test@example.test', password });
    check(login.headers.location, '/calendar', 'Login returns to calendar');
    await other.post('/login').type('form').send({ email: 'other@example.test', password });
    await admin.post('/login').type('form').send({ email: 'admin-test@example.test', password });
    for (const url of ['/', '/calendar', '/booking', '/dashboard', '/profile', '/reviews', '/about']) check((await user.get(url)).status, 200, `${url} renders`);
    check((await admin.get('/admin')).status, 200, 'Admin still works');
    check((await user.get('/admin')).status, 403, 'User cannot access admin');
    check((await request(app).get('/calendar')).text.includes('data-authenticated="false"'), true, 'Guest sees sign-in page');
    check((await request(app).get('/api/calendar/events')).status, 401, 'Calendar API requires login');
    const page = await user.get('/calendar'), otherPage = await other.get('/calendar');
    const token = page.text.match(/data-token="([a-f\d]+)"/)[1], otherToken = otherPage.text.match(/data-token="([a-f\d]+)"/)[1];
    const event = { title: 'Đón gia đình <script>alert(1)</script>', notes: 'Ghi chú riêng tư: không dịch.', location: 'Tân Sơn Nhất', startsAt: '2026-10-23T09:00:00+07:00', endsAt: '2026-10-23T10:00:00+07:00', allDay: false, category: 'travel' };
    const range = '?start=2026-10-01T00:00:00%2B07:00&end=2026-11-01T00:00:00%2B07:00';
    check((await user.post('/api/calendar/events').send(event)).status, 403, 'Mutations require CSRF token');
    check((await user.post('/api/calendar/events').set('X-Calendar-Token', otherToken).send(event)).status, 403, 'Another account token rejected');
    const created = await user.post('/api/calendar/events').set('X-Calendar-Token', token).send({ ...event, owner: '000000000000000000000000' });
    check(created.status, 201, 'Create event');
    const id = created.body.event._id;
    check(created.body.event.startsAt, '2026-10-23T02:00:00.000Z', 'Vietnam time stored accurately');
    check(created.body.event.owner, String((await User.findOne({ email: 'calendar-test@example.test' }))._id), 'Cannot override ownership');
    check((await user.get('/api/calendar/events' + range)).body.events.length, 1, 'Event persists and lists');
    check((await other.get('/api/calendar/events' + range)).body.events.length, 0, 'Other users cannot see notes');
    check((await other.put(`/api/calendar/events/${id}`).set('X-Calendar-Token', otherToken).send(event)).status, 404, 'Other users cannot edit');
    check((await other.delete(`/api/calendar/events/${id}`).set('X-Calendar-Token', otherToken)).status, 404, 'Other users cannot delete');
    for (const changes of [{ title: '' }, { title: 'x'.repeat(121) }, { notes: 'x'.repeat(3001) }, { startsAt: '2026-02-30T09:00:00+07:00' }, { endsAt: event.startsAt }, { endsAt: '2028-10-23T10:00:00+07:00' }, { category: 'invalid' }, { allDay: 'true' }, { allDay: true }]) {
        check((await user.post('/api/calendar/events').set('X-Calendar-Token', token).send({ ...event, ...changes })).status, 400, 'Invalid input rejected');
    }
    check((await user.get('/api/calendar/events?start=invalid&end=invalid')).status, 400, 'Invalid ranges rejected');
    check((await user.get('/api/calendar/events?start=2026-01-01T00:00:00Z&end=2027-01-01T00:00:00Z')).status, 400, 'Oversized ranges rejected');
    check((await user.post('/api/calendar/events').set('X-Calendar-Token', token).send({ ...event, startsAt: '2026-10-23T24:00:00+07:00' })).status, 400, '24:00 is not accepted as a local input time');
    check((await user.get('/api/calendar/events?start=1999-12-27T00:00:00%2B07:00&end=2000-02-07T00:00:00%2B07:00')).status, 200, 'First supported month includes previous-year grid cells');
    const firstDay = await user.post('/api/calendar/events').set('X-Calendar-Token', token).send({ ...event, startsAt: '1999-12-31T17:00:00Z', endsAt: '1999-12-31T18:00:00Z' });
    check(firstDay.status, 201, 'First supported Vietnam date accepts its UTC equivalent');
    await user.delete(`/api/calendar/events/${firstDay.body.event._id}`).set('X-Calendar-Token', token);
    const allDay = { ...event, title: 'Nghỉ cuối tuần', startsAt: '2026-10-31T00:00:00+07:00', endsAt: '2026-11-03T00:00:00+07:00', allDay: true, category: 'personal' };
    const updated = await user.put(`/api/calendar/events/${id}`).set('X-Calendar-Token', token).send(allDay);
    check(updated.status, 200, 'Update event to multiday all-day');
    check((await user.get('/api/calendar/events?start=2026-11-01T00:00:00%2B07:00&end=2026-12-01T00:00:00%2B07:00')).body.events.length, 1, 'Overlapping multiday events appear next month');
    check((await user.get('/api/calendar/events?start=2026-11-03T00:00:00%2B07:00&end=2026-12-01T00:00:00%2B07:00')).body.events.length, 0, 'Exclusive end date respected');
    check((await user.delete(`/api/calendar/events/${id}`).set('X-Calendar-Token', token)).status, 200, 'Delete own event');
    check(await CalendarEvent.countDocuments(), 0, 'Deletion persisted');
    check((await user.delete('/api/calendar/events/not-an-id').set('X-Calendar-Token', token)).status, 400, 'Invalid ID rejected');
    await testDom(page.text);
    await testHomeDom((await user.get('/')).text);
    await user.post('/logout');
    check((await user.get('/api/calendar/events' + range)).status, 401, 'Logout invalidates session');
    console.log(`PASS: ${checks} calendar, auth, privacy, rendering and localization checks.`);
}

const tick = () => new Promise(resolve => setTimeout(resolve, 30));
async function makeDom(html) {
    // No external scripts/resources/network. This exercises DOM logic, not a browser preview.
    const dom = new JSDOM(html, { url: 'https://test.invalid/calendar', runScripts: 'outside-only' });
    await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
    const { window } = dom;
    window.CSS = { escape: value => value };
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
    window.HTMLElement.prototype.scrollIntoView = () => {};
    return dom;
}
const evalFile = (window, file) => window.eval(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', file), 'utf8'));
async function testDom(html) {
    const dom = await makeDom(html), { window: w } = dom, d = w.document;
    let stored = [], requests = [], unavailable = false;
    w.fetch = async (url, options = {}) => {
        requests.push({ url, options });
        if (unavailable) return { ok: false, status: 500, json: async () => ({}) };
        if (options.method === 'POST' || options.method === 'PUT') {
            const event = { ...JSON.parse(options.body), _id: '0123456789abcdef01234567' }; stored = [event]; return { ok: true, json: async () => ({ event }) };
        }
        if (options.method === 'DELETE') { stored = []; return { ok: true, json: async () => ({ deleted: true }) }; }
        return { ok: true, json: async () => ({ events: stored }) };
    };
    evalFile(w, 'locale-refinements.js'); evalFile(w, 'localization.js'); evalFile(w, 'calendar.js');
    d.dispatchEvent(new w.Event('DOMContentLoaded')); await tick();
    check(d.querySelectorAll('.planner-cell').length, 42, 'Month renders 42 cells');
    check(d.querySelectorAll('.planner-day-number.today').length, 1, 'Today highlighted');
    d.querySelector('[data-new-event]').click();
    const form = d.querySelector('[data-event-form]'), f = name => form.elements.namedItem(name);
    check(d.querySelector('dialog').open, true, 'Create opens editor');
    const date = f('startsAt').value.slice(0, 10);
    f('title').value = '<img src=x onerror=alert(1)> Gia đình'; f('notes').value = 'Ghi chú riêng tư'; f('location').value = 'Tân Sơn Nhất';
    f('endsAt').value = `${date}T08:00`; form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
    check(d.querySelector('[data-form-error]').textContent.length > 0, true, 'Invalid times shown in form');
    check(stored.length, 0, 'Invalid event never submitted');
    f('endsAt').value = `${date}T10:00`; form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
    check(stored.length, 1, 'Create saves event');
    check(d.querySelector('dialog').open, false, 'Successful save closes editor');
    check(d.querySelectorAll('.planner-event img').length, 0, 'Titles render as text, never HTML');
    check(d.querySelector('.planner-event strong').textContent, stored[0].title, 'Title is preserved');
    d.querySelector('[data-view="agenda"]').click(); check(d.querySelector('[data-calendar-agenda]').hidden, false, 'Agenda view works');
    const search = d.querySelector('[data-calendar-search]'); search.value = 'absent'; search.dispatchEvent(new w.Event('input'));
    check(d.querySelectorAll('.planner-agenda-day').length, 0, 'Search filters events'); search.value = ''; search.dispatchEvent(new w.Event('input'));
    const category = d.querySelector('[data-category-filter="personal"]'); category.click(); check(d.querySelectorAll('.planner-event').length, 0, 'Category filter works'); category.click();
    const select = d.querySelector('[data-language-select]'); select.value = 'en'; select.dispatchEvent(new w.Event('change')); await tick();
    check(d.querySelector('[data-i18n="calendar"]').textContent, 'My calendar', 'English navigation uses editorial copy');
    check(d.querySelector('.planner-event strong').textContent, stored[0].title, 'Language switching preserves personal titles');
    d.querySelector('.planner-event').click(); check(f('notes').value, 'Ghi chú riêng tư', 'Notes survive language changes');
    const url = new URL(d.querySelector('[data-google-link]').href);
    check(url.hostname, 'calendar.google.com', 'Export opens Google Calendar'); check(url.searchParams.get('ctz'), 'Asia/Ho_Chi_Minh', 'Export uses Vietnam timezone');
    f('allDay').click(); check(f('startsAt').type, 'date', 'All-day mode uses date fields');
    f('startsAt').value = date; f('endsAt').value = date; form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
    check(new Date(stored[0].endsAt) - new Date(stored[0].startsAt), 86400000, 'Single all-day event lasts one day');
    d.querySelector('.planner-event').click(); check(f('endsAt').value, date, 'Inclusive end restored in editor');
    check(new URL(d.querySelector('[data-google-link]').href).searchParams.get('dates').length, 17, 'All-day export uses date format');
    d.querySelector('[data-delete-event]').click(); check(d.querySelector('[data-delete-confirm]').hidden, false, 'Deletion needs confirmation');
    d.querySelector('[data-confirm-delete]').click(); await tick(); check(stored.length, 0, 'Confirmed delete removes event');
    check(requests.filter(r => r.url.includes('/localization/')).length, 0, 'Vietnamese/English calendar needs no machine translation calls');
    unavailable = true; d.querySelector('[data-next-month]').click(); await tick(); check(d.querySelector('[data-calendar-status]').classList.contains('is-error'), true, 'Load failure is visible');
    unavailable = false; d.querySelector('[data-calendar-status] button').click(); await tick(); check(d.querySelector('[data-calendar-status]').classList.contains('is-error'), false, 'Retry recovers');
    dom.window.close();
}
async function testHomeDom(html) {
    const dom = await makeDom(html), { window: w } = dom, d = w.document;
    let calls = 0; w.fetch = async () => { calls++; return { ok: true, json: async () => ({ translations: [] }) }; };
    evalFile(w, 'locale-refinements.js'); evalFile(w, 'localization.js'); d.dispatchEvent(new w.Event('DOMContentLoaded'));
    const select = d.querySelector('[data-language-select]'); select.value = 'en'; select.dispatchEvent(new w.Event('change')); await tick();
    const airport = d.querySelector('[data-i18n="airport_SGN"]');
    check(airport.textContent, 'Tan Son Nhat Airport (SGN)', 'Airport name translated correctly');
    check(airport.value, 'Sân bay Tân Sơn Nhất (SGN)', 'Translated option keeps backend value');
    select.value = 'vi'; select.dispatchEvent(new w.Event('change')); check(airport.textContent, 'Sân bay Tân Sơn Nhất (SGN)', 'Vietnamese restored');
    check(calls, 0, 'Core homepage copy does not call translation provider');
    dom.window.close();
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === databaseName && databaseName.startsWith('sgp_calendar_test_')) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
});
