# Inventory Tracker

A web-based inventory tracking app for product-based businesses. Products move through a 5-stage pipeline: **Orders → Received → Testing → Approved → On Website**.

---

## Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [Supabase](https://supabase.com) project (free tier works)

### 2. Install dependencies

```bash
cd inventory-app
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

- **VITE_SUPABASE_URL** and **VITE_SUPABASE_ANON_KEY** — found in Supabase → Settings → API
- **SUPABASE_SERVICE_KEY** — the service role key (same page). Used only by the seed script, never exposed to the browser.

### 4. Set up the database

In your Supabase dashboard, go to **SQL Editor** and run the entire contents of `schema.sql`. This creates all tables, enums, indexes, RLS policies, and the realtime publication.

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Seeding Sample Data

To pre-populate the database with the included sample orders and received entries:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_KEY=your-service-role-key \
npm run seed
```

Or set those variables in your shell first, then just run `npm run seed`.

The seed script reads `orders_seed.csv` and `received_seed.csv` from the project root and upserts them into Supabase.

---

## Users

No passwords required. On first load, select your name:

| Name | Role |
|---|---|
| Camila | Standard user |
| Aiden | Standard user |
| Peyton | Standard user |
| Admin | Can configure reorder thresholds |

The selected user persists in `localStorage`. Use **Switch User** in the top nav to change.

---

## The 5 Stages

| Stage | Tab Color | Promote Action |
|---|---|---|
| Orders | Blue | Mark Received → |
| Received | Green | Send to Testing → |
| Testing | Orange | Approve → (Pass only) |
| Approved | Cyan | List on Website → |
| On Website | Lime | — |

Promoting a batch:
1. Clicks the promote button on a row
2. A slide-in panel opens pre-filled with batch data
3. User fills any additional required fields
4. On save: inserts a row into the next stage's table, updates the batch status in `orders`, and logs the action to the audit trail

---

## Features

- **Real-time sync** — changes by any user appear live in all open browser tabs
- **Search & filter** — each view has text search, dropdowns, and date range filters
- **Export CSV** — downloads the currently filtered rows
- **Audit Log** — every create, update, delete, and promote is recorded with timestamp and user
- **Low Stock Alerts** — Admin can set reorder thresholds per SKU; alerts appear on the Dashboard
- **Confirmation dialogs** — all destructive actions require confirmation

---

## Tech Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- [Tailwind CSS v3](https://tailwindcss.com/)
- [Supabase JS v2](https://supabase.com/docs/reference/javascript)
- No TypeScript, no React Router, no component library

---

## Project Structure

```
src/
├── lib/supabase.js          Supabase client singleton
├── utils/
│   ├── stageConfig.js       Stage definitions (tabs, colors, promote rules)
│   ├── auditLogger.js       logAction() helper
│   ├── exportCsv.js         CSV download utility
│   └── formatDate.js        Date formatters
├── hooks/                   One hook per data table + useDashboard
├── components/              Reusable UI (Table, SearchFilter, SlidePanel, etc.)
└── views/                   One view per tab
```
