# Rezervări Spălătorie

Programări pentru mașinile de spălat, cu orar live și panou de administrare.

## Stack

- Vite + TypeScript
- Supabase (Postgres, RLS, Realtime, Auth)
- GitHub Pages

## Rulare locală

```bash
npm install
npm run dev
```

## Bază de date

Rulează `supabase/migrations/20261105000000_init.sql` în Supabase → SQL Editor.

Admin nou:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'admin@exemplu.ro';
```

## Securitate

- Toate regulile de rezervare se verifică în baza de date, prin `book()` și `cancel_booking()`.
- PIN-urile sunt stocate cu bcrypt; după 5 încercări greșite, anularea se blochează 15 minute.
- Publicul vede doar prenumele, inițiala și camera; numele complet e vizibil doar pentru admin.
- Istoricul mai vechi de 6 luni se șterge automat.
