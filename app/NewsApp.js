"use client";

import { useState, useEffect, useCallback } from "react";

const CATEGORIES = ["All", "Markets", "Economy", "Banking", "Startups", "Policy"];

function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.fp {
  --paper:#FBFAF7; --ink:#17140F; --muted:#6F695E; --line:#E7E2D8;
  --accent:#0B5563; --accent-soft:#E5EEEF; --breaking:#B23A2E; --body:#3D382F;
  --serif:'Newsreader',Georgia,serif; --sans:'Inter',system-ui,sans-serif; --mono:'IBM Plex Mono',monospace;
  background:var(--paper); color:var(--ink); min-height:100vh;
  font-family:var(--sans); -webkit-font-smoothing:antialiased;
  transition:background .25s ease, color .25s ease;
}
.fp[data-theme="dark"] {
  --paper:#16150F; --ink:#ECE7DC; --muted:#948D7E; --line:#2C2A23;
  --accent:#5DAEBC; --accent-soft:#1B2E2F; --breaking:#E38476; --body:#C8C2B4;
}
.fp * { box-sizing:border-box; }
.fp-wrap { max-width:1080px; margin:0 auto; padding:0 24px; }

.fp-masthead { border-bottom:1px solid var(--line); position:sticky; top:0; z-index:20;
  background:color-mix(in srgb, var(--paper) 86%, transparent); backdrop-filter:blur(8px); }
.fp-mast-top { display:flex; justify-content:space-between; align-items:flex-end;
  gap:16px; flex-wrap:wrap; padding:22px 0 16px; }
.fp-eyebrow { font-family:var(--mono); font-size:11px; letter-spacing:.18em;
  text-transform:uppercase; color:var(--accent); margin:0 0 6px; }
.fp-wordmark { font-family:var(--serif); font-weight:600; font-size:30px;
  line-height:1; letter-spacing:-.01em; margin:0; }
.fp-wordmark span { color:var(--accent); }
.fp-tagline { font-size:13px; color:var(--muted); margin:8px 0 0; }
.fp-right { display:flex; align-items:center; gap:16px; }
.fp-status { display:flex; align-items:center; gap:8px; font-family:var(--mono);
  font-size:12px; color:var(--muted); white-space:nowrap; }
.fp-dot { width:7px; height:7px; border-radius:50%; background:var(--accent);
  animation:fp-pulse 2.4s infinite; }
@keyframes fp-pulse { 0%{box-shadow:0 0 0 0 rgba(11,85,99,.45);} 70%{box-shadow:0 0 0 7px rgba(11,85,99,0);} 100%{box-shadow:0 0 0 0 rgba(11,85,99,0);} }
.fp[data-theme="dark"] .fp-dot { animation-name:fp-pulse-d; }
@keyframes fp-pulse-d { 0%{box-shadow:0 0 0 0 rgba(93,174,188,.5);} 70%{box-shadow:0 0 0 7px rgba(93,174,188,0);} 100%{box-shadow:0 0 0 0 rgba(93,174,188,0);} }

.fp-theme { background:none; border:1px solid var(--line); border-radius:8px;
  width:36px; height:36px; cursor:pointer; color:var(--muted); font-size:15px;
  display:flex; align-items:center; justify-content:center; transition:all .15s; }
.fp-theme:hover { color:var(--accent); border-color:var(--accent); }
.fp-theme:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

.fp-tabs { display:flex; gap:4px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
.fp-tabs::-webkit-scrollbar { display:none; }
.fp-tab { font-family:var(--sans); font-size:13px; font-weight:500; color:var(--muted);
  background:none; border:none; padding:10px 12px; cursor:pointer; white-space:nowrap;
  border-bottom:2px solid transparent; transition:color .15s; }
.fp-tab:hover { color:var(--ink); }
.fp-tab[aria-pressed="true"] { color:var(--accent); border-bottom-color:var(--accent); }
.fp-tab:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }

.fp-section-label { font-family:var(--mono); font-size:11px; letter-spacing:.16em;
  text-transform:uppercase; color:var(--muted); margin:32px 0 14px;
  display:flex; align-items:center; gap:12px; }
.fp-section-label::after { content:""; flex:1; height:1px; background:var(--line); }

.fp-list { display:flex; flex-direction:column; }
.fp-item { display:grid; grid-template-columns:56px 1fr; gap:18px;
  padding:22px 0; border-top:1px solid var(--line); align-items:start; }
.fp-item:first-child { border-top:none; }
.fp-rank { font-family:var(--mono); font-size:16px; font-weight:500; color:var(--accent); padding-top:4px; }
.fp-cat { font-family:var(--mono); font-size:11px; letter-spacing:.12em;
  text-transform:uppercase; color:var(--muted); }
.fp-breaking { color:var(--breaking); }
.fp-head { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin-bottom:6px; }
.fp-title { font-family:var(--serif); font-weight:600; font-size:19px; line-height:1.28;
  letter-spacing:-.005em; margin:6px 0 8px; }
.fp-summary { font-size:14.5px; line-height:1.62; color:var(--body); margin:0 0 10px; }
.fp-meta { display:flex; align-items:center; gap:12px; flex-wrap:wrap;
  font-family:var(--mono); font-size:12px; color:var(--muted); }
.fp-ticker { color:var(--accent); background:var(--accent-soft); padding:1px 7px;
  border-radius:4px; font-weight:500; }
.fp-meta-sep { width:3px; height:3px; border-radius:50%; background:var(--line); }

.fp-hero { grid-template-columns:64px 1fr; padding:8px 0 30px; }
.fp-hero .fp-rank { font-size:22px; }
.fp-hero .fp-title { font-size:32px; line-height:1.16; margin:8px 0 12px; }
.fp-hero .fp-summary { font-size:16px; }

@media (max-width:640px){
  .fp-item, .fp-hero { grid-template-columns:40px 1fr; gap:12px; }
  .fp-hero .fp-title { font-size:25px; }
  .fp-wordmark { font-size:25px; }
}

.fp-state { text-align:center; padding:80px 20px; }
.fp-state h2 { font-family:var(--serif); font-size:22px; font-weight:600; margin:0 0 8px; }
.fp-state p { font-size:14px; color:var(--muted); margin:0; }
.fp-spinner { width:30px; height:30px; border:2px solid var(--line);
  border-top-color:var(--accent); border-radius:50%; margin:0 auto 18px; animation:fp-spin .8s linear infinite; }
@keyframes fp-spin { to{ transform:rotate(360deg);} }

.fp-foot { border-top:1px solid var(--line); margin-top:48px; padding:24px 0 40px;
  font-size:12px; color:var(--muted); line-height:1.6; }

@media (prefers-reduced-motion:reduce){ .fp-dot,.fp-spinner{ animation:none; } .fp{ transition:none; } }
`;

export default function NewsApp() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [theme, setTheme] = useState("light");

  // Resolve theme on mount: saved preference, else system preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fp-theme");
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
      } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    } catch (e) {
      /* localStorage unavailable - fall back to light */
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("fp-theme", next);
      } catch (e) {
        /* ignore */
      }
      return next;
    });
  };

  const loadNews = useCallback(async () => {
    try {
      const res = await fetch(`/api/news?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.articles?.length) setArticles(data.articles);
      if (data.lastUpdated) setLastUpdated(data.lastUpdated);
    } catch (e) {
      console.error("Failed to load news:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
    const interval = setInterval(loadNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNews]);

  const filtered = (filter === "All" ? articles : articles.filter((a) => a.category === filter))
    .slice()
    .sort((a, b) => new Date(b.fetchedAt || 0) - new Date(a.fetchedAt || 0));

  const hero = filtered[0];
  const rest = filtered.slice(1);
  const pad = (n) => String(n).padStart(2, "0");

  function Item({ article, rank, isHero }) {
    const breaking = (article.importance || 0) >= 9;
    return (
      <article className={isHero ? "fp-item fp-hero" : "fp-item"}>
        <div className="fp-rank">{pad(rank)}</div>
        <div>
          <div className="fp-head">
            <span className="fp-cat">{article.category}</span>
            {breaking && <span className="fp-cat fp-breaking">● Breaking</span>}
          </div>
          <h3 className="fp-title">{article.title}</h3>
          <p className="fp-summary">{article.summary}</p>
          <div className="fp-meta">
            <span>{article.source}</span>
            {article.ticker && (
              <>
                <span className="fp-meta-sep" />
                <span className="fp-ticker">{article.ticker}</span>
              </>
            )}
            {article.fetchedAt && (
              <>
                <span className="fp-meta-sep" />
                <span>{timeAgo(article.fetchedAt)}</span>
              </>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="fp" data-theme={theme}>
      <style>{STYLES}</style>

      <header className="fp-masthead">
        <div className="fp-wrap">
          <div className="fp-mast-top">
            <div>
              <p className="fp-eyebrow">India · Markets Brief</p>
              <h1 className="fp-wordmark">Fin<span>Pulse</span></h1>
              <p className="fp-tagline">Today's market-moving stories, ranked by importance.</p>
            </div>
            <div className="fp-right">
              <div className="fp-status">
                <span className="fp-dot" />
                {lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : "Live"}
              </div>
              <button
                className="fp-theme"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                {theme === "dark" ? "\u2600" : "\u263E"}
              </button>
            </div>
          </div>
          <nav className="fp-tabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className="fp-tab"
                aria-pressed={filter === cat}
                onClick={() => setFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="fp-wrap">
        {loading && (
          <div className="fp-state">
            <div className="fp-spinner" />
            <p>Loading the brief…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="fp-state">
            <h2>Nothing in the brief yet</h2>
            <p>The next update runs within a few hours. Check back shortly.</p>
          </div>
        )}

        {!loading && hero && (
          <>
            <div className="fp-section-label">
              {filter === "All" ? "Latest" : `${filter} · latest`}
            </div>
            <Item article={hero} rank={1} isHero />

            {rest.length > 0 && (
              <>
                <div className="fp-section-label">Earlier stories</div>
                <div className="fp-list">
                  {rest.map((a, i) => (
                    <Item key={a.id} article={a} rank={i + 2} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer className="fp-foot">
        <div className="fp-wrap">
          FinPulse aggregates and summarizes public financial news for information only.
          It is not investment advice — verify the source before you trade.
        </div>
      </footer>
    </div>
  );
}
