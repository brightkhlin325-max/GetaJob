const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');
let dbHelper;

test.beforeAll(async () => {
  dbHelper = new DbHelper();
});

test.afterAll(async () => {
  dbHelper.close();
});

test.beforeEach(async () => {
  dbHelper.clearDatabase();
  try {
    await fetch('http://localhost:8089/__mock/reset', { method: 'POST' });
  } catch (err) {
    console.error('Failed to reset Gemini mock:', err);
  }
});

test.describe('Tier 3: Cross-Feature Combinations', () => {
  
  // T3-01: F1 (Settings) x F3 (Extension API) - Scraping Filter Constraint
  test('T3-01: Extension scraping requests are filtered/validated against active platform configuration in settings', async ({ page }) => {
    // 1. Seed settings: disable CakeResume, enable 104
    dbHelper.seedSettings({
      target_platforms: ['104']
    });

    // 2. Submit CakeResume job listing to /api/scrape/extension
    const payload = {
      title: 'Software Engineer',
      company: 'Cake Corp',
      location: 'Taipei',
      salary: '80k',
      url: 'https://www.cakeresume.com/jobs/cake-corp',
      description: 'Vue/React developer',
      source: 'CakeResume'
    };

    const response = await page.request.post('/api/scrape/extension', { data: payload });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);

    // 3. Query DB to verify no job record is created
    const initialJobs = dbHelper.db.prepare('SELECT count(*) as count FROM jobs').get();
    expect(initialJobs.count).toBe(0);

    // 4. Update settings to enable CakeResume
    dbHelper.seedSettings({
      target_platforms: ['104', 'CakeResume']
    });

    // 5. Submit CakeResume payload again
    const response2 = await page.request.post('/api/scrape/extension', { data: payload });
    expect(response2.status()).toBe(201);
    const body2 = await response2.json();
    expect(body2.success).toBe(true);
    expect(body2.jobId).toBeDefined();

    // 6. Query DB and assert job was saved successfully
    const savedJob = dbHelper.db.prepare("SELECT * FROM jobs WHERE source = 'CakeResume'").get();
    expect(savedJob).toBeDefined();
    expect(savedJob.company).toBe('Cake Corp');
  });

  // T3-02: F2 (Resume Management) x F4 (AI Fit Analysis) - Active Resume Swap Isolation
  test('T3-02: Swapping active resume invalidates caches and generates unique analysis records per resume/job pair', async ({ page }) => {
    // 1. Seed Resume A (Python, is_active=1) and Resume B (React, is_active=0)
    dbHelper.seedResumes([
      { id: 1, file_name: 'resume_python.pdf', raw_text: 'Python Specialist', parsed_json: { skills: ['Python'] }, is_active: 1 },
      { id: 2, file_name: 'resume_react.pdf', raw_text: 'React Specialist', parsed_json: { skills: ['React'] }, is_active: 0 }
    ]);

    // 2. Seed Job 1 ("React Developer")
    dbHelper.seedJobs([
      { id: 1, title: 'React Developer', company: 'Tech Corp', description: 'React Developer with TS', source: '104' }
    ]);

    // 3. Call POST /api/ai/analyze-job. Python resume should fail/have low score
    const res1 = await page.request.post('/api/ai/analyze-job', { data: { jobId: 1, resumeId: 1 } });
    expect(res1.ok()).toBe(true);
    const data1 = await res1.json();
    // Low score or different analysis output (mock API returns 90 by default, let's verify cache logic)
    expect(data1.success).toBe(true);

    // Verify mock server received exactly 1 request
    let logsRes = await fetch('http://localhost:8089/__mock/logs');
    let logs = await logsRes.json();
    expect(logs.count).toBe(1);

    // Call it again to verify caching. It should hit cache and not call Gemini mock again.
    const res1_cached = await page.request.post('/api/ai/analyze-job', { data: { jobId: 1, resumeId: 1 } });
    expect(res1_cached.ok()).toBe(true);
    logsRes = await fetch('http://localhost:8089/__mock/logs');
    logs = await logsRes.json();
    expect(logs.count).toBe(1); // still 1

    // 4. Update settings to set Resume B as active
    dbHelper.db.prepare('UPDATE resumes SET is_active = 0 WHERE id = 1').run();
    dbHelper.db.prepare('UPDATE resumes SET is_active = 1 WHERE id = 2').run();

    // 5. Call POST /api/ai/analyze-job for Resume B
    const res2 = await page.request.post('/api/ai/analyze-job', { data: { jobId: 1, resumeId: 2 } });
    expect(res2.ok()).toBe(true);
    
    // 6. Assert that it bypasses the cached score for Resume A and calls the mock server
    logsRes = await fetch('http://localhost:8089/__mock/logs');
    logs = await logsRes.json();
    expect(logs.count).toBe(2); // increased to 2 because of resumeId 2
    
    // Check that there are two distinct analyses in the database
    const analyses = dbHelper.db.prepare('SELECT * FROM job_analyses WHERE job_id = 1').all();
    expect(analyses.length).toBe(2);
  });

  // T3-03: F3 (Job Management) x F5 (Bauhaus Kanban Board UI) - Optimistic Update Rollback
  test('T3-03: Dragging a Kanban card triggers optimistic UI change; failure rolls back and shows toast', async ({ page }) => {
    // 1. Seed job card in Interested
    dbHelper.seedJobs([
      { id: 10, title: 'Architect', company: 'Bauhaus Design', status: 'Interested' }
    ]);

    // 2. Intercept PUT /api/jobs and force 500 error
    await page.route('**/api/jobs', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Database update failed' })
        });
      } else {
        await route.continue();
      }
    });

    // 3. Go to Kanban Board
    await page.goto('/');

    // 4. Find card and drag to Applied
    const card = page.locator('.bauhaus-card', { hasText: 'Architect' });
    const interestedCol = page.locator('div', { has: page.locator('h2', { hasText: 'Interested' }) }).locator('.flex-1');
    const appliedCol = page.locator('div', { has: page.locator('h2', { hasText: 'Applied' }) }).locator('.flex-1');

    // Drag and drop card
    await card.dragTo(appliedCol);

    // 5. Verify optimistic update puts the card in Applied column immediately
    await expect(appliedCol.locator('.bauhaus-card', { hasText: 'Architect' })).toBeVisible();

    // 6. Wait for failure response and rollback
    // Assert toast error becomes visible
    await expect(page.locator('#toast-alert, .toast-error, [role="alert"], text=error')).toBeVisible();

    // Assert card is rolled back to Interested column
    await expect(interestedCol.locator('.bauhaus-card', { hasText: 'Architect' })).toBeVisible();

    // 7. Verify SQLite DB status remains unchanged
    const job = dbHelper.db.prepare('SELECT status FROM jobs WHERE id = 10').get();
    expect(job.status).toBe('Interested');
  });

  // T3-04: F4 (AI Cover Letter) x F5 (Kanban/Modal Markdown Editor) - Persisted Micro-edits
  test('T3-04: Modifications in the modal Markdown editor persist across reloads and update the database record', async ({ page }) => {
    // 1. Seed active resume, job, and cover letter analysis
    dbHelper.seedResumes([{ id: 1, file_name: 'resume.pdf', raw_text: 'raw', parsed_json: {}, is_active: 1 }]);
    dbHelper.seedJobs([{ id: 1, title: 'React dev', company: 'FaceBook', status: 'Interested' }]);
    dbHelper.seedJobAnalyses([
      { id: 1, job_id: 1, resume_id: 1, match_score: 90, match_analysis: {}, cover_letter: '# Cover Letter\n\nOriginal letter content' }
    ]);

    // 2. Open dashboard
    await page.goto('/');

    // 3. Click job card to launch modal
    await page.locator('.bauhaus-card', { hasText: 'React dev' }).click();

    // 4. Go to Cover Letter tab
    await page.locator('button:has-text("Cover Letter"), #tab-cover-letter').click();

    // 5. Edit the cover letter
    const editor = page.locator('textarea, .markdown-editor, [contenteditable="true"]');
    await editor.fill('# Cover Letter\n\nOriginal letter content\n\nPS: I have 24/7 availability for interviews.');

    // 6. Click Save Changes
    await page.locator('button:has-text("Save Changes"), button:has-text("Save")').click();

    // 7. Reload page
    await page.reload();

    // 8. Open modal again and verify edits are preserved in UI
    await page.locator('.bauhaus-card', { hasText: 'React dev' }).click();
    await page.locator('button:has-text("Cover Letter"), #tab-cover-letter').click();
    await expect(editor).toHaveValue(/24\/7 availability/);

    // 9. Query DB and assert cover letter is updated
    const analysis = dbHelper.db.prepare('SELECT cover_letter FROM job_analyses WHERE id = 1').get();
    expect(analysis.cover_letter).toContain('24/7 availability');
  });

  // T3-05: F1 (Settings: Gemini Key) x F6 (Gemini Free Tier API Protection) - Missing Credentials Short-Circuit
  test('T3-05: Missing Gemini API key in settings short-circuits the AI wrapper, preventing API calls and alerting the user', async ({ page }) => {
    // 1. Clear gemini key
    dbHelper.seedSettings({
      gemini_api_key: ''
    });

    // 2. Seed active resume and job
    dbHelper.seedResumes([{ id: 1, file_name: 'resume.pdf', raw_text: 'raw', parsed_json: {}, is_active: 1 }]);
    dbHelper.seedJobs([{ id: 1, title: 'React Developer', company: 'Facebook', status: 'Interested' }]);

    // 3. Go to dashboard, click card, click "Analyze Fit"
    await page.goto('/');
    await page.locator('.bauhaus-card', { hasText: 'React Developer' }).click();
    await page.locator('button:has-text("Analyze Fit")').click();

    // 4. Assert instant validation warning
    await expect(page.locator('text=Please configure your Gemini API Key in Settings, .alert-warning, text=API Key')).toBeVisible();

    // 5. Verify no mock server hits
    const logsRes = await fetch('http://localhost:8089/__mock/logs');
    const logs = await logsRes.json();
    expect(logs.count).toBe(0);

    // 6. Navigate to Settings page, type key and save
    if (await page.locator('button:has-text("Settings")').count() > 0) {
      await page.locator('button:has-text("Settings")').click();
    } else {
      await page.goto('/settings');
    }
    await page.locator('input[name="gemini_api_key"], #gemini_api_key').fill('my-valid-key');
    await page.locator('button:has-text("Save")').click();

    // 7. Return to card and click Analyze Fit again
    if (await page.locator('button:has-text("Kanban")').count() > 0) {
      await page.locator('button:has-text("Kanban")').click();
    } else {
      await page.goto('/');
    }
    await page.locator('.bauhaus-card', { hasText: 'React Developer' }).click();
    await page.locator('button:has-text("Analyze Fit")').click();

    // 8. Verify it succeeds and displays the score
    await expect(page.locator('.match-score, text=90%')).toBeVisible();
  });

  // T3-06: F3 (Chrome Extension API) x F5 (Kanban UI) - Real-time Scraped Card Insertion
  test('T3-06: Background POST requests from Chrome Extension trigger reactive additions to the Kanban board', async ({ page }) => {
    // 1. Open Kanban board
    await page.goto('/');

    const interestedCol = page.locator('div', { has: page.locator('h2', { hasText: 'Interested' }) }).locator('.flex-1');
    
    // Count initial cards in Interested
    const initialCount = await interestedCol.locator('.bauhaus-card').count();

    // 2. Use page request to post extension scrape payload
    const payload = {
      title: 'Backend Engineer',
      company: 'Apple',
      location: 'Taipei',
      salary: '100k',
      url: 'https://www.cakeresume.com/jobs/apple-backend',
      description: 'Need Node.js developer',
      source: 'CakeResume'
    };

    // Make sure CakeResume is enabled in settings
    dbHelper.seedSettings({
      target_platforms: ['104', 'CakeResume']
    });

    const response = await page.request.post('/api/scrape/extension', { data: payload });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);

    // 3. Assert card count increments by 1 without manual page refresh
    await expect(interestedCol.locator('.bauhaus-card')).toHaveCount(initialCount + 1);

    // 4. Assert new card has appeared
    await expect(interestedCol.locator('.bauhaus-card', { hasText: 'Backend Engineer' })).toBeVisible();
    await expect(interestedCol.locator('.bauhaus-card', { hasText: 'Apple' })).toBeVisible();
  });

  // T3-07: F4 (AI Fit Analysis) x F6 (Gemini Caching vs Rate Limit Pacing)
  test('T3-07: Cache hits bypass rate limiter; cache misses are paced strictly by Token Bucket rate limiter', async ({ page }) => {
    // 1. Seed active resume & Job 1
    dbHelper.seedResumes([{ id: 1, file_name: 'resume.pdf', raw_text: 'raw', parsed_json: {}, is_active: 1 }]);
    dbHelper.seedJobs([{ id: 1, title: 'Job 1', company: 'Company 1' }]);

    // 2. Trigger "Analyze Fit" for Job 1 to populate cache
    const firstRes = await page.request.post('/api/ai/analyze-job', { data: { jobId: 1, resumeId: 1 } });
    expect(firstRes.ok()).toBe(true);

    // 3. Trigger identical analysis 20 times in rapid succession
    const startTime = Date.now();
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(page.request.post('/api/ai/analyze-job', { data: { jobId: 1, resumeId: 1 } }));
    }
    const responses = await Promise.all(promises);
    for (const res of responses) {
      expect(res.ok()).toBe(true);
    }
    const duration = Date.now() - startTime;
    // Should be instant (cached)
    expect(duration).toBeLessThan(1000);

    // Verify mock server got exactly 1 request (the first cache-miss)
    let logsRes = await fetch('http://localhost:8089/__mock/logs');
    let logs = await logsRes.json();
    expect(logs.count).toBe(1);

    // 4. Seed 5 new unique jobs (Job 2 to Job 6) without analyses
    dbHelper.seedJobs([
      { id: 2, title: 'Job 2', company: 'Co 2' },
      { id: 3, title: 'Job 3', company: 'Co 3' },
      { id: 4, title: 'Job 4', company: 'Co 4' },
      { id: 5, title: 'Job 5', company: 'Co 5' },
      { id: 6, title: 'Job 6', company: 'Co 6' }
    ]);

    // 5. Trigger fit analysis for Job 2 through Job 6 simultaneously
    const triggerTime = Date.now();
    const promises2 = [];
    for (let id = 2; id <= 6; id++) {
      promises2.push(page.request.post('/api/ai/analyze-job', { data: { jobId: id, resumeId: 1 } }));
    }
    await Promise.all(promises2);
    const elapsed = Date.now() - triggerTime;

    // Verify rate limit pacing delay. Complying with 15 RPM (1 request per 4s).
    // 5 requests will require 4 intervals of 4 seconds = 16 seconds.
    expect(elapsed).toBeGreaterThanOrEqual(16000);

    // Check mock logs timestamps to ensure they are spaced >= 4 seconds apart
    logsRes = await fetch('http://localhost:8089/__mock/logs');
    logs = await logsRes.json();
    
    // Filter out Job 1 log
    const pacedLogs = logs.logs.filter(log => log.body && !JSON.stringify(log.body).includes('Job 1'));
    expect(pacedLogs.length).toBe(5);

    for (let i = 1; i < pacedLogs.length; i++) {
      const diff = new Date(pacedLogs[i].timestamp) - new Date(pacedLogs[i - 1].timestamp);
      expect(diff).toBeGreaterThanOrEqual(3500); // 4000ms with a small network/CPU latency tolerance
    }
  });

});
