import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;

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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`All Gemini models failed. Last error: ${lastError.message}`);
}

function extractBlock(name, textContent) {
  const pattern = new RegExp(`---${name}---\\s*\\n([\\s\\S]*?)(?=\\n---[A-Z_]+---|$)`, 'i');
  const match = textContent.match(pattern);
  return match ? match[1].trim() : "";
}

async function generateArticleForCountry(country, existingSlugs, apiKey) {
  // We ask Gemini to select a topic AND write the article in a single prompt to save API requests and prevent 429 rate limit triggers.
  const articlePrompt = `You are an experienced study abroad advisor, elite academic copywriter, and SEO expert.

First, brainstorm and choose a highly relevant, practical, and highly-searched study abroad topic specifically for international students planning to go to: ${country} (e.g. visa slots, blocked accounts, part-time jobs, student housing, cost of living). Do not duplicate these existing slugs: ${JSON.stringify(existingSlugs.slice(-30))}.

Write a comprehensive, high-quality, and deeply informative guide/article on this chosen topic, specifically tailored for ${country}. All rules, visa specifications, accommodation details, part-time hour limits, tax brackets, and costs must reflect the reality of studying in ${country}.

Make sure the article has these attributes:
1. Long-form and extremely thorough (at least 1000 words).
2. Humanlike Tone & Empathy: Write in a warm, expert, conversational, and highly natural human voice. Do NOT sound like an AI. Avoid robotic transition phrases or corporate buzzwords (do not use words like "delve", "tapestry", "testament", "moreover", "furthermore", "in conclusion", "it is important to note"). Use varying sentence lengths, personal pronouns, and realistic student-focused scenarios.
3. Well-structured in Markdown using H2 (##) and H3 (###) headers, bullet points, numbered lists, and bold text.
4. Contains a detailed HTML or Markdown table summarizing key steps, costs, or requirements (e.g. document checklists or timelines) for ${country}.
5. Includes internal linking references back to the main website domain (e.g., 'Use the Studplex Matching Engine to find matching courses' or 'check your detailed eligibility on the Studplex Roadmap page').
6. SEO optimized with natural keyword integration.

You must format your response EXACTLY as text with the following delimiters:

---SLUG---
[Generate a clean URL slug for the chosen topic, e.g. germany-student-visa-guide]

---TITLE---
[Enter the Compelling Title of the article here]

---META_TITLE---
[Enter the Meta Title here (maximum 60 characters)]

---META_DESCRIPTION---
[Enter the Meta Description here (maximum 160 characters)]

---CATEGORY---
${country}

---TAGS---
[Comma-separated list of tags, e.g. housing, study abroad, guide]

---READ_TIME---
[Enter estimated reading time in minutes as a number, e.g. 7]

---CONTENT---
[Enter the complete, detailed article body in Markdown format here]`;

  const articleText = await callGemini(articlePrompt, apiKey);

  const slug = extractBlock("SLUG", articleText) || `${country.toLowerCase()}-study-guide-${Date.now()}`;
  const title = extractBlock("TITLE", articleText) || `Study Abroad in ${country}`;
  const metaTitle = extractBlock("META_TITLE", articleText) || title.substring(0, 60);
  const metaDescription = extractBlock("META_DESCRIPTION", articleText) || `Learn more about studying abroad in ${country}.`;
  const category = extractBlock("CATEGORY", articleText) || country;
  const tagsStr = extractBlock("TAGS", articleText);
  const readTimeStr = extractBlock("READ_TIME", articleText);
  const content = extractBlock("CONTENT", articleText);

  if (!content) {
    throw new Error(`Failed to parse content from Gemini response for ${country}`);
  }

  const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
  if (tags.length === 0) {
    tags.push(category.toLowerCase());
  }

  let readTime = 7;
  const readTimeMatch = readTimeStr.match(/\d+/);
  if (readTimeMatch) {
    readTime = parseInt(readTimeMatch[0], 10);
  }

  const views = Math.floor(Math.random() * 80) + 20;

  return {
    slug,
    title,
    meta_title: metaTitle,
    meta_description: metaDescription,
    category,
    country: country,
    tags,
    read_time: readTime,
    content,
    views,
    date: new Date().toISOString().split('T')[0]
  };
}

export default async function handler(req, res) {
  const uri = process.env.MONGO_URI;
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!uri) {
    return res.status(500).json({ error: 'MONGO_URI is not configured' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const apiKeys = process.env.GEMINI_API_KEY.split(",").map(k => k.trim()).filter(Boolean);

  let mongoClient;
  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    
    let dbName = 'studyapp';
    try {
      const parsed = new URL(uri);
      if (parsed.pathname && parsed.pathname !== '/') {
        dbName = parsed.pathname.substring(1);
      }
    } catch (e) {}
    
    const db = mongoClient.db(dbName);
    const articlesCol = db.collection('articles');

    const existingArticles = await articlesCol.find({}, { projection: { slug: 1 } }).toArray();
    const existingSlugs = existingArticles.map(a => a.slug);

    const countries = ["Germany", "UK", "USA", "Canada", "Australia", "Netherlands", "Sweden", "France", "Switzerland", "Japan"];

    // Trigger all 10 countries concurrently. Since we consolidated to 1 API call per country,
    // this triggers exactly 10 requests total, remaining comfortably under the 15 RPM free tier limit.
    const results = await Promise.all(
      countries.map(async (country, index) => {
        const apiKey = apiKeys[index % apiKeys.length];
        
        // Stagger calls by 1.5s to prevent concurrent rate limits and API spikes
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, index * 1500));
        }

        try {
          const article = await generateArticleForCountry(country, existingSlugs, apiKey);
          return { country, article, success: true };
        } catch (err) {
          console.error(`Failed to generate article for ${country}:`, err);
          return { country, error: err.message, success: false };
        }
      })
    );

    const successfulArticles = results.filter(r => r.success && r.article).map(r => r.article);
    const failedCountries = results.filter(r => !r.success).map(r => ({ country: r.country, error: r.error }));

    for (const articleObj of successfulArticles) {
      await articlesCol.replaceOne({ slug: articleObj.slug }, articleObj, { upsert: true });
    }

    return res.status(200).json({
      success: true,
      message: `Finished daily cron run. Successfully generated and synced ${successfulArticles.length} articles!`,
      successful: successfulArticles.map(a => ({ country: a.country, slug: a.slug, title: a.title })),
      failedCount: failedCountries.length,
      failed: failedCountries
    });

  } catch (err) {
    console.error("Cron Error:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}
