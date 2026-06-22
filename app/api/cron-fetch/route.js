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

// Indian finance news RSS feeds (free, reliable)
const RSS_FEEDS = [
  "https://feeds.bloomberg.com/markets/india.rss",
  "https://feeds.moneycontrol.com/cnbc-tv18/",
  "https://economictimes.indiatimes.com/archivelist/13357959.cms?feedtype=json",
  "https://www.business-standard.com/rss/home_page_top_stories.rss",
  "https://feeds.livemint.com/latest.rss",
];

async function fetchRSSHeadlines() {
  console.log("📰 [RSS] Fetching from", RSS_FEEDS.length, "RSS feeds...");
  
  const headlines = [];
  
  for (const feed of RSS_FEEDS) {
    try {
      console.log("📰 [RSS] Fetching:", feed.substring(0, 50) + "...");
      
      const response = await fetch(feed, { timeout: 10000 });
      if (!response.ok) {
        console.log("⚠️  [RSS] Feed failed:", response.status, feed);
        continue;
      }

      const text = await response.text();
      
      // Simple XML/JSON parsing for headlines
      // Extract titles from <title> tags or "title" fields
      const titleRegex = /<title>([^<]+)<\/title>/g;
      let match;
      let count = 0;
      
      while ((match = titleRegex.exec(text)) !== null && count < 3) {
        const title = match[1].trim();
        if (title.length > 10 && !title.includes("RSS") && !title.includes("Feed")) {
          headlines.push(title);
          count++;
        }
      }
      
      console.log("📰 [RSS] Got", count, "headlines from feed");
    } catch (e) {
      console.log("⚠️  [RSS] Error fetching feed:", e.message);
    }
  }

  // Remove duplicates
  const unique = [...new Set(headlines)];
  console.log("📰 [RSS] Total unique headlines:", unique.length);
  
  return unique.slice(0, 15); // Top 15 headlines
}

const SUMMARIZATION_PROMPT = `You are an Indian finance news editor. Analyze these headlines and:
1. Select the 5 most important finance-related ones
2. For each, provide: title, 2-3 sentence summary, category, importance (1-10), source name

Ignore duplicate topics and non-finance news.

Return ONLY a JSON array. Each item:
{"title":"headline","summary":"summary text","category":"Markets|Economy|Banking|Startups|Policy","importance":1-10,"source":"guessed source"}

Example:
[
  {"title":"NSE IPO at ₹30,000 Cr","summary":"NSE IPO expected...","category":"Startups","importance":9,"source":"Economic Times"},
  {"title":"RBI Holds Rate at 5.25%","summary":"RBI decided...","category":"Policy","importance":8,"source":"RBI"}
]`;

export async function GET(request) {
  console.log("🚀 [CRON-RSS] Request received");
  
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  console.log("🔐 [CRON-RSS] Auth header:", authHeader ? "present" : "MISSING");
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log("❌ [CRON-RSS] Auth failed");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("✅ [CRON-RSS] Auth passed");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log("🔑 [CRON-RSS] API Key:", apiKey ? "✓ present" : "✗ MISSING");
  
  if (!apiKey) {
    console.log("❌ [CRON-RSS] No API key");
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    // STEP 1: Fetch RSS headlines (free, reliable)
    console.log("📡 [CRON-RSS] Step 1: Fetching RSS headlines...");
    const headlines = await fetchRSSHeadlines();
    
    if (headlines.length === 0) {
      throw new Error("No headlines found from RSS feeds");
    }

    console.log("📡 [CRON-RSS] Got", headlines.length, "headlines");

    // STEP 2: Send headlines to Claude for summarization (cheap!)
    console.log("📡 [CRON-RSS] Step 2: Sending to Claude for summarization...");
    
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
            content: `Headlines to analyze:\n\n${headlines.join("\n")}\n\n${SUMMARIZATION_PROMPT}`,
          },
        ],
      }),
    });

    console.log("📡 [CRON-RSS] Claude API response status:", res.status);
    
    const data = await res.json();
    console.log("📡 [CRON-RSS] Claude response:", data.error ? "ERROR" : "OK");
    
    if (data.error) {
      console.log("❌ [CRON-RSS] Claude API Error:", data.error.message);
      throw new Error(data.error.message || "Claude API error");
    }

    // STEP 3: Parse Claude's response
    console.log("📡 [CRON-RSS] Step 3: Parsing Claude response...");
    
    const textBlock = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    console.log("📝 [CRON-RSS] Text block found:", !!textBlock);

    if (!textBlock) throw new Error("No response from Claude");

    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    
    console.log("🔍 [CRON-RSS] JSON parsing - start:", start, "end:", end);
    
    if (start === -1 || end === -1) throw new Error("Could not parse articles");

    const newArticles = JSON.parse(cleaned.slice(start, end + 1)).map((a, i) => ({
      ...a,
      id: `${Date.now()}-${i}`,
      fetchedAt: new Date().toISOString(),
      ticker: a.ticker || null, // Add default ticker field
    }));

    console.log("📰 [CRON-RSS] Articles parsed:", newArticles.length);

    // STEP 4: Merge with existing articles
    console.log("💾 [CRON-RSS] Getting KV client...");
    const kv = getKV();
    
    console.log("💾 [CRON-RSS] Fetching existing articles...");
    const existing = (await kv.get("articles")) || [];
    console.log("💾 [CRON-RSS] Existing articles:", existing.length);
    
    const existingTitles = new Set(existing.map((a) => a.title.toLowerCase()));
    const fresh = newArticles.filter((a) => !existingTitles.has(a.title.toLowerCase()));
    let merged = [...fresh, ...existing];

    console.log("📰 [CRON-RSS] Fresh articles:", fresh.length);
    console.log("📰 [CRON-RSS] Total before cleanup:", merged.length);

    // STEP 5: Delete articles older than 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    merged = merged.filter((article) => {
      const fetchedDate = new Date(article.fetchedAt);
      const isRecent = fetchedDate > sevenDaysAgo;
      if (!isRecent) {
        console.log("🗑️  [CRON-RSS] Deleting old article:", article.title.substring(0, 40) + "...");
      }
      return isRecent;
    });

    console.log("📰 [CRON-RSS] Total after 7-day cleanup:", merged.length);

    // STEP 6: Save to Redis
    console.log("💾 [CRON-RSS] Saving to KV...");
    await kv.set("articles", merged);
    await kv.set("lastUpdated", new Date().toISOString());
    
    // Update cache version for invalidation
    const cacheVersion = Date.now().toString();
    await kv.set("cacheVersion", cacheVersion);
    console.log("🔄 [CRON-RSS] Cache version updated:", cacheVersion);

    console.log("✅ [CRON-RSS] Success! Added:", fresh.length, "Total:", merged.length);
    return Response.json({ 
      success: true, 
      added: fresh.length, 
      total: merged.length,
      method: "RSS + Claude summarization"
    });
  } catch (e) {
    console.log("❌ [CRON-RSS] Error:", e.message);
    console.log("❌ [CRON-RSS] Stack:", e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
