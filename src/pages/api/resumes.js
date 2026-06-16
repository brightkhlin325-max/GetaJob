import nextConnect from 'next-connect';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseResume } from '../../lib/ai';
import db from '../../lib/db';

// Configure multer storage in a temporary folder
const upload = multer({
  dest: path.join(process.cwd(), 'tmp'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

const apiRoute = nextConnect({
  onError(error, req, res) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  },
  onNoMatch(req, res) {
    res.status(405).json({ error: `Method '${req.method}' Not Allowed` });
  },
});

// GET: Retrieve all resumes
apiRoute.get(async (req, res) => {
  try {
    const resumes = db.prepare('SELECT id, file_name, raw_text, parsed_json, is_active, created_at FROM resumes ORDER BY id DESC').all();
    // Parse JSON strings back to objects
    const formatted = resumes.map(r => ({
      ...r,
      parsed_json: r.parsed_json ? JSON.parse(r.parsed_json) : null
    }));
    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Handle resume upload and parse
apiRoute.post(upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  let originalname = req.file.originalname;
  try {
    originalname = Buffer.from(originalname, 'latin1').toString('utf8');
  } catch (e) {
    console.error('Failed to transcode filename:', e);
  }
  const { path: tmpPath } = req.file;
  try {
    let apiKey = '';
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
    if (row && row.value) {
      try {
        apiKey = JSON.parse(row.value);
      } catch (e) {
        apiKey = row.value;
      }
    }

    const fileBuffer = fs.readFileSync(tmpPath);
    const parsed = await parseResume(fileBuffer, apiKey);

    // Insert into SQLite DB
    const stmt = db.prepare(
      `INSERT INTO resumes (file_name, raw_text, parsed_json, is_active) VALUES (?, ?, ?, ?)`
    );
    const info = stmt.run(originalname, parsed.rawText, JSON.stringify(parsed.structure), 0);

    // If it's the first resume, set it active automatically
    const countRow = db.prepare('SELECT COUNT(*) as count FROM resumes').get();
    if (countRow.count === 1) {
      db.prepare('UPDATE resumes SET is_active = 1 WHERE id = ?').run(info.lastInsertRowid);
    }

    res.status(200).json({ success: true, message: 'Resume uploaded and parsed', data: parsed.structure });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Cleanup temp file if it exists
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
});

// PUT: Set active resume
apiRoute.put(async (req, res) => {
  const id = req.query.id || req.body?.id;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Resume id is required' });
  }

  try {
    db.transaction(() => {
      db.prepare('UPDATE resumes SET is_active = 0').run();
      db.prepare('UPDATE resumes SET is_active = 1 WHERE id = ?').run(id);
    })();
    res.status(200).json({ success: true, message: 'Active resume updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE: Remove resume
apiRoute.delete(async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Resume id query parameter is required' });
  }

  try {
    db.prepare('DELETE FROM resumes WHERE id = ?').run(id);
    res.status(200).json({ success: true, message: 'Resume deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default apiRoute;

// Disable Next.js default body parser when processing multiform data (POST method)
export const config = {
  api: {
    bodyParser: false,
  },
};
