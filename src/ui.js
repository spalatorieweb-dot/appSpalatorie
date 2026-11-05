import { utils } from './utils.js';
import { logic } from './logic.js';
import { data, ServerError } from './data';
import { i18n } from './i18n.js';
import { OPENING_HOURS, HISTORY_RETENTION_DAYS, RESPONSIBLE_PEOPLE } from './config';

const CDN = {
    xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw'],
    jspdf: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk'],
    autotable: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', 'sha384-fCAW/rDWORTbQXSiB7mOg0QtQ5c+r0f544y6XoKjuVva0nMBlCpNUjiFeG5iMdS3'],
    fonts: ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.min.js', 'sha384-dWs4+zGqy/KS6giKxiK+6iowhidQwjVFaiE1lMar36QwIulE44VyBSQp0brMCx4D'],
};

let localBookings = [];
let historyBookings = [];
let deleteId = null;
let isAdmin = false;
let brokenMachines = {};

export const ui = {
    currentDate: utils.todayStr(),

    init() {
        this.setupEventListeners();

        document.getElementById('responsibleNames').textContent = RESPONSIBLE_PEOPLE.join(', ');
        const hoursEl = document.getElementById('openingHours');
        if (hoursEl) hoursEl.textContent = `${OPENING_HOURS.open} – ${OPENING_HOURS.close}`;
        this.renderSlotRule();

        this.setupAuthListener();

        setTimeout(() => {
            const loader = document.getElementById('appLoader');
            if (loader && loader.style.display !== 'none') {
                const text = document.getElementById('loaderText');
                if (text) text.textContent = i18n.t("connection_takes_long");
                const btn = document.getElementById('reloadBtn');
                if (btn) { btn.style.display = 'inline-block'; btn.onclick = () => window.location.reload(); }
            }
        }, 5000);

        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
            if (localStorage.getItem('theme')) return;
            document.body.classList.toggle('dark-mode', e.matches);
            this.syncThemeColor();
        });
        this.syncThemeColor();

        this._today = utils.todayStr();
        this._lastBookable = logic.getBookingWindow().lastBookable;
        this.updateDateDisplay();
        this.startMidnightWatcher();

        this.updateMachineStatus();
        setInterval(() => this.updateMachineStatus(), 1000);

        const d = new Date(); d.setDate(d.getDate() - 1);
        const yesterdayStr = utils.toDateStr(d), mondayStr = logic.weekStart(utils.todayStr());
        this._loadedFrom = mondayStr < yesterdayStr ? mondayStr : yesterdayStr;

        let t1, t2;
        data.subscribe(
            () => { clearTimeout(t1); t1 = setTimeout(() => this.reloadBookings(), 150); },
            () => { clearTimeout(t2); t2 = setTimeout(() => this.reloadState(), 150); }
        );
        this.reloadBookings();
        this.reloadState();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') { this.reloadBookings(); this.reloadState(); }
        });
    },

    async reloadBookings() {
        try {
            localBookings = await data.fetchBookings(this._loadedFrom);
            this._weekCache = new Map();
            const loader = document.getElementById('appLoader');
            if (loader && loader.style.display !== 'none') { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 500); }
            this.renderAll();
            if (!document.getElementById('adminView').hidden) this.renderAdminDashboard();
        } catch (e) { console.error('Load bookings failed:', e); }
    },

    async reloadState() {
        try {
            const state = await data.fetchState();
            brokenMachines = state.brokenMachines;
            const toggle = document.getElementById('maintenanceToggle');
            if (toggle) toggle.checked = state.maintenance;
            this.showMaintenance(state.maintenance && !isAdmin);
            this.updateBrokenMachineVisuals();
            this.renderSchedule();
            this.updateMachineStatus();
            if (!document.getElementById('adminView').hidden) this.renderBrokenMachineToggles();
        } catch (e) { console.error('Load state failed:', e); }
    },

    showMaintenance(on) {
        document.getElementById('maintenanceOverlay').style.display = on ? 'flex' : 'none';
        document.documentElement.classList.toggle('maintenance-on', on);
    },

    // Machines
    updateBrokenMachineVisuals() {
        Object.keys(logic.machines).forEach(key => {
            const card = document.querySelector(`.selector-card[data-value="${key}"]`);
            if (card) card.classList.toggle('broken', !!brokenMachines[key]);
        });
    },

    async toggleBrokenMachine(machineKey) {
        if (!data.isAdmin) return;
        const newBroken = { ...brokenMachines, [machineKey]: !brokenMachines[machineKey] };
        try {
            await data.setState({ brokenMachines: newBroken });
            utils.showToast(newBroken[machineKey] ? i18n.t('broken_on_toast') : i18n.t('broken_off_toast'));
        } catch (e) { console.error(e); utils.showToast(i18n.t("error_generic"), "error"); }
    },

    startMidnightWatcher() {
        setInterval(() => {
            const realToday = utils.todayStr();
            const { lastBookable } = logic.getBookingWindow();
            if (realToday === this._today && lastBookable === this._lastBookable) return;
            const dayChanged = realToday !== this._today;
            this._today = realToday;
            this._lastBookable = lastBookable; 
            if (this.currentDate < realToday) this.currentDate = realToday;
            this.updateDateDisplay(); this.renderAll();
            if (dayChanged) utils.showToast(i18n.t("new_day_calendar_updated"));
        }, 60000);
    },

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (i18n.t(k)) el.textContent = i18n.t(k); });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const k = el.getAttribute('data-i18n-placeholder'); if (i18n.t(k)) el.setAttribute('placeholder', i18n.t(k)); });
        document.querySelectorAll('[data-i18n-title]').forEach(el => { const k = el.getAttribute('data-i18n-title'); if (i18n.t(k)) el.setAttribute('title', i18n.t(k)); });
        document.querySelectorAll('[data-i18n-aria]').forEach(el => { const k = el.getAttribute('data-i18n-aria'); if (i18n.t(k) !== k) el.setAttribute('aria-label', i18n.t(k)); });
    },

    // Live status
    updateMachineStatus() {
        if (document.hidden) return; 
        const today = utils.todayStr();
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const currentSecs = now.getSeconds();
        Object.keys(logic.machines).forEach(machineKey => {
            const statusEl = document.getElementById(`status-${machineKey}`);
            const card = document.querySelector(`.selector-card[data-value="${machineKey}"]`);
            if (!statusEl) return;
            if (brokenMachines[machineKey]) {
                statusEl.textContent = i18n.t('broken');
                statusEl.className = 'live-status broken';
                if (card) card.classList.remove('card-free');
                return;
            }
            const active = localBookings.find(b => {
                if (b.machineType !== machineKey || b.date !== today) return false;
                const sm = utils.timeToMins(b.startTime), em = sm + parseInt(b.duration);
                return currentMins >= sm && currentMins < em;
            });
            if (active) {
                const startMins = utils.timeToMins(active.startTime);
                const endMins = startMins + parseInt(active.duration);
                const totalSecsRaw = (endMins - currentMins) * 60 - currentSecs;
                const totalSecs = Math.max(0, totalSecsRaw);
                const mL = Math.floor(totalSecs / 60), sL = totalSecs % 60;
                const elapsed = currentMins - startMins;
                const progressPct = Math.min(100, Math.round((elapsed / parseInt(active.duration)) * 100));
                statusEl.className = 'live-status busy';
                statusEl.innerHTML = `<span class="busy-text">${i18n.t("busy")} – ${i18n.t("busy_remaining")} ${mL}:${sL.toString().padStart(2, '0')}</span><div class="status-progress-track"><div class="status-progress-fill" style="width:${progressPct}%"></div></div>`;
                if (card) card.classList.remove('card-free');
            } else {
                statusEl.textContent = i18n.t("free");
                statusEl.className = 'live-status free';
                if (card) card.classList.add('card-free');
            }
        });
    },

    // Events
    setupEventListeners() {
        this.setupViewport();
        document.getElementById('bookingForm').addEventListener('submit', this.handleBooking.bind(this));
        document.getElementById('scheduleGrid').addEventListener('click', (ev) => this.onScheduleClick(ev));
        document.getElementById('prevDay').onclick = () => this.changeDate(-1);
        document.getElementById('nextDay').onclick = () => this.changeDate(1);

        document.querySelectorAll('input[name="machineChoice"]').forEach(r => r.addEventListener('change', () => this.updateDurationOptions()));
        document.getElementById('slotChoice').addEventListener('change', () => this.updateEndHint());

        let nameTimer;
        ['userName', 'userRoom'].forEach(id => document.getElementById(id).addEventListener('input', () => {
            clearTimeout(nameTimer); nameTimer = setTimeout(() => this.updateDurationOptions(), 250);
        }));
        ['userName', 'userRoom', 'userPin'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.setFieldError(id, null));
        });
        document.getElementById('weekStrip').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-date]');
            if (btn && !btn.disabled) this.setDate(btn.dataset.date);
        });

        this.setupAdminListeners();

        document.querySelectorAll('.modal-close').forEach(btn => btn.onclick = () => this.closeModals());
        document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target.id === 'modalOverlay') this.closeModals(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('modalOverlay').style.display === 'flex') this.closeModals();
            if (e.key === 'Tab') this.trapFocus(e);
        });
        const successClose = document.getElementById('successModalCloseBtn');
        if (successClose) successClose.onclick = () => this.closeModals();

        const reqDelBtn = document.getElementById('requestDeleteBtn');
        if (reqDelBtn) reqDelBtn.onclick = () => this.requestDelete();
        const confirmPinBtn = document.getElementById('confirmPinDeleteBtn');
        if (confirmPinBtn) confirmPinBtn.onclick = () => this.confirmPinDelete();
        const cancelPinBtn = document.getElementById('cancelPinDeleteBtn');
        if (cancelPinBtn) cancelPinBtn.onclick = () => this.closeModals();

        const pinInput = document.getElementById('deletePinInput');
        if (pinInput) pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.confirmPinDelete(); });
        [['userName', 'userRoom'], ['userRoom', 'userPin'], ['adminEmail', 'adminPassword']].forEach(([from, to]) => {
            document.getElementById(from).addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                document.getElementById(to).focus();
            });
        });

        document.getElementById('maintenanceToggle').onchange = async (e) => {
            if (!data.isAdmin) { e.target.checked = !e.target.checked; return; }
            const isChecked = e.target.checked;
            const statusLabel = document.getElementById('maintenanceStatusLabel');
            if (statusLabel) { statusLabel.textContent = isChecked ? i18n.t("system_offline") : i18n.t("system_online"); isChecked ? statusLabel.classList.add('offline') : statusLabel.classList.remove('offline'); }
            try {
                await data.setState({ maintenance: isChecked });
                utils.showToast(isChecked ? i18n.t("maintenance_on") : i18n.t("maintenance_off"));
            } catch (err) { console.error(err); utils.showToast(i18n.t("error_generic"), "error"); e.target.checked = !isChecked; }
        };

        document.getElementById('maintenanceAdminBtn').onclick = () => this.showAdmin();

        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) themeBtn.onclick = () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            this.syncThemeColor();
        };

        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        if (cancelDeleteBtn) cancelDeleteBtn.onclick = () => { this.closeModals(); deleteId = null; };

        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) confirmDeleteBtn.onclick = async () => {
            if (!data.isAdmin) return;
            const ids = this._deleteIds?.length ? this._deleteIds : [deleteId];
            this._deleteIds = null;
            await this.performAdminDelete(ids);
        };

        document.getElementById('adminToggleBtn').onclick = () => this.showAdmin();
        document.getElementById('adminLoginForm').addEventListener('submit', (e) => { e.preventDefault(); this.handleAdminLogin(); });
        document.getElementById('adminLogoutBtn').onclick = () => {
            data.signOut().then(() => utils.showToast(i18n.t("logout_success"))).catch(e => { console.error(e); utils.showToast(i18n.t("logout_error"), "error"); });
        };
    },

    setupAuthListener() {
        data.onAuthChange((user) => {
            isAdmin = user;
            this.reloadBookings(); 
            document.body.classList.toggle('admin-mode', !!user);
            if (user) {
                this.showMaintenance(false);

                if (this._loginPending) { this._loginPending = false; this.closeModals(); this.openAdminView(); }
            } else {
                this.closeAdminView();
                document.getElementById('adminPassword').value = '';
                const toggle = document.getElementById('maintenanceToggle');
                if (toggle?.checked) { this.showMaintenance(true); this.closeModals(); }
            }
        });
    },

    changeDate(days) {
        this.setDate(utils.addDays(this.currentDate, days));
    },

    setDate(newDate) {
        if (newDate === this.currentDate) return;
        const today = utils.todayStr();
        if (newDate < today) { utils.showToast(i18n.t("cannot_see_past"), 'error'); return; }

        const { lastBookable, nextUnlockDate } = logic.getBookingWindow();
        if (newDate > utils.addDays(lastBookable, 7)) {
            utils.showToast(`${i18n.t("week_locked_toast")} ${utils.formatDateRO(nextUnlockDate)}.`, 'error'); return;
        }
        const dir = newDate > this.currentDate ? 'next' : 'prev';
        this.currentDate = newDate;
        this.updateDateDisplay(); this.renderAll();
        this.animateDayChange(dir);
    },

    syncThemeColor() {
        const isDark = document.body.classList.contains('dark-mode');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = isDark ? '#16120E' : '#F7F4EF';

        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            const label = i18n.t(isDark ? 'theme_light' : 'theme_dark');
            btn.title = label; btn.setAttribute('aria-label', label);
        }
    },

    // Motion

    replayAnimation(el, cls) {
        if (!el) return;
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
    },

    animateDayChange(direction) {
        this.replayAnimation(document.getElementById('scheduleGrid'), direction === 'next' ? 'slide-from-right' : direction === 'prev' ? 'slide-from-left' : 'fade-in');
        this.replayAnimation(document.getElementById('currentDateDisplay'), 'fade-in');
    },

    updateDateDisplay() {
        const display = document.getElementById('currentDateDisplay');
        const today = utils.todayStr();
        const nice = utils.formatDateRO(this.currentDate);

        display.textContent = this.currentDate === today ? `${i18n.t("today_display")} · ${nice.split(', ').slice(1).join(', ') || nice}` : nice;
        const prev = document.getElementById('prevDay');
        if (prev) prev.disabled = this.currentDate <= today;
        const next = document.getElementById('nextDay');
        if (next) next.disabled = this.currentDate >= utils.addDays(logic.getBookingWindow().lastBookable, 7);
    },

    renderWeekStrip() {
        const strip = document.getElementById('weekStrip');
        if (!strip) return;
        const today = utils.todayStr();
        const { lastBookable } = logic.getBookingWindow();
        const maxView = utils.addDays(lastBookable, 7);
        const wd = utils.weekday(this.currentDate);
        const monday = utils.addDays(this.currentDate, -((wd + 6) % 7));
        const lang = i18n.currentLang === 'en' ? 'en-US' : 'ro-RO';
        const slotsPerDay = (utils.timeToMins(OPENING_HOURS.close) - utils.timeToMins(OPENING_HOURS.open)) / 30 * Object.keys(logic.machines).length;
        let html = '';
        for (let k = 0; k < 7; k++) {
            const d = utils.addDays(monday, k);
            const dt = new Date(d + 'T12:00:00');
            const dayName = dt.toLocaleDateString(lang, { weekday: 'short' }).replace('.', '');
            const isPast = d < today, isLocked = d > lastBookable, beyond = d > maxView;

            const used = localBookings.filter(b => b.date === d).reduce((a, b) => a + Math.ceil(parseInt(b.duration) / 30), 0);
            const load = used === 0 ? 0 : used / slotsPerDay < 0.34 ? 1 : used / slotsPerDay < 0.67 ? 2 : 3;
            const cls = ['week-day'];
            if (d === this.currentDate) cls.push('selected');
            if (d === today) cls.push('today');
            if (isLocked) cls.push('locked');
            const full = dt.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
            html += `<button type="button" class="${cls.join(' ')}" data-date="${d}" ${isPast || beyond ? 'disabled' : ''} aria-pressed="${d === this.currentDate}" ${d === today ? 'aria-current="date"' : ''} aria-label="${utils.escapeHtml(full + (isLocked ? ' — ' + i18n.t('locked') : ''))}">
                <span class="wd-name">${utils.escapeHtml(dayName)}</span><span class="wd-num">${dt.getDate()}</span>
                <span class="wd-load load-${load}" aria-hidden="true">${isLocked ? '<i class="fa-solid fa-lock"></i>' : ''}</span>
            </button>`;
        }
        strip.innerHTML = html;
    },

    // Success
    showSuccessModal(booking) {
        const endMins = utils.timeToMins(booking.startTime) + parseInt(booking.duration);
        document.getElementById('successMachine').textContent = booking.machines.map(m => i18n.t(utils.getMachineKey(m))).join(' + ');
        document.getElementById('successDate').textContent = utils.formatDateRO(booking.date);
        document.getElementById('successTime').textContent = `${booking.startTime} – ${utils.minsToTime(endMins)}`;
        document.getElementById('successDuration').textContent = `${this.slotsText(Math.ceil(booking.duration / logic.slotMinutes))} · ${booking.duration} min`;
        document.getElementById('successName').textContent = utils.displayName(booking);
        this.openModal('successModal', 'successModalCloseBtn');
    },

    // Modals

    openModal(id, focusId) {
        const overlay = document.getElementById('modalOverlay');
        clearTimeout(this._closeTimer);
        overlay.classList.remove('closing');
        if (overlay.style.display !== 'flex') this._returnFocus = document.activeElement;
        overlay.querySelectorAll(':scope > .modal-box').forEach(b => { b.style.display = 'none'; });
        this.lockScroll();
        overlay.style.display = 'flex';
        this._fitViewport?.();
        const box = document.getElementById(id);
        box.style.display = 'block';
        let target = (focusId && document.getElementById(focusId)) ||
            box.querySelector('input:not([type=hidden]):not([disabled]), select, button:not(.modal-close)');

        if (target?.matches('input') && window.matchMedia('(pointer: coarse)').matches) {
            box.setAttribute('tabindex', '-1'); target = box;
        }
        requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    },

    closeModals() {
        const overlay = document.getElementById('modalOverlay');
        if (overlay.style.display !== 'flex' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { this.finishClose(); return; }
        clearTimeout(this._closeTimer);
        overlay.classList.add('closing');
        this._closeTimer = setTimeout(() => this.finishClose(), window.innerWidth <= 600 ? 210 : 150);
    },

    finishClose() {
        const overlay = document.getElementById('modalOverlay');
        overlay.classList.remove('closing');
        overlay.style.display = 'none';
        Object.assign(overlay.style, { top: '', height: '', bottom: '' });
        overlay.querySelectorAll(':scope > .modal-box').forEach(b => { b.style.display = 'none'; });
        this.unlockScroll();
        document.querySelectorAll('.selected-slot').forEach(el => el.classList.remove('selected-slot'));
        const back = this._returnFocus;
        this._returnFocus = null;
        if (back && document.contains(back)) back.focus({ preventScroll: true });
    },

    setupViewport() {
        const overlay = document.getElementById('modalOverlay');
        const vv = window.visualViewport;
        if (vv) {
            this._fitViewport = () => {
                if (overlay.style.display !== 'flex') return;
                Object.assign(overlay.style, { top: `${vv.offsetTop}px`, height: `${vv.height}px`, bottom: 'auto' });
            };
            vv.addEventListener('resize', this._fitViewport);
            vv.addEventListener('scroll', this._fitViewport);
        }
        overlay.addEventListener('focusin', (e) => {
            if (!e.target.matches('input:not([type=radio])')) return;
            setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
        });
    },

    lockScroll() {
        if (this._scrollLock) return;
        const y = window.scrollY;
        const gap = window.innerWidth - document.documentElement.clientWidth;
        this._scrollLock = { y };
        Object.assign(document.body.style, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', paddingRight: gap ? `${gap}px` : '' });
    },

    unlockScroll() {
        if (!this._scrollLock) return;
        const { y } = this._scrollLock;
        this._scrollLock = null;
        Object.assign(document.body.style, { position: '', top: '', left: '', right: '', paddingRight: '' });
        window.scrollTo({ top: y, behavior: 'instant' });
    },

    trapFocus(e) {
        const overlay = document.getElementById('modalOverlay');
        if (overlay.style.display !== 'flex') return;
        const box = [...overlay.querySelectorAll(':scope > .modal-box')].find(b => b.style.display === 'block');
        if (!box) return;
        const items = [...box.querySelectorAll('button, input, select, a[href], [tabindex]:not([tabindex="-1"])')]
            .filter(el => !el.disabled && el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    },

    // Booking form

    openReserve(machine, slot) {
        this._draft = { date: this.currentDate, start: slot };
        const startMins = utils.timeToMins(slot);
        document.getElementById('reserveSummary').textContent =
            `${utils.upperFirst(utils.formatDateRO(this._draft.date))} · ${i18n.t('from_time')} ${slot}`;

        const machineOk = m => !brokenMachines[m] && logic.isSlotFree(m, this._draft.date, slot, 30, localBookings);
        const keys = Object.keys(logic.machines);
        document.querySelectorAll('input[name="machineChoice"]').forEach(r => {
            r.disabled = r.value === 'both' ? !keys.every(machineOk) : !machineOk(r.value);
            r.checked = r.value === machine;
        });
        const hint = document.getElementById('machineHint');
        const bothDisabled = document.querySelector('input[name="machineChoice"][value="both"]').disabled;
        hint.hidden = !bothDisabled;
        if (bothDisabled) hint.textContent = i18n.t('both_unavailable');

        const nameEl = document.getElementById('userName'), roomEl = document.getElementById('userRoom');
        nameEl.value = localStorage.getItem('userName') || '';
        roomEl.value = localStorage.getItem('userRoom') || '';
        this._wantedSlots = 2; 
        document.getElementById('slotChoice').innerHTML = '';
        this.updateDurationOptions();
        document.getElementById('userPin').value = '';
        ['userName', 'userRoom', 'userPin'].forEach(id => this.setFieldError(id, null));
        this.setFormError(null);

        this.openModal('reserveModal', !nameEl.value ? 'userName' : !roomEl.value ? 'userRoom' : 'userPin');
    },

    selectedMachines() {
        const v = document.querySelector('input[name="machineChoice"]:checked')?.value;
        if (!v) return [];
        return v === 'both' ? Object.keys(logic.machines) : [v];
    },

    fmt(key, vars = {}) {
        return i18n.t(key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    },
    slotsText(n) { return n === 1 ? i18n.t('slot_one') : this.fmt('slot_many', { n }); },

    renderSlotRule() {
        const el = document.getElementById('slotRule');
        if (el) el.textContent = this.fmt('slot_rule', { max: logic.weeklySlots, min: logic.slotMinutes });
    },

    updateDurationOptions() {
        if (!this._draft) return;
        const { date, start } = this._draft;
        const machines = this.selectedMachines();
        const closeMins = utils.timeToMins(OPENING_HOURS.close), startMins = utils.timeToMins(start);
        const name = utils.capitalize(document.getElementById('userName').value.trim().replace(/\s+/g, ' '));
        const roomVal = document.getElementById('userRoom').value.trim().toUpperCase();
        const left = name.length >= 3 && roomVal ? logic.slotsLeft(name, roomVal, date, localBookings) : logic.weeklySlots;
        this._slotsLeft = left;
        const box = document.getElementById('slotChoice');
        const current = parseInt(box.querySelector('input:checked')?.value) || this._wantedSlots || 1;
        let html = '', firstOk = null, keep = false;
        for (let n = 1; n <= logic.weeklySlots; n++) {
            const d = n * logic.slotMinutes;
            const ok = startMins + d <= closeMins
                && machines.every(m => logic.isSlotFree(m, date, start, d, localBookings))
                && logic.slotsNeeded(d) <= left;
            if (ok && firstOk === null) firstOk = n;
            if (ok && n === current) keep = true;
            html += `<label><input type="radio" name="slotCount" value="${n}" ${ok ? '' : 'disabled'}><span><strong>${this.slotsText(n)}</strong><small>${d} min</small></span></label>`;
        }
        box.innerHTML = html;
        const pick = keep ? current : (firstOk !== null ? Math.max(firstOk, ...[...box.querySelectorAll('input:not(:disabled)')].map(i => +i.value).filter(v => v <= current)) : null);
        if (pick) box.querySelector(`input[value="${pick}"]`).checked = true;
        this.updateEndHint();
    },

    selectedDuration() {
        const n = parseInt(document.querySelector('input[name="slotCount"]:checked')?.value);
        return n ? n * logic.slotMinutes : 0;
    },

    updateEndHint() {
        if (!this._draft) return;
        const hint = document.getElementById('endTimeHint');
        const d = this.selectedDuration();
        const left = this._slotsLeft ?? logic.weeklySlots;
        const leftText = left === 0
            ? this.fmt('slots_none_left', { max: logic.weeklySlots })
            : this.fmt('slots_left', { left, max: logic.weeklySlots });
        const esc = utils.escapeHtml;

        const range = d ? `${this._draft.start} – ${utils.minsToTime(utils.timeToMins(this._draft.start) + d)}` : '';
        hint.innerHTML = `<span class="hint-range">${esc(range)}</span><span class="hint-left${left === 0 ? ' none' : ''}">${esc(leftText)}</span>`;
    },

    setFieldError(id, msg) {
        const input = document.getElementById(id), err = document.getElementById('err-' + id);
        if (!input || !err) return;
        err.textContent = msg || '';
        err.hidden = !msg;
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    },

    setFormError(msg) {
        const box = document.getElementById('reserveError');
        box.hidden = !msg;
        box.innerHTML = msg ? `<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>${utils.escapeHtml(msg)}</span>` : '';
    },

    // Submit
    async handleBooking(e) {
        e.preventDefault();
        if (!this._draft) return;
        const { date: bookingDate, start } = this._draft;
        const nameEl = document.getElementById('userName'), roomEl = document.getElementById('userRoom'), pinEl = document.getElementById('userPin');
        const userName = utils.capitalize(nameEl.value.trim().replace(/\s+/g, ' '));
        const room = roomEl.value.trim().toUpperCase();
        const pin = pinEl.value.trim();
        const machines = this.selectedMachines();
        const duration = this.selectedDuration();
        this.setFormError(null);

        const fieldErrors = {};
        if (userName.length < 3) fieldErrors.userName = i18n.t('short_name_err');
        if (!/^[0-9A-Z]{1,4}$/.test(room)) fieldErrors.userRoom = i18n.t('room_err');
        if (!/^\d{4}$/.test(pin)) fieldErrors.userPin = i18n.t('pin_4_digits_err');
        ['userName', 'userRoom', 'userPin'].forEach(id => this.setFieldError(id, fieldErrors[id]));
        const firstBad = ['userName', 'userRoom', 'userPin'].find(id => fieldErrors[id]);
        if (firstBad) { document.getElementById(firstBad).focus(); return; }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const orig = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;display:inline-block;"></div> ${i18n.t('verifying')}`;
        try {

            if (!machines.length) throw new Error(i18n.t("choose_machine_err"));
            if (machines.some(m => brokenMachines[m])) throw new Error(i18n.t("machine_broken_err"));
            const startMins = utils.timeToMins(start);
            const openMins = utils.timeToMins(OPENING_HOURS.open), closeMins = utils.timeToMins(OPENING_HOURS.close);
            if (startMins % 30 !== 0) throw new Error(i18n.t("half_hour_err"));
            if (startMins < openMins || startMins + duration > closeMins)
                throw new Error(`${i18n.t("outside_hours_err")} ${OPENING_HOURS.open} – ${OPENING_HOURS.close}.`);
            const todayStr = utils.todayStr();
            const nowD = new Date();
            if (bookingDate < todayStr || (bookingDate === todayStr && startMins + duration <= nowD.getHours() * 60 + nowD.getMinutes()))
                throw new Error(i18n.t("past_time_err"));
            const win = logic.getBookingWindow(nowD);
            if (bookingDate > win.lastBookable)
                throw new Error(`${i18n.t("week_locked_toast")} ${utils.formatDateRO(win.nextUnlockDate)}.`);
            if (!duration) throw new Error(this.fmt('slots_none_left', { max: logic.weeklySlots }));
            const left = logic.slotsLeft(userName, room, bookingDate, localBookings);
            if (logic.slotsNeeded(duration) > left)
                throw new Error(left === 0 ? this.fmt('slots_none_left', { max: logic.weeklySlots }) : this.fmt('weekly_limit_err', { left, max: logic.weeklySlots }));
            if (!machines.every(m => logic.isSlotFree(m, bookingDate, start, duration, localBookings))) throw new Error(i18n.t("slot_taken_err"));

            await data.book({ userName, room, pin, machines, date: bookingDate, start, duration });
            this.reloadBookings();

            localStorage.setItem('userName', userName);
            localStorage.setItem('userRoom', room);
            this._draft = null;
            this.showSuccessModal({ userName, room, machines, date: bookingDate, startTime: start, duration });
        } catch (error) {
            console.error(error);
            const msg = error instanceof ServerError ? this.serverErrorText(error) : (error?.message || i18n.t("server_error"));
            this.setFormError(msg);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = orig;
        }
    },

    renderAll() {
        this.renderSchedule(); this.renderWeekStrip(); this.updateMachineStatus();
        if (!document.getElementById('adminView').hidden) this.renderAdminDashboard();
    },

    // Schedule

    renderSchedule() {
        const grid = document.getElementById('scheduleGrid');
        const openMins = utils.timeToMins(OPENING_HOURS.open);
        const closeMins = utils.timeToMins(OPENING_HOURS.close);
        const slots = logic.generateSlots(openMins, closeMins);
        const dayBookings = localBookings.filter(b => b.date === this.currentDate);
        this._bookingsById = new Map(dayBookings.map(b => [b.id, b]));

        const now = new Date();
        const isToday = this.currentDate === utils.todayStr();
        const nowMins = now.getHours() * 60 + now.getMinutes();

        const { lastBookable, nextUnlockDate } = logic.getBookingWindow(now);
        const isLocked = this.currentDate > lastBookable;
        const notice = document.getElementById('scheduleLockNotice');
        if (notice) {
            notice.hidden = !isLocked;
            if (isLocked) notice.innerHTML = `<i class="fa-solid fa-lock"></i><span>${utils.escapeHtml(i18n.t('week_locked_notice'))} <strong>${utils.escapeHtml(utils.formatDateRO(nextUnlockDate))}</strong>.</span>`;
        }

        const esc = utils.escapeHtml;
        const html = Object.keys(logic.machines).map(machineKey => {
            const isBroken = !!brokenMachines[machineKey];
            const label = esc(i18n.t(utils.getMachineKey(machineKey)));
            const header = isBroken
                ? `<span class="broken-badge-header"><i class="fa-solid fa-wrench" aria-hidden="true"></i> ${esc(i18n.t('broken'))}</span><span class="mh-name">${label}</span>`
                : `<svg class="machine-icon" aria-hidden="true"><use href="#icon-washer"/></svg><span class="mh-name">${label}</span>`;
            const machineBookings = dayBookings.filter(b => b.machineType === machineKey);

            const cells = slots.map(slot => {
                const slotMins = utils.timeToMins(slot);
                const nextSlotMins = slotMins + 30;
                const slotRange = `${slot} – ${utils.minsToTime(nextSlotMins)}`;
                const booking = machineBookings.find(b => {
                    const bS = utils.timeToMins(b.startTime);
                    return bS < nextSlotMins && bS + parseInt(b.duration) > slotMins;
                });

                if (booking) {
                    const bS = utils.timeToMins(booking.startTime), bE = bS + parseInt(booking.duration);
                    const cls = ['time-slot', 'occupied'];
                    if (bS >= slotMins) cls.push('booking-start');
                    if (bE <= nextSlotMins) cls.push('booking-end');
                    if (bS < slotMins && bE > nextSlotMins) cls.push('booking-middle');
                    const who = utils.displayName(booking);
                    const range = `${booking.startTime} – ${utils.minsToTime(bE)}`;
                    const isStart = bS >= slotMins && bS < nextSlotMins;
                    const content = isStart
                        ? `<span class="slot-content"><span class="slot-time">${esc(range)}</span><span class="slot-name">${esc(who)}</span></span>`
                        : '';

                    return isStart
                        ? `<button type="button" class="${cls.join(' ')}" data-booking-id="${esc(booking.id)}" aria-label="${esc(`${label}, ${range}, ${i18n.t('reserved')} ${who}`)}">${content}</button>`
                        : `<div class="${cls.join(' ')}" data-booking-id="${esc(booking.id)}" aria-hidden="true"></div>`;
                }
                if (isBroken) return `<div class="time-slot broken-slot" aria-label="${esc(label + ', ' + slot + ', ' + i18n.t('broken'))}"><i class="fa-solid fa-wrench" aria-hidden="true"></i></div>`;
                if (isLocked) return `<div class="time-slot locked-slot" aria-label="${esc(label + ', ' + slotRange + ', ' + i18n.t('locked'))}">${slotRange}</div>`;
                if (isToday && nextSlotMins <= nowMins) return `<div class="time-slot past-slot" aria-hidden="true">${slotRange}</div>`;
                return `<button type="button" class="time-slot available" data-machine="${machineKey}" data-slot="${slot}" aria-label="${esc(`${label}, ${slotRange}, ${i18n.t('free')}`)}">${slotRange}</button>`;
            }).join('');

            return `<div class="machine-column${isBroken ? ' machine-column-broken' : ''}"><div class="machine-header${isBroken ? ' machine-header-broken' : ''}">${header}</div>${cells}</div>`;
        }).join('');
        grid.innerHTML = html;

        
        if (isToday && this._lastScrolledDate !== this.currentDate) {
            this._lastScrolledDate = this.currentDate;
            requestAnimationFrame(() => {
                const idx = Math.max(0, Math.floor((nowMins - openMins) / 30) - 1);
                const target = grid.querySelector('.machine-column')?.querySelectorAll('.time-slot')[idx];
                if (target) grid.scrollTop = target.offsetTop - 60;
            });
        } else if (!isToday) {
            this._lastScrolledDate = null;
        }
    },

    onScheduleClick(ev) {
        const cell = ev.target.closest('.time-slot');
        if (!cell) return;
        if (cell.dataset.bookingId) {
            const booking = this._bookingsById?.get(cell.dataset.bookingId);
            if (booking) this.showBookingModal(booking);
            return;
        }
        if (!cell.dataset.slot) return;
        document.querySelectorAll('.selected-slot').forEach(el => el.classList.remove('selected-slot'));
        cell.classList.add('selected-slot');
        this.openReserve(cell.dataset.machine, cell.dataset.slot);
    },

    showBookingModal(booking) {
        deleteId = booking.id;
        document.getElementById('modalUserName').textContent = utils.displayName(booking);
        const end = utils.minsToTime(utils.timeToMins(booking.startTime) + parseInt(booking.duration));
        document.getElementById('modalBookingInfo').textContent =
            `${i18n.t(utils.getMachineKey(booking.machineType))} • ${utils.formatDateRO(booking.date)} • ${booking.startTime} – ${end} (${this.slotsText(Math.ceil(parseInt(booking.duration) / logic.slotMinutes))})`;
        const label = document.querySelector('#requestDeleteBtn span');
        label.dataset.i18n = data.isAdmin ? 'admin_delete' : 'delete';
        label.textContent = i18n.t(label.dataset.i18n);
        this.openModal('bookingModal', 'requestDeleteBtn');
    },

    requestDelete(id) {
        if (id) deleteId = id;
        if (data.isAdmin) { this.confirmDelete([deleteId]); return; }
        const input = document.getElementById('deletePinInput');
        input.value = ''; input.removeAttribute('aria-invalid');
        this.openModal('deletePinModal', 'deletePinInput');
    },

    async confirmPinDelete() {
        const input = document.getElementById('deletePinInput');
        const enteredPin = input.value.trim();
        const booking = this.findBooking(deleteId);
        if (!booking) { utils.showToast(i18n.t("booking_not_found_err"), "error"); this.closeModals(); return; }

        if (!/^\d{4}$/.test(enteredPin)) { utils.showToast(i18n.t("enter_4_pin_err"), "error"); return; }
        const btn = document.getElementById('confirmPinDeleteBtn');
        if (btn) btn.disabled = true;
        try {

            const res = await data.cancel(deleteId, enteredPin);
            if (res === 'ok') { this.afterDelete([deleteId]); return; }
            const key = res === 'locked' ? 'too_many_attempts_err' : res === 'not_found' ? 'booking_not_found_err' : 'wrong_pin_err';
            utils.showToast(i18n.t(key), "error");
            if (res === 'not_found') { this.closeModals(); this.reloadBookings(); return; }
            input.value = ''; input.setAttribute('aria-invalid', 'true'); input.focus();
        } catch (e) {
            console.error("Cancel error:", e);
            utils.showToast(e instanceof ServerError ? this.serverErrorText(e) : i18n.t("error_generic"), 'error');
        } finally { if (btn) btn.disabled = false; }
    },

    async performAdminDelete(ids) {
        if (!data.isAdmin || !ids.length) return;
        try {
            await data.adminDelete(ids);
            this.afterDelete(ids);
        } catch (e) {
            console.error("Delete error:", e);
            utils.showToast(e instanceof ServerError ? this.serverErrorText(e) : i18n.t("error_generic"), 'error');
        }
    },

    afterDelete(ids) {
        const gone = new Set(ids);
        localBookings = localBookings.filter(b => !gone.has(b.id));
        historyBookings = historyBookings.filter(b => !gone.has(b.id));
        this._weekCache?.forEach((list, k) => this._weekCache.set(k, list.filter(b => !gone.has(b.id))));
        if (this._adminWeekData) this._adminWeekData = this._adminWeekData.filter(b => !gone.has(b.id));
        deleteId = null;
        utils.showToast(i18n.t("delete_success"));
        this.renderAll();
        if (!document.getElementById('adminView').hidden) this.renderAdminDashboard();
        this.closeModals();
    },

    serverErrorText(err) {
        const max = logic.weeklySlots;
        switch (err.key) {
            case 'outside_hours_err': return `${i18n.t('outside_hours_err')} ${OPENING_HOURS.open} – ${OPENING_HOURS.close}.`;
            case 'week_locked_toast': return `${i18n.t('week_locked_toast')} ${utils.formatDateRO(logic.getBookingWindow().nextUnlockDate)}.`;
            case 'weekly_limit_err': {
                const left = parseInt(err.detail) || 0;
                return left === 0 ? this.fmt('slots_none_left', { max }) : this.fmt('weekly_limit_err', { left, max });
            }
            case 'maintenance': return i18n.t('maintenance_title');
            default: {
                const txt = i18n.t(err.key);
                return txt && txt !== err.key ? txt : i18n.t('server_error');
            }
        }
    },

    findBooking(id) {
        const all = [...localBookings, ...historyBookings, ...[...(this._weekCache?.values() || [])].flat()];
        return all.find(b => b.id === id);
    },

    confirmDelete(ids) {
        if (!data.isAdmin) return;
        const list = Array.isArray(ids) ? ids : [ids];
        this._deleteIds = list;
        deleteId = list[0];
        this.openModal('confirmModal', 'cancelDeleteBtn');
    },

    showAdmin() {
        if (this.isAdminActive()) this.openAdminView();
        else { document.getElementById('adminLoginError').hidden = true; this.openModal('adminModal', 'adminEmail'); }
    },

    async handleAdminLogin() {
        const errBox = document.getElementById('adminLoginError');
        const showErr = (msg) => { errBox.hidden = !msg; errBox.innerHTML = msg ? `<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><span>${utils.escapeHtml(msg)}</span>` : ''; };
        showErr(null);
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        if (!email || !password) { showErr(i18n.t("enter_email_pass_err")); return; }
        const btn = document.getElementById('adminLoginBtn');
        const orig = btn.innerHTML;
        btn.disabled = true; btn.textContent = i18n.t("logging_in");
        try {
            this._loginPending = true;
            await data.signIn(email, password);
            utils.showToast(i18n.t("login_success"));
        } catch (error) {
            this._loginPending = false;
            const key = error instanceof ServerError ? error.key : 'login_err_default';
            showErr(i18n.t(key) || i18n.t('login_err_default'));
        } finally { btn.disabled = false; btn.innerHTML = orig; }
    },

    // Admin
    isAdminActive() { return data.isAdmin; },

    setupAdminListeners() {
        const view = document.getElementById('adminView');
        document.getElementById('avPrevWeek').onclick = () => this.loadAdminWeek(utils.addDays(this._adminWeek, -7));
        document.getElementById('avNextWeek').onclick = () => this.loadAdminWeek(utils.addDays(this._adminWeek, 7));
        document.getElementById('avThisWeek').onclick = () => this.loadAdminWeek(logic.weekStart(utils.todayStr()));
        document.getElementById('avClose').onclick = () => this.closeAdminView();
        document.getElementById('avExportXlsx').onclick = () => this.exportWeekXlsx();
        document.getElementById('avExportPdf').onclick = () => this.exportWeekPdf();
        document.getElementById('avTabGrid').onclick = () => this.setAdminTab('grid');
        document.getElementById('avTabList').onclick = () => this.setAdminTab('list');
        let t;
        document.getElementById('adminSearchInput').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => this.renderAdminDashboard(), 150); });
        view.addEventListener('click', (e) => {
            const del = e.target.closest('[data-delete-ids]');
            if (del) this.confirmDelete(del.dataset.deleteIds.split(','));
            const broken = e.target.closest('.broken-toggle');
            if (broken?.dataset.machine) this.toggleBrokenMachine(broken.dataset.machine);
        });
        view.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('modalOverlay').style.display !== 'flex') this.closeAdminView();
        });
    },

    openAdminView() {
        if (!this.isAdminActive()) { this.openModal('adminModal'); return; }
        const view = document.getElementById('adminView');
        if (view.hidden) this._adminReturnFocus = document.activeElement;
        view.hidden = false;
        document.body.classList.add('admin-open');
        this.replayAnimation(view, 'av-enter');
        document.getElementById('avUser').textContent = data.userEmail || i18n.t('av_preview');
        this.loadAdminWeek(this._adminWeek || logic.weekStart(utils.todayStr()));
        requestAnimationFrame(() => document.getElementById('adminViewTitle').focus({ preventScroll: true }));
    },

    closeAdminView() {
        const view = document.getElementById('adminView');
        if (view.hidden) return;
        view.hidden = true;
        document.body.classList.remove('admin-open');
        const back = this._adminReturnFocus; this._adminReturnFocus = null;
        if (back && document.contains(back)) back.focus({ preventScroll: true });
    },

    setAdminTab(tab) {
        this._adminTab = tab;
        const isGrid = tab !== 'list';
        document.getElementById('avTabGrid').setAttribute('aria-selected', String(isGrid));
        document.getElementById('avTabList').setAttribute('aria-selected', String(!isGrid));
        document.getElementById('avGridPanel').hidden = !isGrid;
        document.getElementById('avListPanel').hidden = isGrid;
        this.replayAnimation(document.getElementById(isGrid ? 'avGridPanel' : 'avListPanel'), 'fade-in');
    },

    async getWeekBookings(mon) {
        const sun = utils.addDays(mon, 6);
        if (this._loadedFrom && mon >= this._loadedFrom) return localBookings.filter(b => b.date >= mon && b.date <= sun);
        this._weekCache = this._weekCache || new Map();
        if (this._weekCache.has(mon)) return this._weekCache.get(mon);
        const list = await data.fetchBookings(mon, sun);
        this._weekCache.set(mon, list);
        return list;
    },

    async loadAdminWeek(mon) {
        const thisMon = logic.weekStart(utils.todayStr());
        const oldest = logic.weekStart(utils.addDays(utils.todayStr(), -HISTORY_RETENTION_DAYS));
        const newest = utils.addDays(thisMon, 7);
        if (mon < oldest || mon > newest) return;
        const dir = this._adminWeek && mon !== this._adminWeek ? (mon > this._adminWeek ? 'next' : 'prev') : null;
        this._adminWeek = mon;
        document.getElementById('avPrevWeek').disabled = mon <= oldest;
        document.getElementById('avNextWeek').disabled = mon >= newest;
        document.getElementById('avThisWeek').disabled = mon === thisMon;
        this.renderAdminWeekLabel();
        const body = document.getElementById('avContent');
        body.classList.add('is-loading');
        const token = this._adminLoad = {};
        try {
            const list = await this.getWeekBookings(mon);
            if (this._adminLoad !== token) return; 
            this._adminWeekData = list;
        } catch (e) {
            console.error(e);
            this._adminWeekData = [];
            utils.showToast(i18n.t('history_error'), 'error');
        }
        body.classList.remove('is-loading');
        this.renderAdminDashboard();
        if (dir) this.replayAnimation(document.getElementById('avContent'), dir === 'next' ? 'slide-from-right' : 'slide-from-left');
    },

    renderAdminWeekLabel() {
        const mon = this._adminWeek, sun = utils.addDays(mon, 6);
        const lang = i18n.currentLang === 'en' ? 'en-US' : 'ro-RO';
        const d1 = new Date(mon + 'T12:00:00'), d2 = new Date(sun + 'T12:00:00');
        const sameMonth = d1.getMonth() === d2.getMonth();
        const left = d1.toLocaleDateString(lang, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' });
        const right = d2.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('avWeekLabel').textContent = `${left} – ${right}`;
        const thisMon = logic.weekStart(utils.todayStr());
        const diff = Math.round((new Date(mon) - new Date(thisMon)) / (7 * 864e5));
        const tag = diff === 0 ? i18n.t('av_tag_current') : diff === 1 ? i18n.t('av_tag_next')
            : diff === -1 ? i18n.t('av_tag_last') : this.fmt('av_tag_ago', { n: -diff });
        const tagEl = document.getElementById('avWeekTag');
        tagEl.textContent = tag;
        tagEl.className = diff === 0 ? 'current' : '';
    },

    groupBookings(list) {
        const groups = new Map();
        list.forEach(b => {
            const key = [b.date, b.startTime, b.duration, (b.userName || '').toLowerCase(), b.room || ''].join('|');
            if (!groups.has(key)) groups.set(key, { date: b.date, startTime: b.startTime, duration: parseInt(b.duration), userName: b.userName, room: b.room || '', machines: [], ids: [], createdAt: b.createdAt });
            const g = groups.get(key);
            g.machines.push(b.machineType); g.ids.push(b.id);
        });
        const order = Object.keys(logic.machines);
        return [...groups.values()]
            .map(g => ({ ...g, machines: g.machines.sort((a, b) => order.indexOf(a) - order.indexOf(b)) }))
            .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    },

    machineShort(key) { return 'M' + (Object.keys(logic.machines).indexOf(key) + 1); },

    renderAdminDashboard() {
        if (!this.isAdminActive() || document.getElementById('adminView').hidden || !this._adminWeek) return;
        const mon = this._adminWeek, sun = utils.addDays(mon, 6);

        if (this._loadedFrom && mon >= this._loadedFrom) this._adminWeekData = localBookings.filter(b => b.date >= mon && b.date <= sun);
        const raw = this._adminWeekData || [];
        const groups = this.groupBookings(raw);
        const term = (document.getElementById('adminSearchInput').value || '').trim().toLowerCase();
        const shown = term ? groups.filter(g => utils.displayName(g).toLowerCase().includes(term)) : groups;

        this.renderAdminKpis(raw, groups);
        this.renderAdminGrid(shown, term);
        this.renderAdminList(shown);
        this.renderAdminDayLoad(raw);
        this.renderAdminPeople(groups);
        this.renderBrokenMachineToggles();

        const toggle = document.getElementById('maintenanceToggle');
        const statusLabel = document.getElementById('maintenanceStatusLabel');
        if (toggle && statusLabel) {
            statusLabel.textContent = toggle.checked ? i18n.t("system_offline") : i18n.t("system_online");
            statusLabel.classList.toggle('offline', toggle.checked);
        }
        document.getElementById('avExportXlsx').disabled = !groups.length;
        document.getElementById('avExportPdf').disabled = !groups.length;
    },

    weekCapacity() {
        const perDay = (utils.timeToMins(OPENING_HOURS.close) - utils.timeToMins(OPENING_HOURS.open)) / logic.slotMinutes;
        return perDay * Object.keys(logic.machines).length;
    },

    renderAdminKpis(raw, groups) {
        const used = raw.reduce((a, b) => a + Math.ceil(parseInt(b.duration) / logic.slotMinutes), 0);
        const cap = this.weekCapacity() * 7;
        const people = new Set(groups.map(g => (g.userName || '').toLowerCase())).size;
        const byDay = this.dayLoads(raw);
        const best = byDay.reduce((a, b) => (b.used > a.used ? b : a), byDay[0]);
        const esc = utils.escapeHtml;
        const kpi = (icon, label, value, sub) => `<div class="card av-kpi"><i class="${icon}" aria-hidden="true"></i><div><span class="av-kpi-label">${esc(label)}</span><span class="av-kpi-value">${esc(value)}</span>${sub ? `<span class="av-kpi-sub">${esc(sub)}</span>` : ''}</div></div>`;
        document.getElementById('avKpis').innerHTML =
            kpi('fa-regular fa-calendar-check', i18n.t('av_kpi_bookings'), String(groups.length), this.fmt('av_kpi_bookings_sub', { n: raw.length })) +
            kpi('fa-solid fa-layer-group', i18n.t('av_kpi_slots'), `${used} / ${cap}`, `${cap ? Math.round(used / cap * 100) : 0}% ${i18n.t('av_kpi_occupied')}`) +
            kpi('fa-solid fa-user-group', i18n.t('av_kpi_people'), String(people), '') +
            kpi('fa-solid fa-chart-simple', i18n.t('av_kpi_busiest'), best && best.used ? best.label : '—', best && best.used ? `${best.pct}%` : '');
    },

    dayLoads(raw) {
        const cap = this.weekCapacity();
        const lang = i18n.currentLang === 'en' ? 'en-US' : 'ro-RO';
        return [0, 1, 2, 3, 4, 5, 6].map(k => {
            const d = utils.addDays(this._adminWeek, k);
            const used = raw.filter(b => b.date === d).reduce((a, b) => a + Math.ceil(parseInt(b.duration) / logic.slotMinutes), 0);
            const label = utils.upperFirst(new Date(d + 'T12:00:00').toLocaleDateString(lang, { weekday: 'long' }));
            return { d, used, label, pct: cap ? Math.round(used / cap * 100) : 0 };
        });
    },

    renderAdminDayLoad(raw) {
        const today = utils.todayStr();
        document.getElementById('avDayLoad').innerHTML = this.dayLoads(raw).map(x =>
            `<div class="av-bar-row${x.d === today ? ' today' : ''}"><span class="av-bar-label">${utils.escapeHtml(x.label)}</span><div class="av-bar-track"><div class="av-bar-fill" style="width:${x.pct}%"></div></div><span class="av-bar-val">${x.pct}%</span></div>`
        ).join('');
    },

    renderAdminPeople(groups) {
        const people = new Map();
        groups.forEach(g => {
            const key = (g.userName || '').toLowerCase();
            const p = people.get(key) || { name: utils.displayName(g), slots: 0 };

            p.slots += logic.slotsNeeded(g.duration);
            people.set(key, p);
        });
        const list = [...people.values()].sort((a, b) => b.slots - a.slots || a.name.localeCompare(b.name));
        const max = logic.weeklySlots;
        document.getElementById('avPeople').innerHTML = list.length
            ? `<ul class="av-people">${list.map(p => `<li class="${p.slots > max ? 'over' : p.slots === max ? 'full' : ''}"><span>${utils.escapeHtml(p.name)}</span><span class="av-people-n">${p.slots}/${max}</span></li>`).join('')}</ul>`
            : `<p class="av-empty-small">${i18n.t('av_empty_week')}</p>`;
    },

    renderAdminGrid(groups, term) {
        const mon = this._adminWeek, today = utils.todayStr();
        const lang = i18n.currentLang === 'en' ? 'en-US' : 'ro-RO';
        const days = [0, 1, 2, 3, 4, 5, 6].map(k => utils.addDays(mon, k));
        const slots = logic.generateSlots(utils.timeToMins(OPENING_HOURS.open), utils.timeToMins(OPENING_HOURS.close));
        const esc = utils.escapeHtml;
        const head = days.map(d => {
            const dt = new Date(d + 'T12:00:00');
            return `<th scope="col" class="${d === today ? 'today' : ''}"><span>${esc(dt.toLocaleDateString(lang, { weekday: 'short' }).replace('.', ''))}</span><strong>${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}</strong></th>`;
        }).join('');
        const rows = slots.map(slot => {
            const sm = utils.timeToMins(slot);
            const cells = days.map(d => {
                const here = groups.filter(g => g.date === d && utils.timeToMins(g.startTime) <= sm && utils.timeToMins(g.startTime) + g.duration > sm);
                const inner = here.map(g => {
                    const isStart = utils.timeToMins(g.startTime) === sm;
                    return `<div class="av-entry${isStart ? '' : ' cont'}" title="${esc(`${utils.displayName(g)} · ${g.startTime} – ${utils.minsToTime(utils.timeToMins(g.startTime) + g.duration)}`)}"><span class="av-entry-name">${esc(utils.displayName(g))}</span><span class="av-tags">${g.machines.map(m => `<span class="mtag">${this.machineShort(m)}</span>`).join('')}</span></div>`;
                }).join('');
                return `<td class="${d === today ? 'today' : ''}${here.length ? ' has' : ''}">${inner}</td>`;
            }).join('');
            return `<tr><th scope="row">${slot}</th>${cells}</tr>`;
        }).join('');
        const empty = !groups.length ? `<p class="av-empty">${term ? i18n.t('no_bookings_search') : i18n.t('av_empty_week')}</p>` : '';
        document.getElementById('avGridPanel').innerHTML = `${empty}<div class="av-grid-wrap"><table class="av-grid"><thead><tr><th scope="col" class="corner">${i18n.t('av_col_time')}</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },

    renderAdminList(groups) {
        const esc = utils.escapeHtml;
        const canDelete = data.isAdmin;
        if (!groups.length) { document.getElementById('avListPanel').innerHTML = `<p class="av-empty">${i18n.t('av_empty_week')}</p>`; return; }
        const rows = groups.map(g => {
            const end = utils.minsToTime(utils.timeToMins(g.startTime) + g.duration);
            return `<tr>
                <td>${esc(utils.upperFirst(utils.formatDateRO(g.date)))}</td>
                <td class="num">${esc(g.startTime)} – ${esc(end)}</td>
                <td class="strong">${esc(g.userName)}</td>
                <td class="num">${esc(g.room || '—')}</td>
                <td>${g.machines.map(m => `<span class="mtag">${this.machineShort(m)}</span>`).join(' ')}</td>
                <td class="num">${this.slotsText(Math.ceil(g.duration / logic.slotMinutes))}</td>
                <td class="act">${canDelete ? `<button type="button" class="btn-delete-vip" data-delete-ids="${esc(g.ids.join(','))}" aria-label="${esc(i18n.t('delete') + ' ' + utils.displayName(g))}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>` : ''}</td>
            </tr>`;
        }).join('');
        document.getElementById('avListPanel').innerHTML = `<div class="av-table-wrap"><table class="av-table">
            <thead><tr><th>${i18n.t('date')}</th><th>${i18n.t('av_col_interval')}</th><th>${i18n.t('name')}</th><th>${i18n.t('room')}</th><th>${i18n.t('av_col_machines')}</th><th>${i18n.t('slots')}</th><th class="act"><span class="sr-only">${i18n.t('delete')}</span></th></tr></thead>
            <tbody>${rows}</tbody></table></div>`;
    },

    renderBrokenMachineToggles() {
        const container = document.getElementById('brokenMachinesSection');
        if (!container) return;
        const esc = utils.escapeHtml;
        container.innerHTML = Object.keys(logic.machines).map(key => {
            const isBroken = !!brokenMachines[key];
            return `<div class="av-control-row">
                <div><span class="av-control-name">${esc(i18n.t(utils.getMachineKey(key)))}</span><span class="av-control-state${isBroken ? ' offline' : ''}">${isBroken ? esc(i18n.t('broken')) : esc(i18n.t('av_working'))}</span></div>
                <button type="button" class="btn-ghost broken-toggle" data-machine="${key}">${isBroken ? esc(i18n.t('broken_toggle_off')) : esc(i18n.t('broken_toggle_on'))}</button>
            </div>`;
        }).join('');
    },

    // Export
    loadScript([src, integrity]) {
        return new Promise((res, rej) => {
            if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
            const el = document.createElement('script');
            Object.assign(el, { src, integrity, crossOrigin: 'anonymous', onload: res, onerror: rej });
            document.head.appendChild(el);
        });
    },

    weekExportData() {
        const mon = this._adminWeek, sun = utils.addDays(mon, 6);
        const groups = this.groupBookings(this._adminWeekData || []);
        const days = [0, 1, 2, 3, 4, 5, 6].map(k => utils.addDays(mon, k));
        const slots = logic.generateSlots(utils.timeToMins(OPENING_HOURS.open), utils.timeToMins(OPENING_HOURS.close));
        const cellText = g => `${g.userName}${g.room ? ' ' + g.room : ''} ${g.machines.map(m => this.machineShort(m)).join('+')}`;
        const lang = i18n.currentLang === 'en' ? 'en-US' : 'ro-RO';
        const dayHead = days.map(d => {
            const dt = new Date(d + 'T12:00:00');
            return `${utils.upperFirst(dt.toLocaleDateString(lang, { weekday: 'long' }))} ${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}`;
        });
        const grid = slots.map(slot => {
            const sm = utils.timeToMins(slot);
            return [`${slot} – ${utils.minsToTime(sm + logic.slotMinutes)}`, ...days.map(d => groups
                .filter(g => g.date === d && utils.timeToMins(g.startTime) <= sm && utils.timeToMins(g.startTime) + g.duration > sm)
                .map(cellText).join('\n'))];
        });
        const list = groups.map(g => [
            g.date, utils.upperFirst(utils.formatDateRO(g.date)),
            `${g.startTime} – ${utils.minsToTime(utils.timeToMins(g.startTime) + g.duration)}`,
            g.userName, g.room || '', g.machines.map(m => this.machineShort(m)).join(' + '),
            Math.ceil(g.duration / logic.slotMinutes)
        ]);
        return { mon, sun, groups, dayHead, grid, list, title: `${i18n.t('app_title')} — ${document.getElementById('avWeekLabel').textContent}`, file: `spalatorie_${mon}_${sun}` };
    },

    async exportWeekXlsx() {
        if (!this.isAdminActive()) return;
        const data = this.weekExportData();
        if (!data.groups.length) { utils.showToast(i18n.t("no_export_data"), "error"); return; }
        const btn = document.getElementById('avExportXlsx'); btn.disabled = true;
        try {
            await this.loadScript(CDN.xlsx);
            const XLSX = window.XLSX;
            const wb = XLSX.utils.book_new();

            const s1 = XLSX.utils.aoa_to_sheet([[data.title], [], [i18n.t('av_col_time'), ...data.dayHead], ...data.grid]);
            s1['!cols'] = [{ wch: 15 }, ...data.dayHead.map(() => ({ wch: 26 }))];
            s1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
            s1['!freeze'] = { xSplit: 1, ySplit: 3 };
            XLSX.utils.book_append_sheet(wb, s1, i18n.t('av_sheet_grid'));

            const head = [i18n.t('date'), i18n.t('av_col_day'), i18n.t('av_col_interval'), i18n.t('name'), i18n.t('room'), i18n.t('av_col_machines'), i18n.t('slots')];
            const s2 = XLSX.utils.aoa_to_sheet([head, ...data.list]);
            s2['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 15 }, { wch: 24 }, { wch: 8 }, { wch: 10 }, { wch: 9 }];
            s2['!autofilter'] = { ref: `A1:G${data.list.length + 1}` };
            XLSX.utils.book_append_sheet(wb, s2, i18n.t('av_sheet_list'));
            XLSX.writeFile(wb, `${data.file}.xlsx`);
            utils.showToast(i18n.t('av_export_done'));
        } catch (e) { console.error(e); utils.showToast(i18n.t('av_export_error'), 'error'); }
        finally { btn.disabled = false; }
    },

    async exportWeekPdf() {
        if (!this.isAdminActive()) return;
        const data = this.weekExportData();
        if (!data.groups.length) { utils.showToast(i18n.t("no_export_data"), "error"); return; }
        const btn = document.getElementById('avExportPdf'); btn.disabled = true;
        utils.showToast(i18n.t("pdf_generating"));
        try {
            await this.loadScript(CDN.jspdf);
            await this.loadScript(CDN.autotable);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            let font = 'helvetica';
            try {
                await this.loadScript(CDN.fonts);
                const vfs = window.pdfMake?.vfs;
                if (vfs?.['Roboto-Regular.ttf'] && vfs?.['Roboto-Medium.ttf']) {
                    doc.addFileToVFS('Roboto-Regular.ttf', vfs['Roboto-Regular.ttf']); doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
                    doc.addFileToVFS('Roboto-Medium.ttf', vfs['Roboto-Medium.ttf']); doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');
                    font = 'Roboto';
                }
            } catch (e) { console.warn('PDF font fallback', e); }
            const T = v => font === 'Roboto' ? String(v) : String(v).normalize('NFD').replace(/[̀-ͯ]/g, '');
            const accent = [26, 122, 110];
            doc.setFont(font, 'bold'); doc.setFontSize(15); doc.setTextColor(28, 25, 22);
            doc.text(T(data.title), 12, 14);
            doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(110, 104, 98);
            doc.text(T(`${i18n.t('av_generated')} ${new Date().toLocaleString(i18n.currentLang === 'en' ? 'en-US' : 'ro-RO')}`), 12, 20);
            const common = { styles: { font, fontSize: 7.2, cellPadding: 1.4, lineColor: [224, 221, 213], lineWidth: 0.1, textColor: [28, 25, 22], valign: 'middle' },
                headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold', font }, theme: 'grid', margin: { left: 12, right: 12 } };
            doc.autoTable({ ...common, startY: 24,
                head: [[T(i18n.t('av_col_time')), ...data.dayHead.map(T)]],
                body: data.grid.map(r => r.map(T)),
                columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold', fillColor: [247, 244, 239] } },
                didParseCell: (h) => { if (h.section === 'body' && h.column.index > 0 && h.cell.raw) h.cell.styles.fillColor = [232, 245, 243]; } });
            doc.addPage();
            doc.setFont(font, 'bold'); doc.setFontSize(13); doc.setTextColor(28, 25, 22);
            doc.text(T(`${i18n.t('av_sheet_list')} — ${document.getElementById('avWeekLabel').textContent}`), 12, 14);
            doc.autoTable({ ...common, startY: 19, styles: { ...common.styles, fontSize: 8.5, cellPadding: 2 },
                head: [[i18n.t('av_col_day'), i18n.t('av_col_interval'), i18n.t('name'), i18n.t('room'), i18n.t('av_col_machines'), i18n.t('slots')].map(T)],
                body: data.list.map(r => r.slice(1).map(T)),
                alternateRowStyles: { fillColor: [247, 244, 239] } });
            const pages = doc.getNumberOfPages();
            for (let i = 1; i <= pages; i++) {
                doc.setPage(i); doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(140, 134, 128);
                doc.text(`${i} / ${pages}`, doc.internal.pageSize.getWidth() - 12, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
            }
            doc.save(`${data.file}.pdf`);
        } catch (err) { console.error(err); utils.showToast(i18n.t("pdf_error"), "error"); }
        finally { btn.disabled = false; }
    }
};

document.addEventListener('DOMContentLoaded', () => ui.init());

