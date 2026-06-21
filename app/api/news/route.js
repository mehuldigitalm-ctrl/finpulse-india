import { createClient } from "@vercel/kv";

function getKV() {
  console.log("📖 [GET-NEWS] Creating KV client...");
  console.log("📖 [GET-NEWS] URL exists:", !!process.env.KV_REST_API_URL);
  console.log("📖 [GET-NEWS] Token exists:", !!process.env.KV_REST_API_TOKEN);
  
  return createClient({
    url: process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN,
  });
}

export async function GET() {
  console.log("📖 [GET-NEWS] Request started");
  
  try {
    console.log("📖 [GET-NEWS] Getting KV client...");
    const kv = getKV();
    
    console.log("📖 [GET-NEWS] Fetching articles from Redis...");
    const articles = (await kv.get("articles")) || [];
    console.log("📖 [GET-NEWS] Articles found:", articles.length);
    
    console.log("📖 [GET-NEWS] Fetching lastUpdated from Redis...");
    const lastUpdated = (await kv.get("lastUpdated")) || null;
    console.log("📖 [GET-NEWS] Last updated:", lastUpdated);

    console.log("📖 [GET-NEWS] Success!");
    return Response.json(
      { articles, lastUpdated },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (e) {
    console.log("📖 [GET-NEWS] Error:", e.message);
    console.log("📖 [GET-NEWS] Stack:", e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
