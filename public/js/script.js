document.addEventListener('DOMContentLoaded', () => {
    const currency = value => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

    const successToast = document.querySelector('[data-booking-success-toast]');
    if (successToast) {
        const dismiss = () => {
            if (!successToast.isConnected || successToast.classList.contains('is-leaving')) return;
            successToast.classList.add('is-leaving');
            window.setTimeout(() => successToast.remove(), 320);
        };
        const playSuccessChime = () => {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return true;
                const context = new AudioContext();
                if (context.state === 'suspended') context.resume();
                const now = context.currentTime;
                [523.25, 659.25, 783.99].forEach((frequency, index) => {
                    const oscillator = context.createOscillator();
                    const gain = context.createGain();
                    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
                    gain.gain.setValueAtTime(.0001, now + index * .11);
                    gain.gain.exponentialRampToValueAtTime(.13, now + index * .11 + .025);
                    gain.gain.exponentialRampToValueAtTime(.0001, now + index * .11 + .32);
                    oscillator.connect(gain); gain.connect(context.destination);
                    oscillator.start(now + index * .11); oscillator.stop(now + index * .11 + .34);
                });
                window.setTimeout(() => context.close().catch(() => {}), 1200);
                return true;
            } catch (error) { return false; }
        };
        if (!playSuccessChime()) document.addEventListener('pointerdown', playSuccessChime, { once: true });
        successToast.querySelector('[data-booking-success-close]')?.addEventListener('click', dismiss);
        window.setTimeout(dismiss, 8000);
    }

    document.querySelectorAll('.alert-dismissible').forEach(alert => {
        window.setTimeout(() => bootstrap.Alert.getOrCreateInstance(alert).close(), 5500);
    });

    window.showAlert = (message, type = 'info') => {
        const stack = document.querySelector('.flash-stack') || document.body;
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.setAttribute('role', 'alert');
        const icon = document.createElement('i');
        icon.className = `fa-solid fa-${type === 'danger' ? 'circle-exclamation' : 'circle-info'} me-2`;
        const text = document.createTextNode(message);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn-close';
        close.setAttribute('data-bs-dismiss', 'alert');
        close.setAttribute('aria-label', 'Đóng');
        alert.append(icon, text, close);
        stack.prepend(alert);
        window.setTimeout(() => alert.remove(), 5000);
    };

    const toLocalInputValue = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const minimumPickup = new Date(Date.now() + 2 * 60 * 60 * 1000);
    document.querySelectorAll('input[type="datetime-local"]:not([data-calendar-input])').forEach(input => {
        input.min = toLocalInputValue(minimumPickup);
        if (!input.value) input.value = toLocalInputValue(new Date(Date.now() + 3 * 60 * 60 * 1000));
    });

    document.querySelectorAll('[data-password-toggle]').forEach(button => {
        button.addEventListener('click', () => {
            const input = button.parentElement.querySelector('input');
            if (!input) return;
            const showing = input.type === 'text';
            input.type = showing ? 'password' : 'text';
            button.innerHTML = `<i class="fa-regular fa-eye${showing ? '' : '-slash'}"></i>`;
            button.setAttribute('aria-label', showing ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
        });
    });

    const passwordInput = document.querySelector('input[name="password"]');
    const confirmPasswordInput = document.querySelector('input[name="confirmPassword"]');
    const getPasswordStrength = password => {
        let score = 0;
        if (password.length >= 6) score++;
        if (password.length >= 10) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        return [
            { text: 'Rất yếu', className: 'text-danger' },
            { text: 'Yếu', className: 'text-danger' },
            { text: 'Trung bình', className: 'text-warning' },
            { text: 'Khá', className: 'text-primary' },
            { text: 'Mạnh', className: 'text-success' },
            { text: 'Rất mạnh', className: 'text-success' }
        ][score];
    };
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const indicator = passwordInput.closest('.modern-field')?.querySelector('.password-strength');
            if (!indicator) return;
            const strength = getPasswordStrength(passwordInput.value);
            indicator.textContent = passwordInput.value ? strength.text : '';
            indicator.className = `password-strength ${strength.className}`;
        });
    }
    if (confirmPasswordInput && passwordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            const indicator = confirmPasswordInput.closest('.modern-field')?.querySelector('.confirm-message');
            if (!indicator) return;
            const matched = confirmPasswordInput.value && confirmPasswordInput.value === passwordInput.value;
            indicator.textContent = confirmPasswordInput.value ? (matched ? '✓ Khớp' : 'Chưa khớp') : '';
            indicator.className = `confirm-message ${matched ? 'text-success' : 'text-danger'}`;
        });
    }

    document.querySelectorAll('input[type="tel"]').forEach(input => {
        input.addEventListener('input', () => {
            const digits = input.value.replace(/\D/g, '').slice(0, 11);
            input.value = digits.length > 7 ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
        });
    });

    document.querySelectorAll('.navbar-custom .nav-link[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (href === window.location.pathname || (href !== '/' && window.location.pathname.startsWith(`${href}/`))) link.classList.add('active');
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', event => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    const supportWidget = document.querySelector('[data-support-widget]');
    if (supportWidget) {
        const panel = supportWidget.querySelector('.support-panel');
        const toggle = supportWidget.querySelector('[data-support-toggle]');
        const setOpen = open => {
            panel.classList.toggle('is-open', open);
            panel.setAttribute('aria-hidden', String(!open));
            toggle.setAttribute('aria-expanded', String(open));
        };
        toggle.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
        supportWidget.querySelector('[data-support-close]').addEventListener('click', () => setOpen(false));
        document.addEventListener('click', event => { if (!supportWidget.contains(event.target)) setOpen(false); });
        window.setTimeout(() => { if (!sessionStorage.getItem('sgp-support-seen')) { setOpen(true); sessionStorage.setItem('sgp-support-seen', '1'); } }, 3500);
    }

    const vehicleImageAsset = document.getElementById('vehicleImageAsset');
    const vehicleImagePreview = document.getElementById('vehicleImagePreview');
    if (vehicleImageAsset && vehicleImagePreview) {
        vehicleImageAsset.addEventListener('change', () => {
            const imageUrl = vehicleImageAsset.options[vehicleImageAsset.selectedIndex]?.dataset.imageUrl;
            vehicleImagePreview.classList.toggle('d-none', !imageUrl);
            if (imageUrl) vehicleImagePreview.src = imageUrl;
            else vehicleImagePreview.removeAttribute('src');
        });
    }

    document.querySelectorAll('[data-vehicle-filters]').forEach(filterBar => {
        const scope = filterBar.closest('section') || document;
        const cards = Array.from(scope.querySelectorAll('[data-vehicle-category]'));
        filterBar.querySelectorAll('[data-filter]').forEach(button => {
            button.addEventListener('click', () => {
                const filter = button.dataset.filter;
                filterBar.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
                cards.forEach(card => card.classList.toggle('is-filter-hidden', filter !== 'all' && card.dataset.vehicleCategory !== filter));
                const selected = scope.querySelector('input[name="vehicleId"]:checked');
                if (selected?.closest('[data-vehicle-category]')?.classList.contains('is-filter-hidden')) {
                    selected.checked = false;
                    const first = cards.find(card => !card.classList.contains('is-filter-hidden') && !card.classList.contains('is-unavailable'))?.querySelector('input[name="vehicleId"]');
                    if (first) { first.checked = true; first.dispatchEvent(new Event('change', { bubbles: true })); }
                }
            });
        });
    });

    const chatWidget = document.querySelector('[data-chat-widget]');
    if (chatWidget) {
        const panel = chatWidget.querySelector('.chat-panel');
        const form = chatWidget.querySelector('[data-chat-form]');
        const messagesBox = chatWidget.querySelector('[data-chat-messages]');
        const emptyBox = chatWidget.querySelector('[data-chat-empty]');
        const title = chatWidget.querySelector('[data-chat-title]');
        const fileInput = form.elements.media;
        const preview = chatWidget.querySelector('[data-chat-preview]');
        let pollingTimer = null;
        let unansweredTimer = null;
        let lastSignature = '';
        let lastMessages = [];

        const renderUnansweredCounts = data => {
            const counts = data?.byUser || {};
            document.querySelectorAll('[data-chat-unanswered-user]').forEach(badge => {
                const count = Number(counts[badge.dataset.chatUnansweredUser] || 0);
                badge.textContent = count;
                badge.classList.toggle('d-none', count === 0);
                badge.setAttribute('aria-label', `${count} tin nhắn chưa phản hồi`);
            });
            document.querySelectorAll('[data-chat-unanswered-note]').forEach(note => {
                const count = Number(counts[note.dataset.chatUnansweredNote] || 0);
                note.classList.toggle('d-none', count === 0);
                const number = note.querySelector('b'); if (number) number.textContent = count;
            });
            const totalBadge = chatWidget.querySelector('[data-chat-unanswered-total]');
            if (totalBadge) {
                const total = Number(data?.total || 0);
                totalBadge.textContent = total > 99 ? '99+' : total;
                totalBadge.classList.toggle('d-none', total === 0);
                totalBadge.setAttribute('aria-label', `${total} tin nhắn khách chưa được phản hồi`);
            }
        };

        async function refreshUnansweredCounts() {
            if (chatWidget.dataset.chatRole !== 'admin') return;
            try {
                const response = await fetch('/api/chat/unanswered', { headers: { Accept: 'application/json' } });
                if (response.ok) renderUnansweredCounts(await response.json());
            } catch (error) { /* Giữ số gần nhất nếu mạng tạm gián đoạn. */ }
        }

        const hasConversation = () => Boolean(form.elements.target.value && (chatWidget.dataset.chatRole === 'user' || form.elements.userId.value || form.elements.bookingId.value));
        const setPanelOpen = open => {
            panel.classList.toggle('is-open', open);
            panel.setAttribute('aria-hidden', String(!open));
            chatWidget.querySelector('[data-chat-toggle]').setAttribute('aria-expanded', String(open));
            if (open && hasConversation()) loadMessages();
            if (!open && pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
        };

        const conversationParams = () => {
            const params = new URLSearchParams();
            ['target', 'userId', 'bookingId'].forEach(name => { if (form.elements[name].value) params.set(name, form.elements[name].value); });
            return params;
        };

        const renderMessages = messages => {
            const signature = messages.map(item => item.id).join(',');
            if (signature === lastSignature) return;
            lastSignature = signature;
            lastMessages = messages;
            messagesBox.replaceChildren();
            emptyBox.classList.toggle('d-none', messages.length > 0);
            messages.forEach(message => {
                const row = document.createElement('div');
                row.className = `chat-message ${message.mine ? 'mine' : 'theirs'}`;
                const bubble = document.createElement('div');
                bubble.className = 'chat-bubble';
                if (message.text) { const text = document.createElement('p'); text.textContent = message.text; bubble.appendChild(text); }
                if (message.mediaUrl) {
                    const media = message.mediaType.startsWith('video/') ? document.createElement('video') : document.createElement('img');
                    media.src = message.mediaUrl;
                    if (media.tagName === 'VIDEO') media.controls = true;
                    else { media.loading = 'lazy'; media.alt = 'Ảnh trong cuộc trò chuyện'; }
                    bubble.appendChild(media);
                }
                const meta = document.createElement('small');
                meta.textContent = `${message.mine ? (window.SGP_LOCALIZATION?.text('you') || 'Bạn') : message.senderName}${message.automated ? ` · ${window.SGP_LOCALIZATION?.text('auto_reply') || 'Trả lời tự động'}` : ''} · ${new Date(message.createdAt).toLocaleString(document.documentElement.lang || 'vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`;
                bubble.appendChild(meta);
                if (message.text && !message.mine) {
                    const translateArea = document.createElement('div');
                    translateArea.className = 'chat-translation-area';
                    const translateButton = document.createElement('button');
                    translateButton.type = 'button';
                    translateButton.className = 'chat-translate-button';
                    const updateButtonLabel = () => {
                        const target = window.SGP_LOCALIZATION?.getLanguage() || document.documentElement.lang || 'vi';
                        const name = window.SGP_LOCALIZATION?.getLanguageName(target) || target;
                        translateButton.innerHTML = `<i class="fa-solid fa-language"></i> ${window.SGP_LOCALIZATION?.text('translate_to', { lang: name }) || `Dịch sang ${name}`}`;
                    };
                    updateButtonLabel();
                    translateButton.addEventListener('click', async () => {
                        const targetLanguage = window.SGP_LOCALIZATION?.getLanguage() || document.documentElement.lang || 'vi';
                        translateButton.disabled = true;
                        translateButton.textContent = window.SGP_LOCALIZATION?.text('translating') || 'Đang dịch...';
                        try {
                            const response = await fetch(`/api/chat/messages/${message.id}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ targetLanguage }) });
                            const data = await response.json();
                            if (!response.ok) throw new Error(data.error || 'Chưa dịch được tin nhắn.');
                            let translation = translateArea.querySelector('.chat-translation-result');
                            if (!translation) { translation = document.createElement('div'); translation.className = 'chat-translation-result'; translateArea.appendChild(translation); }
                            translation.replaceChildren();
                            const label = document.createElement('strong'); label.textContent = window.SGP_LOCALIZATION?.text('translation') || 'Bản dịch';
                            const translatedText = document.createElement('p'); translatedText.textContent = data.text;
                            const provider = document.createElement('small'); provider.textContent = window.SGP_LOCALIZATION?.text('translated_by', { provider: data.provider }) || `Dịch tự động bởi ${data.provider}`;
                            translation.append(label, translatedText, provider);
                        } catch (error) { showAlert(error.message || (window.SGP_LOCALIZATION?.text('translation_failed') || 'Chưa dịch được tin nhắn.'), 'warning'); }
                        finally { translateButton.disabled = false; updateButtonLabel(); }
                    });
                    translateArea.appendChild(translateButton); bubble.appendChild(translateArea);
                }
                row.appendChild(bubble); messagesBox.appendChild(row);
            });
            messagesBox.scrollTop = messagesBox.scrollHeight;
        };

        async function loadMessages() {
            if (!hasConversation()) return;
            try {
                const response = await fetch(`/api/chat/messages?${conversationParams()}`, { headers: { Accept: 'application/json' } });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Không tải được tin nhắn');
                title.textContent = data.partner.name;
                renderMessages(data.messages);
                if (!pollingTimer) pollingTimer = setInterval(loadMessages, 5000);
            } catch (error) { emptyBox.querySelector('span').textContent = error.message; }
        }

        const openConversation = trigger => {
            form.elements.target.value = trigger?.dataset.chatTarget || chatWidget.dataset.chatDefaultTarget || '';
            form.elements.userId.value = trigger?.dataset.chatUser || '';
            form.elements.bookingId.value = trigger?.dataset.chatBooking || '';
            if (trigger?.dataset.chatName) title.textContent = trigger.dataset.chatName;
            lastSignature = '';
            setPanelOpen(true);
        };

        if (chatWidget.dataset.chatDefaultTarget) form.elements.target.value = chatWidget.dataset.chatDefaultTarget;
        form.elements.language.value = document.documentElement.lang || 'vi';
        window.addEventListener('sgp:languagechange', event => {
            form.elements.language.value = event.detail.language;
            if (hasConversation()) { lastSignature = ''; renderMessages(lastMessages); }
        });
        if (chatWidget.dataset.chatRole === 'admin') {
            refreshUnansweredCounts();
            unansweredTimer = setInterval(refreshUnansweredCounts, 8000);
            window.addEventListener('beforeunload', () => clearInterval(unansweredTimer), { once: true });
        }
        document.querySelectorAll('[data-chat-open]').forEach(button => button.addEventListener('click', () => openConversation(button)));
        chatWidget.querySelector('[data-chat-toggle]').addEventListener('click', () => panel.classList.contains('is-open') ? setPanelOpen(false) : openConversation(null));
        chatWidget.querySelector('[data-chat-close]').addEventListener('click', () => setPanelOpen(false));
        chatWidget.querySelector('[data-chat-fullscreen]').addEventListener('click', () => {
            panel.classList.toggle('is-fullscreen');
            chatWidget.querySelector('[data-chat-fullscreen] i').className = panel.classList.contains('is-fullscreen') ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        });

        fileInput.addEventListener('change', () => {
            preview.classList.toggle('d-none', !fileInput.files.length);
            preview.textContent = fileInput.files.length ? `Đã chọn: ${fileInput.files[0].name}` : '';
        });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!hasConversation()) return showAlert('Vui lòng chọn người cần chat.', 'danger');
            const submit = form.querySelector('button[type="submit"]');
            submit.disabled = true;
            try {
                const response = await fetch('/api/chat/messages', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Không gửi được tin nhắn');
                form.elements.text.value = ''; fileInput.value = ''; preview.classList.add('d-none'); preview.textContent = ''; lastSignature = ''; await loadMessages(); await refreshUnansweredCounts();
            } catch (error) { showAlert(error.message, 'danger'); }
            finally { submit.disabled = false; }
        });

        const handle = chatWidget.querySelector('[data-chat-drag-handle]');
        let drag = null;
        handle.addEventListener('pointerdown', event => {
            if (event.target.closest('button') || panel.classList.contains('is-fullscreen')) return;
            const rect = panel.getBoundingClientRect();
            drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            handle.setPointerCapture(event.pointerId);
        });
        handle.addEventListener('pointermove', event => {
            if (!drag) return;
            const left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, event.clientX - drag.x));
            const top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, event.clientY - drag.y));
            Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
        });
        handle.addEventListener('pointerup', event => {
            if (!drag) return;
            drag = null; handle.releasePointerCapture(event.pointerId);
            localStorage.setItem('sgp-chat-position', JSON.stringify({ left: panel.style.left, top: panel.style.top }));
        });
        try { const saved = JSON.parse(localStorage.getItem('sgp-chat-position')); if (saved?.left && saved?.top) Object.assign(panel.style, { left: saved.left, top: saved.top, right: 'auto', bottom: 'auto' }); } catch (_) {}
    }

    const bookingForm = document.getElementById('bookingForm');
    if (!bookingForm) return;

    const bookingText = (key, replacements = {}) => window.SGP_LOCALIZATION?.text(key, replacements) || key;

    const dateInput = bookingForm.querySelector('input[name="bookingDate"]');
    const airportInput = bookingForm.querySelector('select[name="airport"]');
    const pickupInput = bookingForm.querySelector('input[name="pickupLocation"]');
    const dropoffInput = bookingForm.querySelector('input[name="dropoffLocation"]');
    const paymentInputs = Array.from(bookingForm.querySelectorAll('input[name="paymentOption"]'));
    const vehicleOptions = Array.from(bookingForm.querySelectorAll('[data-vehicle-option]'));
    const availabilityMessage = document.getElementById('availabilityMessage');
    const noVehicleMessage = document.getElementById('noVehicleMessage');

    const summary = {
        image: bookingForm.querySelector('[data-summary-image]'),
        name: bookingForm.querySelector('[data-summary-name]'),
        capacity: bookingForm.querySelector('[data-summary-capacity]'),
        pickup: bookingForm.querySelector('[data-summary-pickup]'),
        dropoff: bookingForm.querySelector('[data-summary-dropoff]'),
        time: bookingForm.querySelector('[data-summary-time]'),
        airport: bookingForm.querySelector('[data-summary-airport]'),
        price: bookingForm.querySelector('[data-summary-price]'),
        due: bookingForm.querySelector('[data-summary-due]')
    };

    const updateSummary = () => {
        const selected = bookingForm.querySelector('input[name="vehicleId"]:checked');
        const price = Number(selected?.dataset.price || 0);
        if (selected) {
            summary.image.src = selected.dataset.image;
            summary.name.textContent = selected.dataset.name;
            summary.capacity.textContent = `${selected.dataset.capacity} ${bookingText('guests_unit')} · ${selected.dataset.luggage} ${bookingText('luggage_unit')}`;
        } else {
            summary.image.removeAttribute('src');
            summary.name.textContent = bookingText('no_suitable_vehicle');
            summary.capacity.textContent = '';
        }
        summary.pickup.textContent = pickupInput.value.trim() || bookingText('not_entered');
        summary.dropoff.textContent = dropoffInput.value.trim() || bookingText('not_entered');
        summary.airport.textContent = airportInput.value || bookingText('no_airport');
        const pickupDate = new Date(dateInput.value);
        summary.time.textContent = dateInput.value && !Number.isNaN(pickupDate.getTime()) ? pickupDate.toLocaleString(document.documentElement.lang || 'vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : bookingText('no_time');
        summary.price.textContent = currency(price);
        const option = paymentInputs.find(input => input.checked)?.value || 'deposit';
        summary.due.textContent = currency(option === 'full' ? price : Math.round(price * .3));
        bookingForm.querySelector('[data-deposit-amount]').textContent = currency(Math.round(price * .3));
        bookingForm.querySelector('[data-full-amount]').textContent = currency(price);
        const passengerInput = bookingForm.querySelector('input[name="passengerCount"]');
        if (selected && passengerInput) passengerInput.max = selected.dataset.capacity;
    };

    const refreshVehicleAvailability = async () => {
        if (!dateInput.value || !vehicleOptions.length) return;
        availabilityMessage.className = 'availability-message text-muted';
        availabilityMessage.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i> ${bookingText('checking_available')}`;
        try {
            const response = await fetch(`/api/vehicles?bookingDate=${encodeURIComponent(dateInput.value)}`, { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('Không thể kiểm tra xe');
            const availableIds = new Set((await response.json()).map(vehicle => String(vehicle._id)));
            let availableCount = 0;
            vehicleOptions.forEach(option => {
                const radio = option.querySelector('input[name="vehicleId"]');
                const available = availableIds.has(radio.value);
                option.classList.toggle('is-unavailable', !available);
                radio.disabled = !available;
                if (!available && radio.checked) radio.checked = false;
                if (available) availableCount++;
            });
            if (!bookingForm.querySelector('input[name="vehicleId"]:checked')) {
                const firstAvailable = vehicleOptions.find(option => !option.classList.contains('is-unavailable'))?.querySelector('input[name="vehicleId"]');
                if (firstAvailable) firstAvailable.checked = true;
            }
            availabilityMessage.textContent = availableCount ? bookingText('available_count', { count: availableCount }) : bookingText('no_available_vehicle');
            availabilityMessage.className = `availability-message ${availableCount ? 'text-success' : 'text-danger'}`;
            noVehicleMessage?.classList.toggle('d-none', availableCount > 0);
            updateSummary();
        } catch (error) {
            availabilityMessage.textContent = bookingText('availability_failed');
            availabilityMessage.className = 'availability-message text-warning';
        }
    };

    bookingForm.querySelectorAll('[data-quick-time]').forEach(button => {
        button.addEventListener('click', () => {
            const value = button.dataset.quickTime;
            const selectedDate = new Date();
            if (value === '3') selectedDate.setTime(Date.now() + 3 * 60 * 60 * 1000);
            else {
                selectedDate.setDate(selectedDate.getDate() + 1);
                selectedDate.setHours(value === 'tomorrow-8' ? 8 : 18, 0, 0, 0);
            }
            dateInput.value = toLocalInputValue(selectedDate);
            bookingForm.querySelectorAll('[data-quick-time]').forEach(item => item.classList.toggle('active', item === button));
            refreshVehicleAvailability();
            updateSummary();
        });
    });

    bookingForm.querySelectorAll('[data-quantity-minus], [data-quantity-plus]').forEach(button => {
        button.addEventListener('click', () => {
            const input = button.parentElement.querySelector('input[type="number"]');
            const current = Number(input.value || 0);
            const minimum = Number(input.min || 0);
            const maximum = Number(input.max || Number.MAX_SAFE_INTEGER);
            input.value = Math.min(maximum, Math.max(minimum, current + (button.hasAttribute('data-quantity-plus') ? 1 : -1)));
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });

    document.getElementById('routeSwap')?.addEventListener('click', () => {
        [pickupInput.value, dropoffInput.value] = [dropoffInput.value, pickupInput.value];
        updateSummary();
        pickupInput.focus();
    });

    vehicleOptions.forEach(option => option.querySelector('input').addEventListener('change', updateSummary));
    paymentInputs.forEach(input => input.addEventListener('change', updateSummary));
    [airportInput, pickupInput, dropoffInput, dateInput].forEach(input => input.addEventListener('input', updateSummary));
    dateInput.addEventListener('change', refreshVehicleAvailability);

    bookingForm.addEventListener('submit', event => {
        const selected = bookingForm.querySelector('input[name="vehicleId"]:checked');
        if (!selected) {
            event.preventDefault();
            showAlert('Không có xe trống để đặt trong thời gian đã chọn.', 'danger');
            return;
        }
        const passengerCount = Number(bookingForm.elements.passengerCount.value);
        if (passengerCount > Number(selected.dataset.capacity)) {
            event.preventDefault();
            showAlert(bookingText('capacity_error', { vehicle: selected.dataset.name, count: selected.dataset.capacity }), 'danger');
            bookingForm.elements.passengerCount.focus();
            return;
        }
        if (!bookingForm.checkValidity()) return;
        const submitButton = bookingForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${bookingText('creating_booking')}`;
    });

    updateSummary();
    refreshVehicleAvailability();
    window.addEventListener('sgp:languagechange', () => { updateSummary(); refreshVehicleAvailability(); });
    window.addEventListener('sgp:translationsready', () => { updateSummary(); refreshVehicleAvailability(); });
});
