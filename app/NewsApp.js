'use client';

import { useEffect, useState } from 'react';

export default function NewsApp() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

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

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading articles...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui' }}>
      <header style={{ marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
        <h1 style={{ margin: '0 0 10px 0' }}>📰 FinPulse India</h1>
        <p style={{ margin: '0', color: '#666' }}>AI-Powered Finance News</p>
        {lastUpdated && (
          <p style={{ margin: '10px 0 0 0', fontSize: '14px', color: '#999' }}>
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </p>
        )}
      </header>

      {articles.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999' }}>No articles available yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {articles.map((article, i) => (
            <article
              key={i}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>{article.title}</h3>
              <p style={{ margin: '0 0 15px 0', color: '#555', fontSize: '14px' }}>
                {article.summary}
              </p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span style={{ background: '#f0f0f0', padding: '4px 8px', borderRadius: '3px' }}>
                  {article.category}
                </span>
                <span style={{ background: '#ffe', padding: '4px 8px', borderRadius: '3px' }}>
                  ⭐ {article.importance}/10
                </span>
                <span style={{ color: '#999' }}>{article.source}</span>
              </div>
              <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'none', fontWeight: 'bold' }}>
                Read full article →
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
