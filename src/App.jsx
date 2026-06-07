import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import BlogHome from './pages/BlogHome'
import BlogArticle from './pages/BlogArticle'
import CountryPage from './pages/CountryPage'

// Custom Dropdown Component to guarantee it opens DOWNWARDS and has consistent design (Reuters style)
function HeaderDropdown({ label, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className="header-dropdown-container" ref={dropdownRef}>
      <button 
        type="button"
        className="header-dropdown-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{label}: <strong>{selectedOption ? selectedOption.label : value}</strong></span>
        <svg className={`header-dropdown-arrow ${isOpen ? 'open' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      
      {isOpen && (
        <ul className="header-dropdown-menu">
          {options.map(opt => (
            <li 
              key={opt.value} 
              className={`header-dropdown-item ${value === opt.value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AppShell() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('All')
  const [selectedTopic, setSelectedTopic] = useState('All')
  
  const navigate = useNavigate()
  const location = useLocation()

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    if (location.pathname !== "/") {
      navigate("/")
    }
  }

  const handleCountryChange = (val) => {
    setSelectedCountry(val)
    if (location.pathname !== "/") {
      navigate("/")
    }
  }

  const handleTopicChange = (val) => {
    setSelectedTopic(val)
    if (location.pathname !== "/") {
      navigate("/")
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const countryOptions = [
    { value: 'All', label: 'All' },
    { value: 'Germany', label: 'Germany' },
    { value: 'UK', label: 'UK' },
    { value: 'USA', label: 'USA' },
    { value: 'Canada', label: 'Canada' },
    { value: 'Australia', label: 'Australia' },
    { value: 'Netherlands', label: 'Netherlands' },
    { value: 'Sweden', label: 'Sweden' },
    { value: 'France', label: 'France' },
    { value: 'Switzerland', label: 'Switzerland' },
    { value: 'Japan', label: 'Japan' },
    { value: 'Global', label: 'Global' }
  ]

  const topicOptions = [
    { value: 'All', label: 'All' },
    { value: 'Visa', label: 'Visa' },
    { value: 'Blocked Account', label: 'Blocked Account' },
    { value: 'SOP', label: 'SOP' },
    { value: 'APS', label: 'APS' },
    { value: 'Scholarships', label: 'Scholarships' }
  ]

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

        {/* Global Filters & Search Section in Header (Reuters Style) */}
        <div className="header-filters-container">
          {/* Search Bar */}
          <div className="header-search-wrapper">
            <svg className="header-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              className="header-search-input" 
              placeholder="Search news & guides..." 
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Custom Country Selector Dropdown */}
          <HeaderDropdown 
            label="COUNTRY" 
            value={selectedCountry} 
            options={countryOptions} 
            onChange={handleCountryChange}
          />

          {/* Custom Topic Selector Dropdown */}
          <HeaderDropdown 
            label="TOPIC" 
            value={selectedTopic} 
            options={topicOptions} 
            onChange={handleTopicChange}
          />
        </div>

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
          <Route 
            path="/" 
            element={
              <BlogHome 
                searchQuery={searchQuery} 
                setSearchQuery={setSearchQuery}
                selectedCountry={selectedCountry} 
                setSelectedCountry={setSelectedCountry}
                selectedTopic={selectedTopic} 
                setSelectedTopic={setSelectedTopic}
              />
            } 
          />
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
