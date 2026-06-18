import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
// Ensure GEMINI_API_KEY is configured in Vercel environment variables


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
      // Wait 1 second before trying next model
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`All Gemini models failed. Last error: ${lastError.message}`);
}

export default async function handler(req, res) {
  // Simple cron verification check or support GET/POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authorize request to prevent external spam if security key is set
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

  const apiKey = process.env.GEMINI_API_KEY.split(",")[0].trim();

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

    // 1. Fetch existing articles to rotate countries dynamically and avoid duplicate slugs
    const existingArticles = await articlesCol.find({}, { projection: { slug: 1, country: 1 } }).toArray();
    const existingSlugs = existingArticles.map(a => a.slug);

    // Compute counts for the 10 target countries
    const countries = ["Germany", "UK", "USA", "Canada", "Australia", "Netherlands", "Sweden", "France", "Switzerland", "Japan"];
    const countryCounts = {};
    countries.forEach(c => { countryCounts[c] = 0; });
    existingArticles.forEach(a => {
      if (a.country && countries.includes(a.country)) {
        countryCounts[a.country] += 1;
      }
    });

    // Select the country with the lowest count
    let targetCountry = "Germany";
    let minCount = Infinity;
    countries.forEach(c => {
      if (countryCounts[c] < minCount) {
        minCount = countryCounts[c];
        targetCountry = c;
      }
    });

    // 2. Ask Gemini to brainstorm 1 new highly-searched topic for the selected country
    const brainstormPrompt = `You are a master academic editor. Generate a JSON object representing 1 new highly relevant study abroad question or topic for international students planning to go to: ${targetCountry}. Focus on a practical, highly-searched question (e.g. visa slots, blocked accounts, part-time jobs, student housing). Do not duplicate these existing slugs: ${JSON.stringify(existingSlugs.slice(-100))}.
    
    Provide the response as raw JSON matching this structure:
    {
      "id": "slug-name",
      "title": "Compelling Title",
      "prompt": "Description instruction prompt"
    }`;

    let brainstormText = await callGemini(brainstormPrompt, apiKey);
    // Clean any markdown formatting block around json
    brainstormText = brainstormText.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
    
    const topic = JSON.parse(brainstormText);
    if (!topic.id || !topic.title || !topic.prompt) {
      throw new Error("Brainstormed topic is missing required keys.");
    }

    // 3. Ask Gemini to write the high-end, humanlike article focusing specifically on the target country
    const articlePrompt = `You are an experienced study abroad advisor, elite academic copywriter, and SEO expert. Write a comprehensive, high-quality, and deeply informative guide/article on the following topic:
Title: ${topic.title}
Description: ${topic.prompt}
Target Country: ${targetCountry}

You MUST write this article specifically tailored for ${targetCountry}. Do NOT write it as a general/overall guide. All rules, visa specifications, accommodation details, part-time hour limits, tax brackets, and costs must reflect the reality of studying in ${targetCountry}.

Make sure the article has these attributes:
1. Long-form and extremely thorough (at least 1000 words).
2. Humanlike Tone & Empathy: Write in a warm, expert, conversational, and highly natural human voice. Do NOT sound like an AI. Avoid robotic transition phrases or corporate buzzwords (do not use words like "delve", "tapestry", "testament", "moreover", "furthermore", "in conclusion", "it is important to note"). Use varying sentence lengths, personal pronouns, and realistic student-focused scenarios.
3. Well-structured in Markdown using H2 (##) and H3 (###) headers, bullet points, numbered lists, and bold text.
4. Contains a detailed HTML or Markdown table summarizing key steps, costs, or requirements (e.g. document checklists or timelines) for ${targetCountry}.
5. Includes internal linking references back to the main website domain (e.g., 'Use the Studplex Matching Engine to find matching courses' or 'check your detailed eligibility on the Studplex Roadmap page').
6. SEO optimized with natural keyword integration.

You must format your response EXACTLY as text with the following delimiters:

---SLUG---
${topic.id}

---TITLE---
${topic.title}

---META_TITLE---
[Enter the Meta Title here (maximum 60 characters)]

---META_DESCRIPTION---
[Enter the Meta Description here (maximum 160 characters)]

---CATEGORY---
${targetCountry}

---TAGS---
[Comma-separated list of tags, e.g. housing, study abroad, guide]

---READ_TIME---
[Enter estimated reading time in minutes as a number, e.g. 7]

---CONTENT---
[Enter the complete, detailed article body in Markdown format here]`;

    const articleText = await callGemini(articlePrompt, apiKey);

    // 4. Parse delimiters
    function extractBlock(name, textContent) {
      const pattern = new RegExp(`---${name}---\\s*\\n([\\s\\S]*?)(?=\\n---[A-Z_]+---|$)`, 'i');
      const match = textContent.match(pattern);
      return match ? match[1].trim() : "";
    }

    const slug = extractBlock("SLUG", articleText) || topic.id;
    const title = extractBlock("TITLE", articleText) || topic.title;
    const metaTitle = extractBlock("META_TITLE", articleText) || title.substring(0, 60);
    const metaDescription = extractBlock("META_DESCRIPTION", articleText) || "Learn more about studying abroad.";
    const category = extractBlock("CATEGORY", articleText) || "General";
    const tagsStr = extractBlock("TAGS", articleText);
    const readTimeStr = extractBlock("READ_TIME", articleText);
    const content = extractBlock("CONTENT", articleText) || articleText;

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

    const articleObj = {
      slug,
      title,
      meta_title: metaTitle,
      meta_description: metaDescription,
      category,
      country: targetCountry,
      tags,
      read_time: readTime,
      content,
      views,
      date: new Date().toISOString().split('T')[0]
    };

    // 5. Save/Upsert into MongoDB
    await articlesCol.replaceOne({ slug: articleObj.slug }, articleObj, { upsert: true });

    return res.status(200).json({
      success: true,
      message: `Successfully generated and synced article: '${articleObj.title}'`,
      article: {
        slug: articleObj.slug,
        title: articleObj.title,
        category: articleObj.category
      }
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
