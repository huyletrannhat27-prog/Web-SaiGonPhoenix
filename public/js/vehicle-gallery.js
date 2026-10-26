document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    const dialog = document.querySelector('[data-vehicle-gallery]');
    if (!dialog) return;
    const $ = selector => dialog.querySelector(selector);
    const text = key => window.SGP_LOCALIZATION?.text(key) || window.SGP_COPY?.vi?.[key] || key;
    const stage = $('[data-gallery-stage]'), photo = $('[data-gallery-image]');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const modeKeys = { exterior: 'images', interior: 'interiorImages', spin: 'spinImages' };
    let vehicle = null, mode = 'exterior', index = 0, timer = null, playing = false, lastFocus = null, request = null, imageVersion = 0, openVersion = 0, drag = null, vehicleId = '', failed = false;
    const loadedImages = new Map();
    function imageUrl(value) {
        if (typeof value !== 'string') return null;
        if (/^\/(?:images|uploads\/vehicles)\/[\w./-]+$/.test(value) && !value.includes('..')) return value;
        try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
    }
    const images = () => vehicle?.[modeKeys[mode]] || [];
    function preload(url) {
        if (!loadedImages.has(url)) loadedImages.set(url, new Promise((resolve, reject) => {
            const image = new Image(); image.referrerPolicy = 'no-referrer';
            const timeout = setTimeout(() => { loadedImages.delete(url); reject(new Error('image-timeout')); }, 12000);
            image.onload = () => { clearTimeout(timeout); resolve(url); };
            image.onerror = () => { clearTimeout(timeout); loadedImages.delete(url); reject(new Error('image')); };
            image.src = url;
        }));
        return loadedImages.get(url);
    }
    function status(message, retry) {
        const node = $('[data-gallery-status]'); node.replaceChildren(); node.hidden = !message;
        if (!message) return;
        const p = document.createElement('p'); p.textContent = message; node.append(p);
        if (retry) { const button = document.createElement('button'); button.type = 'button'; button.className = 'gallery-motion'; button.textContent = text('vg_retry'); button.addEventListener('click', retry); node.append(button); }
    }
    function stop() { clearInterval(timer); timer = null; playing = false; photo.classList.remove('gallery-photo-moving'); updateMotion(); }
    function updateMotion() {
        const button = $('[data-gallery-motion]'); button.setAttribute('aria-pressed', String(playing));
        button.textContent = text(mode === 'spin' ? playing ? 'vg_spin_off' : 'vg_spin_on' : playing ? 'vg_motion_off' : 'vg_motion_on');
    }
    function play() {
        stop(); if (!images().length || failed) return;
        playing = true;
        if (mode === 'spin' && images().length >= 8) {
            let advancing = false;
            timer = setInterval(async () => {
                if (document.hidden || advancing) return;
                advancing = true;
                try { await showFrame(index + 1); } finally { advancing = false; }
            }, 160);
        }
        else photo.classList.add('gallery-photo-moving');
        updateMotion();
    }
    function updateLabels() {
        dialog.querySelectorAll('[data-gallery-text]').forEach(node => { node.textContent = text(node.dataset.galleryText); });
        dialog.querySelectorAll('[data-gallery-mode]').forEach(button => {
            const key = button.dataset.galleryMode, count = vehicle?.[modeKeys[key]]?.length || 0;
            button.textContent = `${text('vg_' + key)}${count ? ` (${count})` : ''}`; button.setAttribute('aria-pressed', String(key === mode));
        });
        $('[data-gallery-close]').setAttribute('aria-label', text('vg_close'));
        $('[data-gallery-prev]').setAttribute('aria-label', text('vg_previous'));
        $('[data-gallery-next]').setAttribute('aria-label', text('vg_next'));
        $('[data-gallery-thumbnails]').setAttribute('aria-label', text('vg_thumbnails'));
        $('.gallery-tabs').setAttribute('aria-label', text('vg_categories'));
        stage.setAttribute('aria-label', text('vg_stage'));
        $('[data-gallery-book]').textContent = text('vg_book');
        $('[data-gallery-specs]').textContent = vehicle ? `${vehicle.capacity} ${text('vg_passengers')} · ${vehicle.luggageCapacity || 0} ${text('vg_bags')}` : '';
        $('[data-gallery-hint]').textContent = images().length ? text(mode === 'spin' ? 'vg_spin_hint' : 'vg_photo_hint') : '';
        updateMotion();
    }
    async function showFrame(next) {
        const list = images(); if (!list.length) return;
        index = (next + list.length) % list.length;
        const version = ++imageVersion, url = list[index]; failed = false;
        photo.alt = `${vehicle.name} · ${text('vg_' + mode)} · ${index + 1}`;
        $('[data-gallery-counter]').textContent = `${index + 1} / ${list.length}`;
        $('[data-gallery-thumbnails]').querySelectorAll('button').forEach((button, number) => button.setAttribute('aria-pressed', String(number === index)));
        if (photo.hidden) status(text('vg_loading'));
        try {
            await preload(url);
            if (!dialog.open || version !== imageVersion) return;
            photo.src = url; photo.hidden = false; status('');
            $('[data-gallery-motion]').hidden = false;
            if (mode === 'spin') preload(list[(index + 1) % list.length]).catch(() => {});
        } catch {
            if (!dialog.open || version !== imageVersion) return;
            failed = true; photo.hidden = true; stop(); $('[data-gallery-motion]').hidden = true;
            status(text('vg_image_failed'), () => showFrame(index));
        }
    }
    function showMode(nextMode) {
        stop(); mode = nextMode; index = 0; imageVersion++; photo.hidden = true; photo.removeAttribute('src');
        stage.classList.toggle('is-spin', mode === 'spin');
        const list = images(), thumbs = $('[data-gallery-thumbnails]'); thumbs.replaceChildren();
        $('[data-gallery-counter]').hidden = !list.length;
        $('[data-gallery-prev]').hidden = $('[data-gallery-next]').hidden = list.length < 2;
        $('[data-gallery-motion]').hidden = !list.length;
        list.forEach((url, number) => {
            const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', `${text('vg_photo')} ${number + 1}`); button.setAttribute('aria-pressed', String(number === index));
            const img = document.createElement('img'); img.src = url; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; button.append(img);
            button.addEventListener('click', () => { stop(); showFrame(number); }); thumbs.append(button);
        });
        updateLabels();
        if (!list.length) { status(text(mode === 'interior' ? 'vg_empty_interior' : mode === 'spin' ? 'vg_empty_spin' : 'vg_empty')); return; }
        showFrame(0);
        if (!reduceMotion?.matches) play();
    }
    async function load() {
        request?.abort(); const controller = new AbortController(); request = controller; const version = ++openVersion;
        vehicle = null; stop(); photo.hidden = true; imageVersion++; loadedImages.clear();
        $('[data-gallery-thumbnails]').replaceChildren();
        for (const selector of ['[data-gallery-prev]', '[data-gallery-next]', '[data-gallery-counter]', '[data-gallery-motion]']) $(selector).hidden = true;
        $('[data-gallery-book]').hidden = true; updateLabels(); status(text('vg_loading'));
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}/gallery`, { signal: controller.signal, headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('load');
            const data = await response.json(); if (version !== openVersion || !dialog.open) return;
            vehicle = data;
            for (const key of Object.values(modeKeys)) vehicle[key] = (Array.isArray(data[key]) ? data[key] : []).map(imageUrl).filter(Boolean).slice(0, key === 'spinImages' ? 36 : 12);
            if (vehicle.spinImages.length < 8) vehicle.spinImages = [];
            $('[data-gallery-name]').textContent = data.name;
            $('[data-gallery-book]').href = `/booking?vehicleId=${encodeURIComponent(vehicleId)}`; $('[data-gallery-book]').hidden = false;
            showMode('exterior');
        } catch { if (version === openVersion && dialog.open) status(text('vg_failed'), load); }
        finally { clearTimeout(timeout); }
    }
    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-open-gallery]'); if (!trigger) return;
        event.preventDefault(); // Opening photos inside a booking label must not select a different vehicle.
        lastFocus = trigger; vehicleId = trigger.dataset.openGallery; mode = 'exterior';
        $('[data-gallery-name]').textContent = trigger.dataset.vehicleName || 'SaiGonPhoenix';
        dialog.showModal(); document.body.classList.add('vehicle-gallery-open'); $('[data-gallery-close]').focus(); load();
    });
    $('[data-gallery-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { stop(); request?.abort(); openVersion++; imageVersion++; drag = null; loadedImages.clear(); document.body.classList.remove('vehicle-gallery-open'); lastFocus?.focus(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    dialog.querySelectorAll('[data-gallery-mode]').forEach(button => button.addEventListener('click', () => { if (vehicle) showMode(button.dataset.galleryMode); }));
    $('[data-gallery-prev]').addEventListener('click', () => { stop(); showFrame(index - 1); });
    $('[data-gallery-next]').addEventListener('click', () => { stop(); showFrame(index + 1); });
    $('[data-gallery-motion]').addEventListener('click', () => playing ? stop() : play());
    stage.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); stop(); showFrame(index + (event.key === 'ArrowRight' ? 1 : -1)); } });
    stage.addEventListener('pointerdown', event => { if (event.target.closest('button') || !images().length || event.button !== 0) return; drag = { id: event.pointerId, x: event.clientX, start: index }; stage.setPointerCapture?.(event.pointerId); });
    stage.addEventListener('pointermove', event => { if (!drag || drag.id !== event.pointerId || mode !== 'spin') return; const delta = Math.trunc((event.clientX - drag.x) / 14); if (delta) { stop(); const next = ((drag.start - delta) % images().length + images().length) % images().length; if (next !== index) showFrame(next); } });
    stage.addEventListener('pointerup', event => { if (!drag || drag.id !== event.pointerId) return; const delta = event.clientX - drag.x; if (mode !== 'spin' && Math.abs(delta) > 40) { stop(); showFrame(index + (delta < 0 ? 1 : -1)); } drag = null; });
    stage.addEventListener('pointercancel', () => { drag = null; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    reduceMotion?.addEventListener?.('change', () => { if (reduceMotion.matches) stop(); });
    window.addEventListener('sgp:languagechange', () => { updateLabels(); if (dialog.open && vehicle && !images().length) status(text(mode === 'interior' ? 'vg_empty_interior' : mode === 'spin' ? 'vg_empty_spin' : 'vg_empty')); });
});
