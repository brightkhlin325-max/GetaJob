import db from '../../../../lib/db';
import { formatJobDescription } from '../../../../lib/gemini';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;

  try {
    const job = await db.prepare('SELECT description FROM jobs WHERE id = ?').get(id);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (!job.description || job.description.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Job description is empty' });
    }

    // Since this is a manual trigger, we await the result and return it
    const aiSummary = await formatJobDescription(job.description);

    if (!aiSummary || aiSummary.trim() === '') {
      return res.status(500).json({ success: false, error: 'AI returned an empty summary' });
    }

    const updateStmt = db.prepare('UPDATE jobs SET ai_summary = ? WHERE id = ?');
    await updateStmt.run(aiSummary, id);

    return res.status(200).json({ success: true, data: { ai_summary: aiSummary } });

  } catch (error) {
    console.error(`Error formatting job ${id}:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
