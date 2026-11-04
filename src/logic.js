
import { utils } from './utils.js';
import { MACHINES, BOOKING_WINDOW, SLOT_MINUTES, WEEKLY_SLOTS } from './config';

export const logic = {
    machines: MACHINES,

    
    getBookingWindow(now = new Date()) {
        const today = utils.toDateStr(now);
        const wd = now.getDay();                      
        const thisSunday = utils.addDays(today, (7 - wd) % 7);
        const nowMins = now.getHours() * 60 + now.getMinutes();
        
        const unlockIdx = BOOKING_WINDOW.unlockDay === 0 ? 7 : BOOKING_WINDOW.unlockDay;
        const todayIdx = wd === 0 ? 7 : wd;
        const unlockDate = utils.addDays(today, unlockIdx - todayIdx);
        const unlocked = todayIdx > unlockIdx || (todayIdx === unlockIdx && nowMins >= utils.timeToMins(BOOKING_WINDOW.unlockTime));
        const lastBookable = unlocked ? utils.addDays(thisSunday, 7) : thisSunday;
        
        const nextUnlockDate = unlocked ? utils.addDays(unlockDate, 7) : unlockDate;
        return { lastBookable, nextUnlockDate };
    },
    
    
    generateSlots(openMins = 0, closeMins = 1440) {
        const slots = [];
        for (let m = openMins; m < closeMins; m += 30) slots.push(utils.minsToTime(m));
        return slots;
    },

    isSlotFree(machine, date, start, duration, bookings) {
        const sameDayBookings = bookings.filter(b => b.machineType === machine && b.date === date);
        const reqStart = utils.timeToMins(start);
        const reqEnd = reqStart + parseInt(duration);
        
        const overlapSameDay = sameDayBookings.some(b => {
            const bStart = utils.timeToMins(b.startTime);
            const bEnd = bStart + parseInt(b.duration);
            return (reqStart < bEnd && reqEnd > bStart);
        });

        if (overlapSameDay) return false;

        const prevDate = utils.addDays(date, -1);
        const prevDayBookings = bookings.filter(b => b.machineType === machine && b.date === prevDate);
        
        const overlapPrevDay = prevDayBookings.some(b => {
            const bStart = utils.timeToMins(b.startTime);
            const bDuration = parseInt(b.duration);
            const bEndTotal = bStart + bDuration; 
            
            if (bEndTotal > 1440) { 
                const spillEnd = bEndTotal - 1440; 
                return reqStart < spillEnd;
            }
            return false;
        });

        return !overlapPrevDay;
    },

    slotMinutes: SLOT_MINUTES,
    weeklySlots: WEEKLY_SLOTS,

    
    weekStart(dateStr) {
        const wd = utils.weekday(dateStr);
        return utils.addDays(dateStr, -((wd + 6) % 7));
    },

    
    publicName(userName, room) {
        const parts = (userName || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '';
        const first = parts[0], last = parts.length > 1 ? ` ${parts[parts.length - 1].charAt(0)}.` : '';
        return `${first}${last} · ${(room || '').trim().toUpperCase()}`;
    },

    
    isOwner(b, userName, room) {
        const norm = s => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
        if (b.room) return norm(b.userName) === norm(userName) && norm(b.room) === norm(room);
        return norm(b.userName) === norm(this.publicName(userName, room));
    },

    
    slotsUsedInWeek(userName, room, dateStr, bookings) {
        if (!(userName || '').trim() || !(room || '').trim()) return 0;
        const mon = this.weekStart(dateStr), sun = utils.addDays(mon, 6);
        const mine = bookings.filter(b => b.date >= mon && b.date <= sun && this.isOwner(b, userName, room));
        const used = new Set();
        mine.forEach(b => {
            const s = utils.timeToMins(b.startTime);
            for (let m = s; m < s + parseInt(b.duration); m += SLOT_MINUTES) used.add(`${b.date}_${m}`);
        });
        return used.size;
    },

    
    slotsNeeded(duration) {
        return Math.ceil(duration / SLOT_MINUTES);
    },

    slotsLeft(userName, room, dateStr, bookings) {
        return Math.max(0, WEEKLY_SLOTS - this.slotsUsedInWeek(userName, room, dateStr, bookings));
    }
};
