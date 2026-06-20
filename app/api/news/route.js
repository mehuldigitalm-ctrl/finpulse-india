import { createClient } from "@vercel/kv";

function getKV() {
  return createClient({
    url: process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN,
  });
}

export async function GET() {
  try {
    const kv = getKV();
    const articles = (await kv.get("articles")) || [];
    const lastUpdated = (await kv.get("lastUpdated")) || null;

    return Response.json(
      { articles, lastUpdated },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
