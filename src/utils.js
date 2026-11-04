


export const utils = {
    showToast(message, type = 'success') {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    },
    formatDateRO(dateStr) {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const lang = localStorage.getItem('lang') === 'en' ? 'en-US' : 'ro-RO';
        return new Date(dateStr + 'T12:00:00').toLocaleDateString(lang, options);
    },
    timeToMins(time) { 
        if(!time) return 0;
        const [h, m] = time.split(':').map(Number); 
        return h * 60 + m; 
    },
    minsToTime(mins) { 
        let h = Math.floor(mins / 60); 
        const m = mins % 60; 
        if (h >= 24) h = h - 24; 
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; 
    },
    
    toDateStr(date) {
        const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },
    todayStr() { return this.toDateStr(new Date()); },
    addDays(dateStr, days) {
        const date = new Date(dateStr + 'T12:00:00');
        date.setDate(date.getDate() + days);
        return this.toDateStr(date);
    },
    
    weekday(dateStr) { return new Date(dateStr + 'T12:00:00').getDay(); },
    
    displayName(b) {
        return b.room ? `${b.userName} · ${b.room}` : b.userName;
    },
    upperFirst(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; },
    capitalize(str) {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    },
    escapeHtml(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    escapeCsvCell(str) {
        if (str == null) return '';
        const s = String(str);
        if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    },
    
    getMachineKey(type) {
        const map = { masina1: 'machine1', masina2: 'machine2' };
        return map[type] || type;
    }
};
