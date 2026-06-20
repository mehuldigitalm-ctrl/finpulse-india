"use client";

import { useState, useEffect, useCallback } from "react";

const CATEGORIES = ["All", "Markets", "Economy", "Banking", "Startups", "Policy"];

const CATEGORY_COLOR = {
  Markets: "#2563eb",
  Economy: "#059669",
  Banking: "#7c3aed",
  Startups: "#0891b2",
  Policy: "#ea580c",
};

function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function badge(score) {
  if (score >= 8) return { label: "Breaking", color: "#dc2626", bg: "#fef2f2" };
  if (score >= 6) return { label: "Important", color: "#d97706", bg: "#fffbeb" };
  return { label: "Update", color: "#6b7280", bg: "#f3f4f6" };
}

export default function NewsApp() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news");
      const data = await res.json();
      if (data.articles?.length) setArticles(data.articles);
      if (data.lastUpdated) setLastUpdated(data.lastUpdated);
    } catch (e) {
      console.error("Failed to load news:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount + refresh from cache every 5 min (free, no AI calls)
  useEffect(() => {
    loadNews();
    const interval = setInterval(loadNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNews]);

  const filtered = filter === "All" ? articles : articles.filter((a) => a.category === filter);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "14px 20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
                <span style={{ color: "#f97316" }}>◆</span> FinPulse India
              </h1>
              <p
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                AI-Curated Indian Finance News
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {lastUpdated && (
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Updated {timeAgo(lastUpdated)}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  color: "#059669",
                  background: "#ecfdf5",
                  padding: "4px 10px",
                  borderRadius: 12,
                  fontWeight: 600,
                }}
              >
                ● Live — updates every 3 hours
              </span>
            </div>
          </div>

          {/* Category pills */}
          <div style={{ display: "flex", gap: 4, marginTop: 14, overflowX: "auto" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  border: "none",
                  background: filter === cat ? "#111" : "transparent",
                  color: filter === cat ? "#fff" : "#6b7280",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 20px 60px" }}>
        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                border: "3px solid #e5e7eb",
                borderTopColor: "#f97316",
                borderRadius: "50%",
                margin: "0 auto 16px",
                animation: "spin .8s linear infinite",
              }}
            />
            <p style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>Loading latest news…</p>
          </div>
        )}

        {/* Empty */}
        {!loading && articles.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📰</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              News is on its way
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280" }}>
              The AI agent updates news every hour. Check back shortly.
            </p>
          </div>
        )}

        {/* Articles grid */}
        {filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
              gap: 16,
            }}
          >
            {filtered.map((article) => {
              const b = badge(article.importance);
              return (
                <article
                  key={article.id}
                  style={{
                    background: "#fff",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: CATEGORY_COLOR[article.category] || "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {article.category}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 10,
                        color: b.color,
                        background: b.bg,
                      }}
                    >
                      {b.label}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>
                    {article.title}
                  </h3>

                  <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.55, flex: 1 }}>
                    {article.summary}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>
                      {article.source}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {article.ticker && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#2563eb",
                            background: "#eff6ff",
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {article.ticker}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        {article.fetchedAt ? timeAgo(article.fetchedAt) : ""}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Stats */}
        {articles.length > 0 && (
          <div
            style={{
              marginTop: 24,
              padding: "12px 16px",
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "center",
              gap: 24,
              flexWrap: "wrap",
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <span>
              <strong style={{ color: "#111" }}>{articles.length}</strong> articles
            </span>
            <span>
              <strong style={{ color: "#111" }}>{filtered.length}</strong> showing
            </span>
            <span>
              <strong style={{ color: "#111" }}>
                {articles.filter((a) => a.importance >= 8).length}
              </strong>{" "}
              breaking
            </span>
            <span style={{ color: "#059669" }}>Auto-updates every 3 hours</span>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "20px",
          fontSize: 11,
          color: "#9ca3af",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        FinPulse India — AI-curated news. Not financial advice. Verify before investing.
      </footer>
    </div>
  );
}
