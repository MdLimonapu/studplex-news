export default function handler(req, res) {
  res.status(200).json({
    headers: req.headers,
    url: req.url,
    method: req.method
  });
}
