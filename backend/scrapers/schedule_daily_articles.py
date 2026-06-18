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

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
API_KEY = os.environ.get("GEMINI_API_KEY")
MONGO_URI = os.environ.get("MONGO_URI")

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
COUNTRIES = ["Germany", "UK", "USA", "Canada", "Australia", "Netherlands", "Sweden", "France", "Switzerland", "Japan"]

def get_existing_slugs(articles_col):
    """Fetch existing slugs to prevent duplicates."""
    try:
        return [doc["slug"] for doc in articles_col.find({}, {"slug": 1})]
    except Exception as e:
        print(f"⚠️ Warning: Could not fetch existing slugs: {e}")
        return []

def brainstorm_topics_for_country(client, country, existing_slugs, count=2):
    """Brainstorm high-volume, highly-searched student questions for a specific country."""
    print(f"🧠 Brainstorming {count} most-searched questions for {country}...")
    
    prompt = f"""You are a master academic editor. Generate a JSON list of exactly {count} highly relevant study abroad questions/topics that international students frequently search Google for regarding: {country}.
    Focus on practical topics like: visa appointment hacks, blocked accounts, part-time jobs, health insurance, SOPs, accommodation scams, or cost-saving tricks.
    
    Each topic must contain:
    1. "id": a unique URL-friendly slug (hyphenated, lowercase, e.g. "germany-student-visa-appointment-tips")
    2. "title": a compelling, click-worthy, SEO-optimized title (e.g. "How to Book Germany Student Visa Appointments Faster")
    3. "prompt": a detailed instruction prompt (2-3 sentences) specifying exactly what the article should cover.
    
    Do NOT duplicate these existing slugs:
    {json.dumps(existing_slugs[-150:])}
    
    Provide your response as a raw JSON array of objects. Do not include markdown formatting or backticks outside of the raw JSON. Example structure:
    [
      {{"id": "slug-name", "title": "Compelling Title", "prompt": "Instructions for writing this guide."}}
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
                print(f"   ✓ Brainstormed topics for {country} successfully.")
                return data[:count]
        except Exception as e:
            print(f"   ⚠️ Brainstorming failed for {country} with model {model}: {e}")
            time.sleep(2)
            
    # Fallback default topics for country
    print(f"   ⚠️ Brainstorming failed completely for {country}. Using fallback.")
    return [
        {
            "id": f"{country.lower()}-student-accommodation-survival-guide",
            "title": f"Student Housing in {country}: Finding Accommodation and Avoiding Scams",
            "prompt": f"Detail how to find budget student housing in {country}, average rental costs, and specific safety checklists to avoid scams on local rental sites."
        },
        {
            "id": f"{country.lower()}-part-time-job-rules",
            "title": f"Part-Time Work Rules for International Students in {country}",
            "prompt": f"Explain legal working hour limits, minimum wage, tax classes/implications, and popular high-paying part-time sectors for students in {country}."
        }
    ]

def write_article(client, topic, country, model_name, publish_date=None):
    """Write a highly professional, humanlike guide with backlinks to studplex.com."""
    print(f"✍️ Writing article for {country}: '{topic['title']}' using {model_name}...")
    
    prompt = f"""You are an experienced study abroad advisor, elite academic copywriter, and SEO expert. Write a comprehensive, high-quality, and deeply informative guide/article on the following topic:
Title: {topic['title']}
Description: {topic['prompt']}
Destination Country: {country}

Make sure the article has these attributes:
1. Long-form and extremely thorough (at least 1000-1200 words).
2. Humanlike Tone & Empathy: Write in a warm, expert, conversational, and highly natural human voice. Do NOT sound like an AI. Avoid robotic transition phrases or corporate buzzwords (do not use words like "delve", "tapestry", "testament", "moreover", "furthermore", "in conclusion", "it is important to note"). Use varying sentence lengths, personal pronouns, and realistic student-focused scenarios.
3. Well-structured in Markdown using H2 (##) and H3 (###) headers, bullet points, numbered lists, and bold text.
4. Contains a detailed HTML or Markdown table summarizing key steps, costs, or requirements (e.g. document checklists or timelines).
5. MANDATORY Backlink: You must naturally include an anchor text link back to the main website domain (e.g., '[Studplex matching engine](https://studplex.com)' or '[Studplex search tools](https://studplex.com)' or check eligibility on the '[Studplex Roadmap](https://studplex.com)').
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
[Enter main category, e.g. Visa, Blocked Account, SOP, Accommodation, Scholarships, Jobs]

---TAGS---
[Comma-separated list of tags, e.g. jobs, student life, guide]

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
    
    def extract_block(name, text_content):
        pattern = r'---' + name + r'---\s*\n(.*?)(?=\n---[A-Z_]+---|\Z)'
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
        
    views = datetime.datetime.now().microsecond % 80 + 20
    
    if not publish_date:
        publish_date = datetime.datetime.now().strftime("%Y-%m-%d")
        
    return {
        "slug": slug,
        "title": title,
        "meta_title": meta_title,
        "meta_description": meta_description,
        "category": category,
        "country": country,
        "tags": tags,
        "read_time": read_time,
        "content": content,
        "views": views,
        "date": publish_date
    }

def main():
    if not API_KEY:
        print("❌ Error: GEMINI_API_KEY is not set.")
        return
    if not MONGO_URI:
        print("❌ Error: MONGO_URI is not set.")
        return

    api_key = API_KEY.split(",")[0].strip()
    client = genai.Client(api_key=api_key)
    
    # Connect to MongoDB
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

    # Fetch existing slugs
    existing_slugs = get_existing_slugs(articles_col)
    
    all_generated_articles = []
    
    # Process 2 articles for each of the 10 countries
    for country in COUNTRIES:
        print(f"\n🌍 === Starting country: {country} ===")
        
        # Stagger starting from the latest date in MongoDB for this country
        start_date = datetime.date.today()
        try:
            latest_article = articles_col.find_one(
                {"country": country},
                sort=[("date", -1)]
            )
            if latest_article and "date" in latest_article:
                latest_date_str = latest_article["date"]
                latest_date = datetime.datetime.strptime(latest_date_str, "%Y-%m-%d").date()
                if latest_date >= start_date:
                    start_date = latest_date + datetime.timedelta(days=1)
        except Exception as e:
            print(f"⚠️ Error fetching latest article date for {country}: {e}")

        topics = brainstorm_topics_for_country(client, country, existing_slugs, count=2)
        
        for idx, topic in enumerate(topics):
            scheduled_date = start_date + datetime.timedelta(days=idx)
            scheduled_date_str = scheduled_date.strftime("%Y-%m-%d")
            print(f"📅 Scheduling article '{topic['title']}' for {scheduled_date_str}")
            
            article = None
            # Try different models in case of limits/errors
            for model in MODELS:
                try:
                    article = write_article(client, topic, country, model, publish_date=scheduled_date_str)
                    if article and len(article.get("content", "")) > 100:
                        break
                except Exception as e:
                    print(f"   ⚠️ Model {model} failed: {e}")
                    time.sleep(2)
            
            if article:
                try:
                    articles_col.replace_one({"slug": article["slug"]}, article, upsert=True)
                    print(f"   ✅ Saved: '{article['title']}' to database.")
                    all_generated_articles.append(article)
                    existing_slugs.append(article["slug"])
                except Exception as e:
                    print(f"   ❌ Failed to save to database: {e}")
            else:
                print(f"   ❌ Failed to write article for: '{topic['title']}'")
                
            # Sleep to avoid hitting rate limits
            time.sleep(5)

    # If any articles were successfully written, update the fallback JSON cache locally
    if all_generated_articles:
        backup_path = "/Users/mdlimonapu/studyapp/news-frontend/backend/data/articles_backup.json"
        if os.path.exists(backup_path):
            try:
                with open(backup_path, "r") as f:
                    local_articles = json.load(f)
                
                for article in all_generated_articles:
                    # Strip mongo metadata if any, though it's dict
                    exists = False
                    for i, art in enumerate(local_articles):
                        if art["slug"] == article["slug"]:
                            local_articles[i] = article
                            exists = True
                            break
                    if not exists:
                        local_articles.append(article)
                        
                with open(backup_path, "w") as f:
                    json.dump(local_articles, f, indent=2, ensure_ascii=False)
                print(f"\n🎉 Successfully updated fallback JSON file at {backup_path}")
            except Exception as e:
                print(f"⚠️ Failed to update fallback JSON file: {e}")

    print(f"\n🎉 Daily Article Generator successfully completed! Wrote {len(all_generated_articles)} articles.")

if __name__ == "__main__":
    main()
