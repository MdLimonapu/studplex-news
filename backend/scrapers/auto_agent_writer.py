import os
import sys
import json
import time
import datetime
import re
import urllib.parse
from pymongo import MongoClient
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
API_KEY = os.environ.get("GEMINI_API_KEY")
MONGO_URI = os.environ.get("MONGO_URI")

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]

def get_existing_slugs():
    """Fetch existing slugs from MongoDB to avoid duplicates."""
    if not MONGO_URI:
        return []
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
        db_name = "studyapp"
        parsed_uri = urllib.parse.urlparse(MONGO_URI)
        if parsed_uri.path and parsed_uri.path != "/":
            db_name = parsed_uri.path.strip("/")
        db = mongo_client[db_name]
        articles_col = db["articles"]
        return [doc["slug"] for doc in articles_col.find({}, {"slug": 1})]
    except Exception as e:
        print(f"⚠️ Warning: Could not connect to MongoDB to fetch slugs: {e}")
        return []

def brainstorm_topics(client, existing_slugs, count=50):
    """Ask Gemini to generate unique new topics that do not overlap with existing slugs."""
    print(f"🧠 Brainstorming {count} new high-end study abroad topics...")
    
    prompt = f"""You are a master academic editor planning a publication schedule. Generate a JSON list of exactly {count} highly relevant article topics for international students planning to study abroad.
    
    Each topic must contain:
    1. "id": a unique URL-friendly slug (hyphenated, lowercase)
    2. "title": a compelling, SEO-optimized human title
    3. "prompt": a detailed instruction prompt (2-3 sentences) specifying exactly what the article should cover (visa procedures, blocked accounts, SOPs, housing, scholarships, country comparisons, etc.)
    
    Existing articles already cover these slugs, so DO NOT duplicate them:
    {json.dumps(existing_slugs[:150])}
    
    Provide your response as a raw JSON array of objects. Do not include markdown formatting or backticks outside of the raw JSON. Example output:
    [
      {{"id": "germany-student-accommodation-types", "title": "Student Housing in Germany: WG vs. Dormitory", "prompt": "Explain the differences between shared flats (WG), private apartments, and student dormitories in Germany. Include costs, booking timelines, and tips to avoid scams."}}
    ]
    """
    
    for model in MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            data = json.loads(response.text.strip())
            if isinstance(data, list) and len(data) > 0:
                print(f"✓ Brainstormed {len(data)} new topics successfully.")
                return data[:count]
        except Exception as e:
            print(f"⚠️ Brainstorming failed with model {model}: {e}")
    
    # Fallback default topics if brainstorming fails
    print("⚠️ Brainstorming failed completely. Using default fallback topics.")
    return [
        {"id": "studying-in-france-costs", "title": "Cost of Studying in France: Tuition Fees & Living Expenses", "prompt": "Write a guide on tuition fees at public vs private French universities, average monthly student living expenses in Paris and other cities, and national student benefit options like CAF."},
        {"id": "australian-subclass-500-visa", "title": "Step-by-Step Guide to the Australian Subclass 500 Student Visa", "prompt": "Provide a comprehensive walkthrough of the Australian Subclass 500 student visa process, covering Genuine Student (GS) requirements, health insurance (OSHC), financial capacity limits, and processing times."}
    ]

def write_article(client, topic, model_name):
    """Generate the full article content using the humanlike prompt constraints."""
    print(f"✍️ Writing article: '{topic['title']}' using {model_name}...")
    
    prompt = f"""You are an experienced study abroad advisor, elite academic copywriter, and SEO expert. Write a comprehensive, high-quality, and deeply informative guide/article on the following topic:
Title: {topic['title']}
Description: {topic['prompt']}

Make sure the article has these attributes:
1. Long-form and extremely thorough (at least 1000-1500 words).
2. Humanlike Tone & Empathy: Write in a warm, expert, conversational, and highly natural human voice. Do NOT sound like an AI. Avoid robotic transition phrases or corporate buzzwords (do not use words like "delve", "tapestry", "testament", "moreover", "furthermore", "in conclusion", "it is important to note"). Use varying sentence lengths, personal pronouns, and realistic student-focused scenarios.
3. Well-structured in Markdown using H2 (##) and H3 (###) headers, bullet points, numbered lists, and bold text.
4. Contains a detailed HTML or Markdown table summarizing key steps, costs, or requirements (e.g. document checklists or timelines).
5. Includes internal linking references back to the main website domain (e.g., 'Use the Studplex Matching Engine to find matching courses' or 'check your detailed eligibility on the Studplex Roadmap page').
6. SEO optimized with natural keyword integration.

You must format your response EXACTLY as text with the following delimiters:

---SLUG---
{topic['id']}

---TITLE---
{topic['title']}

---META_TITLE---
[Enter the Meta Title here (maximum 60 characters)]

---META_DESCRIPTION---
[Enter the Meta Description here (maximum 160 characters)]

---CATEGORY---
[Enter main category name, e.g. Visa, Germany, Blocked Account, SOP, Scholarships, Canada, Australia]

---TAGS---
[Comma-separated list of tags, e.g. housing, study abroad, guide]

---READ_TIME---
[Enter estimated reading time in minutes as a number, e.g. 7]

---CONTENT---
[Enter the complete, detailed article body in Markdown format here]
"""
    
    response = client.models.generate_content(
        model=model_name,
        contents=prompt
    )
    text = response.text.strip()
    
    # Parse delimited text
    def extract_block(name, text_content):
        pattern = r'---' + name + r'---\s*\n(.*?)(?=\n---[A-Z_]+---| \Z)'
        match = re.search(pattern, text_content, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return ""

    slug = extract_block("SLUG", text) or topic['id']
    title = extract_block("TITLE", text) or topic['title']
    meta_title = extract_block("META_TITLE", text) or title[:60]
    meta_description = extract_block("META_DESCRIPTION", text) or "Learn more about studying abroad."
    category = extract_block("CATEGORY", text) or "General"
    tags_str = extract_block("TAGS", text)
    read_time_str = extract_block("READ_TIME", text)
    content = extract_block("CONTENT", text) or text
    
    tags = [t.strip() for t in tags_str.split(",") if t.strip()]
    if not tags:
        tags = [category.lower()]
        
    try:
        read_time = int(re.search(r'\d+', read_time_str).group())
    except Exception:
        read_time = 7
        
    # Generate an organic-looking initial view count
    # Tiers: standard guides start with a realistic organic count
    views = datetime.datetime.now().microsecond % 80 + 20 # 20 - 99 views
        
    return {
        "slug": slug,
        "title": title,
        "meta_title": meta_title,
        "meta_description": meta_description,
        "category": category,
        "tags": tags,
        "read_time": read_time,
        "content": content,
        "views": views,
        "date": datetime.datetime.now().strftime("%Y-%m-%d")
    }

def main():
    if not API_KEY:
        print("❌ Error: GEMINI_API_KEY is not set.")
        return
    if not MONGO_URI:
        print("❌ Error: MONGO_URI is not set. Cannot run scheduler without database access.")
        return

    # Use first valid API key
    api_key = API_KEY.split(",")[0].strip()
    client = genai.Client(api_key=api_key)
    
    # 1. Fetch existing slugs
    existing_slugs = get_existing_slugs()
    
    # Parse custom article count from command line arguments
    count = 50
    if len(sys.argv) > 1:
        try:
            count = int(sys.argv[1])
        except ValueError:
            pass

    # 2. Brainstorm new topics
    topics = brainstorm_topics(client, existing_slugs, count=count)
    
    # 3. Connect to database
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
        db_name = "studyapp"
        parsed_uri = urllib.parse.urlparse(MONGO_URI)
        if parsed_uri.path and parsed_uri.path != "/":
            db_name = parsed_uri.path.strip("/")
        db = mongo_client[db_name]
        articles_col = db["articles"]
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        return

    # 4. Generate articles & upload to MongoDB
    success_count = 0
    for idx, topic in enumerate(topics):
        print(f"[{idx + 1}/{count}] Processing topic...")
        
        # Try different models in case of transient issues
        article = None
        for model in MODELS:
            try:
                article = write_article(client, topic, model)
                if article and len(article.get("content", "")) > 100:
                    break
            except Exception as e:
                print(f"   ⚠️ Model {model} failed: {e}")
                time.sleep(2)
        
        if article:
            try:
                # Upsert into MongoDB Atlas
                articles_col.replace_one({"slug": article["slug"]}, article, upsert=True)
                print(f"   ✅ Saved & Synced: '{article['title']}' to database.")
                success_count += 1
            except Exception as e:
                print(f"   ❌ Failed to save to database: {e}")
        else:
            print(f"   ❌ Failed to write article for topic: '{topic['title']}'")
            
        # Avoid API rate limits (15 RPM -> 4s sleep is safe)
        time.sleep(5)

    print(f"🎉 Auto-Agent run finished. Successfully wrote and published {success_count}/{count} articles.")

if __name__ == "__main__":
    main()
