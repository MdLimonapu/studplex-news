import os
import json
import time
import sys
import datetime
import re
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
API_KEY = os.environ.get("GEMINI_API_KEY")
MONGO_URI = os.environ.get("MONGO_URI")

# The 5 core SEO-rich topics for Studplex guides
TOPICS = [
    {
        "id": "expatrio-blocked-account-guide",
        "title": "Complete Guide to Securing an Expatrio Blocked Account in Germany",
        "prompt": "Write a complete, highly detailed guide about how international students can secure and set up an Expatrio Blocked Account for their German student visa. Explain what a blocked account is, step-by-step application on Expatrio, transferring the €11,904, receiving the blocking confirmation, and how to activate it once they arrive in Germany. Include comparison with Fintiba/Coracle."
    },
    {
        "id": "vfs-visa-interview-tips",
        "title": "VFS Visa Slot Booking Tips for International Student Visa Interviews",
        "prompt": "Write a highly practical guide explaining VFS Global visa slot booking strategies and student visa interview preparation. Discuss slot opening patterns, setting up booking alerts, common documents needed for student visa (focusing on Germany, USA, UK, Canada), and typical interview questions with sample good answers."
    },
    {
        "id": "statement-of-purpose-us-guide",
        "title": "How to Write a Perfect Statement of Purpose (SOP) for US Universities",
        "prompt": "Write a masterclass guide on writing a winning Statement of Purpose (SOP) for undergraduate and postgraduate admission at US universities. Outline the perfect structure (Introduction, Academic Background, Professional Experience, Why this Course/University, Future Career Goals), what admissions committees look for, common mistakes to avoid, and sample opening hooks."
    },
    {
        "id": "aps-certificate-germany-process",
        "title": "Everything You Need to Know About the APS Certificate Process for Germany",
        "prompt": "Write a detailed guide explaining the Academic Evaluation Center (APS) certificate process for Germany, specifically for students from India, China, and Vietnam. Explain why it is mandatory, step-by-step portal registration, how to courier documents, verification of transcripts and school records, average processing times, and how it is submitted with Uni-Assist applications."
    },
    {
        "id": "scholarship-search-uk-canada",
        "title": "Scholarship Search & Funding Strategies for Studying in the UK & Canada",
        "prompt": "Write a comprehensive guide on finding and winning scholarships for international students applying to the UK and Canada. Cover major government awards (Chevening, Commonwealth, Vanier, Banting), university-specific merit awards, application timelines, how to write a compelling scholarship essay, and alternative funding sources."
    }
]

MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"]

def generate_article_with_retry(client, topic, model_name):
    print(f"✍️ Generating article: '{topic['title']}' using model '{model_name}'...", flush=True)
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
[Enter the SEO Title here]

---META_TITLE---
[Enter the Meta Title here (maximum 60 characters)]

---META_DESCRIPTION---
[Enter the Meta Description here (maximum 160 characters)]

---CATEGORY---
[Enter main category name, e.g. Germany, Visa, SOP, Scholarships]

---TAGS---
[Comma-separated list of tags, e.g. blocked account, germany, visa]

---READ_TIME---
[Enter estimated reading time in minutes as a number, e.g. 6]

---CONTENT---
[Enter the complete, detailed article body in Markdown format here]
"""
    
    backoff = 5
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            text = response.text.strip()
            
            # Parse delimited text
            def extract_block(name, text_content):
                pattern = r'---' + name + r'---\s*\n(.*?)(?=\n---[A-Z_]+---|\Z)'
                match = re.search(pattern, text_content, re.DOTALL | re.IGNORECASE)
                if match:
                    return match.group(1).strip()
                
                # Fallback split
                parts = text_content.split(f"---{name}---")
                if len(parts) > 1:
                    subpart = parts[1].strip()
                    subparts = re.split(r'---[A-Z_]+---', subpart)
                    return subparts[0].strip()
                return ""

            slug = extract_block("SLUG", text)
            title = extract_block("TITLE", text)
            meta_title = extract_block("META_TITLE", text)
            meta_description = extract_block("META_DESCRIPTION", text)
            category = extract_block("CATEGORY", text)
            tags_str = extract_block("TAGS", text)
            read_time_str = extract_block("READ_TIME", text)
            content = extract_block("CONTENT", text)
            
            if not slug:
                slug = topic['id']
            if not title:
                title = topic['title']
            if not content:
                content = text
                
            tags = [t.strip() for t in tags_str.split(",") if t.strip()]
            if not tags:
                tags = [category.lower()] if category else []
                
            try:
                read_time = int(re.search(r'\d+', read_time_str).group())
            except Exception:
                read_time = 6
                
            return {
                "slug": slug,
                "title": title,
                "meta_title": meta_title or title[:60],
                "meta_description": meta_description or "Learn more about studying abroad.",
                "category": category or "General",
                "tags": tags,
                "read_time": read_time,
                "content": content,
                "views": 0,
                "date": datetime.datetime.now().strftime("%Y-%m-%d")
            }
        except Exception as e:
            err_str = str(e).lower()
            is_transient = "503" in err_str or "demand" in err_str or "429" in err_str or "quota" in err_str or "limit" in err_str or "exhausted" in err_str
            if is_transient and attempt < max_retries - 1:
                print(f"    ⚠️ Transient error calling Gemini ({e}). Sleeping for {backoff}s before retry...", flush=True)
                time.sleep(backoff)
                backoff *= 2
            else:
                raise e

def main():
    if not API_KEY:
        print("❌ GEMINI_API_KEY env variable not set.")
        sys.exit(1)
        
    api_keys = [k.strip() for k in API_KEY.split(",") if k.strip()]
    if not api_keys:
        print("❌ No valid GEMINI_API_KEY found.")
        sys.exit(1)
        
    articles = []
    
    for topic in TOPICS:
        art = None
        # Try combination of keys and models
        for key in api_keys:
            client = genai.Client(api_key=key)
            for model in MODELS:
                try:
                    art = generate_article_with_retry(client, topic, model)
                    if art and art.get("content") and len(art.get("content")) > 100:
                        break
                except Exception as e:
                    print(f"⚠️ Error using key {key[:10]}... with model {model}: {e}", flush=True)
            if art:
                break
                
        if art:
            articles.append(art)
            print(f"    ✓ Successfully generated article: '{art['title']}' (Slug: {art['slug']})", flush=True)
        else:
            print(f"❌ Failed to generate article '{topic['title']}' after trying all keys/models.", flush=True)
            
        time.sleep(3) # Prevent rate limits
        
    if not articles:
        print("❌ No articles generated.")
        return

    # 1. Save locally as backup cache
    local_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "articles_backup.json"
    )
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "w") as f:
        json.dump(articles, f, indent=2, ensure_ascii=False)
    print(f"💾 Saved {len(articles)} articles locally to {local_path}")

    # 2. Write/Upsert to Cloud MongoDB Atlas if available
    if MONGO_URI:
        try:
            from pymongo import MongoClient
            import urllib.parse
            
            mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
            db_name = "studyapp"
            parsed_uri = urllib.parse.urlparse(MONGO_URI)
            if parsed_uri.path and parsed_uri.path != "/":
                db_name = parsed_uri.path.strip("/")
                
            db = mongo_client[db_name]
            articles_col = db["articles"]
            articles_col.create_index("slug", unique=True)
            
            inserted_count = 0
            for art in articles:
                articles_col.replace_one({"slug": art["slug"]}, art, upsert=True)
                inserted_count += 1
                
            print(f"✅ Successfully loaded/synced {inserted_count} articles to Cloud MongoDB Atlas.")
        except Exception as e:
            print(f"⚠️ Could not write to MongoDB Atlas: {e}. Local cache backup is ready.")

if __name__ == "__main__":
    main()
