import { createClient } from "@vercel/kv";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getKV() {
  return createClient({
    url: process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN,
  });
}

// Normalize a title so cosmetic differences don't defeat dedup.
// Lowercases, strips punctuation/symbols/currency, drops digits, collapses spaces.
function normalizeTitle(title) {
  if (typeof title !== "string") return "";
  return title
    .toLowerCase()
    .replace(/<cite[^>]*>|<\/cite>/gi, "") // strip any stray tags
    .replace(/[₹$%,.\-:;!?'"“”‘’()\[\]/]/g, " ") // punctuation & symbols
    .replace(/\d+/g, " ") // numbers (₹30,000 cr vs ₹30000 crore etc.)
    .replace(/\b(crore|cr|lakh|rs|inr)\b/g, " ") // currency words
    .replace(/\s+/g, " ")
    .trim();
}

const SUMMARIZATION_PROMPT = `You are an Indian finance news editor. Analyze these news articles and:
1. Select the 5 most important finance-related ones
2. Do NOT include multiple articles about the same underlying story or event. If several cover the same story, pick the single best one and drop the rest.
3. For each, provide: title, 2-3 sentence summary, category, importance (1-10), source

Return ONLY a JSON array. Each item:
{"title":"headline","summary":"summary text","category":"Markets|Economy|Banking|Startups|Policy","importance":1-10,"source":"source name","ticker":null}`;

export async function GET(request) {
  console.log("🚀 [CRON] Request received");

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log("❌ [CRON] Auth failed");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.log("✅ [CRON] Auth passed");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const newsApiKey = process.env.NEWS_API_KEY;
  if (!apiKey || !newsApiKey) {
    return Response.json({ error: "Missing API keys" }, { status: 500 });
  }

  try {
    // STEP 1: Fetch from NewsAPI
    console.log("📡 [CRON] Fetching from NewsAPI...");
    const newsRes = await fetch(
      `https://newsapi.org/v2/everything?q=india+finance+stocks+market+rupee+rbi&sortBy=publishedAt&language=en&pageSize=20&apiKey=${newsApiKey}`,
      { cache: "no-store" }
    );
    if (!newsRes.ok) throw new Error(`NewsAPI error: ${newsRes.status}`);

    const newsData = await newsRes.json();
    console.log("📡 [CRON] Articles from NewsAPI:", newsData.articles?.length || 0);
    if (!newsData.articles || newsData.articles.length === 0) {
      throw new Error("No articles from NewsAPI");
    }

    const headlines = newsData.articles
      .slice(0, 15)
      .map((a) => `${a.title}\n${a.description || ""}`)
      .join("\n\n");

    // STEP 2: Claude summarization + in-run dedup via prompt
    console.log("📡 [CRON] Sending to Claude...");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [
          { role: "user", content: `${SUMMARIZATION_PROMPT}\n\nArticles:\n${headlines}` },
        ],
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Claude API error");

    const textBlock = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (!textBlock) throw new Error("No response from Claude");

    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("Could not parse articles");

    const parsed = JSON.parse(cleaned.slice(start, end + 1)).map((a, i) => ({
      ...a,
      id: `${Date.now()}-${i}`,
      fetchedAt: new Date().toISOString(),
      ticker: a.ticker || null,
    }));
    console.log("📰 [CRON] Articles parsed:", parsed.length);

    // STEP 3: Dedup
    const kv = getKV();
    const existing = (await kv.get("articles")) || [];
    console.log("💾 [CRON] Existing articles:", existing.length);

    // Build a set of normalized titles already stored
    const seen = new Set(existing.map((a) => normalizeTitle(a.title)));

    const fresh = [];
    for (const article of parsed) {
      const key = normalizeTitle(article.title);
      if (!key) continue; // skip empty/garbage titles
      if (seen.has(key)) {
        console.log("🔁 [CRON] Duplicate skipped:", article.title.substring(0, 50));
        continue;
      }
      seen.add(key); // also blocks duplicates within this same batch
      fresh.push(article);
    }
    console.log("📰 [CRON] Fresh after dedup:", fresh.length);

    let merged = [...fresh, ...existing];

    // STEP 4: Drop articles older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    merged = merged.filter((a) => new Date(a.fetchedAt) > sevenDaysAgo);
    console.log("📰 [CRON] Total after 7-day cleanup:", merged.length);

    // STEP 5: Save
    await kv.set("articles", merged);
    await kv.set("lastUpdated", new Date().toISOString());
    await kv.set("cacheVersion", Date.now().toString());

    console.log("✅ [CRON] Success! Added:", fresh.length, "Total:", merged.length);
    return Response.json({ success: true, added: fresh.length, total: merged.length });
  } catch (e) {
    console.log("❌ [CRON] Error:", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
