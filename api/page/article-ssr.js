import { MongoClient } from 'mongodb';
import { marked } from 'marked';

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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function render404(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Article Not Found — Studplex News</title>
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #334155; min-height: 100vh; display: flex; flex-direction: column; }
    header { background: #0f172a; padding: 0 24px; }
    .header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 64px; }
    .logo a { color: #fff; text-decoration: none; font-size: 1.4rem; font-weight: 700; }
    .logo .accent { color: #f97316; }
    nav a { color: #cbd5e1; text-decoration: none; margin-left: 24px; font-size: 0.95rem; font-weight: 500; transition: color .2s; }
    nav a:hover { color: #f97316; }
    .error-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
    .error-box { text-align: center; max-width: 500px; }
    .error-code { font-size: 6rem; font-weight: 700; color: #f97316; line-height: 1; }
    .error-msg { font-size: 1.3rem; color: #475569; margin: 16px 0 32px; line-height: 1.6; }
    .back-btn { display: inline-block; background: #f97316; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 1rem; transition: background .2s; }
    .back-btn:hover { background: #ea580c; }
    footer { background: #0f172a; color: #94a3b8; padding: 40px 24px; text-align: center; font-size: 0.9rem; }
    footer a { color: #f97316; text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="logo"><a href="/">Stud<span class="accent">plex</span> News</a></div>
      <nav>
        <a href="/">Home</a>
        <a href="/">Guides</a>
        <a href="/">Countries</a>
      </nav>
    </div>
  </header>
  <main class="error-wrap">
    <div class="error-box">
      <div class="error-code">404</div>
      <p class="error-msg">The article you&rsquo;re looking for doesn&rsquo;t exist or hasn&rsquo;t been published yet.</p>
      <a href="/" class="back-btn">&larr; Back to Home</a>
    </div>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} <a href="https://studplex.com">Studplex</a>. All rights reserved.</p>
  </footer>
</body>
</html>`);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(405).send('<h1>Method Not Allowed</h1>');
  }

  const { slug } = req.query;
  if (!slug) {
    return render404(res);
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
    const article = await articlesCol.findOne(
      { slug: slug, date: { $lte: todayStr } },
      { projection: { _id: 0 } }
    );

    if (!article) {
      return render404(res);
    }

    // Increment views
    await articlesCol.updateOne({ slug: slug }, { $inc: { views: 1 } });

    // Convert markdown to HTML
    const contentHtml = marked(article.content || '');

    // Detect if proxied under /news base path
    const host = req.headers.host || '';
    const isProxied = host.includes('studplex.com') && !host.includes('news.');
    const basePath = isProxied ? '/news' : '';

    // Escaped values for safe attribute insertion
    const safeTitle = escapeHtml(article.meta_title || article.title);
    const safeDescription = escapeHtml(article.meta_description || '');
    const safeSlug = escapeHtml(article.slug);
    const safeCategory = escapeHtml(article.category || '');
    const safeCountry = escapeHtml(article.country || '');
    const safeDate = escapeHtml(article.date || '');
    const canonicalUrl = `https://studplex.com/news/${safeSlug}`;
    const displayViews = (article.views || 0) + 1;
    const readTime = article.read_time || 0;
    const tags = article.tags || [];

    // Deduplicate category and country tags (e.g. "Japan" and "Japan")
    const showCountryBadge = safeCountry && safeCountry.toLowerCase() !== safeCategory.toLowerCase();

    // JSON-LD structured data
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": article.meta_title || article.title,
      "description": article.meta_description || '',
      "datePublished": article.date,
      "author": {
        "@type": "Organization",
        "name": "Studplex"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Studplex"
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": canonicalUrl
      }
    });

    // Format the date for display
    let displayDate = safeDate;
    try {
      const d = new Date(article.date + 'T00:00:00Z');
      displayDate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    } catch (e) {}

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta name="google-site-verification" content="kIDo3GYT309SU6JrISBV0mv2bh_4UimccrL6r6RgO4M" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonicalUrl}" />

  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7860269432378841" crossorigin="anonymous"></script>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">${jsonLd}</script>

  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Inter', sans-serif;
      background: #f8fafc;
      color: #334155;
      font-size: 18px;
      line-height: 1.8;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    header {
      background: #0f172a;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
    }
    .logo a {
      color: #fff;
      text-decoration: none;
      font-size: 1.4rem;
      font-weight: 700;
    }
    .logo .accent { color: #f97316; }
    nav a {
      color: #cbd5e1;
      text-decoration: none;
      margin-left: 24px;
      font-size: 0.95rem;
      font-weight: 500;
      transition: color .2s;
    }
    nav a:hover { color: #f97316; }

    /* ── Main Content ── */
    main {
      flex: 1;
      padding: 32px 20px 60px;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 780px;
      margin: 0 auto 20px;
      font-size: 0.95rem;
      font-weight: 500;
      color: #f97316;
      text-decoration: none;
      transition: color .2s;
    }
    .back-link:hover { color: #ea580c; text-decoration: underline; }
    .article-container {
      max-width: 780px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 4px 24px rgba(0,0,0,.04);
      padding: 40px;
    }

    /* ── Article Head ── */
    .article-container h1 {
      font-size: 2.2rem;
      color: #0f172a;
      margin-bottom: 8px;
      line-height: 1.25;
      font-weight: 700;
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
      margin-bottom: 32px;
      font-size: 0.88rem;
      color: #64748b;
    }
    .meta-bar .badge {
      background: #f97316;
      color: #fff;
      padding: 3px 12px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: .3px;
    }
    .meta-bar .sep { color: #cbd5e1; }
    .meta-bar svg {
      width: 15px;
      height: 15px;
      vertical-align: -2px;
      margin-right: 3px;
      fill: none;
      stroke: #94a3b8;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* ── Article Body ── */
    .article-body h2 {
      font-size: 1.6rem;
      margin-top: 2rem;
      margin-bottom: 12px;
      color: #1e293b;
      border-bottom: 2px solid #f97316;
      padding-bottom: 6px;
      font-weight: 700;
    }
    .article-body h3 {
      font-size: 1.3rem;
      color: #334155;
      margin-top: 1.6rem;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .article-body h4 {
      font-size: 1.1rem;
      color: #475569;
      margin-top: 1.4rem;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .article-body p {
      margin-bottom: 16px;
    }
    .article-body a {
      color: #f97316;
      text-decoration: none;
      transition: color .2s;
    }
    .article-body a:hover {
      text-decoration: underline;
      color: #ea580c;
    }
    .article-body img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 16px 0;
    }

    /* Tables */
    .article-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 0.95rem;
    }
    .article-body th {
      background: #f1f5f9;
      font-weight: 600;
      text-align: left;
    }
    .article-body th, .article-body td {
      padding: 12px;
      border: 1px solid #e2e8f0;
    }
    .article-body tr:hover td {
      background: #f8fafc;
    }

    /* Code */
    .article-body pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 20px 0;
      font-size: 0.92rem;
      line-height: 1.6;
    }
    .article-body code {
      font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
      font-size: 0.9em;
    }
    .article-body :not(pre) > code {
      background: #f1f5f9;
      color: #c2410c;
      padding: 2px 6px;
      border-radius: 4px;
    }

    /* Blockquotes */
    .article-body blockquote {
      border-left: 4px solid #f97316;
      padding-left: 16px;
      margin: 20px 0;
      color: #64748b;
      font-style: italic;
    }
    .article-body blockquote p {
      margin-bottom: 8px;
    }

    /* Lists */
    .article-body ul, .article-body ol {
      padding-left: 24px;
      margin-bottom: 16px;
    }
    .article-body li {
      margin-bottom: 8px;
    }

    .article-body hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 32px 0;
    }

    /* ── Tags ── */
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .tags span {
      background: #f1f5f9;
      color: #475569;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 500;
    }

    /* ── Footer ── */
    footer {
      background: #0f172a;
      color: #94a3b8;
      padding: 40px 24px;
      text-align: center;
      font-size: 0.9rem;
      line-height: 1.8;
    }
    footer a {
      color: #f97316;
      text-decoration: none;
    }
    footer a:hover { text-decoration: underline; }
    footer .footer-links {
      margin-bottom: 12px;
    }
    footer .footer-links a {
      margin: 0 12px;
    }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .article-container {
        padding: 20px;
        border-radius: 8px;
      }
      .article-container h1 {
        font-size: 1.6rem;
      }
      .article-body h2 {
        font-size: 1.3rem;
      }
      .article-body h3 {
        font-size: 1.1rem;
      }
      nav a {
        margin-left: 16px;
        font-size: 0.85rem;
      }
      .meta-bar {
        gap: 10px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="logo"><a href="${basePath || '/'}">Stud<span class="accent">plex</span> News</a></div>
      <nav>
        <a href="${basePath || '/'}">Home</a>
        <a href="${basePath || '/'}">Guides</a>
        <a href="${basePath || '/'}">Countries</a>
      </nav>
    </div>
  </header>

  <main>
    <a href="${basePath || '/'}" class="back-link">&larr; Back to all guides</a>
    <article class="article-container">
      <h1>${escapeHtml(article.title)}</h1>
      <div class="meta-bar">
        ${safeCategory ? `<span class="badge">${safeCategory}</span>` : ''}
        <span>
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${displayDate}
        </span>
        ${readTime ? `<span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${readTime} min read</span>` : ''}
        <span>
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${displayViews.toLocaleString()} views
        </span>
        ${showCountryBadge ? `<span><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${safeCountry}</span>` : ''}
      </div>

      <div class="article-body">
        ${contentHtml}
      </div>

      ${tags.length > 0 ? `
      <div class="tags">
        ${tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}
      </div>` : ''}
    </article>
  </main>

  <footer>
    <div class="footer-links">
      <a href="https://studplex.com">Studplex</a>
      <a href="${basePath || '/'}">News</a>
    </div>
    <p>&copy; ${new Date().getFullYear()} <a href="https://studplex.com">Studplex</a>. All rights reserved.</p>
  </footer>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Database error:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send('<h1>Internal Server Error</h1>');
  }
}
