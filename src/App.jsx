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
  const [sortBy, setSortBy] = useState('latest')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  
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

  const countries = [
    { name: 'Global', flag: '🌐', value: 'All' },
    { name: 'Germany', flag: '🇩🇪', value: 'Germany' },
    { name: 'UK', flag: '🇬🇧', value: 'UK' },
    { name: 'USA', flag: '🇺🇸', value: 'USA' },
    { name: 'Canada', flag: '🇨🇦', value: 'Canada' },
    { name: 'Australia', flag: '🇦🇺', value: 'Australia' },
    { name: 'Netherlands', flag: '🇳🇱', value: 'Netherlands' },
    { name: 'Sweden', flag: '🇸🇪', value: 'Sweden' },
    { name: 'France', flag: '🇫🇷', value: 'France' },
    { name: 'Switzerland', flag: '🇨🇭', value: 'Switzerland' },
    { name: 'Japan', flag: '🇯🇵', value: 'Japan' }
  ]

  const topicsList = [
    { name: 'All Topics', flag: '📂', value: 'All' },
    { name: 'Visa', flag: '🏛️', value: 'Visa' },
    { name: 'Blocked Account', flag: '💳', value: 'Blocked Account' },
    { name: 'SOP', flag: '✍️', value: 'SOP' },
    { name: 'APS', flag: '📜', value: 'APS' },
    { name: 'Scholarships', flag: '🎓', value: 'Scholarships' }
  ]

  return (
    <div className="app-container">
      {/* Axios Utility Top Bar: Countries with Flags */}
      <div className="axios-utility-bar">
        <div className="axios-utility-content">
          <div className="country-flags-list">
            {countries.map(c => (
              <button
                key={c.value}
                className={`country-flag-tab ${selectedCountry === c.value ? 'active' : ''}`}
                onClick={() => handleCountryChange(c.value)}
              >
                <span className="flag-icon">{c.flag}</span>
                <span className="country-name-text">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="axios-utility-right">
            <a 
              href="https://www.studplex.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="main-app-link"
            >
              Main App ↗
            </a>
          </div>
        </div>
      </div>

      {/* Axios Main Header Row */}
      <header className="axios-main-header">
        <div className="axios-header-left">
          <button 
            type="button" 
            className="menu-toggle-btn"
            onClick={() => setIsMenuOpen(true)}
            title="Open navigation menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <span className="menu-text-label">Sections</span>
          </button>
        </div>

        <div className="axios-header-center">
          <Link to="/" className="axios-brand-logo" onClick={() => { setSelectedCountry('All'); setSelectedTopic('All'); setSearchQuery(''); }}>
            STUDPLEX
          </Link>
        </div>

        <div className="axios-header-right">
          {/* Inline Search Bar */}
          <div className="axios-search-wrapper">
            <svg className="axios-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              className="axios-search-input" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Theme Switcher */}
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

      {/* Axios Topic Subnav Pills */}
      <div className="axios-subnav-bar">
        <div className="axios-subnav-pills">
          {topicsList.map(t => (
            <button
              key={t.value}
              className={`axios-pill ${selectedTopic === t.value ? 'active' : ''}`}
              onClick={() => handleTopicChange(t.value)}
            >
              <span style={{ marginRight: '6px' }}>{t.flag}</span>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Drawer Overlay */}
      {isMenuOpen && (
        <div className="drawer-overlay" onClick={() => setIsMenuOpen(false)}></div>
      )}

      {/* Navigation Drawer Panel */}
      <div className={`nav-drawer ${isMenuOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-logo">STUDPLEX</span>
          <button className="close-drawer-btn" onClick={() => setIsMenuOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="drawer-content">
          {/* Section: Sort & Feed */}
          <div className="drawer-section">
            <h3 className="drawer-section-title">Feed Options</h3>
            <ul className="drawer-links-list">
              <li>
                <button 
                  onClick={() => { 
                    setSortBy('latest'); 
                    setSelectedCountry('All'); 
                    setSelectedTopic('All'); 
                    setSearchQuery(''); 
                    setIsMenuOpen(false); 
                    if (location.pathname !== "/") navigate("/");
                  }}
                  style={sortBy === 'latest' && selectedCountry === 'All' && selectedTopic === 'All' && !searchQuery ? { color: 'var(--accent)', fontWeight: 800 } : {}}
                >
                  📅 Latest Articles
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { 
                    setSortBy('popular'); 
                    setSelectedCountry('All'); 
                    setSelectedTopic('All'); 
                    setSearchQuery(''); 
                    setIsMenuOpen(false); 
                    if (location.pathname !== "/") navigate("/");
                  }}
                  style={sortBy === 'popular' && selectedCountry === 'All' && selectedTopic === 'All' ? { color: 'var(--accent)', fontWeight: 800 } : {}}
                >
                  🔥 Most Viewed
                </button>
              </li>
            </ul>
          </div>

          {/* Section: Academic Levels */}
          <div className="drawer-section">
            <h3 className="drawer-section-title">Academic Levels</h3>
            <ul className="drawer-links-list">
              <li><button onClick={() => { handleSearchChange('Bachelor'); setIsMenuOpen(false); }}>🎓 Bachelor's Guides</button></li>
              <li><button onClick={() => { handleSearchChange('Master'); setIsMenuOpen(false); }}>🎓 Master's Guides</button></li>
              <li><button onClick={() => { handleSearchChange('PhD'); setIsMenuOpen(false); }}>🎓 PhD / Research Guides</button></li>
            </ul>
          </div>

          {/* Section: Topic Categories */}
          <div className="drawer-section">
            <h3 className="drawer-section-title">Topic Categories</h3>
            <ul className="drawer-links-list">
              <li><button onClick={() => { handleTopicChange('Visa'); setIsMenuOpen(false); }}>🏛️ Visa Roadmaps</button></li>
              <li><button onClick={() => { handleTopicChange('Blocked Account'); setIsMenuOpen(false); }}>💳 Blocked Accounts</button></li>
              <li><button onClick={() => { handleTopicChange('SOP'); setIsMenuOpen(false); }}>✍️ SOP & CV Writing</button></li>
              <li><button onClick={() => { handleTopicChange('APS'); setIsMenuOpen(false); }}>📜 APS / Verification</button></li>
              <li><button onClick={() => { handleTopicChange('Scholarships'); setIsMenuOpen(false); }}>💰 Scholarships & Grants</button></li>
            </ul>
          </div>

          {/* Section: Popular Countries */}
          <div className="drawer-section">
            <h3 className="drawer-section-title">Study Destinations</h3>
            <ul className="drawer-links-list">
              <li><button onClick={() => { handleCountryChange('Germany'); setIsMenuOpen(false); }}>🇩🇪 Germany</button></li>
              <li><button onClick={() => { handleCountryChange('UK'); setIsMenuOpen(false); }}>🇬🇧 United Kingdom</button></li>
              <li><button onClick={() => { handleCountryChange('USA'); setIsMenuOpen(false); }}>🇺🇸 United States</button></li>
              <li><button onClick={() => { handleCountryChange('Canada'); setIsMenuOpen(false); }}>🇨🇦 Canada</button></li>
              <li><button onClick={() => { handleCountryChange('Australia'); setIsMenuOpen(false); }}>🇦🇺 Australia</button></li>
              <li><button onClick={() => { handleCountryChange('All'); setIsMenuOpen(false); }}>🌐 View All Countries</button></li>
            </ul>
          </div>

          {/* Section: Main App Utilities */}
          <div className="drawer-section utils-section">
            <h3 className="drawer-section-title">Studplex Tools</h3>
            <a href="https://www.studplex.com" target="_blank" rel="noopener noreferrer" className="drawer-util-btn">
              Go to Main Portal ↗
            </a>
          </div>
        </div>
      </div>


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
                sortBy={sortBy}
                setSortBy={setSortBy}
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
