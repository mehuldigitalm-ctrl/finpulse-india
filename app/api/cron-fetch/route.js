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

const SYSTEM_PROMPT = `Indian finance news editor. Find and summarize latest India finance news.

Topics: Sensex, Nifty, NSE/BSE stocks, RBI policy, repo rate, CPI/WPI, GDP, rupee, Indian banking (SBI/HDFC/ICICI), startups/IPOs, Union Budget, GST, SEBI, FDI.
Sources: Economic Times, Moneycontrol, Mint, Business Standard, Livemint, Financial Express.

Return ONLY a JSON array. Each item:
{"title":"headline","summary":"2-3 sentences","category":"Markets|Economy|Banking|Startups|Policy","importance":1-10,"source":"source name","ticker":"NSE_TICKER or null"}

Return 5 articles by importance. Be concise. Use ₹ for currency.`;

export async function GET(request) {
  console.log("🚀 [CRON] Request received");
  
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  console.log("🔐 [CRON] Auth header:", authHeader ? "present" : "MISSING");
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log("❌ [CRON] Auth failed");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("✅ [CRON] Auth passed");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log("🔑 [CRON] API Key:", apiKey ? "✓ present" : "✗ MISSING");
  
  if (!apiKey) {
    console.log("❌ [CRON] No API key");
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    console.log("📡 [CRON] Calling Anthropic API...");
    
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 2,
          },
        ],
        messages: [
          {
            role: "user",
            content: "Latest India finance news today. Return JSON array.",
          },
        ],
      }),
    });

    console.log("📡 [CRON] API response status:", res.status);
    
    const data = await res.json();
    console.log("📡 [CRON] API response:", data.error ? "ERROR" : "OK");
    
    if (data.error) {
      console.log("❌ [CRON] API Error:", data.error.message);
      throw new Error(data.error.message || "API error");
    }

    const textBlock = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    console.log("📝 [CRON] Text block found:", !!textBlock);

    if (!textBlock) throw new Error("No response from AI");

    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    
    console.log("🔍 [CRON] JSON parsing - start:", start, "end:", end);
    
    if (start === -1 || end === -1) throw new Error("Could not parse articles");

    const newArticles = JSON.parse(cleaned.slice(start, end + 1)).map((a, i) => ({
      ...a,
      id: `${Date.now()}-${i}`,
      fetchedAt: new Date().toISOString(),
    }));

    console.log("📰 [CRON] Articles parsed:", newArticles.length);

    // Get existing articles
    console.log("💾 [CRON] Getting KV client...");
    const kv = getKV();
    
    console.log("💾 [CRON] Fetching existing articles...");
    const existing = (await kv.get("articles")) || [];
    console.log("💾 [CRON] Existing articles:", existing.length);
    
    // Merge new with existing, deduplicate by title
    const existingTitles = new Set(existing.map((a) => a.title.toLowerCase()));
    const fresh = newArticles.filter((a) => !existingTitles.has(a.title.toLowerCase()));
    let merged = [...fresh, ...existing];

    console.log("📰 [CRON] Fresh articles:", fresh.length);
    console.log("📰 [CRON] Total before cleanup:", merged.length);

    // DELETE ARTICLES OLDER THAN 7 DAYS
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    merged = merged.filter((article) => {
      const fetchedDate = new Date(article.fetchedAt);
      const isRecent = fetchedDate > sevenDaysAgo;
      if (!isRecent) {
        console.log("🗑️  [CRON] Deleting old article:", article.title.substring(0, 40) + "...");
      }
      return isRecent;
    });

    console.log("📰 [CRON] Total after 7-day cleanup:", merged.length);

    // Save to Redis
    console.log("💾 [CRON] Saving to KV...");
    await kv.set("articles", merged);
    await kv.set("lastUpdated", new Date().toISOString());

    console.log("✅ [CRON] Success! Added:", fresh.length, "Total:", merged.length);
    return Response.json({ success: true, added: fresh.length, total: merged.length, deleted: existing.length - fresh.length });
  } catch (e) {
    console.log("❌ [CRON] Error:", e.message);
    console.log("❌ [CRON] Stack:", e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
