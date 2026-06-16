const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');
const { startServer, stopServer } = require('../../helpers/gemini-mock');

let dbHelper;
let mockServer;

test.beforeAll(async () => {
  dbHelper = new DbHelper();
  mockServer = await startServer(8089);
});

test.afterAll(async () => {
  dbHelper.close();
  await stopServer();
});

test.beforeEach(async () => {
  dbHelper.clearDatabase();
  try {
    await fetch('http://localhost:8089/__mock/reset', { method: 'POST' });
  } catch (err) {
    console.error('Failed to reset Gemini mock:', err);
  }
});

test('T4-04: Bulk Job Processing under Gemini Free Tier Constraints', async ({ page }) => {
  // Increase test timeout to accommodate the 15 RPM (4s interval) pacing over 12 requests
  test.setTimeout(60000);

  // 1. Seed settings, active resume, and 12 jobs (Job 5 has company 'Company 5' which is mocked to fail)
  dbHelper.seedSettings({
    gemini_api_key: 'mock-key'
  });

  dbHelper.seedResumes([
    { id: 1, file_name: 'resume.pdf', raw_text: 'React Specialist', parsed_json: { skills: ['React'] }, is_active: 1 }
  ]);

  const jobs = [];
  for (let i = 1; i <= 12; i++) {
    jobs.push({
      id: i,
      title: `Job ${i} (React)`,
      company: i === 5 ? 'Company 5' : `Company ${i}`,
      status: 'Interested'
    });
  }
  dbHelper.seedJobs(jobs);

  // 2. Go to dashboard
  await page.goto('/');

  // Verify cards are visible
  await expect(page.locator('.bauhaus-card', { hasText: 'Job 1 (React)' })).toBeVisible();

  // 3. Trigger fit analysis for all 12 jobs in rapid succession (simulating concurrent user clicks or bulk processing)
  const startTime = Date.now();
  const promises = [];
  for (let id = 1; id <= 12; id++) {
    promises.push(
      page.request.post('/api/ai/analyze-job', {
        data: { jobId: id, resumeId: 1 }
      })
    );
  }

  // Wait for all requests to be settled (some will succeed, Job 5 will fail)
  const responses = await Promise.all(promises);

  const duration = Date.now() - startTime;

  // 4. Assert that total execution time respects the rate limiter (at least ~44 seconds for 12 requests with 4s delay between each)
  // Note: 11 intervals of 4s = 44s. Let's allow a slight buffer for network/CI environments.
  expect(duration).toBeGreaterThanOrEqual(40000);

  // 5. Verify failure isolation: Job 5 response should have failed (non-2xx)
  const resJob5 = responses[4]; // index 4 is Job 5
  expect(resJob5.ok()).toBe(false);

  // The rest should be successful
  for (let i = 0; i < 12; i++) {
    if (i !== 4) {
      expect(responses[i].ok()).toBe(true);
    }
  }

  // 6. Check mock server logs to confirm rate-limiter pacing
  const logsRes = await fetch('http://localhost:8089/__mock/logs');
  const logs = await logsRes.json();

  // The mock server should have received all 12 requests (even if Job 5 failed, it was forwarded and failed inside mock server)
  expect(logs.count).toBe(12);

  // Verify timestamps are spaced >= 4 seconds apart
  for (let i = 1; i < logs.logs.length; i++) {
    const diff = new Date(logs.logs[i].timestamp) - new Date(logs.logs[i - 1].timestamp);
    expect(diff).toBeGreaterThanOrEqual(3500); // 4000ms with a small tolerance
  }

  // 7. Verify DB contains analyses for all successful jobs, but NOT Job 5
  const analyses = dbHelper.db.prepare('SELECT job_id FROM job_analyses').all().map(a => a.job_id);
  expect(analyses.includes(5)).toBe(false);
  expect(analyses.length).toBe(11);
});
