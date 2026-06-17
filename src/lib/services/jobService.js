import db from '../db';
import { formatJobDescription } from '../gemini';

/**
 * Asynchronously process and structure a job description using AI.
 * Includes safeguards against race conditions, short texts, and API failures.
 *
 * @param {number|string} jobId The ID of the job
 * @param {string} originalText The original raw text at the time of creation
 */
export async function processJobSummaryAsync(jobId, originalText) {
  try {
    // 1. Short Text Bypass: If description is too short, it's not worth formatting.
    if (!originalText || originalText.trim().length < 150) {
      console.log(`[JobService] Skipping AI format for Job ${jobId} (text length < 150)`);
      return;
    }

    console.log(`[JobService] Starting AI format for Job ${jobId}...`);

    // 2. Call AI
    const aiSummary = await formatJobDescription(originalText);

    if (!aiSummary || aiSummary.trim() === '') {
      console.warn(`[JobService] AI returned empty summary for Job ${jobId}.`);
      return;
    }

    // 3. Race Condition Check: Ensure the description hasn't been changed manually
    // while the AI was processing.
    const currentJob = db.prepare('SELECT description FROM jobs WHERE id = ?').get(jobId);
    
    if (!currentJob) {
      console.warn(`[JobService] Job ${jobId} was deleted before AI format could finish.`);
      return;
    }

    if (currentJob.description !== originalText) {
      console.log(`[JobService] Job ${jobId} description was manually updated. Aborting AI override.`);
      return;
    }

    // 4. Save to DB
    const updateStmt = db.prepare('UPDATE jobs SET ai_summary = ? WHERE id = ?');
    updateStmt.run(aiSummary, jobId);
    
    console.log(`[JobService] Successfully generated ai_summary for Job ${jobId}.`);

  } catch (error) {
    // 5. API Error Degradation: Log error but do not crash the app
    console.error(`[JobService] Failed to generate AI summary for Job ${jobId}:`, error);
  }
}
