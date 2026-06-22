// Removes leftover citation tags like <cite index="5-22">...</cite>
// that were saved from the old web_search-based cron runs.
function stripTags(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/<cite[^>]*>/gi, "")
    .replace(/<\/cite>/gi, "")
    .trim();
}

function cleanArticle(a) {
  return {
    ...a,
    title: stripTags(a.title),
    summary: stripTags(a.summary),
  };
}

export async function GET() {
  console.log("📖 [GET-NEWS] Request started");

  try {
    const url = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error("Missing KV credentials");
    }

    // Get articles
    const articlesRes = await fetch(`${url}/get/articles`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const articlesData = await articlesRes.json();
    let articles = [];
    if (articlesData.result) {
      try {
        articles = JSON.parse(articlesData.result);
      } catch (e) {
        console.log("📖 [GET-NEWS] Parse error:", e.message);
        articles = articlesData.result;
      }
    }

    // Strip any leftover citation tags from each article
    if (Array.isArray(articles)) {
      articles = articles.map(cleanArticle);
    }
    console.log("📖 [GET-NEWS] Cleaned articles:", articles.length);

    // Get lastUpdated
    const lastUpdatedRes = await fetch(`${url}/get/lastUpdated`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const lastUpdatedData = await lastUpdatedRes.json();
    const lastUpdated = lastUpdatedData.result || null;

    return Response.json(
      { articles, lastUpdated },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      }
    );
  } catch (e) {
    console.log("📖 [GET-NEWS] Error:", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
