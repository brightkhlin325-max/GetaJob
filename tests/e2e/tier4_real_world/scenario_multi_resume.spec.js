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

test('T4-02: Multi-Resume Job Alignment (A/B Testing Resumes)', async ({ page }) => {
  // 1. Seed Gemini key
  dbHelper.seedSettings({
    gemini_api_key: 'mock-key'
  });

  // 2. Seed both Frontend and Backend resumes
  dbHelper.seedResumes([
    { id: 1, file_name: 'resume_frontend.pdf', raw_text: 'React Specialist', parsed_json: { skills: ['React'] }, is_active: 1 },
    { id: 2, file_name: 'resume_backend.pdf', raw_text: 'Python Specialist', parsed_json: { skills: ['Python'] }, is_active: 0 }
  ]);

  // 3. Seed two jobs: Frontend (Job 1) and Backend (Job 2)
  dbHelper.seedJobs([
    { id: 1, title: 'React Developer', company: 'Company A', description: 'Looking for a React Developer with TypeScript.', status: 'Interested' },
    { id: 2, title: 'Django Developer', company: 'Company B', description: 'Looking for a Django Developer with Python expertise.', status: 'Interested' }
  ]);

  // 4. Open dashboard and run fit analysis for both jobs under Frontend Resume (active)
  await page.goto('/');

  // Job 1 (React Developer) - should have high match score (92%)
  const card1 = page.locator('.bauhaus-card', { hasText: 'React Developer' });
  await card1.click();
  await page.locator('button:has-text("Analyze Fit"), #btn-analyze-fit').click();
  await expect(page.locator('.match-score, text=92%')).toBeVisible();
  
  // Close Job 1 modal
  let closeBtn = page.locator('button:has-text("Close"), .modal-close, button:has-text("×")');
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  // Job 2 (Django Developer) - should have low match score (40%)
  const card2 = page.locator('.bauhaus-card', { hasText: 'Django Developer' });
  await card2.click();
  await page.locator('button:has-text("Analyze Fit"), #btn-analyze-fit').click();
  await expect(page.locator('.match-score, text=40%')).toBeVisible();

  // Close Job 2 modal
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  // 5. Navigate to Resume Manager and swap active resume to Backend
  if (await page.locator('button:has-text("Resumes"), #nav-resumes').count() > 0) {
    await page.locator('button:has-text("Resumes"), #nav-resumes').click();
  } else {
    await page.goto('/resumes');
  }

  // Click "Set Active" for the Backend resume
  const backendCard = page.locator('.resume-card', { hasText: 'resume_backend.pdf' });
  await backendCard.locator('button:has-text("Set Active")').click();
  // Ensure visual indication of active resume changes
  await expect(backendCard.locator('.active-badge, text=Active')).toBeVisible();

  // 6. Return to Kanban and analyze fit for both jobs under Backend Resume
  if (await page.locator('button:has-text("Kanban"), #nav-kanban').count() > 0) {
    await page.locator('button:has-text("Kanban"), #nav-kanban').click();
  } else {
    await page.goto('/');
  }

  // Job 1 (React Developer) - should now have low match score (45%)
  await card1.click();
  await page.locator('button:has-text("Analyze Fit"), #btn-analyze-fit').click();
  await expect(page.locator('.match-score, text=45%')).toBeVisible();

  // Close Job 1 modal
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  // Job 2 (Django Developer) - should now have high match score (88%)
  await card2.click();
  await page.locator('button:has-text("Analyze Fit"), #btn-analyze-fit').click();
  await expect(page.locator('.match-score, text=88%')).toBeVisible();

  // 7. Generate Cover Letter for Job 2 under Backend Resume
  await page.locator('button:has-text("Cover Letter"), #tab-cover-letter').click();
  await page.locator('button:has-text("Generate Cover Letter"), #btn-gen-letter').click();
  const editor = page.locator('textarea, .markdown-editor, [contenteditable="true"]');
  await expect(editor).toHaveValue(/Dear Hiring Manager/);
  
  // Save Cover Letter
  await page.locator('button:has-text("Save Changes"), button:has-text("Save")').click();

  // Close Job 2 modal
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  // Drag Job 2 (Django) to Applied
  const appliedCol = page.locator('div', { has: page.locator('h2', { hasText: 'Applied' }) }).locator('.flex-1');
  await card2.dragTo(appliedCol);

  // 8. Swap active resume back to Frontend
  if (await page.locator('button:has-text("Resumes"), #nav-resumes').count() > 0) {
    await page.locator('button:has-text("Resumes"), #nav-resumes').click();
  } else {
    await page.goto('/resumes');
  }
  const frontendCard = page.locator('.resume-card', { hasText: 'resume_frontend.pdf' });
  await frontendCard.locator('button:has-text("Set Active")').click();

  // 9. Verify cached analysis recovery instantly (Job 1 should load 92% instantly)
  if (await page.locator('button:has-text("Kanban"), #nav-kanban').count() > 0) {
    await page.locator('button:has-text("Kanban"), #nav-kanban').click();
  } else {
    await page.goto('/');
  }

  const logsResBefore = await fetch('http://localhost:8089/__mock/logs');
  const logsBefore = await logsResBefore.json();

  await card1.click();
  await page.locator('button:has-text("Analyze Fit"), #btn-analyze-fit').click();
  await expect(page.locator('.match-score, text=92%')).toBeVisible();

  // Close modal
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  const logsResAfter = await fetch('http://localhost:8089/__mock/logs');
  const logsAfter = await logsResAfter.json();
  // Confirm no API calls made (retrieved from cache)
  expect(logsAfter.count).toBe(logsBefore.count);

  // 10. Assert DB State: two active analyses for Job 1 and two for Job 2
  const analysesJob1 = dbHelper.db.prepare('SELECT count(*) as count FROM job_analyses WHERE job_id = 1').get();
  expect(analysesJob1.count).toBe(2);

  const analysesJob2 = dbHelper.db.prepare('SELECT count(*) as count FROM job_analyses WHERE job_id = 2').get();
  expect(analysesJob2.count).toBe(2);
});
