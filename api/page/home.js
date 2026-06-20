import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
let client;
let clientPromise;

if (!uri) {
  throw new Error('Please add your Mongo URI to environment variables');
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return dateStr || '';
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const mongoClient = await clientPromise;
    let dbName = 'studyapp';
    try {
      const parsed = new URL(uri);
      if (parsed.pathname && parsed.pathname !== '/') {
        dbName = parsed.pathname.substring(1);
      }
    } catch (e) {}

    const db = mongoClient.db(dbName);
    const articlesCol = db.collection('articles');

    const todayStr = new Date().toISOString().split('T')[0];
    const articles = await articlesCol
      .find({ date: { $lte: todayStr } }, { projection: { _id: 0, content: 0 } })
      .sort({ date: -1 })
      .toArray();

    const totalArticles = articles.length;

    // Detect if proxied under /news base path
    const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host || '';
    const isProxied = req.query.proxied === 'true' || (forwardedHost.includes('studplex.com') && !forwardedHost.includes('news.'));
    const basePath = isProxied ? '/news' : '';

    // Extract query parameters
    const search = req.query.search || '';
    const category = req.query.category || '';
    const sort = req.query.sort || 'latest';
    const country = req.query.country || '';

    // Extract all unique categories from original active articles list
    const allCategories = ['All', ...new Set(articles.map(art => art.category).filter(Boolean))];

    // Filter articles in-memory
    let filtered = [...articles];

    if (country) {
      filtered = filtered.filter(art => (art.country || '').toLowerCase() === country.toLowerCase());
    }

    if (category && category.toLowerCase() !== 'all') {
      filtered = filtered.filter(art => (art.category || '').toLowerCase() === category.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(art => 
        (art.title || '').toLowerCase().includes(q) ||
        (art.meta_description || '').toLowerCase().includes(q) ||
        (art.category || '').toLowerCase().includes(q) ||
        (art.country || '').toLowerCase().includes(q) ||
        (Array.isArray(art.tags) && art.tags.some(t => String(t).toLowerCase().includes(q)))
      );
    }

    // Sort
    if (sort === 'popular') {
      filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sort === 'read_time') {
      filtered.sort((a, b) => (b.read_time || 0) - (a.read_time || 0));
    } else {
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    const matchedArticlesCount = filtered.length;

    const articleCards = filtered.map(article => {
      const slug = esc(article.slug);
      const title = esc(article.title || article.meta_title || 'Untitled');
      const description = esc(article.meta_description || '');
      const categoryVal = esc(article.category || '');
      const countryVal = esc(article.country || '');
      const date = formatDate(article.date);
      const readTime = article.read_time || 0;
      const views = article.views || 0;

      // Deduplicate category and country tags (e.g. "Japan" and "Japan")
      const showCountryBadge = countryVal && countryVal.toLowerCase() !== categoryVal.toLowerCase();

      return `
        <a href="${basePath}/${slug}" class="card-link">
          <article class="card">
            <div class="card-badges">
              ${categoryVal ? `<span class="badge badge-category">${categoryVal}</span>` : ''}
              ${showCountryBadge ? `<span class="badge badge-country">${countryVal}</span>` : ''}
            </div>
            <h2 class="card-title">${title}</h2>
            ${description ? `<p class="card-desc">${description}</p>` : ''}
            <div class="card-meta">
              <span>${date}</span>
              <span class="meta-sep">·</span>
              <span>${readTime} min read</span>
              <span class="meta-sep">·</span>
              <span>${views.toLocaleString()} views</span>
            </div>
          </article>
        </a>`;
    }).join('');

    const seoTitle = country
      ? `Study Abroad in ${esc(country)}: Guides &amp; News | Studplex`
      : `Studplex Guides &amp; News — Study Abroad Resources`;

    const seoDesc = country
      ? `Expert study abroad guides, visa tips, scholarship updates, and student life advice for ${esc(country)}.`
      : `Expert study abroad guides, visa tips, scholarship updates, and student life advice for Germany, UK, USA, Canada, Australia, Netherlands, Sweden, France, Switzerland, and Japan.`;

    const pageTitle = country 
      ? `Study Abroad Guides &amp; News for ${esc(country)}` 
      : `Study Abroad Guides &amp; News`;

    const pageDesc = country 
      ? `Expert resources, visa requirements, and guides for students heading to ${esc(country)}.`
      : `Expert resources for international students`;

    const canonicalUrl = country
      ? `https://studplex.com/news/country/${esc(country)}`
      : `https://studplex.com/news`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoTitle}</title>
  <meta name="description" content="${seoDesc}">
  <meta name="google-site-verification" content="kIDo3GYT309SU6JrISBV0mv2bh_4UimccrL6r6RgO4M" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${seoTitle}" />
  <meta property="og:description" content="${seoDesc}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="Studplex News" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${seoTitle}" />
  <meta name="twitter:description" content="${seoDesc}" />

  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7860269432378841" crossorigin="anonymous"></script>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Header ── */
    .header {
      background: #0f172a;
      padding: 0 24px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-inner {
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      font-size: 1.35rem;
      font-weight: 700;
      color: #fff;
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .logo-accent { color: #f97316; }
    .nav { display: flex; gap: 24px; align-items: center; }
    .nav a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.2s;
    }
    .nav a:hover { color: #fff; }

    /* ── Hero ── */
    .hero {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 60px 24px;
      text-align: center;
      color: #fff;
    }
    .hero h1 {
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 12px;
      line-height: 1.2;
    }
    .hero p {
      font-size: 1.15rem;
      color: #94a3b8;
      max-width: 560px;
      margin: 0 auto;
    }

    /* ── Article Count ── */
    .article-count {
      text-align: center;
      padding: 24px 24px 0;
      color: #64748b;
      font-size: 0.95rem;
      font-weight: 500;
    }

    /* ── Country Filter Bar ── */
    .country-bar-wrapper {
      max-width: 1200px;
      margin: 24px auto 0;
      padding: 0 24px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .country-bar-wrapper::-webkit-scrollbar { display: none; }
    .country-bar {
      display: flex;
      gap: 10px;
      padding: 4px 0;
      white-space: nowrap;
      justify-content: center;
    }
    .country-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #334155;
      text-decoration: none;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .country-btn:hover {
      background: #f97316;
      color: #fff;
      border-color: #f97316;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(249,115,22,0.25);
    }

    /* ── Grid ── */
    .grid-wrapper {
      max-width: 1200px;
      margin: 32px auto 48px;
      padding: 0 24px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    /* ── Card ── */
    .card-link {
      text-decoration: none;
      color: inherit;
      display: block;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 24px;
      transition: transform 0.2s, box-shadow 0.2s;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .card-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.5;
      letter-spacing: 0.02em;
    }
    .badge-category {
      background: #f97316;
      color: #fff;
    }
    .badge-country {
      background: #e2e8f0;
      color: #475569;
    }
    .card-title {
      font-size: 1.15rem;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.4;
      margin-bottom: 8px;
    }
    .card-desc {
      font-size: 0.875rem;
      color: #64748b;
      line-height: 1.55;
      margin-bottom: 14px;
      flex: 1;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 0.8rem;
      color: #94a3b8;
      margin-top: auto;
    }
    .meta-sep { color: #cbd5e1; }

    /* ── Footer ── */
    .footer {
      background: #0f172a;
      color: #94a3b8;
      text-align: center;
      padding: 40px 24px;
      font-size: 0.875rem;
      line-height: 1.7;
    }
    .footer a {
      color: #f97316;
      text-decoration: none;
    }
    .footer a:hover { text-decoration: underline; }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .footer-links a { color: #cbd5e1; font-weight: 500; }
    .footer-links a:hover { color: #f97316; }

    /* ── Filters Section ── */
    .filters-container {
      max-width: 1200px;
      margin: 32px auto 0;
      padding: 0 24px;
    }
    .filters-row {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .search-wrapper {
      position: relative;
      flex: 1;
      min-width: 280px;
      max-width: 480px;
    }
    .search-input {
      width: 100%;
      padding: 12px 16px 12px 42px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.95rem;
      font-family: inherit;
      color: #1e293b;
      outline: none;
      transition: all 0.2s;
      background: #fff;
    }
    .search-input:focus {
      border-color: #f97316;
      box-shadow: 0 0 0 3px rgba(249,115,22,0.15);
    }
    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #64748b;
      width: 18px;
      height: 18px;
      pointer-events: none;
    }
    .sort-wrapper {
      position: relative;
    }
    .sort-select {
      appearance: none;
      padding: 12px 36px 12px 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      font-size: 0.95rem;
      font-family: inherit;
      font-weight: 500;
      color: #334155;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
    }
    .sort-select:focus {
      border-color: #f97316;
    }
    .sort-arrow {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      width: 16px;
      height: 16px;
      color: #64748b;
    }
    .categories-row {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 8px;
      scrollbar-width: none;
      margin-bottom: 8px;
    }
    .categories-row::-webkit-scrollbar { display: none; }
    .category-chip {
      padding: 8px 16px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .category-chip:hover {
      border-color: #cbd5e1;
      color: #1e293b;
    }
    .category-chip.active {
      background: #f97316;
      border-color: #f97316;
      color: #fff;
    }
    
    /* ── Empty State ── */
    .empty-state {
      text-align: center;
      padding: 64px 24px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin: 24px 0;
      width: 100%;
    }
    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 16px;
    }
    .empty-state h3 {
      font-size: 1.25rem;
      color: #0f172a;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .empty-state p {
      color: #64748b;
      margin-bottom: 20px;
    }
    .reset-btn {
      padding: 10px 20px;
      background: #f97316;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .reset-btn:hover {
      background: #ea580c;
    }

    .country-btn.active {
      background: #f97316;
      color: #fff;
      border-color: #f97316;
      box-shadow: 0 4px 12px rgba(249,115,22,0.25);
    }

    /* ── Responsive ── */
    @media (max-width: 1024px) {
      .grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 768px) {
      .hero { padding: 40px 20px; }
      .hero h1 { font-size: 1.75rem; }
      .hero p { font-size: 1rem; }
      .grid { grid-template-columns: 1fr; }
      .country-bar { justify-content: flex-start; }
      .nav { gap: 16px; }
      .nav a { font-size: 0.82rem; }
      .filters-row { flex-direction: column; align-items: stretch; }
      .search-wrapper { max-width: 100%; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="header-inner">
      <a href="${basePath || '/'}" class="logo">Stud<span class="logo-accent">plex</span> News</a>
      <nav class="nav">
        <a href="${basePath || '/'}">Home</a>
        <a href="https://studplex.com">Studplex</a>
      </nav>
    </div>
  </header>

  <!-- Hero -->
  <section class="hero">
    <h1>${pageTitle}</h1>
    <p>${pageDesc}</p>
  </section>

  <!-- Article Count -->
  <div class="article-count">${matchedArticlesCount} guide${matchedArticlesCount !== 1 ? 's' : ''} found ${search || category || country ? `matching filters` : `published`}</div>

  <!-- Country Filter Bar -->
  <div class="country-bar-wrapper">
    <div class="country-bar">
      <a href="${country.toLowerCase() === 'germany' ? (basePath || '/') : `${basePath}/country/Germany`}" class="country-btn ${country.toLowerCase() === 'germany' ? 'active' : ''}">🇩🇪 Germany</a>
      <a href="${country.toLowerCase() === 'uk' ? (basePath || '/') : `${basePath}/country/UK`}" class="country-btn ${country.toLowerCase() === 'uk' ? 'active' : ''}">🇬🇧 UK</a>
      <a href="${country.toLowerCase() === 'usa' ? (basePath || '/') : `${basePath}/country/USA`}" class="country-btn ${country.toLowerCase() === 'usa' ? 'active' : ''}">🇺🇸 USA</a>
      <a href="${country.toLowerCase() === 'canada' ? (basePath || '/') : `${basePath}/country/Canada`}" class="country-btn ${country.toLowerCase() === 'canada' ? 'active' : ''}">🇨🇦 Canada</a>
      <a href="${country.toLowerCase() === 'australia' ? (basePath || '/') : `${basePath}/country/Australia`}" class="country-btn ${country.toLowerCase() === 'australia' ? 'active' : ''}">🇦🇺 Australia</a>
      <a href="${country.toLowerCase() === 'netherlands' ? (basePath || '/') : `${basePath}/country/Netherlands`}" class="country-btn ${country.toLowerCase() === 'netherlands' ? 'active' : ''}">🇳🇱 Netherlands</a>
      <a href="${country.toLowerCase() === 'sweden' ? (basePath || '/') : `${basePath}/country/Sweden`}" class="country-btn ${country.toLowerCase() === 'sweden' ? 'active' : ''}">🇸🇪 Sweden</a>
      <a href="${country.toLowerCase() === 'france' ? (basePath || '/') : `${basePath}/country/France`}" class="country-btn ${country.toLowerCase() === 'france' ? 'active' : ''}">🇫🇷 France</a>
      <a href="${country.toLowerCase() === 'switzerland' ? (basePath || '/') : `${basePath}/country/Switzerland`}" class="country-btn ${country.toLowerCase() === 'switzerland' ? 'active' : ''}">🇨🇭 Switzerland</a>
      <a href="${country.toLowerCase() === 'japan' ? (basePath || '/') : `${basePath}/country/Japan`}" class="country-btn ${country.toLowerCase() === 'japan' ? 'active' : ''}">🇯🇵 Japan</a>
    </div>
  </div>

  <!-- Filters Section -->
  <div class="filters-container">
    <form id="filtersForm" method="GET" action="">
      ${country ? `<input type="hidden" name="country" value="${esc(country)}">` : ''}
      <input type="hidden" id="categoryInput" name="category" value="${esc(category)}">

      <div class="filters-row">
        <!-- Search bar -->
        <div class="search-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" name="search" value="${esc(search)}" class="search-input" placeholder="Search guides & news..." autocomplete="off">
        </div>

        <!-- Sort drop-down -->
        <div class="sort-wrapper">
          <select name="sort" class="sort-select" onchange="document.getElementById('filtersForm').submit()">
            <option value="latest" ${sort === 'latest' ? 'selected' : ''}>📅 Latest Articles</option>
            <option value="popular" ${sort === 'popular' ? 'selected' : ''}>🔥 Most Viewed</option>
            <option value="read_time" ${sort === 'read_time' ? 'selected' : ''}>⏱️ Reading Time</option>
          </select>
          <svg class="sort-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      <!-- Categories selection -->
      <div class="categories-row">
        ${allCategories.map(cat => {
          const isActive = (!category && cat === 'All') || (category.toLowerCase() === cat.toLowerCase());
          return `
            <button type="button" class="category-chip ${isActive ? 'active' : ''}" onclick="selectCategory('${esc(cat)}')">
              ${esc(cat)}
            </button>
          `;
        }).join('')}
      </div>
    </form>
  </div>

  <!-- Articles Grid / Empty State -->
  <div class="grid-wrapper">
    ${articleCards ? `
      <div class="grid">
        ${articleCards}
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3>No articles found</h3>
        <p>We couldn't find any articles matching your filters. Try different search terms or categories.</p>
        <button type="button" class="reset-btn" onclick="resetFilters()">Reset Filters</button>
      </div>
    `}
  </div>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-links">
      <a href="${basePath || '/'}">Home</a>
      <a href="https://studplex.com">Studplex</a>
      <a href="${basePath}/sitemap.xml">Sitemap</a>
    </div>
    <p>&copy; ${new Date().getFullYear()} <a href="https://studplex.com">Studplex</a>. All rights reserved.</p>
  </footer>

  <script>
    function selectCategory(cat) {
      document.getElementById('categoryInput').value = cat === 'All' ? '' : cat;
      document.getElementById('filtersForm').submit();
    }
    function resetFilters() {
      // Clear filters keeping only country if active
      const countryVal = "${esc(country)}";
      if (countryVal) {
        window.location.href = window.location.pathname;
      } else {
        window.location.href = "${basePath || '/'}";
      }
    }
  </script>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Home page error:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Error</title></head><body><h1>Something went wrong</h1><p>Please try again later.</p></body></html>`);
  }
}
