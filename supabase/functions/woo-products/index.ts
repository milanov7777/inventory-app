const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const WOO_KEY = Deno.env.get("WOO_CONSUMER_KEY");
  const WOO_SECRET = Deno.env.get("WOO_CONSUMER_SECRET");
  const WOO_URL = Deno.env.get("WOO_STORE_URL") || "https://novapeptidesupply.com";

  if (!WOO_KEY || !WOO_SECRET) {
    return new Response(
      JSON.stringify({ error: "WooCommerce credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch all published products (up to 100 per page)
    const allProducts: Record<string, unknown>[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${WOO_URL}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish&consumer_key=${WOO_KEY}&consumer_secret=${WOO_SECRET}`;
      const res = await fetch(url);

      if (!res.ok) {
        const errText = await res.text();
        console.error("WooCommerce API error:", errText);
        return new Response(
          JSON.stringify({ error: "WooCommerce API failed", detail: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const products = await res.json();
      allProducts.push(...products);

      // Check if there are more pages
      const totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
      hasMore = page < totalPages;
      page++;
    }

    // Map to a clean format for the client
    const mapped = allProducts.map((p: Record<string, unknown>) => ({
      woo_id: p.id,
      sku: (p.sku as string) || "",
      name: (p.name as string) || "",
      price: (p.price as string) || "0",
      stock_quantity: (p.stock_quantity as number) ?? 0,
      stock_status: (p.stock_status as string) || "unknown",
      source: "woocommerce",
    }));

    return new Response(
      JSON.stringify(mapped),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("woo-products error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
