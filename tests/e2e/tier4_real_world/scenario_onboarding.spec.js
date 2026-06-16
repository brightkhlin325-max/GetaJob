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

test('T4-01: End-to-End Onboarding & First Job Application', async ({ page }) => {
  // 1. Launch & Initialization - user visits dashboard, gets redirected to onboarding/settings
  await page.goto('/');
  await expect(page).toHaveURL(/.*settings|.*onboarding/);

  // 2. Settings Configuration - fill and save
  await page.locator('input[name="gemini_api_key"], #gemini_api_key').fill('mock-gemini-key-xyz');
  
  const regionSelector = page.locator('select[name="target_region"], #target_region');
  if (await regionSelector.count() > 0) {
    await regionSelector.selectOption('Taiwan');
  }

  // Check platforms
  const chk104 = page.locator('input[type="checkbox"][value="104"]');
  if (await chk104.count() > 0) {
    await chk104.check();
  }
  const chkCake = page.locator('input[type="checkbox"][value="CakeResume"]');
  if (await chkCake.count() > 0) {
    await chkCake.check();
  }

  await page.locator('button:has-text("Save Changes"), button:has-text("Save")').click();

  // 3. Resume Management - upload and set active
  if (await page.locator('button:has-text("Resumes"), #nav-resumes').count() > 0) {
    await page.locator('button:has-text("Resumes"), #nav-resumes').click();
  } else {
    await page.goto('/resumes');
  }

  // Upload file
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/resumes/resume_john_react.pdf');
  
  // Wait for parsing
  await expect(page.locator('text=John Doe, .resume-name, text=parsed')).toBeVisible();

  // Toggle active
  const activeBtn = page.locator('button:has-text("Set Active")');
  if (await activeBtn.count() > 0) {
    await activeBtn.click();
  }

  // 4. Job Clipping - simulate extension clipping via API
  const jobPayload = require('../../fixtures/scraped_jobs/104_job.json');
  const scrapeResponse = await page.request.post('/api/scrape/extension', { data: jobPayload });
  expect(scrapeResponse.status()).toBe(201);
  const scrapeBody = await scrapeResponse.json();
  expect(scrapeBody.success).toBe(true);
  const jobId = scrapeBody.jobId;

  // 5. Kanban Update - open board, assert card exists
  if (await page.locator('button:has-text("Kanban"), #nav-kanban').count() > 0) {
    await page.locator('button:has-text("Kanban"), #nav-kanban').click();
  } else {
    await page.goto('/');
  }

  const cardLocator = page.locator('.bauhaus-card', { hasText: 'Frontend Engineer (React)' });
  await expect(cardLocator).toBeVisible();
  await expect(page.locator('.bauhaus-card', { hasText: 'Bauhaus Innovations' })).toBeVisible();

  // 6. Fit Analysis - click card, trigger analysis
  await cardLocator.click();
  await page.locator('button:has-text("Analyze Fit"), #btn-analyze-fit').click();

  // Assert fit analysis finishes and shows score
  await expect(page.locator('.match-score, text=90%')).toBeVisible();
  await expect(page.locator('text=advantages, text=gaps, text=Proficient')).toBeVisible();

  // 7. Cover Letter Generation - click and generate
  await page.locator('button:has-text("Cover Letter"), #tab-cover-letter').click();
  await page.locator('button:has-text("Generate Cover Letter"), #btn-gen-letter').click();

  const editor = page.locator('textarea, .markdown-editor, [contenteditable="true"]');
  await expect(editor).toHaveValue(/Dear Hiring Manager/);

  // 8. Modification & Extraction - edit, save, copy
  const updatedLetterText = '# Cover Letter\n\nDear Hiring Manager,\n\nI have React experience...\n\nBest, John Doe';
  await editor.fill(updatedLetterText);
  await page.locator('button:has-text("Save Changes"), button:has-text("Save")').click();

  // Copy to clipboard
  const copyBtn = page.locator('button:has-text("Copy"), button:has-text("Copy to Clipboard")');
  if (await copyBtn.count() > 0) {
    await copyBtn.click();
    // In playwright, we can read clipboard text if permissions are configured, but let's check it doesn't throw.
  }

  // Close modal
  const closeBtn = page.locator('button:has-text("Close"), .modal-close, button:has-text("×")');
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  // 9. Kanban Progression - drag to Applied
  const interestedCol = page.locator('div', { has: page.locator('h2', { hasText: 'Interested' }) }).locator('.flex-1');
  const appliedCol = page.locator('div', { has: page.locator('h2', { hasText: 'Applied' }) }).locator('.flex-1');
  
  await cardLocator.dragTo(appliedCol);
  await expect(appliedCol.locator('.bauhaus-card', { hasText: 'Frontend Engineer (React)' })).toBeVisible();

  // 10. Assert DB State
  const dbSettings = dbHelper.db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
  expect(dbSettings.value).toBe('mock-gemini-key-xyz');

  const activeResume = dbHelper.db.prepare('SELECT count(*) as count FROM resumes WHERE is_active = 1').get();
  expect(activeResume.count).toBe(1);

  const job = dbHelper.db.prepare('SELECT status FROM jobs WHERE id = ?').get(jobId);
  expect(job.status).toBe('Applied');

  const analysis = dbHelper.db.prepare('SELECT cover_letter FROM job_analyses WHERE job_id = ?').get(jobId);
  expect(analysis.cover_letter).toContain('Best, John Doe');
});
