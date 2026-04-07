import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");

Deno.serve(async (req) => {
  if (!SLACK_WEBHOOK_URL) {
    return new Response("SLACK_WEBHOOK_URL not configured", { status: 500 });
  }

  try {
    // Create a Supabase client with the service role key for server-side queries
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get current stock levels and thresholds
    const [{ data: summary }, { data: thresholds }, { data: notifLog }] =
      await Promise.all([
        supabase.from("sku_qty_summary").select("*"),
        supabase.from("sku_thresholds").select("*"),
        supabase.from("slack_notification_log").select("*"),
      ]);

    if (!thresholds || thresholds.length === 0) {
      return new Response(JSON.stringify({ message: "No thresholds configured" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build lookup maps
    const qtyBySku: Record<string, number> = {};
    (summary || []).forEach((r: { sku: string; total_qty: number }) => {
      qtyBySku[r.sku] = Number(r.total_qty) || 0;
    });

    const notifiedBySku: Record<string, boolean> = {};
    (notifLog || []).forEach((r: { sku: string; notified: boolean }) => {
      notifiedBySku[r.sku] = r.notified;
    });

    // 2. Find newly low-stock SKUs (below threshold AND not already notified)
    const newAlerts: { sku: string; qty: number; threshold: number }[] = [];
    const recovered: string[] = [];

    for (const t of thresholds) {
      const qty = qtyBySku[t.sku] ?? 0;
      const isLow = qty < t.reorder_threshold;

      if (isLow && !notifiedBySku[t.sku]) {
        newAlerts.push({ sku: t.sku, qty, threshold: t.reorder_threshold });
      } else if (!isLow && notifiedBySku[t.sku]) {
        recovered.push(t.sku);
      }
    }

    // 3. Reset recovered SKUs (stock replenished above threshold)
    for (const sku of recovered) {
      await supabase
        .from("slack_notification_log")
        .upsert({ sku, notified: false, last_sent: new Date().toISOString() });
    }

    // 4. Send Slack notification for new alerts
    if (newAlerts.length > 0) {
      const lines = newAlerts.map(
        (a) => `*${a.sku}* — ${a.qty} units remaining (threshold: ${a.threshold})`
      );

      const slackPayload = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "\u{1F6A8} Low Stock Alert",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: lines.join("\n"),
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `${newAlerts.length} SKU${newAlerts.length > 1 ? "s" : ""} below reorder threshold`,
              },
            ],
          },
        ],
      };

      const slackRes = await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackPayload),
      });

      if (!slackRes.ok) {
        const errText = await slackRes.text();
        console.error("Slack webhook failed:", errText);
        return new Response(JSON.stringify({ error: "Slack webhook failed", detail: errText }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 5. Mark these SKUs as notified
      for (const a of newAlerts) {
        await supabase
          .from("slack_notification_log")
          .upsert({ sku: a.sku, notified: true, last_sent: new Date().toISOString() });
      }
    }

    return new Response(
      JSON.stringify({
        newAlerts: newAlerts.length,
        recovered: recovered.length,
        message: newAlerts.length > 0 ? "Slack notification sent" : "No new alerts",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-slack error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
