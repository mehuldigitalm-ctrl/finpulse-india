export async function GET() {
  console.log("📖 [GET-NEWS] Request started");
  
  try {
    const url = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;

    console.log("📖 [GET-NEWS] URL:", url ? "✓" : "✗");
    console.log("📖 [GET-NEWS] Token:", token ? "✓" : "✗");

    if (!url || !token) {
      throw new Error("Missing KV credentials");
    }

    // Get articles using REST API
    console.log("📖 [GET-NEWS] Fetching articles from Upstash REST API...");
    const articlesRes = await fetch(`${url}/get/articles`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const articlesData = await articlesRes.json();
    console.log("📖 [GET-NEWS] Articles response status:", articlesRes.status);

    let articles = [];
    if (articlesData.result) {
      try {
        articles = JSON.parse(articlesData.result);
        console.log("📖 [GET-NEWS] Parsed articles:", articles.length);
      } catch (e) {
        console.log("📖 [GET-NEWS] Parse error:", e.message);
        articles = articlesData.result;
      }
    }

    // Get lastUpdated using REST API
    console.log("📖 [GET-NEWS] Fetching lastUpdated from Upstash REST API...");
    const lastUpdatedRes = await fetch(`${url}/get/lastUpdated`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const lastUpdatedData = await lastUpdatedRes.json();
    const lastUpdated = lastUpdatedData.result || null;
    console.log("📖 [GET-NEWS] Last updated:", lastUpdated);

    console.log("📖 [GET-NEWS] Success! Returning", articles.length, "articles");
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
