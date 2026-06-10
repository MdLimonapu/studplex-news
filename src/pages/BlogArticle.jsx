import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Eye, Calendar, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const BASE_URL = import.meta.env.VITE_API_URL || "";

export default function BlogArticle() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${BASE_URL}/api/articles/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Article not found')
        return res.json()
      })
      .then(data => {
        setArticle(data)
        setLoading(false)
        
        // Update document title and meta description dynamically for SEO!
        if (data.title) {
          document.title = `${data.title} | Studplex Guides`;
          
          let metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.getElementsByTagName('head')[0].appendChild(metaDesc);
          }
          metaDesc.setAttribute('content', data.meta_description || 'Studplex Guide');

          // Dynamically update JSON-LD Article Schema
          let schemaScript = document.getElementById('jsonld-article-schema');
          if (!schemaScript) {
            schemaScript = document.createElement('script');
            schemaScript.setAttribute('id', 'jsonld-article-schema');
            schemaScript.setAttribute('type', 'application/ld+json');
            document.getElementsByTagName('head')[0].appendChild(schemaScript);
          }
          const articleSchema = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": data.title,
            "description": data.meta_description || 'Studplex Guide',
            "datePublished": data.date,
            "author": {
              "@type": "Organization",
              "name": "Studplex",
              "url": "https://studplex.com/"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Studplex",
              "logo": {
                "@type": "ImageObject",
                "url": "https://studplex.com/apple-touch-icon.png"
              }
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": window.location.href
            }
          };
          schemaScript.textContent = JSON.stringify(articleSchema);

          // Update Open Graph (Social Sharing) Tags
          const ogTags = {
            "og:title": `${data.title} | Studplex Guides`,
            "og:description": data.meta_description || 'Studplex Guide',
            "og:type": "article",
            "og:url": window.location.href,
            "og:site_name": "Studplex Newsroom"
          };
          Object.entries(ogTags).forEach(([property, content]) => {
            let tag = document.querySelector(`meta[property="${property}"]`);
            if (!tag) {
              tag = document.createElement('meta');
              tag.setAttribute('property', property);
              document.getElementsByTagName('head')[0].appendChild(tag);
            }
            tag.setAttribute('content', content);
          });
        }
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [slug])

  // Extract outline (H2 elements) for Table of Contents
  const headers = []
  if (article && article.content) {
    const lines = article.content.split('\n')
    lines.forEach(line => {
      if (line.startsWith('## ')) {
        const title = line.replace('## ', '').trim()
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        headers.push({ title, id })
      }
    })
  }

  const handleScrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="loading-spinner" style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
        <h3>Loading article...</h3>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h3>Guide not found</h3>
        <p style={{ marginTop: '8px', marginBottom: '24px' }}>The resource you are looking for does not exist or has been moved.</p>
        <button className="back-button" onClick={() => navigate('/')} style={{ margin: '0 auto' }}>
          <ArrowLeft size={16} /> Back to Guides
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Back Link */}
      <button className="back-button" onClick={() => navigate('/')}>
        <ArrowLeft size={16} /> Back to all guides
      </button>

      <div className="reader-layout">
        {/* Main Article Card */}
        <article className="card article-detail-card">
          <div className="article-header">
            <h1 className="article-title">{article.title}</h1>
            <div className="article-meta-row">
              <span className="category-badge">{article.category}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} /> {article.date}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} /> {article.read_time} min read
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Eye size={14} /> {article.views} views
              </span>
            </div>
          </div>

          <div className="article-body-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ node, ...props }) => {
                  const rawText = props.children;
                  const id = typeof rawText === 'string'
                    ? rawText.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    : '';
                  return <h2 id={id} style={{ scrollMarginTop: '100px' }} {...props} />;
                }
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>

          {/* Call-to-action widget redirecting back to studplex.com */}
          <div className="cta-widget">
            <h3 className="cta-title">Ready to check your qualification?</h3>
            <p className="cta-desc">
              Go to the main Studplex app to search for matching university courses, evaluate your GPA, and track your visa requirements step-by-step.
            </p>
            <a 
              href="https://www.studplex.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="cta-button"
            >
              Launch Studplex Matches →
            </a>
          </div>
        </article>

        {/* Sidebar Outline */}
        {headers.length > 0 && (
          <aside className="sidebar-toc">
            <div className="card toc-card">
              <h3 className="toc-title">
                <BookOpen size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Outline
              </h3>
              <ul className="toc-list">
                {headers.map(h => (
                  <li key={h.id} className="toc-item">
                    <a 
                      onClick={() => handleScrollTo(h.id)} 
                      className="toc-link"
                    >
                      {h.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
