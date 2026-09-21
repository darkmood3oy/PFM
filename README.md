# Finance Tracker

A private, offline-first tracker for variable income and expenses. Data lives in your browser and is backed up to a JSON file you control.

## Setup

1. Create a new GitHub repository (public is fine — no data is stored in the repo).
2. Upload `index.html`, `manifest.json`, `sw.js`, `README.md`.
3. Go to **Settings → Pages**. Source: *Deploy from a branch*. Branch: `main`, folder: `/ (root)`. Save.
4. Wait ~1 minute. Your app is at `https://<your-username>.github.io/<repo-name>/`.

## Install on your phone

Open the URL in Chrome (Android) or Safari (iOS) → Share → **Add to Home Screen**. It will behave like a native app and work offline.

## Backup (do this regularly)

- Tap **Backup** in the top bar, or go to the **Data** tab → **Save backup file**.
- On desktop Chrome/Edge, the app remembers the folder you save into and will re-save to the same file with one click.
- **Recommended:** save into a folder inside your Google Drive (or a folder synced by Google Drive for Desktop). Then every backup automatically syncs to Drive.
- Restore any time with **Data → Restore from file**.

## What it tracks

- Income: hourly, daily, weekly, monthly, one-off
- Expenses: categorised, marked essential or not
- Accounts: Holding / Operating / Savings (renameable) with transfers between them
- Normalised earnings: per hour, per day, per week, per month, per year
- Monthly breakdown and 12-month chart

## Privacy

No server. No tracking. No accounts. Everything stays on your device and in the backup file you create.