# Backend setup (Admin editing)

The site works completely without this — it ships with the workbook's data
bundled in `assets/js/data.js`, and that's what every visitor sees until you
do the steps below. This is only needed if you want to:

- Edit equipment / power-load / antenna / radome data yourself and have it
  update live for every visitor, from any device, without redeploying code.
- Fix inaccuracies without hand-editing `data.js` and committing.

It uses [Supabase](https://supabase.com) (a free-tier hosted Postgres +
REST API + auth service) as the backend. The site talks to it with plain
`fetch()` calls — no SDK, no build step, nothing else changes about how the
site is hosted.

## 1. Create a Supabase project

1. Sign up / log in at supabase.com and create a new project (free tier is
   plenty for this). Pick any name/region/password — you won't need the
   database password for anything below.
2. Wait for it to finish provisioning (a minute or two).

## 2. Run the schema + seed script

1. In your project, open **SQL Editor** → **New query**.
2. Paste in the entire contents of [`backend/schema.sql`](backend/schema.sql)
   from this repo and run it. This creates the four tables (`equipment`,
   `power_load_items`, `antenna_comparison`, `radome_comparison`), turns on
   row-level security (public read, no write yet), and seeds them with
   exactly what's in the site today.

   At this point writes are locked to *nobody* — the admin-write policy
   references a placeholder UID that doesn't exist yet. That's intentional;
   step 3 fixes it.

## 3. Create your one admin account

1. In Supabase, go to **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email and a strong password, and make sure **Auto Confirm User**
   is checked (so it doesn't try to send a confirmation email).
3. Click into the new user and copy their **User UID** (a long
   `xxxxxxxx-xxxx-...` value).
4. Back in the **SQL Editor**, run this once, with your real UID in place of
   the placeholder (you can also just re-run all of section 2 of
   `schema.sql` after find-and-replacing the placeholder UID throughout):

   ```sql
   -- repeat for each table: equipment, power_load_items, antenna_comparison, radome_comparison
   drop policy if exists "equipment_admin_write" on equipment;
   create policy "equipment_admin_write" on equipment for all
     using (auth.uid() = 'YOUR-REAL-UID-HERE')
     with check (auth.uid() = 'YOUR-REAL-UID-HERE');
   ```

That's the whole access model: **read is public, write requires being signed
in as that one UID.** No other accounts can write even if they sign up.

## 4. Get your API keys

In your Supabase project, go to **Project Settings** → **API**. You need two
values:

- **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
- **`anon` `public` key** (a long JWT string) — this is meant to be public,
  it's what every visitor's browser uses for read-only access. Do **not**
  use the `service_role` key here; that one bypasses row-level security
  entirely and must never appear in client-side code.

## 5. Wire it into the site

Edit `assets/js/backend-config.js`:

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

Commit and deploy. On next load, the site fetches live data from Supabase
(falling back silently to the bundled data if that ever fails), and the
**Admin** link in the nav lets you sign in with the account from step 3 to
add, edit, or delete equipment and comparison-table rows — changes are live
for every visitor immediately.

## Notes

- Nothing here is required for the "Suggest a correction" links scattered
  through the Equipment and Antenna & Radome pages — those just open a
  pre-filled GitHub Issue on this repo and work with zero setup.
- If `backend-config.js` is left blank (the default), the Admin page shows a
  friendly "not connected" message instead of a broken login form, and the
  rest of the site is unaffected.
