import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_ELAPSED_MS = 45_000; // Stop after 45s to stay under the 60s Edge Function limit

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const WOO_KEY = Deno.env.get("WOO_CONSUMER_KEY");
  const WOO_SECRET = Deno.env.get("WOO_CONSUMER_SECRET");
  const WOO_URL =
    Deno.env.get("WOO_STORE_URL") || "https://novapeptidesupply.com";

  if (!WOO_KEY || !WOO_SECRET) {
    return new Response(
      JSON.stringify({ error: "WooCommerce credentials not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "incremental";

    // Get sync cursor
    const { data: metaRows } = await supabase
      .from("sync_metadata")
      .select("*");
    const meta: Record<string, string> = {};
    (metaRows || []).forEach(
      (r: { key: string; value: string }) => (meta[r.key] = r.value)
    );

    let startPage = 1;
    let afterDate = "";
    let orderDirection = "asc";

    if (mode === "reset") {
      await supabase.from("sync_metadata").delete().neq("key", "");
      await supabase.from("sales_history").delete().neq("id", "");
      return new Response(
        JSON.stringify({ ok: true, message: "Reset complete" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mode === "initial") {
      startPage = parseInt(meta["woo_sync_page"] || "1", 10);
      orderDirection = "asc";
    } else {
      // incremental — fetch orders since last sync minus 1 day buffer
      const lastSynced = meta["woo_sync_last_date"];
      if (lastSynced) {
        const d = new Date(lastSynced);
        d.setDate(d.getDate() - 1);
        afterDate = d.toISOString();
      }
      orderDirection = "desc";
    }

    const startTime = Date.now();
    let page = startPage;
    let totalInserted = 0;
    let hasMore = true;
    let pagesProcessed = 0;

    while (hasMore) {
      // Check time limit
      if (Date.now() - startTime > MAX_ELAPSED_MS) {
        // Save page cursor for resume
        if (mode === "initial") {
          await supabase
            .from("sync_metadata")
            .upsert({ key: "woo_sync_page", value: String(page), updated_at: new Date().toISOString() });
        }
        return new Response(
          JSON.stringify({
            ok: true,
            has_more: true,
            pages_processed: pagesProcessed,
            rows_inserted: totalInserted,
            next_page: page,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build WooCommerce URL
      let url = `${WOO_URL}/wp-json/wc/v3/orders?per_page=100&page=${page}&status=completed,delivered,processing&orderby=date&order=${orderDirection}&consumer_key=${WOO_KEY}&consumer_secret=${WOO_SECRET}`;
      if (afterDate) {
        url += `&after=${afterDate}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 429) {
          // Rate limited — save progress and return
          if (mode === "initial") {
            await supabase
              .from("sync_metadata")
              .upsert({ key: "woo_sync_page", value: String(page), updated_at: new Date().toISOString() });
          }
          return new Response(
            JSON.stringify({
              ok: true,
              has_more: true,
              rate_limited: true,
              pages_processed: pagesProcessed,
              rows_inserted: totalInserted,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await res.text();
        console.error("WooCommerce API error:", errText);
        return new Response(
          JSON.stringify({ error: "WooCommerce API failed", detail: errText }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const orders = await res.json();
      if (!Array.isArray(orders) || orders.length === 0) {
        hasMore = false;
        break;
      }

      // Extract line items
      const rows: Record<string, unknown>[] = [];
      for (const order of orders) {
        for (const item of order.line_items || []) {
          if (!item.sku) continue; // Skip items without SKU
          rows.push({
            woo_order_id: order.id,
            order_date: order.date_created_gmt
              ? order.date_created_gmt + "Z"
              : order.date_created,
            order_status: order.status,
            sku: item.sku,
            product_id: item.product_id || null,
            variation_id: item.variation_id || null,
            product_name: item.name || null,
            quantity: item.quantity || 1,
            line_total: item.total ? parseFloat(item.total) : null,
          });
        }
      }

      // Upsert into sales_history (ignore duplicates)
      if (rows.length > 0) {
        const { error: insertErr } = await supabase
          .from("sales_history")
          .upsert(rows, { onConflict: "woo_order_id,sku,coalesce(variation_id,0)", ignoreDuplicates: true });

        if (insertErr) {
          // If upsert with onConflict fails (functional index), fall back to insert with ignoreDuplicates
          const { error: fallbackErr } = await supabase
            .from("sales_history")
            .insert(rows)
            .select();
          if (fallbackErr && !fallbackErr.message.includes("duplicate")) {
            console.error("Insert error:", fallbackErr.message);
          }
        }
        totalInserted += rows.length;
      }

      // Check pagination
      const totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
      hasMore = page < totalPages;
      page++;
      pagesProcessed++;
    }

    // Sync complete — update metadata
    await supabase
      .from("sync_metadata")
      .upsert({ key: "woo_sync_last_date", value: new Date().toISOString(), updated_at: new Date().toISOString() });

    if (mode === "initial") {
      // Reset page cursor since we're done
      await supabase
        .from("sync_metadata")
        .upsert({ key: "woo_sync_page", value: "1", updated_at: new Date().toISOString() });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        has_more: false,
        pages_processed: pagesProcessed,
        rows_inserted: totalInserted,
        message: "Sync complete",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("woo-sync-orders error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
