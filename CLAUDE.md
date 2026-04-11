# Inventory Tracker — Claude Context

## Project Identity

- **App**: Inventory Tracker — 5-stage pipeline: Orders > Received > Testing > Approved > On Website
- **Stack**: React 18 + Vite 5 + Tailwind CSS 3 + Supabase JS v2
- **Not used**: TypeScript, React Router, component library, test framework
- **Users**: Camila (admin), Admin (admin), Aiden (viewer), Peyton (viewer) — PIN login, roles stored in `users` table
- **Supabase project ref**: `uxjgqwaeruustwnxplyy`

---

## Key File Map

| File | Purpose |
|---|---|
| `schema.sql` | Full DB schema — run once for a fresh Supabase project |
| `schema_update.sql` | Incremental ALTERs — safe to re-run, append new changes here |
| `.env` / `.env.example` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` |
| `.mcp.json` | Supabase MCP server config |
| `src/lib/supabase.js` | Supabase client singleton (reads VITE_ env vars) |
| `src/utils/stageConfig.js` | `STAGES` array (tab definitions, colors, promote rules) and `USERS` array |
| `src/utils/auditLogger.js` | `logAction()` — called after every successful mutation |
| `src/utils/exportCsv.js` | CSV download utility |
| `src/utils/formatDate.js` | Date formatting helpers |
| `src/hooks/use*.js` | One hook per table: fetch, realtime subscription, CRUD functions |
| `src/views/*.jsx` | One view per tab (Dashboard, Orders, Received, Testing, Approved, OnWebsite, AuditLog) |
| `src/components/*.jsx` | Shared UI: Table, SearchFilter, SlidePanel, NavBar, TabBar, UserPicker, etc. |
| `scripts/seed.js` | Reads CSV files, upserts via service key |

---

## Database Schema Quick Reference

**8 tables**: `users`, `orders`, `received`, `testing`, `approved`, `on_website`, `audit_log`, `sku_thresholds`
**1 view**: `sku_qty_summary` (aggregates `approved.qty_available` by SKU)

**Enums**:
- `order_status`: ordered, received, in_testing, approved, live, failed
- `storage_location`: fridge, shelf
- `pass_fail_result`: pass, fail
- `coa_status`: yes, no

**Key relationships**:
- `orders.batch_number` is UNIQUE and is the cross-table foreign key
- `received`, `testing`, `approved`, `on_website` all reference `orders(batch_number)`
- `orders.total_value` is a generated stored column: `qty_ordered * unit_price + shipping_cost`

**RLS**: Enabled on all tables with permissive "allow all" policies (no auth)
**Realtime**: Publication includes orders, received, testing, approved, on_website, audit_log

---

## Architecture Patterns

- **Hook pattern**: Each table has `src/hooks/use<Table>.js` with fetch, realtime subscription via `supabase.channel('<table>-realtime')`, and CRUD functions. Every mutation calls `logAction()` after success.
- **Promote pattern**: Promoting a batch = insert into next stage table + update `orders.status`. Promote conditions are in `stageConfig.js` (e.g., testing requires `pass_fail === 'pass'`).
- **View pattern**: Each view is self-contained, uses its hook, renders `<Table>`, uses `<SlidePanel>` for add/edit forms.
- **No routing**: `App.jsx` uses `useState('dashboard')` for tab switching. All views rendered inline.
- **Styling**: Tailwind utility classes only. No custom CSS beyond directives in `index.css`.

---

## CRITICAL: Supabase Change Workflow

**Every database change MUST follow all 5 steps. Never skip steps 1-2.**

1. **Edit `schema.sql`** — Update the CREATE TABLE/VIEW so this file always represents the full current schema from scratch.
2. **Edit `schema_update.sql`** — Append new ALTER/CREATE statements at the bottom with `IF NOT EXISTS` / `IF EXISTS` guards so it is safe to re-run.
3. **Run the SQL** — Use Supabase MCP tools if available. If MCP cannot execute the SQL, tell the user:
   > Copy the SQL below and paste it into the Supabase SQL Editor:
   > https://supabase.com/dashboard/project/uxjgqwaeruustwnxplyy/sql/new
   > Then click "Run".
4. **Update the frontend** — If columns changed, update the relevant hook (`src/hooks/`), view (`src/views/`), and `stageConfig.js` if promote logic is affected.
5. **Verify** — Run `npm run dev` and check that the affected table loads correctly in the browser. Open the browser console and confirm there are no red Supabase errors.

**Rule**: NEVER make schema changes only in the SQL Editor without updating both `schema.sql` and `schema_update.sql`. If only the live DB is changed, the next fresh setup will be broken.

---

## Deployment Checklist

### Pre-deploy (always do this first)
1. Run `npm run build` — must complete with zero errors
2. Run `npm run preview` — open http://localhost:4173 and do a quick visual check

### First-time Vercel setup
See `.claude/workflows.md` — Workflow C for detailed click-by-click instructions.

### Subsequent deploys
1. Commit your changes: `git add <files>` then `git commit -m "description"`
2. Push to GitHub: `git push`
3. Vercel auto-deploys within 1-2 minutes
4. Check the live URL to verify

### Environment variables (Vercel dashboard)
Only two are needed in Vercel (NOT the service key):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### If MCP/CLI cannot deploy
Tell the user:
> Go to https://vercel.com/dashboard, find your project, and click "Redeploy" on the latest deployment. Or push your changes to GitHub and Vercel will auto-deploy.

---

## Testing Workflow

Before every deploy, verify locally:

### Quick checks (after any change)
- [ ] `npm run dev` starts without errors
- [ ] App loads at http://localhost:5173
- [ ] No red errors in browser console (open with Cmd+Option+J)

### Functional checks (after feature/schema changes)
- [ ] User picker works (can switch between Camila, Aiden, Peyton, Admin)
- [ ] Dashboard shows correct counts
- [ ] Can add a new order and it appears in the table
- [ ] Can promote a batch through all 5 stages
- [ ] Audit log records the actions
- [ ] Search and filter work on affected tables
- [ ] CSV export downloads correctly

### After schema changes specifically
- [ ] Affected table loads (no "undefined" or missing columns)
- [ ] Add/edit forms include any new fields
- [ ] Promote still works end-to-end
- [ ] Browser console has no red Supabase errors

### Build check (before deploy)
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run preview` shows the app correctly at localhost:4173

---

## Common Tasks

| Task | Where to look |
|---|---|
| Add a new column | `.claude/workflows.md` — Workflow A |
| Add a new table | `.claude/workflows.md` — Workflow B |
| First-time deploy to Vercel | `.claude/workflows.md` — Workflow C |
| Update and redeploy | `.claude/workflows.md` — Workflow D |
| Add a new user | Add to `USERS` array in `src/utils/stageConfig.js` AND insert into `users` table in Supabase |
| Change stage colors or promote rules | Edit `STAGES` array in `src/utils/stageConfig.js` |
| Run seed data | `npm run seed` (requires `SUPABASE_SERVICE_KEY` in `.env`) |
| Supabase Dashboard | https://supabase.com/dashboard/project/uxjgqwaeruustwnxplyy |

---

## Git Setup

This project does not yet have a git repository. Before first deploy:

```bash
cd inventory-app
git init
git add -A
git commit -m "Initial commit"
```

Then create a GitHub repo and push (see Workflow C in `.claude/workflows.md` for full instructions).
