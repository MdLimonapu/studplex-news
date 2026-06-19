import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const COUNTRIES = ["Germany", "UK", "USA", "Canada", "Australia", "Netherlands", "Sweden", "France", "Switzerland", "Japan"];

async function callGemini(prompt, apiKey) {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastError;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error with ${model}: ${res.status} - ${errText}`);
      }
      
      const data = await res.json();
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0]) {
        throw new Error(`Invalid response structure from Gemini API with ${model}`);
      }
      return data.candidates[0].content.parts[0].text.trim();
    } catch (err) {
      console.warn(`⚠️ Gemini model ${model} failed, trying next:`, err.message);
      lastError = err;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  throw new Error(`All Gemini models failed. Last error: ${lastError.message}`);
}

// Helper to parse XML item tags using Regex to avoid external libraries
function parseRssXml(xmlText, country) {
  const items = [];
  const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];
  
  for (const itemXml of itemMatches.slice(0, 10)) {
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    
    if (titleMatch && linkMatch) {
      const title = titleMatch[1].trim();
      const link = linkMatch[1].trim();
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";
      
      const cleanTitle = title.includes(" - ") 
        ? title.substring(0, title.lastIndexOf(" - ")).trim() 
        : title;

      items.append = items.push({
        raw_title: title,
        clean_title: cleanTitle.toLowerCase(),
        link: link,
        pub_date: pubDate,
        search_country: country
      });
    }
  }
  return items;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Optional Authentication check if CRON_SECRET is set
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!uri || !GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Environment variables not configured' });
  }

  const apiKey = GEMINI_API_KEY.split(",")[0].trim();
  let mongoClient;

  try {
    const rawNewsCandidates = [];
    const seenLinks = new Set();
    const seenTitles = new Set();

    // Fetch RSS feeds in parallel for all countries
    const feedPromises = COUNTRIES.map(async (country) => {
      const url = `https://news.google.com/rss/search?q=student+visa+study+abroad+${country}+when:7d&hl=en-US&gl=US&ceid=US:en`;
      try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) return [];
        const xmlText = await response.text();
        return parseRssXml(xmlText, country);
      } catch (err) {
        console.error(`Failed to fetch RSS for ${country}:`, err);
        return [];
      }
    });

    const countryResults = await Promise.all(feedPromises);
    
    // Pick up to 2 unique articles per country
    for (let i = 0; i < COUNTRIES.length; i++) {
      const country = COUNTRIES[i];
      const candidates = countryResults[i];
      let selectedForCountry = 0;
      
      for (const item of candidates) {
        if (!seenLinks.has(item.link) && !seenTitles.has(item.clean_title)) {
          rawNewsCandidates.push(item);
          seenLinks.add(item.link);
          seenTitles.add(item.clean_title);
          selectedForCountry++;
          if (selectedForCountry >= 2) break;
        }
      }
    }

    if (rawNewsCandidates.length === 0) {
      return res.status(200).json({ success: false, message: "No news candidates found from RSS feeds." });
    }

    // Call Gemini to summarize the items
    const prompt = `
You are a study abroad counselor. Analyze and summarize the following list of study visa and study abroad news articles from a Google News RSS feed.
You must process and include all the articles provided to ensure complete country coverage.

For each article, generate a summary and output a clean JSON list matching this structure:
{
  "news": [
    {
      "title": "Clear, punchy counselor headline (UNDER 7 WORDS MAX)",
      "source": "Website name (e.g. Times Higher Education, PIE News)",
      "date": "Exact Month Day, Year (e.g., May 27, 2026)",
      "summary": "Extremely short summary (UNDER 12 WORDS MAX, exactly ONE short sentence)",
      "country": "The primary country concerned. MUST be exactly one of these: Germany, UK, USA, Canada, Australia, Netherlands, Sweden, France, Switzerland, Japan, or Global",
      "link": "The article URL"
    }
  ]
}

Raw Articles to Process:
${JSON.stringify(rawNewsCandidates, null, 2)}

Return ONLY valid JSON. Do not include markdown code block formatting (such as \`\`\`json) in your final output.
`;

    let summaryText = await callGemini(prompt, apiKey);
    summaryText = summaryText.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
    
    const parsed = JSON.parse(summaryText);
    const processedNews = parsed.news || [];

    const allowedCountries = ["Germany", "UK", "USA", "Canada", "Australia", "Netherlands", "Sweden", "France", "Switzerland", "Japan", "Global"];
    processedNews.forEach(item => {
      if (item.country) {
        const norm = item.country.trim().toLowerCase();
        if (norm === "united states" || norm === "us") {
          item.country = "USA";
        } else if (norm === "united kingdom" || norm === "uk") {
          item.country = "UK";
        } else {
          // Find case-sensitive match
          const match = allowedCountries.find(c => c.toLowerCase() === norm);
          item.country = match ? match : "Global";
        }
      } else {
        item.country = "Global";
      }
    });

    if (processedNews.length > 0) {
      // Connect to MongoDB and save
      mongoClient = new MongoClient(uri);
      await mongoClient.connect();
      
      let dbName = 'studyapp';
      try {
        const parsedUrl = new URL(uri);
        if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
          dbName = parsedUrl.pathname.substring(1);
        }
      } catch (e) {}

      const db = mongoClient.db(dbName);
      const newsCol = db.collection('news');
      
      await newsCol.updateOne(
        { key: "latest_news" },
        { 
          $set: { 
            items: processedNews, 
            updated_at: new Date() 
          } 
        },
        { upsert: true }
      );
      
      return res.status(200).json({ 
        success: true, 
        message: `Successfully updated news cache with ${processedNews.length} articles!`,
        newsCount: processedNews.length 
      });
    }

    return res.status(500).json({ error: "Failed to summarize news items." });

  } catch (error) {
    console.error("News fetch API error:", error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}
