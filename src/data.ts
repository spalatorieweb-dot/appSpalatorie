import { createClient, type PostgrestError, type Session } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export interface Booking {
  id: string;
  groupId: string;
  machineType: string;
  date: string;
  startTime: string;
  duration: number;
  userName: string;
  room?: string;
  createdAt?: string;
}

export interface AppState {
  maintenance: boolean;
  brokenMachines: Record<string, boolean>;
}

export type CancelResult = 'ok' | 'wrong_pin' | 'locked' | 'not_found';

export class ServerError extends Error {
  constructor(public key: string, public detail?: string) { super(key); }
}

const PUBLIC_COLS = 'id,group_id,machine,date,start_time,duration,public_name';
const ADMIN_COLS = 'id,group_id,machine,date,start_time,duration,user_name,room,created_at';

type Row = Record<string, any>;
const hhmm = (t: string) => String(t).slice(0, 5);

function toBooking(r: Row, admin: boolean): Booking {
  return {
    id: r.id,
    groupId: r.group_id,
    machineType: r.machine,
    date: r.date,
    startTime: hhmm(r.start_time),
    duration: Number(r.duration),
    userName: admin ? r.user_name : r.public_name,
    room: admin ? r.room : undefined,
    createdAt: r.created_at,
  };
}

function fail(error: PostgrestError | null): never {

  if (error && /^[a-z_]+$/.test(error.message)) throw new ServerError(error.message, error.details ?? undefined);
  throw new ServerError('error_generic', error?.message);
}

export const data = {
  isAdmin: false,
  userEmail: null as string | null,

  async fetchBookings(from: string, to?: string): Promise<Booking[]> {
    const admin = this.isAdmin;
    let q = supabase
      .from(admin ? 'admin_bookings' : 'bookings')
      .select(admin ? ADMIN_COLS : PUBLIC_COLS)
      .gte('date', from)
      .order('date')
      .order('start_time');
    if (to) q = q.lte('date', to);
    const { data: rows, error } = await q;
    if (error) fail(error);
    return (rows as Row[]).map(r => toBooking(r, admin));
  },

  async fetchState(): Promise<AppState> {
    const { data: row, error } = await supabase.from('app_state').select('maintenance,broken_machines').single();
    if (error) fail(error);
    return {
      maintenance: !!row.maintenance,
      brokenMachines: Object.fromEntries((row.broken_machines as string[]).map(m => [m, true])),
    };
  },

  async setState(patch: Partial<AppState>): Promise<void> {
    const upd: Row = { updated_at: new Date().toISOString() };
    if (patch.maintenance !== undefined) upd.maintenance = patch.maintenance;
    if (patch.brokenMachines) upd.broken_machines = Object.keys(patch.brokenMachines).filter(k => patch.brokenMachines![k]);
    const { data: rows, error } = await supabase.from('app_state').update(upd).eq('id', true).select('id');
    if (error) fail(error);
    if (!rows?.length) throw new ServerError('permission_denied_err');
  },

  subscribe(onBookings: () => void, onState: () => void): void {
    supabase
      .channel('live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => onBookings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, () => onState())
      .subscribe();
  },

  async book(p: { userName: string; room: string; pin: string; machines: string[]; date: string; start: string; duration: number }): Promise<string> {
    const { data: groupId, error } = await supabase.rpc('book', {
      p_user_name: p.userName, p_room: p.room, p_pin: p.pin,
      p_machines: p.machines, p_date: p.date, p_start: p.start, p_duration: p.duration,
    });
    if (error) fail(error);
    return groupId as string;
  },

  async cancel(bookingId: string, pin: string): Promise<CancelResult> {
    const { data: res, error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId, p_pin: pin });
    if (error) fail(error);
    return res as CancelResult;
  },

  async adminDelete(ids: string[]): Promise<void> {
    const { data: rows, error } = await supabase.from('bookings').delete().in('id', ids).select('id');
    if (error) fail(error);
    if (!rows?.length) throw new ServerError('permission_denied_err');
  },

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new ServerError(error.message === 'Invalid login credentials' ? 'login_err_wrong_pass' : 'login_err_default', error.message);
    if (!(await this.checkAdmin())) {
      await supabase.auth.signOut();
      throw new ServerError('login_err_not_allowed');
    }
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new ServerError('logout_error', error.message);
  },

  async checkAdmin(): Promise<boolean> {
    const { data: ok, error } = await supabase.rpc('is_admin');
    return !error && ok === true;
  },

  onAuthChange(cb: (isAdmin: boolean) => void): void {
    let last: boolean | null = null;
    const handle = async (session: Session | null) => {
      const admin = session ? await this.checkAdmin() : false;
      this.userEmail = admin ? session?.user.email ?? null : null;
      if (admin === last) return;
      last = admin;
      this.isAdmin = admin;
      cb(admin);
    };
    supabase.auth.onAuthStateChange((_event, session) => {

      setTimeout(() => handle(session), 0);
    });
  },
};
