import { createClient } from "@vercel/kv";

export const maxDuration = 60;

function getKV() {
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
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
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

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "API error");

    const textBlock = data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!textBlock) throw new Error("No response from AI");

    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("Could not parse articles");

    const newArticles = JSON.parse(cleaned.slice(start, end + 1)).map((a, i) => ({
      ...a,
      id: `${Date.now()}-${i}`,
      fetchedAt: new Date().toISOString(),
    }));

    // Merge with existing articles, deduplicate, keep last 60
    const kv = getKV();
    const existing = (await kv.get("articles")) || [];
    const existingTitles = new Set(existing.map((a) => a.title.toLowerCase()));
    const fresh = newArticles.filter((a) => !existingTitles.has(a.title.toLowerCase()));
    const merged = [...fresh, ...existing].slice(0, 60);

    await kv.set("articles", merged);
    await kv.set("lastUpdated", new Date().toISOString());

    return Response.json({ success: true, added: fresh.length, total: merged.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
