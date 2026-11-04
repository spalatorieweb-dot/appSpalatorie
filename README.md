# Rezervări Spălătorie

Site pentru programări la mașinile de spălat.

## Pornire

```bash
npm install
npm run dev
```

## Bază de date

Schema e în `supabase/migrations/20261105000000_init.sql` și se rulează în Supabase → SQL Editor.

Admin nou:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'admin@exemplu.ro';
```
