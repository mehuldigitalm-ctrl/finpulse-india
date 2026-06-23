import { createClient } from "@vercel/kv";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function getKV() {
  return createClient({
    url: process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN,
  });
}

// Your live feeds. Add/remove here anytime.
const FEEDS = [
  { name: "Zee Business", url: "https://zeenews.india.com/rss/business.xml" },
  { name: "India Today", url: "https://www.indiatoday.in/rss/1206513" },
  { name: "NDTV Profit", url: "https://feeds.feedburner.com/ndtvprofit-latest" },
];

const ITEMS_PER_FEED = 6; // most-recent N from each feed sent to Claude

function unwrap(s) {
  if (!s) return "";
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}
function stripHtml(s) {
  return unwrap(s)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}
function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : "";
}

async function fetchFeed(feed) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(feed.url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FinPulseBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.log(`⚠️ [RSS] ${feed.name} failed: ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    const items = blocks.slice(0, ITEMS_PER_FEED).map((b) => ({
      source: feed.name,
      title: stripHtml(pick(b, "title")),
      desc: stripHtml(pick(b, "description")),
      date: unwrap(pick(b, "pubDate")),
    })).filter((i) => i.title);
    console.log(`📰 [RSS] ${feed.name}: ${items.length} items`);
    return items;
  } catch (e) {
    console.log(`⚠️ [RSS] ${feed.name} error: ${e.message}`);
    return [];
  }
}

// Normalized title: lowercase, strip punctuation, collapse spaces.
// Blocks near-identical repeats without collapsing genuinely different stories.
function normalizeTitle(t) {
  if (typeof t !== "string") return "";
  return t.toLowerCase()
    .replace(/<cite[^>]*>|<\/cite>/gi, "")
    .replace(/[^a-z0-9₹ ]/g, " ")
    .replace(/\s+/g, " ").trim();
}

const PROMPT = `You are an Indian finance news editor. Below are headlines from Indian news feeds, each tagged with its source.
1. Keep ONLY finance/business/markets stories (Sensex, Nifty, stocks, RBI, economy, banking, startups, IPOs, policy). DISCARD anything non-financial (accidents, health, general news, politics not tied to markets).
2. If several items cover the SAME story, keep only one — never output duplicates.
3. Select up to 5, ordered by importance.
4. For each, write a fresh 2-3 sentence summary in your own words. Use ₹ for rupees.
Return ONLY a JSON array, no other text:
[{"title":"","summary":"","category":"Markets|Economy|Banking|Startups|Policy","importance":1-10,"source":"the source tag","ticker":"NSE_TICKER or null"}]`;

export async function GET(request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });

  try {
    // 1. Pull all feeds in parallel; failures are skipped, not fatal.
    const results = await Promise.all(FEEDS.map(fetchFeed));
    const items = results.flat();
    console.log(`📰 [RSS] total items: ${items.length}`);
    if (items.length === 0) throw new Error("No items from any feed");

    const feedText = items
      .map((i) => `[${i.source}] ${i.title}${i.desc ? " — " + i.desc : ""}`)
      .join("\n");

    // 2. Claude filters to finance, dedupes, summarizes.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1600,
        messages: [{ role: "user", content: `${PROMPT}\n\nHeadlines:\n${feedText}` }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const textBlock = data.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    if (!textBlock) throw new Error("No response from Claude");
    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    const s = cleaned.indexOf("["), e = cleaned.lastIndexOf("]");
    if (s === -1 || e === -1) throw new Error("Could not parse articles");

    const parsed = JSON.parse(cleaned.slice(s, e + 1)).map((a, i) => ({
      ...a, id: `${Date.now()}-${i}`, fetchedAt: new Date().toISOString(), ticker: a.ticker || null,
    }));
    console.log(`📰 [CRON] Claude returned: ${parsed.length}`);

    // 3. Dedupe against the stored 7-day set (and within this batch).
    const kv = getKV();
    const existing = (await kv.get("articles")) || [];
    const seen = new Set(existing.map((a) => normalizeTitle(a.title)));
    const fresh = [];
    for (const a of parsed) {
      const key = normalizeTitle(a.title);
      if (!key || seen.has(key)) { console.log(`🔁 dup skipped: ${a.title?.slice(0, 50)}`); continue; }
      seen.add(key);
      fresh.push(a);
    }

    // 4. Merge, drop >7 days old, save.
    let merged = [...fresh, ...existing];
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    merged = merged.filter((a) => new Date(a.fetchedAt) > cutoff);

    await kv.set("articles", merged);
    await kv.set("lastUpdated", new Date().toISOString());
    await kv.set("cacheVersion", Date.now().toString());

    console.log(`✅ [CRON] added ${fresh.length}, total ${merged.length}`);
    return Response.json({ success: true, added: fresh.length, total: merged.length });
  } catch (err) {
    console.log("❌ [CRON] Error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
