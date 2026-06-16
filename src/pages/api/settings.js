import db, { prepare, all } from '../../lib/db';

export default async function handler(req, res) {
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

      const upsert = db.prepare(`
        INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
      `);

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
