import { createMocks } from 'node-mocks-http';
import analyzeJobHandler from '../ai/analyze-job';
import generateCoverLetterHandler from '../ai/generate-cover-letter';
import db from '../../../lib/db';

describe('AI API Endpoints', () => {
  let jobId;
  let resumeId;
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    // Clear databases
    await db.prepare('DELETE FROM job_analyses').run();
    await db.prepare('DELETE FROM jobs').run();
    await db.prepare('DELETE FROM resumes').run();
    await db.prepare('DELETE FROM settings').run();

    // Set mock settings
    await db.prepare("INSERT INTO settings (key, value) VALUES ('gemini_api_key', 'mock_key')").run();

    // Insert mock job
    const jobInfo = await db.prepare(`
      INSERT INTO jobs (title, company, description, status)
      VALUES (?, ?, ?, ?)
    `).run('React Developer', 'Awesome Corp', 'Must know React and hooks.', 'Interested');
    jobId = jobInfo.lastInsertRowid;

    // Insert mock active resume
    const resumeInfo = await db.prepare(`
      INSERT INTO resumes (file_name, raw_text, parsed_json, is_active)
      VALUES (?, ?, ?, ?)
    `).run('resume.pdf', 'I have 5 years React experience and hooks knowledge.', '{}', 1);
    resumeId = resumeInfo.lastInsertRowid;
  });

  test('/api/ai/analyze-job should match resume with job description', async () => {
    // Mock fetch to simulate Gemini response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  match_score: 90,
                  matches: ['React experience matches', 'Hooks knowledge matches'],
                  gaps: ['None']
                })
              }]
            }
          }]
        })
      })
    );

    const { req, res } = createMocks({
      method: 'POST',
      body: { jobId }
    });

    await analyzeJobHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = res._getJSONData();
    expect(body.success).toBe(true);
    expect(body.data.matchScore).toBe(90);
    expect(body.data.matches).toContain('React experience matches');

    // Verify written to database
    const analysis = db.prepare('SELECT * FROM job_analyses WHERE job_id = ? AND resume_id = ?').get(jobId, resumeId);
    expect(analysis).toBeDefined();
    expect(analysis.match_score).toBe(90);
  });

  test('/api/ai/generate-cover-letter should generate cover letter and update db', async () => {
    const mockCoverLetter = '# Cover Letter\n\nDear Hiring Manager,\n\nI am writing to express my interest in...';

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: mockCoverLetter
              }]
            }
          }]
        })
      })
    );

    const { req, res } = createMocks({
      method: 'POST',
      body: { jobId }
    });

    await generateCoverLetterHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = res._getJSONData();
    expect(body.success).toBe(true);
    expect(body.data.coverLetter).toBe(mockCoverLetter);

    // Verify written to database
    const analysis = db.prepare('SELECT * FROM job_analyses WHERE job_id = ? AND resume_id = ?').get(jobId, resumeId);
    expect(analysis).toBeDefined();
    expect(analysis.cover_letter).toBe(mockCoverLetter);
  });
});
