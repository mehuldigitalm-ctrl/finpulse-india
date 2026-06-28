import { GoogleGenerativeAI } from "@google/generative-ai";
import Parser from "rss-parser";
import { createClient } from "@vercel/kv";

export const maxDuration = 60;

function getKV() {
  return createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

const SYSTEM_PROMPT = `You are an Indian finance news editor. Analyze the provided RSS feed articles and extract the most important finance news stories.

Focus on: Sensex, Nifty, NSE/BSE stocks, RBI policy, repo rate, CPI/WPI, GDP, rupee, Indian banking (SBI/HDFC/ICICI), startups/IPOs, Union Budget, GST, SEBI, FDI.

For each article:
1. Categorize: Markets | Economy | Banking | Startups | Policy
2. Rate importance: 1-10 (10 = major market impact)
3. Extract a concise 2-3 sentence summary

Return ONLY valid JSON array. Each item:
{
  "title": "headline",
  "summary": "2-3 sentences",
  "category": "Markets|Economy|Banking|Startups|Policy",
  "importance": 1-10,
  "source": "source name",
  "url": "article url",
  "timestamp": "ISO timestamp"
}

Return exactly 10 articles sorted by importance (highest first). No markdown, no explanation, just JSON.`;

const RSS_FEEDS = [
  "https://feeds.economictimes.indiatimes.com/et-markets/",
  "https://www.moneycontrol.com/rss/mcnews/",
  "https://www.livemint.com/feed/latest-news.rss",
];

async function fetchAndParseRSSFeeds() {
  const parser = new Parser();
  const allItems = [];

  console.log("🔄 [CRON] Fetching RSS feeds...");

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = feed.items.slice(0, 10).map((item) => ({
        title: item.title || "Untitled",
        link: item.link || "",
        pubDate: item.pubDate || new Date().toISOString(),
        source: feed.title || "Finance News",
      }));
      allItems.push(...items);
      console.log(`✅ [CRON] Fetched ${items.length} items from ${feed.title}`);
    } catch (error) {
      console.error(`⚠️ [CRON] Failed to fetch ${feedUrl}:`, error.message);
    }
  }

  return allItems.slice(0, 30); // Keep top 30 for processing
}

async function processWithGemini(articles) {
  console.log("🤖 [CRON] Processing with Gemini 2.0 Flash...");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const feedText = articles
    .map(
      (a) =>
        `Title: ${a.title}\nSource: ${a.source}\nDate: ${a.pubDate}\nURL: ${a.link}`
    )
    .join("\n---\n");

  const userMessage = `Process these finance news articles:\n\n${feedText}`;

  try {
    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      systemInstruction: SYSTEM_PROMPT,
    });

    const responseText = response.response.text();
    console.log("📝 [CRON] Raw Gemini response:", responseText.substring(0, 200));

    // Parse JSON response - handle both markdown code blocks and raw JSON
    let jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (!jsonMatch) {
      jsonMatch = responseText.match(/\[[\s\S]*\]/);
    }
    
    if (!jsonMatch) {
      throw new Error("No JSON array found in response");
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsedArticles = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsedArticles)) {
      throw new Error("Response is not an array");
    }

    console.log(`✅ [CRON] Processed ${parsedArticles.length} articles`);
    return parsedArticles;
  } catch (error) {
    console.error("❌ [CRON] Gemini processing failed:", error.message);
    throw error;
  }
}

async function deduplicateAndStore(newArticles) {
  const kv = getKV();

  console.log("💾 [CRON] Deduplicating and storing...");

  // Get existing articles
  const existingArticles = (await kv.get("articles")) || [];
  const existingTitles = new Set(existingArticles.map((a) => a.title));

  // Filter out duplicates
  const uniqueNew = newArticles.filter((a) => !existingTitles.has(a.title));

  console.log(
    `📊 [CRON] New: ${newArticles.length}, Unique: ${uniqueNew.length}, Existing: ${existingArticles.length}`
  );

  // Combine: new unique + existing, keep last 70
  const combined = [...uniqueNew, ...existingArticles].slice(0, 70);

  // Store combined articles
  await kv.set("articles", combined);

  // Store metadata
  await kv.set("lastUpdated", new Date().toISOString());
  await kv.set("articleCount", combined.length);

  console.log(`✅ [CRON] Stored ${combined.length} articles in Redis`);
  return combined;
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error("❌ [CRON] Unauthorized attempt");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🚀 [CRON] Starting news fetch cycle...");

    // Step 1: Fetch RSS feeds
    const rawArticles = await fetchAndParseRSSFeeds();
    if (rawArticles.length === 0) {
      return Response.json(
        { error: "No articles fetched from RSS feeds" },
        { status: 500 }
      );
    }

    // Step 2: Process with Gemini
    const processedArticles = await processWithGemini(rawArticles);

    // Step 3: Deduplicate and store
    const stored = await deduplicateAndStore(processedArticles);

    console.log("✅ [CRON] Cycle complete!");
    return Response.json({
      success: true,
      articlesProcessed: processedArticles.length,
      articlesStored: stored.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [CRON] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
