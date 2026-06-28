'use client';

import { useEffect, useState } from 'react';

export default function NewsApp() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filter, setFilter] = useState('all');
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch('/api/news', { cache: 'no-store' });
        const data = await res.json();
        setArticles(data.articles || []);
        setLastUpdated(data.lastUpdated);
      } catch (error) {
        console.error('Error fetching articles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  const categories = ['all', ...new Set(articles.map(a => a.category))];
  const filtered = filter === 'all' ? articles : articles.filter(a => a.category === filter);

  const getImportanceColor = (importance) => {
    if (importance >= 8) return darkMode ? '#ff6b6b' : '#dc2626';
    if (importance >= 6) return darkMode ? '#ffa94d' : '#ea580c';
    return darkMode ? '#51cf66' : '#16a34a';
  };

  const bgColor = darkMode ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
  const textColor = darkMode ? '#fff' : '#000';
  const secondaryText = darkMode ? '#a0aec0' : '#64748b';
  const cardBg = darkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.7)';
  const cardBorder = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const headerBg = darkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.5)';
  const featuredBg = darkMode ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))' : 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(59, 130, 246, 0.05))';

  return (
    <div style={{
      background: bgColor,
      minHeight: '100vh',
      color: textColor,
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      transition: 'all 0.3s ease',
    }}>
      {/* Header */}
      <header style={{
        background: headerBg,
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        padding: '30px 20px',
        sticky: 'top',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: '0', fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                📊 FinPulse India
              </h1>
              <p style={{ margin: '5px 0 0 0', color: secondaryText, fontSize: '14px' }}>
                AI-Powered Finance News Updates
              </p>
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              {lastUpdated && (
                <div style={{
                  background: darkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.15)',
                  border: `1px solid ${darkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.4)'}`,
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '13px',
                  color: darkMode ? '#86efac' : '#16a34a',
                }}>
                  🔄 Updated {new Date(lastUpdated).toLocaleTimeString()}
                </div>
              )}
              <button
                onClick={() => setDarkMode(!darkMode)}
                style={{
                  background: 'none',
                  border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                  borderRadius: '8px',
                  padding: '10px 15px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  transition: 'all 0.3s ease',
                  color: textColor,
                }}
                onMouseOver={(e) => {
                  e.target.style.background = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'none';
                }}
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: filter === cat ? '2px solid #10b981' : `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                  background: filter === cat ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  color: textColor,
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(16, 185, 129, 0.15)'}
                onMouseOut={(e) => e.target.style.background = filter === cat ? 'rgba(16, 185, 129, 0.2)' : 'transparent'}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: `3px solid ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
              borderTop: '3px solid #10b981',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ marginTop: '20px', color: secondaryText }}>Loading latest articles...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: secondaryText, fontSize: '16px' }}>No articles in this category yet.</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '20px', color: secondaryText, fontSize: '14px' }}>
              Showing {filtered.length} article{filtered.length !== 1 ? 's' : ''}
            </div>

            {/* Featured Article */}
            {filtered[0] && (
              <article style={{
                background: featuredBg,
                border: `1px solid ${darkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.4)'}`,
                borderRadius: '12px',
                padding: '30px',
                marginBottom: '40px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = darkMode ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.6)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = darkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.4)';
              }}
              >
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center' }}>
                  <span style={{
                    background: '#10b981',
                    color: '#000',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}>
                    FEATURED
                  </span>
                  <span style={{
                    background: getImportanceColor(filtered[0].importance),
                    color: '#000',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}>
                    ⭐ {filtered[0].importance}/10
                  </span>
                </div>
                <h2 style={{ margin: '0 0 15px 0', fontSize: '28px', fontWeight: '700', lineHeight: '1.3', color: textColor }}>
                  {filtered[0].title}
                </h2>
                <p style={{ margin: '0 0 20px 0', color: secondaryText, fontSize: '16px', lineHeight: '1.6' }}>
                  {filtered[0].summary}
                </p>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <small style={{ color: secondaryText }}>{filtered[0].source}</small>
                  <a href={filtered[0].url} target="_blank" rel="noopener noreferrer" style={{
                    color: '#10b981',
                    textDecoration: 'none',
                    fontWeight: '600',
                    fontSize: '14px',
                  }}>
                    Read full article →
                  </a>
                </div>
              </article>
            )}

            {/* Article Grid */}
            <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {filtered.slice(1).map((article, i) => (
                <article
                  key={i}
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                    borderRadius: '10px',
                    padding: '20px',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = darkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)';
                    e.currentTarget.style.borderColor = darkMode ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.5)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = cardBg;
                    e.currentTarget.style.borderColor = cardBorder;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{
                      display: 'inline-block',
                      background: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                      color: darkMode ? '#60a5fa' : '#2563eb',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      marginRight: '8px',
                    }}>
                      {article.category}
                    </span>
                    <span style={{
                      display: 'inline-block',
                      color: getImportanceColor(article.importance),
                      fontSize: '12px',
                      fontWeight: '600',
                    }}>
                      ⭐ {article.importance}/10
                    </span>
                  </div>

                  <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    lineHeight: '1.4',
                    flex: '1',
                    color: textColor,
                  }}>
                    {article.title}
                  </h3>

                  <p style={{
                    margin: '0 0 15px 0',
                    color: secondaryText,
                    fontSize: '13px',
                    lineHeight: '1.5',
                    flex: '1',
                  }}>
                    {article.summary}
                  </p>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  }}>
                    <small style={{ color: secondaryText, fontSize: '11px' }}>
                      {article.source}
                    </small>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" style={{
                      color: '#10b981',
                      textDecoration: 'none',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}>
                      Read →
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
