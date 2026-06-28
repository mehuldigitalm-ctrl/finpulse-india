import Parser from "rss-parser";
import { createClient } from "@vercel/kv";

export const maxDuration = 60;

const RSS_FEEDS = [
  "https://feeds.bloomberg.com/markets/news.rss",
  "https://feeds.feedburner.com/ndtvprofit-latest",
  "https://zeenews.india.com/rss/business.xml",
  "https://www.indiatoday.in/rss/1206513",
];

export async function GET(request) {
  try {
    console.log("🚀 [CRON] Starting news fetch cycle...");
    
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error("❌ [CRON] Unauthorized");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("📋 [CRON] Verifying environment variables...");
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY not set");
    }
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      throw new Error("Redis credentials not set");
    }

    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    console.log("🔄 [CRON] Fetching RSS feeds...");
    const parser = new Parser();
    const allItems = [];

    for (const feedUrl of RSS_FEEDS) {
      try {
        console.log(`  📡 Trying: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        const items = feed.items.slice(0, 15).map((item) => ({
          title: item.title || "Untitled",
          link: item.link || "",
          pubDate: item.pubDate || new Date().toISOString(),
          source: feed.title || "Finance News",
          content: item.content || item.description || "",
        }));
        allItems.push(...items);
        console.log(`  ✅ Got ${items.length} items from ${feed.title}`);
      } catch (e) {
        console.error(`  ⚠️ Failed: ${e.message}`);
      }
    }

    console.log(`📊 [CRON] Total articles fetched: ${allItems.length}`);

    if (allItems.length === 0) {
      throw new Error("No articles fetched from any RSS feed");
    }

    const feedText = allItems
      .map((a) => `Title: ${a.title}\nURL: ${a.link}\nSource: ${a.source}\n${a.content.substring(0, 200)}`)
      .join("\n---\n");

    console.log("🤖 [CRON] Calling OpenRouter API (auto-routing to best available model)...");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://finpulse-india.com",
        "X-Title": "FinPulse India",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        messages: [
          {
            role: "user",
            content: `You are an Indian finance news editor. Extract and summarize the 10 most important Indian finance/markets news stories.

Focus on: Sensex, Nifty, NSE/BSE, RBI policy, rupee, Indian banks, startups, IPOs, Union Budget, GST, SEBI.

Return ONLY valid JSON array. Each item must have:
- title: headline
- summary: 2-3 sentences
- category: Markets|Economy|Banking|Startups|Policy|Other
- importance: 1-10 (10=most important)
- source: source name
- url: article URL

Just return the JSON array, no markdown, no explanation.

Articles to process:
${feedText}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ OpenRouter API error:", error);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;
    const usedModel = data.model || "unknown";
    console.log(`📝 [CRON] Got response from model: ${usedModel}, length: ${responseText.length}`);

    let jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    if (!jsonMatch) {
      jsonMatch = responseText.match(/\[[\s\S]*\]/);
    }

    if (!jsonMatch) {
      console.error("❌ No JSON found. Raw response:", responseText.substring(0, 300));
      throw new Error("No JSON array in response");
    }

    const articles = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    if (!Array.isArray(articles)) {
      throw new Error("Response is not an array");
    }

    console.log(`✅ [CRON] Processed ${articles.length} articles`);

    const existing = (await kv.get("articles")) || [];
    const existingTitles = new Set(existing.map((a) => a.title));

    const uniqueNew = articles.filter((a) => !existingTitles.has(a.title));
    console.log(`📊 New unique: ${uniqueNew.length}, Existing: ${existing.length}`);

    const combined = [...uniqueNew, ...existing].slice(0, 70);

    await kv.set("articles", combined);
    await kv.set("lastUpdated", new Date().toISOString());
    await kv.set("articleCount", combined.length);

    console.log(`✅ [CRON] Stored ${combined.length} articles in Redis`);
    console.log("✅ [CRON] Cycle complete!");

    return Response.json({
      success: true,
      articlesProcessed: articles.length,
      articlesStored: combined.length,
      modelUsed: usedModel,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [CRON] Error:", error.message);
    return Response.json({ 
      error: error.message,
    }, { status: 500 });
  }
}
