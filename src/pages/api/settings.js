import db, { prepare, all } from '../../lib/db';

export default async function handler(req, res) {
  // Enable CORS for Chrome Extension calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const rows = (await all('SELECT key, value FROM settings')) || [];
      const settings = {};
      for (const row of rows) {
        let parsedVal;
        try {
          parsedVal = JSON.parse(row.value);
        } catch (e) {
          parsedVal = row.value;
        }
        settings[row.key] = parsedVal;
      }
      return res.status(200).json(settings);
    } else if (req.method === 'POST') {
      const payload = req.body;
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        return res.status(400).json({ success: false, error: 'Invalid settings payload' });
      }

      // Auto-reset progress on target_position/target_locations change
      let currentPos = '';
      let currentLocs = '';
      try {
        const rows = (await all("SELECT key, value FROM settings WHERE key IN ('target_position', 'target_locations')")) || [];
        for (const r of rows) {
          if (r.key === 'target_position') currentPos = r.value;
          if (r.key === 'target_locations') currentLocs = r.value;
        }
      } catch (e) {
        console.warn('Failed to query current settings for comparison:', e);
      }

      let positionChanged = false;
      let locationsChanged = false;

      if ('target_position' in payload) {
        const newPos = typeof payload.target_position === 'string' ? payload.target_position : JSON.stringify(payload.target_position);
        if (newPos !== currentPos) positionChanged = true;
      }
      if ('target_locations' in payload) {
        const newLocs = typeof payload.target_locations === 'string' ? payload.target_locations : JSON.stringify(payload.target_locations);
        if (newLocs !== currentLocs) locationsChanged = true;
      }

      const upsert = db.prepare(`
        INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
      `);

      if (positionChanged || locationsChanged) {
        console.log('Target preferences changed. Resetting all page progress parameters.');
        await upsert.run('last_page_104', '0');
        await upsert.run('last_page_cake', '0');
        await upsert.run('last_page_linkedin', '0');
        await upsert.run('last_page_1111', '0');
      }

      for (const [key, value] of Object.entries(payload)) {
        const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
        await upsert.run(key, stringVal);
      }
      return res.status(200).json({ success: true });
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API Error /api/settings:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
