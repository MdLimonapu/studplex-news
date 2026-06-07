import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import BlogHome from './pages/BlogHome'
import BlogArticle from './pages/BlogArticle'
import CountryPage from './pages/CountryPage'

function AppShell() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <Link to="/" className="brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Studplex Brand Icon Logo */}
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2L2 9L16 16L30 9L16 2Z" fill="url(#studplex-grad)" />
              <path d="M6 14.5V21C6 24.3 10.5 27 16 27C21.5 27 26 24.3 26 21V14.5L16 19.5L6 14.5Z" fill="url(#studplex-grad2)" />
              <defs>
                <linearGradient id="studplex-grad" x1="2" y1="2" x2="30" y2="16" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--secondary-accent)" />
                  <stop offset="1" stopColor="var(--accent2)" />
                </linearGradient>
                <linearGradient id="studplex-grad2" x1="6" y1="14.5" x2="26" y2="27" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--accent2)" />
                  <stop offset="1" stopColor="var(--secondary-accent)" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="brand-text">
                Stud<span className="brand-plex">plex</span>
              </span>
              <span className="brand-tagline">Guides & News</span>
            </div>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Main App Link */}
          <a 
            href="https://www.studplex.com" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              fontSize: '11.5px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text)',
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '0px',
              border: '1px solid var(--card-border)',
              background: 'var(--bg-card)'
            }}
          >
            Go to Studplex.com
          </a>

          {/* Theme Switcher Button */}
          <button 
            className="theme-toggle-btn"
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Pages Wrapper */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<BlogHome />} />
          <Route path="/country/:countryName" element={<CountryPage />} />
          <Route path="/:slug" element={<BlogArticle />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div style={{ marginBottom: '16px' }}>
          <span className="brand-text" style={{ fontSize: '18px' }}>Stud<span className="brand-plex">plex</span></span>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Expert guides & news resources for study abroad eligibility.</p>
        </div>
        <div>
          <p>&copy; {new Date().getFullYear()} Studplex. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
