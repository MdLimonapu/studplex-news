export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

  const content = `User-agent: *
Allow: /

Sitemap: https://news.studplex.com/sitemap.xml
`;

  return res.status(200).send(content);
}
