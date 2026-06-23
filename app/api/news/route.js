// Always run fresh; never cache internal fetches or the response.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Strip leftover citation tags from older web_search-era articles.
function stripTags(text) {
  if (typeof text !== "string") return text;
  return text.replace(/<cite[^>]*>/gi, "").replace(/<\/cite>/gi, "").trim();
}
function cleanArticle(a) {
  return { ...a, title: stripTags(a.title), summary: stripTags(a.summary) };
}

export async function GET() {
  try {
    const url = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;
    if (!url || !token) throw new Error("Missing KV credentials");

    const articlesRes = await fetch(`${url}/get/articles`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const articlesData = await articlesRes.json();
    let articles = [];
    if (articlesData.result) {
      try {
        articles = JSON.parse(articlesData.result);
      } catch (e) {
        articles = articlesData.result;
      }
    }
    if (Array.isArray(articles)) articles = articles.map(cleanArticle);

    const lastUpdatedRes = await fetch(`${url}/get/lastUpdated`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const lastUpdatedData = await lastUpdatedRes.json();
    const lastUpdated = lastUpdatedData.result || null;

    return Response.json(
      { articles, lastUpdated },
      {
        headers: {
          // No caching anywhere between Redis and the browser.
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "CDN-Cache-Control": "no-store",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
