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

    // Fetch variations for variable products
    const mapped: Record<string, unknown>[] = [];

    for (const p of allProducts) {
      const pType = p.type as string;
      const variations = p.variations as number[] | undefined;

      if (pType === "variable" && variations && variations.length > 0) {
        // Fetch all variations for this product
        const varUrl = `${WOO_URL}/wp-json/wc/v3/products/${p.id}/variations?per_page=100&consumer_key=${WOO_KEY}&consumer_secret=${WOO_SECRET}`;
        const varRes = await fetch(varUrl);
        if (varRes.ok) {
          const varData = await varRes.json();
          for (const v of varData as Record<string, unknown>[]) {
            const attrs = (v.attributes as { name: string; option: string }[]) || [];
            const attrLabel = attrs.map((a) => a.option).join(", ");
            const varName = attrLabel
              ? `${p.name} — ${attrLabel}`
              : (p.name as string);
            mapped.push({
              woo_id: v.id,
              sku: (v.sku as string) || (p.sku as string) || "",
              name: varName,
              price: (v.price as string) || "0",
              stock_quantity: (v.stock_quantity as number) ?? 0,
              stock_status: (v.stock_status as string) || "unknown",
              source: "woocommerce",
            });
          }
        }
      } else {
        // Simple product — add directly
        mapped.push({
          woo_id: p.id,
          sku: (p.sku as string) || "",
          name: (p.name as string) || "",
          price: (p.price as string) || "0",
          stock_quantity: (p.stock_quantity as number) ?? 0,
          stock_status: (p.stock_status as string) || "unknown",
          source: "woocommerce",
        });
      }
    }

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
