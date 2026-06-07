import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, MapPin, Tag } from 'lucide-react'

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5001";

export default function BlogHome() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('All')
  const [selectedTopic, setSelectedTopic] = useState('All')
  const navigate = useNavigate()

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
  const countries = ['All', 'Germany', 'USA', 'UK & Canada', 'Global']

  // List of topics/categories for filtering
  const topics = ['All', 'Visa', 'Blocked Account', 'SOP', 'APS', 'Scholarships']

  const COUNTRY_FLAG = {
    Germany: "🇩🇪",
    USA: "🇺🇸",
    "UK & Canada": "🇬🇧🇨🇦",
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

  return (
    <div>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', margin: '30px 0 50px', borderBottom: '1.5px solid var(--card-border)', paddingBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '46px', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.03em' }}>
          The Studplex Times
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '600px', margin: '0 auto', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          Independent, expert resources, student guides, and visa slot updates for study abroad.
        </p>
      </div>

      {/* Search & Double Filter Bar */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search guides, visa updates, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Country Filter Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Country:
            </span>
          </div>
          <div className="categories-bar">
            {countries.map(c => (
              <button
                key={c}
                className={`category-chip ${selectedCountry === c ? 'active' : ''}`}
                onClick={() => setSelectedCountry(c)}
              >
                {COUNTRY_FLAG[c] && <span style={{ marginRight: '6px' }}>{COUNTRY_FLAG[c]}</span>}
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Topic/Category Filter Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Topic:
            </span>
          </div>
          <div className="categories-bar">
            {topics.map(t => (
              <button
                key={t}
                className={`category-chip ${selectedTopic === t ? 'active' : ''}`}
                onClick={() => setSelectedTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

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
      ) : filteredArticles.length > 0 ? (
        <div className="articles-grid">
          {filteredArticles.map(art => (
            <div
              key={art.slug}
              className="article-card"
            >
              <div className="article-card-header">
                <span className="category-badge">{art.category}</span>
                <span className="article-date">{art.date}</span>
              </div>
              
              <div className="article-card-body" onClick={() => navigate(`/${art.slug}`)}>
                <h2 className="article-card-title">{art.title}</h2>
                <p className="article-card-desc">{art.meta_description}</p>
              </div>

              <div className="article-card-footer">
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span>⏱️ {art.read_time} min read</span>
                  <span>👁️ {art.views || 0} views</span>
                </div>
                {art.country && (
                  <Link 
                    to={`/country/${art.country.toLowerCase()}`}
                    style={{ 
                      color: 'var(--secondary-accent)', 
                      textDecoration: 'none', 
                      fontWeight: 700,
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {COUNTRY_FLAG[art.country] || '🌍'} {art.country} Page →
                  </Link>
                )}
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
