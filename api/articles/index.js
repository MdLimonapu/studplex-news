import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
let client;
let clientPromise;

if (!uri) {
  throw new Error('Please add your Mongo URI to environment variables');
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const mongoClient = await clientPromise;
    let dbName = 'studyapp';
    try {
      const parsed = new URL(uri);
      if (parsed.pathname && parsed.pathname !== '/') {
        dbName = parsed.pathname.substring(1);
      }
    } catch (e) {}
    
    const db = mongoClient.db(dbName);
    const articlesCol = db.collection('articles');
    
    // Find all published articles (date <= today), excluding full content to keep payload size small for list view
    const todayStr = new Date().toISOString().split('T')[0];
    const articles = await articlesCol.find({ date: { $lte: todayStr } }, { projection: { _id: 0, content: 0 } }).toArray();
    
    return res.status(200).json(articles);
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
