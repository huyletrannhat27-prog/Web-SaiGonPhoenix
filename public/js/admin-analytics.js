(function () {
    'use strict';
    const source = document.getElementById('adminAnalyticsData');
    if (!source) return;
    let analytics;
    try { analytics = JSON.parse(source.textContent); } catch (error) { return; }

    const palette = { booked: '#df3a5b', completed: '#17a467', blue: '#3878c7', gold: '#e5a527', muted: '#8a94a6', grid: 'rgba(130,145,165,.18)', statuses: ['#e5a527','#3878c7','#17a467','#df4261','#798396'] };
    const setup = canvas => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(canvas.clientWidth, 280);
        const height = Math.max(canvas.clientHeight, 230);
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        const context = canvas.getContext('2d'); context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);
        const styles = getComputedStyle(document.documentElement);
        return { context, width, height, text: styles.getPropertyValue('--text-dark').trim() || '#263247', muted: styles.getPropertyValue('--text-muted').trim() || '#738096' };
    };
    const roundedRect = (context, x, y, width, height, radius) => {
        const r = Math.min(radius, width / 2, height / 2); context.beginPath(); context.roundRect(x, y, width, height, r); context.fill();
    };
    const empty = (context, width, height, message, muted) => {
        context.fillStyle = muted; context.font = '600 13px Inter, sans-serif'; context.textAlign = 'center'; context.fillText(message, width / 2, height / 2);
    };
    const compact = value => new Intl.NumberFormat('vi-VN', { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);

    function drawTrend(canvas) {
        const { context, width, height, text, muted } = setup(canvas); const data = analytics.trend || [];
        if (!data.length || !data.some(item => item.booked || item.completed)) return empty(context, width, height, 'Chưa có chuyến trong khoảng này', muted);
        const margin = { left: 42, right: 14, top: 16, bottom: 36 }; const plotWidth = width - margin.left - margin.right; const plotHeight = height - margin.top - margin.bottom;
        const max = Math.max(1, ...data.flatMap(item => [item.booked, item.completed]));
        context.font = '10px Inter, sans-serif'; context.textAlign = 'right'; context.textBaseline = 'middle';
        for (let step = 0; step <= 4; step++) {
            const value = Math.round(max * step / 4); const y = margin.top + plotHeight - plotHeight * step / 4;
            context.strokeStyle = palette.grid; context.lineWidth = 1; context.beginPath(); context.moveTo(margin.left, y); context.lineTo(width - margin.right, y); context.stroke();
            context.fillStyle = muted; context.fillText(compact(value), margin.left - 8, y);
        }
        const groupWidth = plotWidth / data.length; const barWidth = Math.max(3, Math.min(13, groupWidth * .28));
        data.forEach((item, index) => {
            const center = margin.left + groupWidth * index + groupWidth / 2;
            [[item.booked, palette.booked, -barWidth - 1], [item.completed, palette.completed, 1]].forEach(([value, color, offset]) => {
                const barHeight = plotHeight * value / max; context.fillStyle = color; roundedRect(context, center + offset, margin.top + plotHeight - barHeight, barWidth, barHeight, 4);
            });
            const labelStep = Math.max(1, Math.ceil(data.length / Math.max(5, Math.floor(plotWidth / 60))));
            if (index % labelStep === 0 || index === data.length - 1) { context.fillStyle = muted; context.font = '9px Inter, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(item.label, center, margin.top + plotHeight + 10); }
        });
        context.fillStyle = text;
    }

    function drawStatus(canvas) {
        const { context, width, height, text, muted } = setup(canvas); const data = analytics.status || []; const total = data.reduce((sum, item) => sum + item.count, 0);
        if (!total) return empty(context, width, height, 'Chưa có dữ liệu trạng thái', muted);
        const centerX = width / 2; const centerY = height / 2; const radius = Math.min(width, height) * .32; const inner = radius * .63;
        let angle = -Math.PI / 2;
        data.forEach((item, index) => { const next = angle + Math.PI * 2 * item.count / total; context.beginPath(); context.arc(centerX, centerY, radius, angle, next); context.arc(centerX, centerY, inner, next, angle, true); context.closePath(); context.fillStyle = palette.statuses[index % palette.statuses.length]; context.fill(); angle = next; });
        context.fillStyle = text; context.font = '800 27px Inter, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(compact(total), centerX, centerY - 5);
        context.fillStyle = muted; context.font = '600 10px Inter, sans-serif'; context.fillText('TỔNG ĐƠN', centerX, centerY + 18);
    }

    function drawDrivers(canvas) {
        const { context, width, height, text, muted } = setup(canvas); const data = (analytics.drivers || []).slice(0, 8);
        if (!data.length || !data.some(item => item.assignedTrips)) return empty(context, width, height, 'Chưa có chuyến được phân công', muted);
        const margin = { left: Math.min(145, width * .3), right: 35, top: 12, bottom: 15 }; const plotWidth = width - margin.left - margin.right; const rowHeight = (height - margin.top - margin.bottom) / data.length; const max = Math.max(1, ...data.map(item => item.assignedTrips));
        data.forEach((item, index) => {
            const y = margin.top + index * rowHeight + rowHeight * .24; const h = Math.max(9, rowHeight * .5);
            context.font = '600 10px Inter, sans-serif'; context.textAlign = 'right'; context.textBaseline = 'middle'; context.fillStyle = text;
            const label = item.name.length > 19 ? `${item.name.slice(0, 18)}…` : item.name; context.fillText(label, margin.left - 10, y + h / 2);
            context.fillStyle = palette.grid; roundedRect(context, margin.left, y, plotWidth, h, 6);
            const assignedWidth = plotWidth * item.assignedTrips / max; context.fillStyle = palette.blue; roundedRect(context, margin.left, y, assignedWidth, h, 6);
            if (item.completedTrips) { context.fillStyle = palette.completed; roundedRect(context, margin.left, y, plotWidth * item.completedTrips / max, h, 6); }
            context.fillStyle = muted; context.textAlign = 'left'; context.fillText(`${item.completedTrips}/${item.assignedTrips}`, margin.left + assignedWidth + 7, y + h / 2);
        });
    }

    function drawRating(canvas) {
        const { context, width, height, text, muted } = setup(canvas); const data = (analytics.trend || []).filter(item => item.averageRating > 0);
        if (!data.length) return empty(context, width, height, 'Chưa có đánh giá trong khoảng này', muted);
        const margin = { left: 35, right: 18, top: 20, bottom: 36 }; const plotWidth = width - margin.left - margin.right; const plotHeight = height - margin.top - margin.bottom;
        context.font = '9px Inter, sans-serif'; context.textAlign = 'right'; context.textBaseline = 'middle';
        for (let value = 1; value <= 5; value++) { const y = margin.top + plotHeight - plotHeight * value / 5; context.strokeStyle = palette.grid; context.beginPath(); context.moveTo(margin.left, y); context.lineTo(width - margin.right, y); context.stroke(); context.fillStyle = muted; context.fillText(String(value), margin.left - 8, y); }
        const points = data.map((item, index) => ({ x: margin.left + (data.length === 1 ? plotWidth / 2 : plotWidth * index / (data.length - 1)), y: margin.top + plotHeight - plotHeight * item.averageRating / 5, item }));
        const gradient = context.createLinearGradient(0, margin.top, 0, margin.top + plotHeight); gradient.addColorStop(0, 'rgba(223,58,91,.25)'); gradient.addColorStop(1, 'rgba(223,58,91,0)');
        context.beginPath(); context.moveTo(points[0].x, margin.top + plotHeight); points.forEach(point => context.lineTo(point.x, point.y)); context.lineTo(points.at(-1).x, margin.top + plotHeight); context.closePath(); context.fillStyle = gradient; context.fill();
        context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.strokeStyle = palette.booked; context.lineWidth = 3; context.lineJoin = 'round'; context.stroke();
        points.forEach((point, index) => { context.beginPath(); context.arc(point.x, point.y, 4, 0, Math.PI * 2); context.fillStyle = '#fff'; context.fill(); context.strokeStyle = palette.booked; context.lineWidth = 2; context.stroke(); const step = Math.max(1, Math.ceil(points.length / 5)); if (index % step === 0 || index === points.length - 1) { context.fillStyle = muted; context.font = '9px Inter, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(point.item.label, point.x, margin.top + plotHeight + 10); } });
        context.fillStyle = text;
    }

    const renderers = { trend: drawTrend, status: drawStatus, drivers: drawDrivers, rating: drawRating };
    const canvases = Array.from(document.querySelectorAll('[data-analytics-chart]'));
    const render = () => canvases.forEach(canvas => renderers[canvas.dataset.analyticsChart]?.(canvas));
    let timer; const schedule = () => { clearTimeout(timer); timer = window.setTimeout(render, 80); };
    render(); window.addEventListener('resize', schedule); window.addEventListener('sgp:themechange', schedule);
    if ('ResizeObserver' in window) { const observer = new ResizeObserver(schedule); canvases.forEach(canvas => observer.observe(canvas.parentElement)); }
    const period = document.querySelector('[data-analytics-period]'); const custom = document.querySelector('[data-analytics-custom]');
    period?.addEventListener('change', () => custom?.classList.toggle('d-none', period.value !== 'custom'));
})();
