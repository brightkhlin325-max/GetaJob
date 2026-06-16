/**
 * Kanban Boundary & Corner Case Tests (F5)
 * File: tests/e2e/tier2_boundary_corner/kanban_boundary.spec.js
 */
const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');

test.describe('F5: Bauhaus Kanban Board & UI Boundary Cases', () => {
  let dbHelper;

  test.beforeAll(async () => {
    dbHelper = new DbHelper();
  });

  test.beforeEach(async () => {
    dbHelper.clearDatabase();
  });

  test.afterAll(async () => {
    dbHelper.close();
  });

  test('F5-T2-01: Optimistic update rollback on PUT API failure', async ({ page }) => {
    // Seed a single job
    dbHelper.seedJobs([{
      id: 1,
      title: 'React Developer',
      company: 'Tech Corp',
      status: 'Interested',
      url: 'https://example.com/1'
    }]);

    await page.goto('/');

    // Intercept PUT /api/jobs and force it to fail (HTTP 500)
    await page.route('**/api/jobs', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Database error' })
        });
      } else {
        await route.continue();
      }
    });

    const card = page.locator('text=React Developer');
    const interestedColumn = page.locator('[data-column-id="Interested"], .flex-col:has-text("Interested")');
    const appliedColumn = page.locator('[data-column-id="Applied"], .flex-col:has-text("Applied")');

    // Drag card to Applied
    await card.dragTo(appliedColumn);

    // Verify error toast displays
    await expect(page.locator('text=Failed to update job status')).toBeVisible();

    // Verify card is reverted back to Interested column
    await expect(interestedColumn.locator('text=React Developer')).toBeVisible();
    await expect(appliedColumn.locator('text=React Developer')).not.toBeVisible();
  });

  test('F5-T2-02: Rapid card drags race condition resolution', async ({ page }) => {
    dbHelper.seedJobs([{
      id: 1,
      title: 'React Developer',
      company: 'Tech Corp',
      status: 'Interested',
      url: 'https://example.com/1'
    }]);

    await page.goto('/');

    const card = page.locator('text=React Developer');
    const appliedColumn = page.locator('[data-column-id="Applied"], .flex-col:has-text("Applied")');
    const interviewingColumn = page.locator('[data-column-id="Interviewing"], .flex-col:has-text("Interviewing")');

    // Drag rapidly: Interested -> Applied -> Interviewing
    await card.dragTo(appliedColumn);
    await card.dragTo(interviewingColumn);

    // Wait for requests to settle
    await page.waitForTimeout(1000);

    // Verify card settles in the final column
    await expect(interviewingColumn.locator('text=React Developer')).toBeVisible();

    // Verify database matches final card position
    const job = dbHelper.db.prepare('SELECT status FROM jobs WHERE id = 1').get();
    expect(job.status).toBe('Interviewing');
  });

  test('F5-T2-03: Extreme text overflow safety', async ({ page }) => {
    const longTitle = 'ReactDeveloperSuperCalifragiListicExpialiDociousTitleThatNeverEndsAndHasNoSpacesToBreakProperly';
    dbHelper.seedJobs([{
      id: 1,
      title: longTitle,
      company: 'Tech Corp',
      status: 'Interested',
      url: 'https://example.com/1'
    }]);

    await page.goto('/');

    const card = page.locator(`text=${longTitle}`);
    await expect(card).toBeVisible();

    // Verify card width does not blow out column width
    const cardBox = await card.boundingBox();
    const column = page.locator('[data-column-id="Interested"], .flex-col:has-text("Interested")');
    const columnBox = await column.boundingBox();

    // Ensure layout is clean (card width matches or is smaller than the column container)
    expect(cardBox.width).toBeLessThan(columnBox.width + 10);
  });

  test('F5-T2-04: Empty Kanban board columns state', async ({ page }) => {
    // Navigate with no jobs in database
    await page.goto('/');

    // Check for placeholders in columns
    const emptyPlaceholders = page.locator('text=Empty column, text=No jobs in this column');
    const count = await emptyPlaceholders.count();
    expect(count).toBeGreaterThan(0);
  });

  test('F5-T2-05: Platform filter enforcement (disabled platform jobs hidden)', async ({ page }) => {
    // Disable Indeed in settings
    dbHelper.seedSettings({
      gemini_api_key: 'mock-key',
      target_region: 'Taiwan',
      target_platforms: ['104', 'CakeResume'] // Indeed disabled
    });

    dbHelper.seedJobs([
      {
        id: 1,
        title: 'Indeed Job Listing',
        company: 'Indeed Company',
        status: 'Interested',
        url: 'https://www.indeed.com/job/1',
        source: 'Indeed'
      },
      {
        id: 2,
        title: '104 Job Listing',
        company: '104 Company',
        status: 'Interested',
        url: 'https://www.104.com.tw/job/2',
        source: '104'
      }
    ]);

    await page.goto('/');

    // Assert 104 job is visible, Indeed job is hidden
    await expect(page.locator('text=104 Job Listing')).toBeVisible();
    await expect(page.locator('text=Indeed Job Listing')).not.toBeVisible();
  });
});
