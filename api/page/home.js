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
    const isProxied = forwardedHost.includes('studplex.com') && !forwardedHost.includes('news.');
    const basePath = isProxied ? '/news' : '';

    const articleCards = articles.map(article => {
      const slug = esc(article.slug);
      const title = esc(article.title || article.meta_title || 'Untitled');
      const description = esc(article.meta_description || '');
      const category = esc(article.category || '');
      const country = esc(article.country || '');
      const date = formatDate(article.date);
      const readTime = article.read_time || 0;
      const views = article.views || 0;

      // Deduplicate category and country tags (e.g. "Japan" and "Japan")
      const showCountryBadge = country && country.toLowerCase() !== category.toLowerCase();

      return `
        <a href="${basePath}/${slug}" class="card-link">
          <article class="card">
            <div class="card-badges">
              ${category ? `<span class="badge badge-category">${category}</span>` : ''}
              ${showCountryBadge ? `<span class="badge badge-country">${country}</span>` : ''}
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

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Studplex Guides &amp; News — Study Abroad Resources</title>
  <meta name="description" content="Expert study abroad guides, visa tips, scholarship updates, and student life advice for Germany, UK, USA, Canada, Australia, Netherlands, Sweden, France, Switzerland, and Japan.">
  <meta name="google-site-verification" content="kIDo3GYT309SU6JrISBV0mv2bh_4UimccrL6r6RgO4M" />
  <link rel="canonical" href="https://studplex.com/news" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Studplex Guides &amp; News — Study Abroad Resources" />
  <meta property="og:description" content="Expert study abroad guides, visa tips, scholarship updates, and student life advice for Germany, UK, USA, Canada, Australia, Netherlands, Sweden, France, Switzerland, and Japan." />
  <meta property="og:url" content="https://studplex.com/news" />
  <meta property="og:site_name" content="Studplex News" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Studplex Guides &amp; News — Study Abroad Resources" />
  <meta name="twitter:description" content="Expert study abroad guides, visa tips, scholarship updates, and student life advice for Germany, UK, USA, Canada, Australia, Netherlands, Sweden, France, Switzerland, and Japan." />

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
    <h1>Study Abroad Guides &amp; News</h1>
    <p>Expert resources for international students</p>
  </section>

  <!-- Article Count -->
  <div class="article-count">${totalArticles} article${totalArticles !== 1 ? 's' : ''} published</div>

  <!-- Country Filter Bar -->
  <div class="country-bar-wrapper">
    <div class="country-bar">
      <a href="${basePath}/country/Germany" class="country-btn">🇩🇪 Germany</a>
      <a href="${basePath}/country/UK" class="country-btn">🇬🇧 UK</a>
      <a href="${basePath}/country/USA" class="country-btn">🇺🇸 USA</a>
      <a href="${basePath}/country/Canada" class="country-btn">🇨🇦 Canada</a>
      <a href="${basePath}/country/Australia" class="country-btn">🇦🇺 Australia</a>
      <a href="${basePath}/country/Netherlands" class="country-btn">🇳🇱 Netherlands</a>
      <a href="${basePath}/country/Sweden" class="country-btn">🇸🇪 Sweden</a>
      <a href="${basePath}/country/France" class="country-btn">🇫🇷 France</a>
      <a href="${basePath}/country/Switzerland" class="country-btn">🇨🇭 Switzerland</a>
      <a href="${basePath}/country/Japan" class="country-btn">🇯🇵 Japan</a>
    </div>
  </div>

  <!-- Articles Grid -->
  <div class="grid-wrapper">
    <div class="grid">
      ${articleCards}
    </div>
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
