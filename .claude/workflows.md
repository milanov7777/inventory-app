# Inventory Tracker — Step-by-Step Workflows

These playbooks are written for someone with no code experience. Follow every step in order.

---

## Workflow A: Adding a Column to an Existing Table

**Example**: Adding a `brand` text column to the `orders` table.

1. **Decide** the column name, type, whether it can be empty (nullable), and any default value.

2. **Edit `schema.sql`** — Find the CREATE TABLE block for the table and add the new column line in the right position. This keeps the file as the single source of truth for a fresh database.

3. **Edit `schema_update.sql`** — Append at the bottom:
   ```sql
   -- Add brand column to orders
   ALTER TABLE orders ADD COLUMN IF NOT EXISTS brand text;
   ```
   Use `IF NOT EXISTS` so it is safe to run again.

4. **Run the SQL** — Use Supabase MCP if available. If not, tell the user:
   > Copy the ALTER TABLE line above, go to the Supabase SQL Editor:
   > https://supabase.com/dashboard/project/uxjgqwaeruustwnxplyy/sql/new
   > Paste it in and click **Run**.

5. **Update the hook** — Open `src/hooks/use<Table>.js`. Add the new column to:
   - The `.insert()` payload (in the add function)
   - The `.update()` payload (in the edit function)
   - No changes needed for `.select('*')` — it already fetches all columns.

6. **Update the view** — Open `src/views/<Table>.jsx`:
   - Add a column header to the table columns array
   - Add an input field in the SlidePanel form for add/edit

7. **Test locally** — Run `npm run dev`, open the app, go to the affected tab:
   - Verify the new column appears in the table
   - Add a new row with the field filled in — confirm it saves
   - Edit an existing row — confirm the field appears and saves
   - Check browser console for errors (Cmd+Option+J)

---

## Workflow B: Adding a New Table

**Example**: Adding an `inventory_notes` table.

1. **Design the table** — Decide columns, types, and whether it references `orders(batch_number)`.

2. **Edit `schema.sql`** — Add a new CREATE TABLE block after the existing tables:
   ```sql
   CREATE TABLE inventory_notes (
     id            uuid primary key default uuid_generate_v4(),
     batch_number  text references orders(batch_number)
                     on update cascade on delete restrict,
     note_text     text not null,
     created_by    text not null,
     created_at    timestamptz not null default now()
   );
   ```

3. **Edit `schema_update.sql`** — Append `CREATE TABLE IF NOT EXISTS` with the same definition.

4. **Add indexes** (in both schema files):
   ```sql
   CREATE INDEX IF NOT EXISTS idx_inventory_notes_batch ON inventory_notes(batch_number);
   ```

5. **Enable RLS** (in both schema files):
   ```sql
   ALTER TABLE inventory_notes ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "allow all" ON inventory_notes FOR ALL USING (true) WITH CHECK (true);
   ```

6. **Enable realtime** if live updates are needed (in both schema files):
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE inventory_notes;
   ```

7. **Run the SQL** — Use Supabase MCP or tell the user to paste into SQL Editor.

8. **Create the hook** — Copy `src/hooks/useOrders.js` as a template:
   - Save as `src/hooks/useInventoryNotes.js`
   - Change table name, column names, and channel name
   - Keep the same pattern: fetch, realtime subscription, add, update, delete, all calling `logAction()`

9. **Create the view** — Copy an existing view (e.g., `src/views/Orders.jsx`) as template:
   - Save as `src/views/InventoryNotes.jsx`
   - Update to use the new hook and column definitions

10. **If it is a pipeline stage** — Add an entry to the `STAGES` array in `src/utils/stageConfig.js` with: key, label, color, tableName, nextStage, promoteLabel.

11. **Add to App.jsx** — Import the new view and add it to the `views` object so it gets a tab.

12. **Test locally** — Run `npm run dev` and verify the new tab appears, you can add/edit/delete rows, and the audit log records actions.

---

## Workflow C: First-Time Vercel Deploy

Follow these steps exactly. You only do this once.

### Step 1: Build the app
Open your terminal in the `inventory-app` folder and run:
```bash
npm run build
```
If you see red error messages, stop and fix them before continuing.

### Step 2: Set up Git
Run these commands one at a time:
```bash
git init
git add -A
git commit -m "Initial commit"
```

### Step 3: Create a GitHub repository
1. Go to https://github.com/new
2. Name it `inventory-app`
3. Leave it as **Public** or choose **Private**
4. Do NOT check "Add a README file"
5. Click **Create repository**
6. GitHub will show you commands under "push an existing repository from the command line". Copy and run both lines. They look like:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/inventory-app.git
   git push -u origin main
   ```

### Step 4: Connect to Vercel
1. Go to https://vercel.com and sign in with your GitHub account
2. Click **Add New Project**
3. Find `inventory-app` in the list and click **Import**
4. Under **Configure Project**:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Environment Variables** and add these two (copy the values from your `.env` file):
   - Name: `VITE_SUPABASE_URL` — Value: your Supabase URL
   - Name: `VITE_SUPABASE_ANON_KEY` — Value: your anon key
   - Do NOT add `SUPABASE_SERVICE_KEY` — it is only for the seed script
6. Click **Deploy**
7. Wait 1-2 minutes. Vercel gives you a URL like `inventory-app-xyz.vercel.app`
8. Open that URL and verify the app works

From now on, every `git push` to GitHub automatically triggers a new Vercel deploy.

---

## Workflow D: Update and Redeploy

After making any changes to the code:

1. **Test locally first**:
   ```bash
   npm run dev
   ```
   Open http://localhost:5173 and verify your changes work. Follow the testing checklist in CLAUDE.md.

2. **Build to check for errors**:
   ```bash
   npm run build
   ```
   This must complete with zero errors. If it fails, fix the errors before continuing.

3. **Commit your changes**:
   ```bash
   git add <list the files you changed>
   git commit -m "Short description of what you changed"
   ```

4. **Push to GitHub**:
   ```bash
   git push
   ```

5. **Vercel auto-deploys** — Within 1-2 minutes, your live site updates automatically.

6. **Verify** — Open your Vercel URL and check that everything works.

7. **If something is wrong** — Fix it locally, test again, commit, and push. Vercel deploys every push, so the fix goes live automatically.

### If you can't push from the terminal
Go to https://vercel.com/dashboard, find your project, click on the latest deployment, and click **Redeploy**.
