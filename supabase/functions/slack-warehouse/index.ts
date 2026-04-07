import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format a date string to "Apr 7, 2026" in America/Chicago timezone
function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T12:00:00"));
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Format a number as currency
function fmtMoney(val: number | null): string {
  if (val == null) return "$0.00";
  return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format a number with commas
function fmtNum(val: number | null): string {
  if (val == null) return "0";
  return Number(val).toLocaleString("en-US");
}

// Capitalize first letter
function cap(s: string | null): string {
  if (!s) return "N/A";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SLACK_WEBHOOK_URL) {
    return new Response(
      JSON.stringify({ error: "SLACK_WEBHOOK_URL not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event, data } = await req.json();
    const batchNumber = data?.batch_number;
    const userName = data?.user || "System";

    let message = "";

    switch (event) {
      // ── Automation 1: New Order Logged ──
      case "new_order": {
        const { data: order } = await supabase
          .from("orders")
          .select("*")
          .eq("batch_number", batchNumber)
          .single();
        if (!order) { message = `New order logged: ${batchNumber}`; break; }

        message = [
          "\ud83d\udce6 *NEW ORDER LOGGED*",
          `*Compound:* ${order.compound_mg}`,
          `*Batch #:* ${order.batch_number}`,
          `*Qty:* ${fmtNum(order.qty_ordered)}  |  *Vendor:* ${order.vendor || "N/A"}`,
          `*Unit Price:* ${fmtMoney(order.unit_price)}  |  *Total Value:* ${fmtMoney(order.total_value)}`,
          `*Date Ordered:* ${fmtDate(order.date_ordered)}`,
          `*Logged by:* ${order.logged_by}`,
        ].join("\n");
        break;
      }

      // ── Automation 2: Order Marked Received ──
      case "order_received": {
        const { data: rec } = await supabase
          .from("received")
          .select("*")
          .eq("batch_number", batchNumber)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (!rec) { message = `Shipment received: ${batchNumber}`; break; }

        message = [
          "\u2705 *SHIPMENT RECEIVED*",
          `*Compound:* ${rec.compound_mg}`,
          `*Batch #:* ${rec.batch_number}`,
          `*Qty Received:* ${fmtNum(rec.qty_received)}`,
          `*Storage:* ${cap(rec.storage)}  |  *Cap Color:* ${rec.cap_color ? rec.cap_color.toUpperCase() : "N/A"}`,
          `*Date Received:* ${fmtDate(rec.date_received)}`,
          `*Logged by:* ${rec.logged_by}`,
        ].join("\n");
        break;
      }

      // ── Automation 3: Sent to Testing ──
      case "sent_to_testing": {
        const { data: test } = await supabase
          .from("testing")
          .select("*")
          .eq("batch_number", batchNumber)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (!test) { message = `Sent to testing: ${batchNumber}`; break; }

        message = [
          "\ud83e\uddea *SENT TO TESTING*",
          `*Compound:* ${test.compound_mg}`,
          `*Batch #:* ${test.batch_number}`,
          `*Vials Sent:* ${fmtNum(test.vials_sent)}  |  *Lab:* ${test.lab || "N/A"}`,
          `*Date Sent:* ${fmtDate(test.date_sent)}`,
          `*Sent by:* ${test.logged_by}`,
        ].join("\n");
        break;
      }

      // ── Automation 4: Test Result Recorded ──
      case "test_result": {
        const result = data?.result; // 'pass' or 'fail'
        const { data: test } = await supabase
          .from("testing")
          .select("*")
          .eq("batch_number", batchNumber)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (!test) { message = `Test result for ${batchNumber}: ${result}`; break; }

        const isPassed = (result || test.pass_fail) === "pass";
        if (isPassed) {
          message = [
            "\u2705 *TEST PASSED*",
            `*Compound:* ${test.compound_mg}  |  *Batch #:* ${test.batch_number}`,
            `*Result:* PASS  |  *COA On File:* ${test.coa_on_file === "yes" ? "Yes" : "No"}`,
            `*Results Received:* ${fmtDate(test.date_results_received)}`,
            `*Logged by:* ${userName}`,
          ].join("\n");
        } else {
          message = [
            "\u274c *TEST FAILED \u2014 DO NOT LIST*",
            `*Compound:* ${test.compound_mg}  |  *Batch #:* ${test.batch_number}`,
            `*Result:* FAIL`,
            `*Logged by:* ${userName}`,
            "\u26a0\ufe0f This batch must not be approved or listed.",
          ].join("\n");
        }
        break;
      }

      // ── Automation 5: Batch Approved ──
      case "batch_approved": {
        const { data: appr } = await supabase
          .from("approved")
          .select("*")
          .eq("batch_number", batchNumber)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Also fetch cap_color from received table
        const { data: rec } = await supabase
          .from("received")
          .select("cap_color")
          .eq("batch_number", batchNumber)
          .limit(1)
          .single();

        if (!appr) { message = `Batch approved: ${batchNumber}`; break; }

        message = [
          "\ud83d\udfe2 *BATCH APPROVED & READY TO LIST*",
          `*Compound:* ${appr.compound_mg}`,
          `*Batch #:* ${appr.batch_number}`,
          `*Qty Available:* ${fmtNum(appr.qty_available)}`,
          `*Storage:* ${cap(appr.storage)}  |  *Cap:* ${rec?.cap_color ? rec.cap_color.toUpperCase() : "N/A"}`,
          `*Approved by:* ${appr.logged_by}`,
        ].join("\n");
        break;
      }

      // ── Automation 6: Listed on Website ──
      case "listed_on_website": {
        const { data: web } = await supabase
          .from("on_website")
          .select("*")
          .eq("batch_number", batchNumber)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (!web) { message = `Listed on website: ${batchNumber}`; break; }

        message = [
          "\ud83c\udf10 *NOW LIVE ON WEBSITE*",
          `*Compound:* ${web.compound_mg}`,
          `*Batch #:* ${web.batch_number}`,
          `*Qty Listed:* ${fmtNum(web.qty_listed)}  |  *Price:* ${fmtMoney(web.price_listed)}`,
          `*Date Listed:* ${fmtDate(web.date_listed)}`,
          `*Listed by:* ${userName}`,
        ].join("\n");
        break;
      }

      // ── Automation 7: Daily Summary ──
      case "daily_summary": {
        const today = new Date().toLocaleDateString("en-US", {
          timeZone: "America/Chicago",
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        // Count batches by status
        const statuses = ["ordered", "received", "in_testing", "approved", "live"] as const;
        const counts: Record<string, number> = {};
        for (const s of statuses) {
          const { count } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("status", s);
          counts[s] = count ?? 0;
        }

        // Low stock alerts
        const [{ data: summary }, { data: thresholds }] = await Promise.all([
          supabase.from("sku_qty_summary").select("*"),
          supabase.from("sku_thresholds").select("*"),
        ]);

        const qtyBySku: Record<string, number> = {};
        (summary || []).forEach((r: { sku: string; total_qty: number }) => {
          qtyBySku[r.sku] = Number(r.total_qty) || 0;
        });

        const lowStockAlerts: string[] = [];
        (thresholds || []).forEach((t: { sku: string; reorder_threshold: number }) => {
          const qty = qtyBySku[t.sku] ?? 0;
          if (qty < t.reorder_threshold) {
            lowStockAlerts.push(`${t.sku}: ${qty} units (threshold: ${t.reorder_threshold})`);
          }
        });

        const alertLine = lowStockAlerts.length > 0
          ? `\u26a0\ufe0f Low stock alerts:\n${lowStockAlerts.map(a => `  \u2022 ${a}`).join("\n")}`
          : "\u26a0\ufe0f Low stock alerts: None";

        message = [
          `\ud83d\udcca *DAILY INVENTORY SUMMARY \u2014 ${today}*`,
          "",
          "Pipeline status:",
          `\u2022 \ud83d\udce6 Orders: ${counts["ordered"]} batches`,
          `\u2022 \u2705 Received: ${counts["received"]} batches`,
          `\u2022 \ud83e\uddea In Testing: ${counts["in_testing"]} batches`,
          `\u2022 \ud83d\udfe2 Approved & Ready: ${counts["approved"]} batches`,
          `\u2022 \ud83c\udf10 On Website: ${counts["live"]} batches`,
          "",
          alertLine,
        ].join("\n");
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown event: ${event}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Post to Slack
    const slackRes = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, mrkdwn: true }),
    });

    if (!slackRes.ok) {
      const errText = await slackRes.text();
      console.error("Slack webhook failed:", errText);
      // Still write audit log even on Slack failure
      await supabase.from("audit_log").insert({
        user_name: userName,
        action_type: "slack_notification",
        batch_number: batchNumber || null,
        stage: event,
        changes_json: { message: `Slack post FAILED: ${event}`, error: errText },
      });
      return new Response(
        JSON.stringify({ error: "Slack webhook failed", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Write audit log for successful notification
    await supabase.from("audit_log").insert({
      user_name: userName,
      action_type: "slack_notification",
      batch_number: batchNumber || null,
      stage: event,
      changes_json: { message: `Slack notification sent: ${event}` },
    });

    return new Response(
      JSON.stringify({ ok: true, event }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("slack-warehouse error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
