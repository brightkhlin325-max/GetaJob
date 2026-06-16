import db from '../db';

describe('Database Layer Integration Tests', () => {
  beforeEach(async () => {
    await db.prepare('DELETE FROM job_analyses').run();
    await db.prepare('DELETE FROM jobs').run();
    await db.prepare('DELETE FROM resumes').run();
    await db.prepare('DELETE FROM settings').run();
  });



  test('should initialize schema and verify table structures', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name);

    expect(tables).toContain('settings');
    expect(tables).toContain('resumes');
    expect(tables).toContain('jobs');
    expect(tables).toContain('job_analyses');
  });

  test('should enforce foreign key constraints (ON DELETE CASCADE)', () => {
    const resumeResult = db.prepare(`
      INSERT INTO resumes (file_name, raw_text, parsed_json, is_active)
      VALUES (?, ?, ?, ?)
    `).run('resume.pdf', 'raw text', '{}', 1);
    const resumeId = resumeResult.lastInsertRowid;

    const jobResult = db.prepare(`
      INSERT INTO jobs (title, company, status)
      VALUES (?, ?, ?)
    `).run('Engineer', 'Acme Corp', 'Interested');
    const jobId = jobResult.lastInsertRowid;

    const analysisResult = db.prepare(`
      INSERT INTO job_analyses (job_id, resume_id, match_score, match_analysis, cover_letter)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, resumeId, 85, '{}', 'Hello cover letter');
    const analysisId = analysisResult.lastInsertRowid;

    const analysisBefore = db.prepare('SELECT * FROM job_analyses WHERE id = ?').get(analysisId);
    expect(analysisBefore).toBeDefined();
    expect(analysisBefore.match_score).toBe(85);

    db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);

    const analysisAfterJobDelete = db.prepare('SELECT * FROM job_analyses WHERE id = ?').get(analysisId);
    expect(analysisAfterJobDelete).toBeUndefined();

    const resumeStillExists = db.prepare('SELECT * FROM resumes WHERE id = ?').get(resumeId);
    expect(resumeStillExists).toBeDefined();
  });

  test('should enforce foreign key constraint when resume is deleted', () => {
    const resumeResult = db.prepare(`
      INSERT INTO resumes (file_name, raw_text, parsed_json, is_active)
      VALUES (?, ?, ?, ?)
    `).run('resume2.pdf', 'raw text 2', '{}', 1);
    const resumeId = resumeResult.lastInsertRowid;

    const jobResult = db.prepare(`
      INSERT INTO jobs (title, company, status)
      VALUES (?, ?, ?)
    `).run('Designer', 'Acme Corp', 'Interested');
    const jobId = jobResult.lastInsertRowid;

    const analysisResult = db.prepare(`
      INSERT INTO job_analyses (job_id, resume_id, match_score, match_analysis, cover_letter)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, resumeId, 90, '{}', 'Cover letter 2');
    const analysisId = analysisResult.lastInsertRowid;

    db.prepare('DELETE FROM resumes WHERE id = ?').run(resumeId);

    const analysisAfterResumeDelete = db.prepare('SELECT * FROM job_analyses WHERE id = ?').get(analysisId);
    expect(analysisAfterResumeDelete).toBeUndefined();

    const jobStillExists = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(jobStillExists).toBeDefined();
  });

  test('should respect GETAJOB_DB_DIR override', async () => {
    const fs = require('fs');
    const path = require('path');
    const originalEnv = process.env.GETAJOB_DB_DIR;
    const tempDir = path.join(__dirname, 'temp_db_dir');

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    process.env.GETAJOB_DB_DIR = tempDir;
    delete global.cachedDb;
    jest.resetModules();

    const testDb = require('../db').default;

    expect(fs.existsSync(tempDir)).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'getajob.db'))).toBe(true);

    testDb.close();
      fs.rmSync(tempDir, { recursive: true, force: true });

    delete global.cachedDb;
    if (originalEnv) {
      process.env.GETAJOB_DB_DIR = originalEnv;
    } else {
      delete process.env.GETAJOB_DB_DIR;
    }
    jest.resetModules();
    require('../db');
  });
});
