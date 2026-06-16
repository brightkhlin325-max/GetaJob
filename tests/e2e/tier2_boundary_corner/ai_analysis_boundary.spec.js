/**
 * AI Analysis Boundary & Corner Case Tests (F4)
 * File: tests/e2e/tier2_boundary_corner/ai_analysis_boundary.spec.js
 */
const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');

test.describe('F4: AI Fit Analysis & Cover Letter Boundary Cases', () => {
  let dbHelper;

  test.beforeAll(async () => {
    dbHelper = new DbHelper();
  });

  test.beforeEach(async () => {
    dbHelper.clearDatabase();
    // Reset mock server state
    await fetch('http://localhost:8089/__mock/reset', { method: 'POST' }).catch(() => {});
  });

  test.afterAll(async () => {
    dbHelper.close();
  });

  test('F4-T2-01: Backend Rate Limiter Throttling (15 RPM bucket)', async ({ request }) => {
    dbHelper.seedSettings({ gemini_api_key: 'mock-key' });
    dbHelper.seedResumes([{
      id: 1,
      file_name: 'resume.pdf',
      raw_text: 'My React Skills',
      parsed_json: { skills: ['React'] },
      is_active: 1
    }]);

    // Seed 16 distinct jobs to bypass caching
    const jobs = [];
    for (let i = 1; i <= 16; i++) {
      jobs.push({
        id: i,
        title: `Job ${i}`,
        company: `Company ${i}`,
        description: `React Dev position ${i}`,
        status: 'Interested',
        url: `https://example.com/${i}`
      });
    }
    dbHelper.seedJobs(jobs);

    // Fire 16 rapid requests
    const promises = [];
    for (let i = 1; i <= 16; i++) {
      promises.push(
        request.post('/api/ai/analyze-job', {
          data: { jobId: i, resumeId: 1 }
        })
      );
    }

    const responses = await Promise.all(promises);
    const statusCodes = responses.map(res => res.status());
    const successCount = statusCodes.filter(code => code === 200).length;
    const throttledCount = statusCodes.filter(code => code === 429).length;

    expect(successCount).toBe(15);
    expect(throttledCount).toBe(1);
  });

  test('F4-T2-02: Upstream 429 Exponential Backoff retry behavior', async ({ request }) => {
    dbHelper.seedSettings({ gemini_api_key: 'mock-key' });
    dbHelper.seedResumes([{
      id: 1,
      file_name: 'resume.pdf',
      raw_text: 'React Developer',
      parsed_json: { skills: ['React'] },
      is_active: 1
    }]);
    dbHelper.seedJobs([{
      id: 1,
      title: 'React Dev',
      company: 'Tech Corp',
      description: 'Looking for React Dev',
      status: 'Interested'
    }]);

    // Force rate limit on the mock Gemini server
    await fetch('http://localhost:8089/__mock/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceRateLimit: true })
    });

    // Trigger API analysis in the background
    const analysisPromise = request.post('/api/ai/analyze-job', {
      data: { jobId: 1, resumeId: 1 }
    });

    // Wait a brief moment for the initial request to fail with 429
    await new Promise(r => setTimeout(r, 200));

    // Turn off rate limit so that retry attempt succeeds
    await fetch('http://localhost:8089/__mock/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceRateLimit: false })
    });

    const response = await analysisPromise;
    expect(response.status()).toBe(200);

    // Verify mock logs contain multiple attempts
    const logRes = await fetch('http://localhost:8089/__mock/logs');
    const logData = await logRes.json();
    expect(logData.count).toBeGreaterThan(1);
  });

  test('F4-T2-03: Missing Gemini API key warning', async ({ page }) => {
    // Clear the Gemini API key in DB
    dbHelper.seedSettings({ gemini_api_key: '' });
    dbHelper.seedResumes([{
      id: 1,
      file_name: 'resume.pdf',
      raw_text: 'React Dev',
      parsed_json: { skills: ['React'] },
      is_active: 1
    }]);
    dbHelper.seedJobs([{
      id: 1,
      title: 'React Dev',
      company: 'Tech Corp',
      description: 'Looking for React Dev',
      status: 'Interested'
    }]);

    // Verify backend returns 400 or 401 error
    const response = await page.request.post('/api/ai/analyze-job', {
      data: { jobId: 1, resumeId: 1 }
    });
    expect([400, 401]).toContain(response.status());

    // Verify UI shows warning banner/modal
    await page.goto('/');
    await page.locator('text=React Dev').click();
    await page.locator('#analyze-fit-btn, text=Analyze Fit').click();
    await expect(page.locator('text=Configure Gemini API Key in Settings first')).toBeVisible();
  });

  test('F4-T2-04: Empty/malformed description validation', async ({ request }) => {
    dbHelper.seedSettings({ gemini_api_key: 'mock-key' });
    dbHelper.seedResumes([{
      id: 1,
      file_name: 'resume.pdf',
      raw_text: 'React Dev',
      parsed_json: { skills: ['React'] },
      is_active: 1
    }]);
    dbHelper.seedJobs([{
      id: 1,
      title: 'React Dev',
      company: 'Tech Corp',
      description: '', // Empty description
      status: 'Interested'
    }]);

    const response = await request.post('/api/ai/analyze-job', {
      data: { jobId: 1, resumeId: 1 }
    });

    // API handles it gracefully (returns 400 validation error or returns a 0 score without crash)
    expect([200, 400]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.match_score).toBe(0);
    }
  });

  test('F4-T2-05: Multi-resume cache isolation', async ({ request, page }) => {
    dbHelper.seedSettings({ gemini_api_key: 'mock-key' });
    dbHelper.seedResumes([
      {
        id: 1,
        file_name: 'resume_A.pdf',
        raw_text: 'React Developer',
        parsed_json: { skills: ['React'] },
        is_active: 1
      },
      {
        id: 2,
        file_name: 'resume_B.pdf',
        raw_text: 'Python Developer',
        parsed_json: { skills: ['Python'] },
        is_active: 0
      }
    ]);
    dbHelper.seedJobs([{
      id: 1,
      title: 'React Dev',
      company: 'Tech Corp',
      description: 'Looking for React Dev',
      status: 'Interested'
    }]);

    // Analyze with Resume A
    const resA = await request.post('/api/ai/analyze-job', {
      data: { jobId: 1, resumeId: 1 }
    });
    expect(resA.status()).toBe(200);

    // Switch active resume to Resume B
    dbHelper.db.prepare('UPDATE resumes SET is_active = 0 WHERE id = 1').run();
    dbHelper.db.prepare('UPDATE resumes SET is_active = 1 WHERE id = 2').run();

    // Analyze with Resume B
    const resB = await request.post('/api/ai/analyze-job', {
      data: { jobId: 1, resumeId: 2 }
    });
    expect(resB.status()).toBe(200);

    // Assert two separate analyses saved in database
    const analyses = dbHelper.db.prepare('SELECT * FROM job_analyses WHERE job_id = 1').all();
    expect(analyses.length).toBe(2);

    // Assert UI displays correct score based on currently active resume
    await page.goto('/');
    await page.locator('text=React Dev').click();
    const scoreTextB = await page.locator('.match-score-value, #match-score').textContent();

    // Switch back to Resume A
    dbHelper.db.prepare('UPDATE resumes SET is_active = 1 WHERE id = 1').run();
    dbHelper.db.prepare('UPDATE resumes SET is_active = 0 WHERE id = 2').run();

    await page.reload();
    await page.locator('text=React Dev').click();
    const scoreTextA = await page.locator('.match-score-value, #match-score').textContent();

    expect(scoreTextA).not.toBe(scoreTextB);
  });
});
