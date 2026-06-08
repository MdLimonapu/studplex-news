import os
import json
import xml.etree.ElementTree as ET
import urllib.request
import ssl
import datetime
from email.utils import parsedate_to_datetime
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Bypass SSL verify for macOS urllib environments
ssl._create_default_https_context = ssl._create_unverified_context

# Load env from parent directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
raw_keys = os.environ.get("GEMINI_API_KEY", "")
API_KEYS = [k.strip() for k in raw_keys.split(",") if k.strip()]

COUNTRIES = ["Germany", "UK", "USA", "Canada", "Australia", "Netherlands", "Sweden", "France", "Switzerland", "Japan"]

def is_within_days(pub_date_str, days):
    try:
        dt = parsedate_to_datetime(pub_date_str)
        now = datetime.datetime.now(datetime.timezone.utc)
        return (now - dt).days <= days
    except Exception:
        return True

def parse_and_format_date(pub_date_str):
    try:
        dt = parsedate_to_datetime(pub_date_str)
        return dt.strftime("%b %d, %Y")
    except Exception:
        return "Today"

from concurrent.futures import ThreadPoolExecutor, as_completed

def fetch_country_rss(country):
    urls = [
        f"https://news.google.com/rss/search?q=student+visa+study+abroad+{country}+when:7d&hl=en-US&gl=US&ceid=US:en",
        f"https://news.google.com/rss/search?q=student+visa+study+abroad+{country}&hl=en-US&gl=US&ceid=US:en"
    ]
    
    candidates = []
    for url in urls:
        try:
            print(f"Fetching RSS feed for {country}: {url}", flush=True)
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                xml_data = response.read()
            
            root = ET.fromstring(xml_data)
            for item in root.findall('.//item')[:10]:  # Inspect top 10 candidates
                title = item.find('title').text if item.find('title') is not None else ""
                link = item.find('link').text if item.find('link') is not None else ""
                pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ""
                
                clean_title = title.rsplit(" - ", 1)[0].strip().lower() if " - " in title else title.strip().lower()
                candidates.append({
                    "raw_title": title,
                    "link": link,
                    "pub_date": pub_date,
                    "search_country": country,
                    "clean_title": clean_title
                })
            if candidates:
                break
        except Exception as e:
            print(f"Error fetching RSS for {country} from {url}: {e}", flush=True)
    return country, candidates

def fetch_rss_news():
    all_items = []
    seen_links = set()
    seen_titles = set()
    
    country_candidates = {}
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(fetch_country_rss, country): country for country in COUNTRIES}
        for future in as_completed(futures):
            country, candidates = future.result()
            country_candidates[country] = candidates
            
    for country in COUNTRIES:
        candidates = country_candidates.get(country, [])
        
        # Filter candidates by age. Try strictly last 2 days first.
        country_selected = []
        for c in candidates:
            if is_within_days(c["pub_date"], 2):
                if c["link"] not in seen_links and c["clean_title"] not in seen_titles:
                    country_selected.append(c)
                    seen_links.add(c["link"])
                    seen_titles.add(c["clean_title"])
                if len(country_selected) >= 2:
                    break
                    
        # If we got less than 2 articles from the last 2 days, relax filter to last 7 days
        if len(country_selected) < 2:
            for c in candidates:
                if c not in country_selected and is_within_days(c["pub_date"], 7):
                    if c["link"] not in seen_links and c["clean_title"] not in seen_titles:
                        country_selected.append(c)
                        seen_links.add(c["link"])
                        seen_titles.add(c["clean_title"])
                    if len(country_selected) >= 2:
                        break
                        
        # If still less than 2, take whatever unique ones we have left
        if len(country_selected) < 2:
            for c in candidates:
                if c not in country_selected:
                    if c["link"] not in seen_links and c["clean_title"] not in seen_titles:
                        country_selected.append(c)
                        seen_links.add(c["link"])
                        seen_titles.add(c["clean_title"])
                    if len(country_selected) >= 2:
                        break
                        
        print(f"Successfully selected {len(country_selected)} unique articles for {country}.", flush=True)
        all_items.extend(country_selected)
        
    print(f"Total unique articles selected across all countries: {len(all_items)}", flush=True)
    return all_items


def summarize_with_gemini(raw_news):
    if not API_KEYS:
        print("❌ No GEMINI_API_KEY found in environment.", flush=True)
        return []
    
    if not raw_news:
        print("No raw news items to process.", flush=True)
        return []
        
    # Models to try in order of priority and availability
    models_to_try = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
    
    prompt = f"""
You are a study abroad counselor. Analyze and summarize the following list of study visa and study abroad news articles from a Google News RSS feed.
You must process and include all the articles provided to ensure complete country coverage.

For each article, generate a summary and output a clean JSON list matching this structure:
{{
  "news": [
    {{
      "title": "Clear, punchy counselor headline (UNDER 7 WORDS MAX)",
      "source": "Website name (e.g. Times Higher Education, PIE News)",
      "date": "Exact Month Day, Year (e.g., May 27, 2026)",
      "summary": "Extremely short summary (UNDER 12 WORDS MAX, exactly ONE short sentence)",
      "country": "The primary country concerned (e.g., Germany, UK, Canada, USA, France, etc.)",
      "link": "The article URL"
    }}
  ]
}}

Raw Articles to Process (each article has an associated search_country. Ensure you set "country" to that search_country):
{json.dumps(raw_news, indent=2)}

Return ONLY valid JSON. Do not include markdown code block formatting (such as ```json) in your final output.
"""

    for api_key in API_KEYS:
        for model in models_to_try:
            try:
                print(f"Processing news items with Gemini (Model: {model}, Key: {api_key[:10]}...)", flush=True)
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2
                    )
                )
                
                # Clean response if LLM wrapped it in markdown code block
                text = response.text.strip()
                if text.startswith("```"):
                    lines = text.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines[-1].startswith("```"):
                        lines = lines[:-1]
                    text = "\n".join(lines).strip()
                    
                data = json.loads(text)
                return data.get("news", [])
            except Exception as e:
                print(f"Error calling Gemini with key {api_key[:10]}... and model {model}: {e}", flush=True)
                
    print("❌ All API keys and models exhausted.", flush=True)
    return []

def extract_country_from_title(title):
    import re
    title_lower = title.lower()
    if any(k in title_lower for k in ["germany", "german", "daad"]):
        return "Germany"
    if any(k in title_lower for k in ["uk", "united kingdom", "british", "london", "oxford", "cambridge"]):
        return "UK"
    if re.search(r'\b(us|usa|united states|america|american|harvard|yale|mit)\b', title_lower):
        return "USA"
    if any(k in title_lower for k in ["canada", "canadian", "toronto", "vancouver", "mcgill"]):
        return "Canada"
    if any(k in title_lower for k in ["australia", "australian", "sydney", "melbourne"]):
        return "Australia"
    if any(k in title_lower for k in ["netherlands", "dutch", "holland", "amsterdam"]):
        return "Netherlands"
    if any(k in title_lower for k in ["sweden", "swedish", "stockholm"]):
        return "Sweden"
    if any(k in title_lower for k in ["france", "french", "paris"]):
        return "France"
    if any(k in title_lower for k in ["switzerland", "swiss", "zurich"]):
        return "Switzerland"
    if any(k in title_lower for k in ["japan", "japanese", "tokyo"]):
        return "Japan"
    if any(k in title_lower for k in ["europe", "european", "eu"]):
        return "Europe"
    return "Global"

def get_fallback_summary(raw_title, country):
    title = raw_title
    if " - " in title:
        title = title.rsplit(" - ", 1)[0]
    title = title.strip().rstrip(". ")
    if not title:
        return f"Latest student visa updates for {country}."
    summary = title[0].upper() + title[1:]
    if not summary.endswith("."):
        summary += "."
    return summary

def clean_fallback_title(title):
    if ":" in title:
        parts = title.split(":", 1)
        if len(parts[0]) > 12:
            title = parts[0]
    if len(title) > 60:  # Even shorter fallback titles (under 60 chars)
        title = title[:60].rsplit(" ", 1)[0] + "..."
    return title.strip()

def fallback_process(raw_news):
    news = []
    for item in raw_news:
        title = item["raw_title"]
        source = "Google News"
        if " - " in title:
            parts = title.rsplit(" - ", 1)
            title = parts[0]
            source = parts[1]
            
        title = clean_fallback_title(title)
        
        country = item.get("search_country")
        if not country or country == "Global":
            country = extract_country_from_title(title)
        if not country:
            country = "Global"
            
        summary = get_fallback_summary(item["raw_title"], country)
        formatted_date = parse_and_format_date(item["pub_date"])
            
        news.append({
            "title": title,
            "source": source,
            "date": formatted_date,
            "summary": summary,
            "country": country,
            "link": item["link"]
        })
    return news

def main():
    raw_news = fetch_rss_news()
    if not raw_news:
        print("No news fetched. Exiting.", flush=True)
        return
        
    processed_news = []
    if API_KEYS:
        processed_news = summarize_with_gemini(raw_news)
        
    if not processed_news:
        print("⚠️ Gemini processing was skipped, failed, or hit rate limits. Falling back to direct RSS parsing...", flush=True)
        processed_news = fallback_process(raw_news)
        
    if not processed_news:
        print("No news items processed. Exiting.", flush=True)
        return
        
    # Write to data directory
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    os.makedirs(data_dir, exist_ok=True)
    
    cache_path = os.path.join(data_dir, "news_cache.json")
    with open(cache_path, "w") as f:
        json.dump(processed_news, f, indent=2)
        
    print(f"Successfully updated local news cache! Saved {len(processed_news)} items to {cache_path}", flush=True)

    # Write to MongoDB Atlas as a fallback/persistent storage
    mongo_uri = os.environ.get("MONGO_URI")
    if mongo_uri:
        try:
            m_client = MongoClient(
                mongo_uri, 
                serverSelectionTimeoutMS=5000,
                tlsAllowInvalidCertificates=True
            )
            db_name = "studplex"
            parsed_uri = urllib.parse.urlparse(mongo_uri)
            if parsed_uri.path and parsed_uri.path != "/":
                db_name = parsed_uri.path.strip("/")
            m_db = m_client[db_name]
            
            news_col = m_db["news"]
            news_col.update_one(
                {"key": "latest_news"},
                {"$set": {"items": processed_news, "updated_at": datetime.datetime.now(datetime.timezone.utc)}},
                upsert=True
            )
            print("💾 Successfully persisted latest news to MongoDB Atlas Cloud Database.", flush=True)
        except Exception as e:
            print(f"⚠️ Error writing news to MongoDB Atlas: {e}", flush=True)

if __name__ == "__main__":
    main()
