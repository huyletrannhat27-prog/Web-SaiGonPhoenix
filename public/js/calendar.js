document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    const root = document.querySelector('[data-calendar]');
    if (!root || root.dataset.authenticated !== 'true') return;
    const $ = selector => root.querySelector(selector);
    const t = key => window.SGP_LOCALIZATION?.text(key) || key;
    const zone = 'Asia/Ho_Chi_Minh';
    const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
    const today = () => dayKey(new Date());
    const atNoon = day => new Date(`${day}T12:00:00+07:00`);
    const addDays = (day, amount) => dayKey(new Date(atNoon(day).getTime() + amount * 86400000));
    const monthStart = day => `${day.slice(0, 7)}-01`;
    const shiftMonth = (day, amount) => { const [y, m] = day.split('-').map(Number); return dayKey(new Date(Date.UTC(y, m - 1 + amount, 1, 5))); };
    const iso = value => new Date(`${value}+07:00`).toISOString();
    const inputTime = value => `${dayKey(value)}T${new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))}`;
    const format = (value, options) => new Intl.DateTimeFormat(document.documentElement.lang || 'vi', { timeZone: zone, ...options }).format(new Date(value));
    const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
    let month = monthStart(today()), selected = today(), view = 'month', events = [], loaded = false, loadError = false, requestVersion = 0, loading = false, saving = false;
    let lastFocus;
    const dialog = $('[data-event-dialog]'), form = $('[data-event-form]');
    const field = name => form.elements.namedItem(name);
    const activeCategories = () => [...root.querySelectorAll('[data-category-filter]:checked')].map(input => input.dataset.categoryFilter);
    const visible = () => { const categories = activeCategories(), query = $('[data-calendar-search]').value.trim().toLocaleLowerCase(); return events.filter(event => categories.includes(event.category) && `${event.title} ${event.location} ${event.notes}`.toLocaleLowerCase().includes(query)); };
    const onDay = (items, day) => items.filter(event => new Date(event.startsAt) < new Date(`${addDays(day, 1)}T00:00:00+07:00`) && new Date(event.endsAt) > new Date(`${day}T00:00:00+07:00`));
    const timeLabel = event => event.allDay ? t('cal_allday') : format(event.startsAt, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    function range() {
        const weekday = (atNoon(month).getUTCDay() + 6) % 7;
        const start = addDays(month, -weekday);
        return { start, end: addDays(start, 42) };
    }
    async function api(path = '', options = {}) {
        const response = await fetch(`/api/calendar/events${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Calendar-Token': root.dataset.token }, ...options });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(response.status === 401 ? t('cal_session_expired') : response.status === 403 ? t('cal_session_changed') : response.status === 404 ? t('cal_not_found') : response.status === 400 ? t('cal_invalid') : t('cal_request_failed'));
        return data;
    }
    function setStatus(message, error = false) {
        const status = $('[data-calendar-status]'); status.replaceChildren(); status.classList.toggle('is-error', error);
        status.append(el('span', '', message));
        if (error) { const retry = el('button', 'planner-button', t('cal_retry')); retry.type = 'button'; retry.addEventListener('click', load); status.append(retry); }
    }
    async function load() {
        const version = ++requestVersion, dates = range(); loading = true; loadError = false;
        setStatus(t('cal_loading')); $('[data-calendar-grid]').setAttribute('aria-busy', 'true');
        try {
            const params = new URLSearchParams({ start: iso(`${dates.start}T00:00`), end: iso(`${dates.end}T00:00`) });
            const data = await api(`?${params}`);
            if (version !== requestVersion) return;
            events = data.events; loaded = true; setStatus('');
        } catch (error) { if (version !== requestVersion) return; events = []; loaded = false; loadError = true; setStatus(error.message, true); }
        finally { if (version === requestVersion) { loading = false; $('[data-calendar-grid]').setAttribute('aria-busy', 'false'); render(); } }
    }
    function eventButton(event, compact = false) {
        const button = el('button', compact ? `planner-event ${event.category}` : `planner-day-event ${event.category}`); button.type = 'button';
        button.title = `${timeLabel(event)} · ${event.title}`;
        button.append(el('span', 'planner-event-time', timeLabel(event)), el('strong', '', event.title));
        if (!compact && event.location) button.append(el('small', '', event.location));
        button.addEventListener('click', () => openEvent(event)); return button;
    }
    function render() {
        const items = visible(), dates = range(), grid = $('[data-calendar-grid]'), mini = $('[data-mini-calendar]');
        $('[data-month-title]').textContent = format(atNoon(month), { month: 'long', year: 'numeric' });
        $('[data-event-count]').textContent = loaded ? `${items.filter(event => new Date(event.startsAt) < new Date(`${shiftMonth(month, 1)}T00:00:00+07:00`) && new Date(event.endsAt) > new Date(`${month}T00:00:00+07:00`)).length} ${t('cal_events')}` : '';
        $('[data-prev-month]').disabled = month <= '2000-01-01'; $('[data-next-month]').disabled = month >= '2100-12-01';
        grid.hidden = view !== 'month'; $('[data-calendar-agenda]').hidden = view !== 'agenda'; grid.replaceChildren(); mini.replaceChildren();
        const miniTitle = el('strong', 'planner-mini-title', format(atNoon(month), { month: 'long', year: 'numeric' })); mini.append(miniTitle);
        for (let i = 0; i < 7; i++) { const label = format(atNoon(addDays(dates.start, i)), { weekday: 'short' }); grid.append(el('div', 'planner-weekday', label)); mini.append(el('span', 'planner-mini-weekday', label)); }
        for (let i = 0; i < 42; i++) {
            const day = addDays(dates.start, i), otherMonth = day.slice(0, 7) !== month.slice(0, 7), isToday = day === today(), isSelected = day === selected;
            const cell = el('div', `planner-cell${otherMonth ? ' outside' : ''}${isSelected ? ' selected' : ''}`);
            const button = el('button', `planner-day-number${isToday ? ' today' : ''}`, Number(day.slice(-2))); button.type = 'button'; button.setAttribute('aria-label', format(atNoon(day), { dateStyle: 'full' })); button.setAttribute('aria-pressed', String(isSelected));
            button.addEventListener('click', () => { selected = day; render(); }); cell.append(button);
            const dayEvents = onDay(items, day);
            dayEvents.slice(0, 3).forEach(event => cell.append(eventButton(event, true)));
            if (dayEvents.length > 3) { const more = el('button', 'planner-more', `+${dayEvents.length - 3} ${t('cal_more')}`); more.type = 'button'; more.addEventListener('click', () => { selected = day; render(); $('[data-day-events]').scrollIntoView({ block: 'nearest' }); }); cell.append(more); }
            cell.addEventListener('dblclick', event => { if (event.target === cell) { selected = day; openEvent(); } }); grid.append(cell);
            const miniDay = el('button', `${otherMonth ? 'outside ' : ''}${isSelected ? 'selected ' : ''}${isToday ? 'today' : ''}`, Number(day.slice(-2))); miniDay.type = 'button'; miniDay.setAttribute('aria-label', format(atNoon(day), { dateStyle: 'full' })); miniDay.setAttribute('aria-pressed', String(isSelected)); miniDay.addEventListener('click', () => { selected = day; render(); }); mini.append(miniDay);
        }
        $('[data-day-eyebrow]').textContent = selected === today() ? t('cal_today') : t('cal_selected_day');
        $('[data-selected-date]').textContent = format(atNoon(selected), { weekday: 'long', day: 'numeric', month: 'long' });
        const dayList = $('[data-day-events]'); dayList.replaceChildren();
        const dayEvents = onDay(items, selected);
        dayEvents.forEach(event => dayList.append(eventButton(event)));
        if (!dayEvents.length) { const empty = el('div', 'planner-day-empty'); empty.append(el('span', 'planner-empty-symbol', '✦'), el('strong', '', loading ? t('cal_loading') : loadError ? t('cal_unavailable') : t('cal_free_day')), el('p', '', loadError ? t('cal_retry_hint') : t('cal_free_hint'))); dayList.append(empty); }
        $('[data-add-day]').textContent = `+ ${t('cal_add_day')}`;
        const agenda = $('[data-calendar-agenda]'); agenda.replaceChildren(); let count = 0;
        for (let day = month; day < shiftMonth(month, 1); day = addDays(day, 1)) {
            const dayItems = onDay(items, day); if (!dayItems.length) continue;
            const group = el('section', 'planner-agenda-day'); group.append(el('h3', '', format(atNoon(day), { weekday: 'short', day: 'numeric', month: 'short' })));
            const list = el('div'); dayItems.forEach(event => list.append(eventButton(event))); group.append(list); agenda.append(group); count++;
        }
        if (!count) agenda.append(el('p', 'planner-agenda-empty', loading ? t('cal_loading') : loadError ? t('cal_unavailable') : t('cal_no_results')));
    }
    function googleUrl(event) {
        const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
        const dates = event.allDay ? `${dayKey(event.startsAt).replaceAll('-', '')}/${dayKey(event.endsAt).replaceAll('-', '')}` : `${stamp(event.startsAt)}/${stamp(event.endsAt)}`;
        return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates, details: event.notes, location: event.location, ctz: zone })}`;
    }
    function allDayInputs() {
        for (const name of ['startsAt', 'endsAt']) { const input = field(name), previous = input.value; input.type = field('allDay').checked ? 'date' : 'datetime-local'; input.min = input.type === 'date' ? '2000-01-01' : '2000-01-01T00:00'; input.max = input.type === 'date' ? '2100-12-30' : '2100-12-30T23:59'; input.value = input.type === 'date' ? previous.slice(0, 10) : previous.length === 10 ? `${previous}T${name === 'startsAt' ? '09' : '10'}:00` : previous; }
    }
    function openEvent(event) {
        lastFocus = document.activeElement; form.reset(); field('eventId').value = event?._id || ''; field('allDay').checked = Boolean(event?.allDay);
        allDayInputs();
        field('title').value = event?.title || ''; field('category').value = event?.category || 'personal'; field('notes').value = event?.notes || ''; field('location').value = event?.location || '';
        field('startsAt').value = event ? event.allDay ? dayKey(event.startsAt) : inputTime(event.startsAt) : `${selected}T09:00`;
        field('endsAt').value = event ? event.allDay ? addDays(dayKey(event.endsAt), -1) : inputTime(event.endsAt) : `${selected}T10:00`;
        $('[data-dialog-title]').textContent = t(event ? 'cal_edit' : 'cal_create'); $('[data-form-error]').textContent = '';
        $('[data-delete-event]').hidden = !event; $('[data-delete-confirm]').hidden = true; $('[data-export-area]').hidden = !event;
        if (event) $('[data-google-link]').href = googleUrl(event);
        dialog.showModal(); field('title').focus();
    }
    const close = () => { if (!saving) dialog.close(); };
    dialog.addEventListener('close', () => { if (lastFocus?.isConnected) lastFocus.focus(); else $('[data-new-event]')?.focus(); });
    dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
    root.querySelectorAll('[data-new-event]').forEach(button => button.addEventListener('click', () => openEvent()));
    root.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', close));
    field('allDay').addEventListener('change', allDayInputs);
    function busy(value) { saving = value; form.querySelectorAll('button, input, select, textarea').forEach(node => { node.disabled = value; }); $('[data-save-event]').textContent = t(value ? 'cal_saving' : 'cal_save'); }
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (saving) return; $('[data-form-error]').textContent = '';
        const allDay = field('allDay').checked;
        const data = { title: field('title').value.trim(), notes: field('notes').value, location: field('location').value, category: field('category').value, allDay };
        try {
            data.startsAt = iso(allDay ? `${field('startsAt').value}T00:00` : field('startsAt').value);
            data.endsAt = iso(allDay ? `${addDays(field('endsAt').value, 1)}T00:00` : field('endsAt').value);
            if (!data.title || new Date(data.endsAt) <= new Date(data.startsAt) || new Date(data.endsAt) - new Date(data.startsAt) > 366 * 86400000) throw new Error(t('cal_invalid'));
            const id = field('eventId').value; busy(true);
            await api(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
            selected = dayKey(data.startsAt); month = monthStart(selected); busy(false); dialog.close(); await load(); if (!loadError) setStatus(t('cal_saved'));
        } catch (error) { $('[data-form-error]').textContent = error.message; } finally { busy(false); }
    });
    $('[data-delete-event]').addEventListener('click', () => { $('[data-delete-confirm]').hidden = false; $('[data-confirm-delete]').focus(); });
    $('[data-cancel-delete]').addEventListener('click', () => { $('[data-delete-confirm]').hidden = true; $('[data-delete-event]').focus(); });
    $('[data-confirm-delete]').addEventListener('click', async () => { if (saving) return; const id = field('eventId').value; busy(true); try { await api(`/${id}`, { method: 'DELETE' }); busy(false); dialog.close(); await load(); if (!loadError) setStatus(t('cal_deleted')); } catch (error) { $('[data-form-error]').textContent = error.message; } finally { busy(false); } });
    const navigate = amount => { month = shiftMonth(month, amount); selected = month; events = []; loaded = false; render(); load(); };
    $('[data-prev-month]').addEventListener('click', () => navigate(-1)); $('[data-next-month]').addEventListener('click', () => navigate(1));
    $('[data-today]').addEventListener('click', () => { selected = today(); month = monthStart(selected); events = []; loaded = false; render(); load(); });
    root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; root.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); render(); }));
    root.querySelectorAll('[data-category-filter]').forEach(input => input.addEventListener('change', render)); $('[data-calendar-search]').addEventListener('input', render);
    window.addEventListener('sgp:languagechange', () => { render(); if (loading) setStatus(t('cal_loading')); if (dialog.open) $('[data-dialog-title]').textContent = t(field('eventId').value ? 'cal_edit' : 'cal_create'); });
    window.addEventListener('sgp:translationsready', render);
    render(); load();
});
