import os
import json
import random
import urllib.parse
from pymongo import MongoClient

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def main():
    """
    Set organic-looking view counts on all articles.
    - Older/foundational articles (first 5) get higher views (800-2400)
    - Mid-tier articles get moderate views (200-900)
    - Newer articles get lower views (40-300)
    - Add natural variance so no two articles look the same
    """
    
    backup_file = os.path.join(os.path.dirname(__file__), "..", "data", "articles_backup.json")
    backup_file = os.path.abspath(backup_file)
    
    with open(backup_file, "r") as f:
        articles = json.load(f)
    
    total = len(articles)
    print(f"Found {total} articles. Setting organic view counts...")
    
    # Group articles into tiers based on position (simulating age/popularity)
    # First 5: "older" cornerstone articles - highest views
    # Next 15: mid-tier articles - moderate views  
    # Remaining: newer articles - lower views
    
    for i, article in enumerate(articles):
        if i < 5:
            # Cornerstone/popular articles: 800 - 2400 views
            base = random.randint(800, 2400)
        elif i < 15:
            # Mid-tier articles: 200 - 900 views
            base = random.randint(200, 900)
        elif i < 30:
            # Newer articles: 80 - 350 views
            base = random.randint(80, 350)
        else:
            # Newest articles: 30 - 180 views
            base = random.randint(30, 180)
        
        # Add some randomness so it doesn't look like a perfect gradient
        jitter = random.randint(-15, 25)
        views = max(12, base + jitter)
        
        article["views"] = views
        print(f"  {article['slug']}: {views} views")
    
    # Save to backup file
    with open(backup_file, "w") as f:
        json.dump(articles, f, indent=2)
    print(f"\n✅ Saved organic view counts to {backup_file}")
    
    # Sync to MongoDB
    mongo_uri = os.environ.get("MONGO_URI")
    if not mongo_uri:
        print("⚠️ MONGO_URI not set. Skipping database sync.")
        return
    
    try:
        m_client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            tlsAllowInvalidCertificates=True
        )
        db_name = "studyapp"
        parsed_uri = urllib.parse.urlparse(mongo_uri)
        if parsed_uri.path and parsed_uri.path != "/":
            db_name = parsed_uri.path.strip("/")
        
        db = m_client[db_name]
        articles_col = db["articles"]
        
        updated = 0
        for art in articles:
            articles_col.replace_one({"slug": art["slug"]}, art, upsert=True)
            updated += 1
        
        print(f"✅ Synchronized {updated} articles with organic views to MongoDB Atlas.")
    except Exception as e:
        print(f"⚠️ Error syncing to MongoDB: {e}")

if __name__ == "__main__":
    main()
