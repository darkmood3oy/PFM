# Finance Tracker

A private, offline-first personal finance tracker you can run from your phone, laptop or anywhere — deployed free on **GitHub Pages**, with **encrypted backups** and **free Supabase cloud sync**.

**Privacy first:** your data is encrypted on your device (AES-256, passphrase-protected) *before* it ever leaves the browser. The GitHub repo is public but stores no data. Even if your Supabase table, your Google Drive file, or this repo were exposed, nobody can read anything without your passphrase.

---

## 1 · Deploy to GitHub Pages

1. Create a GitHub repository (public or private — the code only).
2. Upload `index.html`, `manifest.json`, `sw.js`, `README.md`.
3. Go to **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, folder `/` → Save.
4. Wait ~1 minute. Your app is at `https://<your-username>.github.io/<repo-name>/`.

> ⚠️ GitHub Pages serves over **HTTPS**, which is required for the built-in encryption. Don't use `localhost`/HTTP for real data.

## 2 · Install on your phone

Open the URL in Chrome (Android) or Safari (iOS) → Share → **Add to Home Screen**. It behaves like a native app and works offline.

## 3 · Protect your data with a passphrase (2 minutes)

Inside the app: **Data & sync → Set a passphrase** (at least 8 chars).

- This one passphrase encrypts backups *and* cloud sync, always on your device, before upload.
- There is **no recovery** if you lose it — keep it in a password manager.
- "Remember on this device" is optional and convenient, but only tick it on devices only you use.

## 4 · Turn on cloud sync — Supabase (free, ~10 minutes)

No credit card needed. Supabase is a free Postgres database + API.

1. Create an account at [supabase.com](https://supabase.com) → **New project** (free plan).
2. In your project: **SQL Editor → New query**, paste the setup below and press **Run**:

```sql
-- ============================================================
--  Finance sync setup — run once, then create the user in the
--  dashboard under Authentication → Users → Add user.
-- ============================================================

-- 1) The single table that holds your encrypted snapshot
create table if not exists public.finance_sync (
  id         text primary key,
  user_id    uuid not null references auth.users (id),
  payload    text not null,
  updated_at timestamptz not null default now()
);

-- 2) Allow the API roles to read/write (RLS below is the real gate)
grant select, insert, update on public.finance_sync to anon, authenticated;

-- 3) Row Level Security: only YOUR signed-in user can touch YOUR row
alter table public.finance_sync enable row level security;

drop policy if exists "own row" on public.finance_sync;
create policy "own row" on public.finance_sync
  for all
  using (auth.uid() = user_id);
```

3. In the dashboard: **Authentication → Users → Add user** with any email (e.g. `finance-sync@you.com`) and a strong password. This is the *sync email / sync password* you'll type into the app. (It only exists to lock the API; your actual data is still AES-encrypted with your own passphrase on top.)
4. **Settings → API** → copy the **Project URL** (`https://abcdef.supabase.co`) and the **anon public** key.
5. In the app: **Data & sync → Cloud sync** → fill in the four fields → **Save settings**.
6. Tap **Push to cloud**. On your other devices, open the app, fill the same four fields, and tap **Pull from cloud**. Done.

> After the first push the app remembers a login token, so later pushes are one tap. Keep one device as your main "source of truth" — this is a last-write-wins snapshot sync (not bidirectional merge).

## 5 · Back up to Google Drive (and keep 3 copies)

- **Data & sync → Save backup** (or the 💾 icon in the header).
- Tick **Encrypt backup with my passphrase** so the file is unreadable without it.
- Save the file into a folder synced by **Google Drive for Desktop**, or upload it to Drive / email it to yourself after saving.
- Restore anytime with **Restore**.

Rule of thumb — **3-2-1**: keep 3 copies (device + Drive + one more, e.g. a USB stick or a second cloud), on 2 different media, 1 off-site. With encryption on, all copies are safe wherever they live.

## What it tracks

- **Income** — hourly, daily, weekly, monthly or one-off; auto-calculates hours and amount
- **Expenses** — categorised, marked essential or not, per account
- **Accounts** — renameable (Holding / Operating / Savings) with opening balances and transfers
- **Dashboard** — balances, this month's income/expenses/net, normalised earnings (per hour/day/week/month/year), recent activity
- **Reports** — 12-month chart + table, CSV exports

## Security model (how it works)

| Layer | What protects you |
|---|---|
| At rest on device | Browser storage (localStorage) — only you on this device |
| Backups & cloud | **AES-256-GCM**, key derived from your passphrase via PBKDF2-SHA256 (200k iterations) — applied in the browser |
| Supabase access | Row Level Security + a dedicated sign-in only you hold |
| Public GitHub repo | Contains only app code — never your data or keys |

## Development

```bash
node _tests/core.test.js   # crypto + state unit tests
node _tests/smoke.test.js  # UI render / wiring smoke tests
node _tests/sync.test.js   # sync client against a mock server
```

The old (v1) app is preserved in `_archive/` if you ever want to compare or import data from it manually.