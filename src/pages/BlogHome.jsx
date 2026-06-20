import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, MapPin, Tag } from 'lucide-react'

const basePath = window.location.pathname.startsWith('/news') ? '/news' : '';
const BASE_URL = import.meta.env.VITE_API_URL || basePath;

export default function BlogHome({ searchQuery, setSearchQuery, selectedCountry, setSelectedCountry, selectedTopic, setSelectedTopic, sortBy, setSortBy }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const basePath = window.location.pathname.startsWith('/news') ? '/news' : '';

  useEffect(() => {
    fetch(`${BASE_URL}/api/articles`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setArticles(data)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching articles:', err)
        setLoading(false)
      })
  }, [])

  // List of countries for filtering
  const countries = ['All', 'Germany', 'UK', 'USA', 'Canada', 'Australia', 'Netherlands', 'Sweden', 'France', 'Switzerland', 'Japan', 'Global']

  // List of topics/categories for filtering
  const topics = ['All', 'Visa', 'Blocked Account', 'SOP', 'APS', 'Scholarships']

  const COUNTRY_FLAG = {
    Germany: "🇩🇪",
    UK: "🇬🇧",
    USA: "🇺🇸",
    Canada: "🇨🇦",
    Australia: "🇦🇺",
    Netherlands: "🇳🇱",
    Sweden: "🇸🇪",
    France: "🇫🇷",
    Switzerland: "🇨🇭",
    Japan: "🇯🇵",
    Global: "🌍"
  }

  // Filter articles based on search, country, and topic
  const filteredArticles = articles.filter(art => {
    const matchesCountry = selectedCountry === 'All' || (art.country || '').toLowerCase() === selectedCountry.toLowerCase()
    
    const matchesTopic = selectedTopic === 'All' || (art.category || '').toLowerCase() === selectedTopic.toLowerCase()
    
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          art.meta_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          art.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
                          
    return matchesCountry && matchesTopic && matchesSearch
  })

  // Sort articles based on selection
  const sortedArticles = [...filteredArticles].sort((a, b) => {
    if (sortBy === 'latest') {
      return new Date(b.date) - new Date(a.date);
    }
    if (sortBy === 'popular') {
      return (b.views || 0) - (a.views || 0);
    }
    if (sortBy === 'oldest') {
      return new Date(a.date) - new Date(b.date);
    }
    return 0;
  })

  return (
    <div>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', margin: '30px 0 50px', borderBottom: '1.5px solid var(--card-border)', paddingBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '42px', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
          Studplex Newsroom
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '600px', margin: '0 auto', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
          Real-time global student guides, visa updates, and official resources for study abroad.
        </p>
      </div>

      {/* Mobile-only Filter Bar (Hidden on Desktop via CSS) */}
      <div className="mobile-filters-container">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search news & guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="header-select" 
            style={{ display: 'block', width: '100%', flex: 1 }}
            value={selectedCountry} 
            onChange={(e) => setSelectedCountry(e.target.value)}
          >
            <option value="All">All Countries</option>
            <option value="Germany">Germany</option>
            <option value="UK">UK</option>
            <option value="USA">USA</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="Netherlands">Netherlands</option>
            <option value="Sweden">Sweden</option>
            <option value="France">France</option>
            <option value="Switzerland">Switzerland</option>
            <option value="Japan">Japan</option>
            <option value="Global">Global</option>
          </select>

          <select 
            className="header-select" 
            style={{ display: 'block', width: '100%', flex: 1 }}
            value={selectedTopic} 
            onChange={(e) => setSelectedTopic(e.target.value)}
          >
            <option value="All">All Topics</option>
            <option value="Visa">Visa</option>
            <option value="Blocked Account">Blocked Account</option>
            <option value="SOP">SOP</option>
            <option value="APS">APS</option>
            <option value="Scholarships">Scholarships</option>
          </select>
        </div>
      </div>

      {/* Sort By controls bar */}
      {!loading && (
        <div className="filter-controls-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
            {sortedArticles.length} guides found
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>Sort By:</label>
            <select 
              className="header-select" 
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer' }}
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="latest">📅 Latest Articles</option>
              <option value="popular">🔥 Most Viewed</option>
              <option value="oldest">⏳ Oldest Articles</option>
            </select>
          </div>
        </div>
      )}

      {/* Grid of Articles */}
      {loading ? (
        <div className="articles-grid">
          {[1, 2, 3].map(n => (
            <div key={n} className="article-card" style={{ height: '300px' }}>
              <div style={{ background: 'var(--card-border)', height: '20px', width: '30%', marginBottom: '16px' }}></div>
              <div style={{ background: 'var(--card-border)', height: '48px', width: '100%', marginBottom: '16px' }}></div>
              <div style={{ background: 'var(--card-border)', height: '80px', width: '100%' }}></div>
            </div>
          ))}
        </div>
      ) : sortedArticles.length > 0 ? (
        <div className="articles-grid">
          {sortedArticles.map(art => (
            <div
              key={art.slug}
              className="article-card"
            >
              <div className="article-card-header">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="category-badge">{art.category}</span>
                  {art.country && (
                    <span 
                      className="category-badge" 
                      style={{ 
                        background: 'rgba(var(--accent-rgb), 0.08)', 
                        color: 'var(--accent)',
                        cursor: 'pointer' 
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${basePath}/country/${art.country.toLowerCase()}`);
                      }}
                      title={`View all ${art.country} guides`}
                    >
                      {COUNTRY_FLAG[art.country] || '🌍'} {art.country}
                    </span>
                  )}
                </div>
                <span className="article-date">{art.date}</span>
              </div>
              
              <div className="article-card-body" onClick={() => navigate(`${basePath}/${art.slug}`)}>
                <h2 className="article-card-title">{art.title}</h2>
                <p className="article-card-desc">{art.meta_description}</p>
              </div>

              <div className="article-card-footer">
                <div style={{ display: 'flex', gap: '12px', color: 'var(--text-muted)' }}>
                  <span>⏱️ {art.read_time} min read</span>
                  <span>👁️ {art.views || 0} views</span>
                </div>
                <Link 
                  to={`${basePath}/${art.slug}`}
                  style={{ 
                    color: 'var(--secondary-accent)', 
                    textDecoration: 'none', 
                    fontWeight: 700,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Read More →
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: '4px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3>No articles found</h3>
          <p style={{ marginTop: '8px' }}>Try adjusting your filters or search queries.</p>
        </div>
      )}
    </div>
  )
}
