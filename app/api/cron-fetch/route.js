import { createClient } from "@vercel/kv";

export const maxDuration = 60;

function getKV() {
  console.log("📦 Creating KV client with URL:", process.env.KV_REST_API_URL ? "✓" : "✗");
  console.log("📦 Creating KV client with token:", process.env.KV_REST_API_TOKEN ? "✓" : "✗");
  
  return createClient({
    url: process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN,
  });
}

const SUMMARIZATION_PROMPT = `You are an Indian finance news editor. Analyze these news articles and:
1. Select the 5 most important finance-related ones
2. For each, provide: title, 2-3 sentence summary, category, importance (1-10), source

Return ONLY a JSON array. Each item:
{"title":"headline","summary":"summary text","category":"Markets|Economy|Banking|Startups|Policy","importance":1-10,"source":"source name","ticker":null}`;

export async function GET(request) {
  console.log("🚀 [CRON-NEWSAPI] Request received");
  
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  console.log("🔐 [CRON-NEWSAPI] Auth header:", authHeader ? "present" : "MISSING");
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log("❌ [CRON-NEWSAPI] Auth failed");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("✅ [CRON-NEWSAPI] Auth passed");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const newsApiKey = process.env.NEWS_API_KEY;
  
  console.log("🔑 [CRON-NEWSAPI] Anthropic API Key:", apiKey ? "✓ present" : "✗ MISSING");
  console.log("📰 [CRON-NEWSAPI] NewsAPI Key:", newsApiKey ? "✓ present" : "✗ MISSING");
  
  if (!apiKey || !newsApiKey) {
    console.log("❌ [CRON-NEWSAPI] Missing API keys");
    return Response.json({ error: "Missing API keys" }, { status: 500 });
  }

  try {
    // STEP 1: Fetch from NewsAPI (reliable, free)
    console.log("📡 [CRON-NEWSAPI] Step 1: Fetching from NewsAPI...");
    
    const newsRes = await fetch(
      `https://newsapi.org/v2/everything?q=india+finance+stocks+market+rupee+rbi&sortBy=publishedAt&language=en&pageSize=20&apiKey=${newsApiKey}`
    );

    console.log("📡 [CRON-NEWSAPI] NewsAPI response status:", newsRes.status);
    
    if (!newsRes.ok) {
      throw new Error(`NewsAPI error: ${newsRes.status}`);
    }

    const newsData = await newsRes.json();
    console.log("📡 [CRON-NEWSAPI] Articles from NewsAPI:", newsData.articles?.length || 0);

    if (!newsData.articles || newsData.articles.length === 0) {
      throw new Error("No articles from NewsAPI");
    }

    // Extract headlines and descriptions
    const headlines = newsData.articles
      .slice(0, 15)
      .map((a) => `${a.title}\n${a.description || ""}`)
      .join("\n\n");

    console.log("📝 [CRON-NEWSAPI] Prepared headlines for Claude");

    // STEP 2: Send to Claude for summarization (cheap!)
    console.log("📡 [CRON-NEWSAPI] Step 2: Sending to Claude for analysis...");
    
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
          {
            role: "user",
            content: `${SUMMARIZATION_PROMPT}\n\nArticles:\n${headlines}`,
          },
        ],
      }),
    });

    console.log("📡 [CRON-NEWSAPI] Claude API response status:", res.status);
    
    const data = await res.json();
    
    if (data.error) {
      console.log("❌ [CRON-NEWSAPI] Claude API Error:", data.error.message);
      throw new Error(data.error.message || "Claude API error");
    }

    // STEP 3: Parse Claude's response
    console.log("📡 [CRON-NEWSAPI] Step 3: Parsing Claude response...");
    
    const textBlock = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    console.log("📝 [CRON-NEWSAPI] Text block found:", !!textBlock);

    if (!textBlock) throw new Error("No response from Claude");

    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    
    console.log("🔍 [CRON-NEWSAPI] JSON parsing - start:", start, "end:", end);
    
    if (start === -1 || end === -1) throw new Error("Could not parse articles");

    const newArticles = JSON.parse(cleaned.slice(start, end + 1)).map((a, i) => ({
      ...a,
      id: `${Date.now()}-${i}`,
      fetchedAt: new Date().toISOString(),
      ticker: a.ticker || null,
    }));

    console.log("📰 [CRON-NEWSAPI] Articles parsed:", newArticles.length);

    // STEP 4: Merge with existing articles
    console.log("💾 [CRON-NEWSAPI] Getting KV client...");
    const kv = getKV();
    
    console.log("💾 [CRON-NEWSAPI] Fetching existing articles...");
    const existing = (await kv.get("articles")) || [];
    console.log("💾 [CRON-NEWSAPI] Existing articles:", existing.length);
    
    const existingTitles = new Set(existing.map((a) => a.title.toLowerCase()));
    const fresh = newArticles.filter((a) => !existingTitles.has(a.title.toLowerCase()));
    let merged = [...fresh, ...existing];

    console.log("📰 [CRON-NEWSAPI] Fresh articles:", fresh.length);
    console.log("📰 [CRON-NEWSAPI] Total before cleanup:", merged.length);

    // STEP 5: Delete articles older than 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    merged = merged.filter((article) => {
      const fetchedDate = new Date(article.fetchedAt);
      const isRecent = fetchedDate > sevenDaysAgo;
      if (!isRecent) {
        console.log("🗑️  [CRON-NEWSAPI] Deleting old article:", article.title.substring(0, 40) + "...");
      }
      return isRecent;
    });

    console.log("📰 [CRON-NEWSAPI] Total after 7-day cleanup:", merged.length);

    // STEP 6: Save to Redis
    console.log("💾 [CRON-NEWSAPI] Saving to KV...");
    await kv.set("articles", merged);
    await kv.set("lastUpdated", new Date().toISOString());
    
    // Update cache version
    const cacheVersion = Date.now().toString();
    await kv.set("cacheVersion", cacheVersion);
    console.log("🔄 [CRON-NEWSAPI] Cache version updated:", cacheVersion);

    console.log("✅ [CRON-NEWSAPI] Success! Added:", fresh.length, "Total:", merged.length);
    return Response.json({ 
      success: true, 
      added: fresh.length, 
      total: merged.length,
      method: "NewsAPI + Claude"
    });
  } catch (e) {
    console.log("❌ [CRON-NEWSAPI] Error:", e.message);
    console.log("❌ [CRON-NEWSAPI] Stack:", e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
