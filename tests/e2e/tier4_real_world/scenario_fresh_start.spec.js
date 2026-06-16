const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DbHelper = require('../../helpers/db-helper');
const { startServer, stopServer } = require('../../helpers/gemini-mock');

const DB_DIR = path.join(os.homedir(), '.getajob');
const TEST_DB_PATH = path.join(DB_DIR, 'getajob_test.db');

let dbHelper;
let mockServer;

test.beforeAll(async () => {
  // Do not instantiate dbHelper immediately because we want to delete the file first
  mockServer = await startServer(8089);
});

test.afterAll(async () => {
  if (dbHelper) {
    dbHelper.close();
  }
  await stopServer();
});

test('T4-05: Clean State Recovery, DB Auto-Init & Script Launch', async ({ page }) => {
  // 1. Database Purge: Delete the test database file
  // Close helper connection first if active
  if (dbHelper) {
    dbHelper.close();
    dbHelper = null;
  }

  // Attempt to delete the database file
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  } catch (err) {
    console.warn('Failed to delete database file (likely locked by running server). Clearing tables instead.', err);
    // Fallback: Clear tables instead if file is locked
    dbHelper = new DbHelper();
    dbHelper.clearDatabase();
    dbHelper.close();
    dbHelper = null;
  }

  // 2. Start page and trigger DB Auto-creation
  await page.goto('/');

  // 3. Onboarding Validation - Redirected to settings/onboarding due to empty settings
  await expect(page).toHaveURL(/.*settings|.*onboarding/);

  // Re-instantiate dbHelper to verify schema is initialized
  dbHelper = new DbHelper();
  const tables = dbHelper.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  expect(tables).toContain('settings');
  expect(tables).toContain('resumes');
  expect(tables).toContain('jobs');
  expect(tables).toContain('job_analyses');

  // 4. Setup Execution - configure key and upload resume to get to dashboard
  await page.locator('input[name="gemini_api_key"], #gemini_api_key').fill('mock-fresh-key');
  await page.locator('button:has-text("Save Changes"), button:has-text("Save")').click();

  // Go to Resumes page and upload
  if (await page.locator('button:has-text("Resumes"), #nav-resumes').count() > 0) {
    await page.locator('button:has-text("Resumes"), #nav-resumes').click();
  } else {
    await page.goto('/resumes');
  }
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/resumes/resume_john_react.pdf');
  await expect(page.locator('text=John Doe, .resume-name, text=parsed')).toBeVisible();

  // Set active
  const activeBtn = page.locator('button:has-text("Set Active")');
  if (await activeBtn.count() > 0) {
    await activeBtn.click();
  }

  // Go to Kanban board - should show empty board (not redirect to onboarding anymore)
  if (await page.locator('button:has-text("Kanban"), #nav-kanban').count() > 0) {
    await page.locator('button:has-text("Kanban"), #nav-kanban').click();
  } else {
    await page.goto('/');
  }

  await expect(page).toHaveURL(/\/$/); // URL is exactly the root path now
  await expect(page.locator('text=Empty column, text=Interested')).toBeVisible();

  // 5. Script Verification: If start.bat exists (Milestone 7), check its content
  const startBatPath = path.join(__dirname, '../../../../start.bat');
  if (fs.existsSync(startBatPath)) {
    const content = fs.readFileSync(startBatPath, 'utf8');
    expect(content).toContain('getajob');
  }
});
