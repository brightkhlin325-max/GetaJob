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

test('T4-03: System Resilience & Graceful Degradation under Gemini Outage', async ({ page }) => {
  // 1. Seed Gemini key, active resume, and two jobs
  dbHelper.seedSettings({
    gemini_api_key: 'mock-key'
  });

  dbHelper.seedResumes([
    { id: 1, file_name: 'resume.pdf', raw_text: 'React Specialist', parsed_json: { skills: ['React'] }, is_active: 1 }
  ]);

  dbHelper.seedJobs([
    { id: 1, title: 'React Developer', company: 'Company A', status: 'Interested' },
    { id: 2, title: 'Vue Developer', company: 'Company B', status: 'Interested' }
  ]);

  // 2. Go to Kanban Board
  await page.goto('/');

  // --- PART 1: Transient 429 Outage and Recovery ---
  
  // Configure mock server to return 429
  await fetch('http://localhost:8089/__mock/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceRateLimit: true })
  });

  // Open Job 1 and click Analyze Fit
  const card1 = page.locator('.bauhaus-card', { hasText: 'React Developer' });
  await card1.click();
  await page.locator('button:has-text("Analyze Fit"), #btn-analyze-fit').click();

  // Poll mock logs until logs.count > 0 to ensure mock received the request
  let logged = false;
  for (let i = 0; i < 50; i++) {
    try {
      const logsRes = await fetch('http://localhost:8089/__mock/logs');
      const logs = await logsRes.json();
      if (logs.count > 0) {
        logged = true;
        break;
      }
    } catch (err) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await fetch('http://localhost:8089/__mock/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceRateLimit: false })
  });

  // Assert that analysis eventually succeeds
  await expect(page.locator('.match-score, text=90%')).toBeVisible();

  // Close modal
  let closeBtn = page.locator('button:has-text("Close"), .modal-close, button:has-text("×")');
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  // --- PART 2: Fatal 503 Outage and Graceful Degradation ---

  // Configure mock server to return 503
  await fetch('http://localhost:8089/__mock/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceServerError: true })
  });

  // Open Job 2 and click Analyze Fit
  const card2 = page.locator('.bauhaus-card', { hasText: 'Vue Developer' });
  await card2.click();
  await page.locator('button:has-text("Analyze Fit"), #btn-analyze-fit').click();

  // Verify that the UI displays a warning/error toast indicating overload and retry failure
  await expect(page.locator('#toast-alert, .toast-error, [role="alert"], text=overloaded, text=unavailable, text=error')).toBeVisible();

  // Close modal
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  // Assert card is still in the Interested column (no crash or layout freeze)
  const interestedCol = page.locator('div', { has: page.locator('h2', { hasText: 'Interested' }) }).locator('.flex-1');
  await expect(interestedCol.locator('.bauhaus-card', { hasText: 'Vue Developer' })).toBeVisible();

  // Drag Job 2 to Applied to ensure board is still fully interactive
  const appliedCol = page.locator('div', { has: page.locator('h2', { hasText: 'Applied' }) }).locator('.flex-1');
  await card2.dragTo(appliedCol);
  await expect(appliedCol.locator('.bauhaus-card', { hasText: 'Vue Developer' })).toBeVisible();
});
