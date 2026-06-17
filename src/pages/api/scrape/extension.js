// Added debug logging and explicit API config
import db from '../../../lib/db';

export default async function handler(req, res) {
  // Enable CORS for Chrome Extension calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Log the raw body for debugging
  console.log('Extension API received body:', req.body);

  // Normalize body: Next.js may give string if header parsing fails
  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      console.warn('Failed to parse JSON string body');
    }
  }

  const {
    title,
    company,
    location = '',
    salary = '',
    url = '',
    description = '',
    source = ''
  } = payload || {};

  if (!title || !company) {
    console.warn('Missing title or company in payload');
    return res.status(400).json({ error: 'Missing required fields (title, company)' });
  }

  try {
    if (payload.checkOnly) {
      if (url) {
        const exists = db.prepare('SELECT 1 FROM jobs WHERE url = ?').get(url);
        return res.status(200).json({ success: true, duplicated: !!exists });
      }
      return res.status(200).json({ success: true, duplicated: false });
    }

    if (url) {
      const exists = db.prepare('SELECT 1 FROM jobs WHERE url = ?').get(url);
      if (exists) {
        return res.status(200).json({ success: true, message: 'Already exists', duplicated: true });
      }
    }
    const stmt = db.prepare(`INSERT INTO jobs (title, company, location, salary, url, description, source) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(title, company, location, salary, url, description, source);
    const jobId = info.lastInsertRowid;
    return res.status(201).json({ success: true, jobId });
  } catch (err) {
    console.error('DB insert error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}

// Ensure Next.js parses JSON bodies
export const config = {
  api: {
    bodyParser: true,
  },
};
