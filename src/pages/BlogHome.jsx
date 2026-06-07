import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5001";

export default function BlogHome() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
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

  // Categories list
  const categories = ['All', 'Germany', 'Visa', 'SOP', 'Scholarships']

  // Filter articles based on search and selected category
  const filteredArticles = articles.filter(art => {
    const matchesCategory = selectedCategory === 'All' || art.category.toLowerCase() === selectedCategory.toLowerCase()
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          art.meta_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          art.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  return (
    <div>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', margin: '40px 0 60px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '48px', fontWeight: 900, marginBottom: '16px', letterSpacing: '-0.02em' }}>
          Stud<span style={{ color: 'var(--secondary-accent)' }}>plex</span> Guides & News
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
          Thorough, expert-backed resources to guide your international study journey and help you secure admissions.
        </p>
      </div>

      {/* Search & Categories */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Search guides, requirements, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="categories-bar">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Articles */}
      {loading ? (
        <div className="articles-grid">
          {[1, 2, 3].map(n => (
            <div key={n} className="card" style={{ height: '350px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--card-border)', height: '24px', width: '30%', borderRadius: '4px' }}></div>
              <div style={{ background: 'var(--card-border)', height: '48px', width: '100%', borderRadius: '4px' }}></div>
              <div style={{ background: 'var(--card-border)', height: '80px', width: '100%', borderRadius: '4px' }}></div>
              <div style={{ marginTop: 'auto', background: 'var(--card-border)', height: '20px', width: '100%', borderRadius: '4px' }}></div>
            </div>
          ))}
        </div>
      ) : filteredArticles.length > 0 ? (
        <div className="articles-grid">
          {filteredArticles.map(art => (
            <div
              key={art.slug}
              className="card article-card"
              onClick={() => navigate(`/${art.slug}`)}
            >
              <div className="article-card-header">
                <span className="category-badge">{art.category}</span>
                <span className="article-date">{art.date}</span>
              </div>
              
              <div className="article-card-body">
                <h2 className="article-card-title">{art.title}</h2>
                <p className="article-card-desc">{art.meta_description}</p>
              </div>

              <div className="article-card-footer">
                <span>⏱️ {art.read_time} min read</span>
                <span>👁️ {art.views || 0} views</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3>No articles found</h3>
          <p style={{ marginTop: '8px' }}>Try adjusting your search queries or select a different category.</p>
        </div>
      )}
    </div>
  )
}
