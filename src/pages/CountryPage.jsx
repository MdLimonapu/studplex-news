import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'

const BASE_URL = import.meta.env.VITE_API_URL || "";

export default function CountryPage() {
  const { countryName } = useParams()
  const navigate = useNavigate()
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTopic, setSelectedTopic] = useState('All')

  // Clean country name for display (e.g., 'germany' -> 'Germany')
  const displayName = countryName.charAt(0).toUpperCase() + countryName.slice(1).toLowerCase()

  useEffect(() => {
    setLoading(true)
    
    // Update dynamic metadata for SEO
    document.title = `Study Abroad in ${displayName}: Visas, Guides & News | Studplex`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.getElementsByTagName('head')[0].appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', `Find all student resources, visa rules, blocked accounts, admissions details, and expert guides for study abroad in ${displayName}.`);

    fetch(`${BASE_URL}/api/articles`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Filter articles for this country
          const countryArticles = data.filter(art => 
            (art.country || '').toLowerCase() === countryName.toLowerCase()
          )
          setArticles(countryArticles)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching country articles:', err)
        setLoading(false)
      })
  }, [countryName, displayName])

  // Get list of unique topics/categories for this country's articles
  const topics = ['All', ...new Set(articles.map(art => art.category))].filter(Boolean)

  const filteredArticles = articles.filter(art => 
    selectedTopic === 'All' || art.category.toLowerCase() === selectedTopic.toLowerCase()
  )

  return (
    <div>
      {/* Back Button */}
      <button className="back-button" onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to all resources
      </button>

      {/* Country Header */}
      <div style={{ borderBottom: '2px double var(--card-border)', paddingBottom: '24px', marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Study Abroad Resources for {displayName}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
          Expert guides, visa slot booking updates, blocked accounts, and admission requirements for {displayName}.
        </p>
      </div>

      {/* Topics Sub-Filter Bar */}
      {topics.length > 1 && (
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginRight: '16px' }}>
            Filter by topic:
          </span>
          <div className="categories-bar" style={{ display: 'inline-flex' }}>
            {topics.map(topic => (
              <button
                key={topic}
                className={`category-chip ${selectedTopic === topic ? 'active' : ''}`}
                onClick={() => setSelectedTopic(topic)}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Articles Grid */}
      {loading ? (
        <div className="articles-grid">
          {[1, 2].map(n => (
            <div key={n} className="article-card" style={{ height: '200px' }}>
              <div style={{ background: 'var(--card-border)', height: '20px', width: '25%', marginBottom: '12px' }}></div>
              <div style={{ background: 'var(--card-border)', height: '28px', width: '90%', marginBottom: '12px' }}></div>
              <div style={{ background: 'var(--card-border)', height: '60px', width: '100%', marginBottom: '12px' }}></div>
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
                <div style={{ display: 'flex', gap: '12px', color: 'var(--text-muted)' }}>
                  <span>⏱️ {art.read_time} min read</span>
                  <span>👁️ {art.views || 0} views</span>
                </div>
                <Link 
                  to={`/${art.slug}`}
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
          <h3>No guides found for this topic</h3>
          <p style={{ marginTop: '8px' }}>Select another filter or browse all countries.</p>
        </div>
      )}
    </div>
  )
}
