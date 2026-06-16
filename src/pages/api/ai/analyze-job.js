import db from '../../../lib/db';
import { analyzeJobFit } from '../../../lib/gemini';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ success: false, error: 'jobId is required' });
  }

  try {
    // 1. Get job details
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // 2. Get the active resume
    const resume = db.prepare('SELECT * FROM resumes WHERE is_active = 1').get();
    if (!resume) {
      return res.status(400).json({ success: false, error: 'No active resume selected. Please upload and set a resume as active first.' });
    }

    // 3. Call Gemini to analyze fit
    const resumeText = resume.raw_text || '';
    const jobDescription = job.description || `${job.title}\n${job.company}`;

    const analysis = await analyzeJobFit(resumeText, jobDescription);

    // 4. Save/update in job_analyses table
    const existingAnalysis = db.prepare('SELECT id FROM job_analyses WHERE job_id = ? AND resume_id = ?').get(job.id, resume.id);

    if (existingAnalysis) {
      db.prepare(`
        UPDATE job_analyses
        SET match_score = ?, match_analysis = ?, created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(analysis.match_score, JSON.stringify(analysis), existingAnalysis.id);
    } else {
      db.prepare(`
        INSERT INTO job_analyses (job_id, resume_id, match_score, match_analysis)
        VALUES (?, ?, ?, ?)
      `).run(job.id, resume.id, analysis.match_score, JSON.stringify(analysis));
    }

    return res.status(200).json({
      success: true,
      data: {
        jobId: job.id,
        resumeId: resume.id,
        matchScore: analysis.match_score,
        matches: analysis.matches,
        gaps: analysis.gaps
      }
    });
  } catch (error) {
    console.error('API Error /api/ai/analyze-job:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
