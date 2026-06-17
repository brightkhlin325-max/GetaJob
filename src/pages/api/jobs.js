import db from '../../lib/db';
import { processJobSummaryAsync } from '../../lib/services/jobService';

const ALLOWED_STATUSES = ['Interested', 'Applied', 'Interviewing', 'Offered', 'Rejected'];

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { id, status } = req.query;

      if (id) {
        if (Array.isArray(id)) {
          return res.status(400).json({ success: false, error: 'Multiple job IDs not allowed' });
        }
        const job = await db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
        if (!job) {
          return res.status(404).json({ success: false, error: 'Job not found' });
        }
        const analyses = await db.prepare('SELECT * FROM job_analyses WHERE job_id = ? ORDER BY created_at DESC').all(id);
        job.analyses = analyses;
        return res.status(200).json({ success: true, data: job });
      }

      let jobs;
      const activeResumeSubquery = '(SELECT id FROM resumes WHERE is_active = 1)';
      if (status) {
        jobs = await db.prepare(`
          SELECT j.*, ja.match_score, ja.cover_letter
          FROM jobs j
          LEFT JOIN job_analyses ja ON j.id = ja.job_id AND ja.resume_id = ${activeResumeSubquery}
          WHERE j.status = ?
          ORDER BY j.created_at DESC
        `).all(status);
      } else {
        jobs = await db.prepare(`
          SELECT j.*, ja.match_score, ja.cover_letter
          FROM jobs j
          LEFT JOIN job_analyses ja ON j.id = ja.job_id AND ja.resume_id = ${activeResumeSubquery}
          ORDER BY j.id DESC
        `).all();
      }

      return res.status(200).json({ success: true, data: jobs });

    } else if (req.method === 'POST') {
      const { title, company, location, salary, url, description, source, status } = req.body || {};

      if (
        title === undefined ||
        title === null ||
        typeof title !== 'string' ||
        !title.trim() ||
        company === undefined ||
        company === null ||
        typeof company !== 'string' ||
        !company.trim()
      ) {
        return res.status(400).json({ success: false, error: 'Title and company are required fields and must be non-empty strings' });
      }

      if (status !== undefined) {
        if (status === null || !ALLOWED_STATUSES.includes(status)) {
          return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` });
        }
      }

      const finalStatus = status || 'Interested';

      const stmt = db.prepare(`
        INSERT INTO jobs (title, company, location, salary, url, description, source, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = await stmt.run(
        title.trim(),
        company.trim(),
        location || null,
        salary || null,
        url || null,
        description || null,
        source || null,
        finalStatus
      );

      if (description) {
        setTimeout(() => {
          processJobSummaryAsync(result.lastInsertRowid, description);
        }, 0);
      }

      return res.status(201).json({ success: true, jobId: result.lastInsertRowid });

    } else if (req.method === 'PUT') {
      const { id, title, company, location, salary, url, description, source, status } = req.body || {};

      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing job ID' });
      }
      if (Array.isArray(id)) {
        return res.status(400).json({ success: false, error: 'Multiple job IDs not allowed' });
      }

      const jobExists = await db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id);
      if (!jobExists) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      if (status !== undefined) {
        if (status === null || !ALLOWED_STATUSES.includes(status)) {
          return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` });
        }
      }

      const updates = [];
      const values = [];

      if (title !== undefined) {
        if (title === null || typeof title !== 'string' || !title.trim()) {
          return res.status(400).json({ success: false, error: 'Title must be a non-empty string' });
        }
        updates.push('title = ?');
        values.push(title.trim());
      }
      if (company !== undefined) {
        if (company === null || typeof company !== 'string' || !company.trim()) {
          return res.status(400).json({ success: false, error: 'Company must be a non-empty string' });
        }
        updates.push('company = ?');
        values.push(company.trim());
      }
      if (location !== undefined) {
        updates.push('location = ?');
        values.push(location);
      }
      if (salary !== undefined) {
        updates.push('salary = ?');
        values.push(salary);
      }
      if (url !== undefined) {
        updates.push('url = ?');
        values.push(url);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (source !== undefined) {
        updates.push('source = ?');
        values.push(source);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      values.push(id);
      const stmt = db.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`);
      await stmt.run(...values);

      if (description !== undefined) {
        setTimeout(() => {
          processJobSummaryAsync(id, description);
        }, 0);
      }

      return res.status(200).json({ success: true });

    } else if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Missing job ID query parameter' });
      }
      if (Array.isArray(id)) {
        return res.status(400).json({ success: false, error: 'Multiple job IDs not allowed' });
      }

      const jobExists = db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id);
      if (!jobExists) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
      await stmt.run(id);

      return res.status(200).json({ success: true });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API Error /api/jobs:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
