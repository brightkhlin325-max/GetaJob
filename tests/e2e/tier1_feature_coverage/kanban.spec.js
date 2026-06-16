const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');

test.describe('F5: Bauhaus Kanban Board & UI', () => {
  let dbHelper;

  test.beforeEach(async () => {
    dbHelper = new DbHelper();
    dbHelper.clearDatabase();
  });

  test.afterEach(async () => {
    dbHelper.close();
  });

  test('Kanban Columns Render', async ({ page }) => {
    await page.goto('/');

    const columns = ['Interested', 'Applied', 'Interviewing', 'Offered', 'Rejected'];
    for (const col of columns) {
      const column = page.locator(`[data-testid="column-${col}"]`);
      await expect(column).toBeVisible();
      await expect(column.locator('[data-testid="column-title"]')).toHaveText(col);
    }
  });

  test('Job Card Layout & Hover', async ({ page }) => {
    dbHelper.seedResumes([
      { id: 1, file_name: 'r.pdf', is_active: 1 }
    ]);
    dbHelper.seedJobs([
      {
        id: 10,
        title: 'Frontend Engineer',
        company: 'Bauhaus Design',
        location: 'New York',
        salary: '$100,000',
        url: 'http://example.com',
        description: 'React position',
        source: 'LinkedIn',
        status: 'Interested'
      }
    ]);
    dbHelper.seedJobAnalyses([
      {
        job_id: 10,
        resume_id: 1,
        match_score: 90,
        match_analysis: {},
        cover_letter: ''
      }
    ]);

    await page.goto('/');

    const card = page.locator('[data-testid="job-card"]').filter({ hasText: 'Frontend Engineer' });
    await expect(card).toBeVisible();
    await expect(card.locator('[data-testid="job-company"]')).toHaveText('Bauhaus Design');
    await expect(card.locator('[data-testid="job-location"]')).toHaveText('New York');
    await expect(card.locator('[data-testid="job-source"]')).toHaveText('LinkedIn');
    await expect(card.locator('[data-testid="job-score-badge"]')).toHaveText('90%');

    // Trigger hover on card and verify transform style
    const initialTransform = await card.evaluate(el => window.getComputedStyle(el).transform);
    await card.hover();
    // Wait for transiton
    await page.waitForTimeout(200);
    const hoverTransform = await card.evaluate(el => window.getComputedStyle(el).transform);
    
    // Bauhaus cards hover translates (-2px, -2px), changing CSS transform matrix
    expect(hoverTransform).not.toBe(initialTransform);
  });

  test('Optimistic Drag-and-Drop Success', async ({ page }) => {
    dbHelper.seedJobs([
      {
        id: 10,
        title: 'Frontend Engineer',
        company: 'Bauhaus Design',
        status: 'Interested'
      }
    ]);

    await page.goto('/');

    const card = page.locator('[data-testid="job-card"]').filter({ hasText: 'Frontend Engineer' });
    const targetColumn = page.locator('[data-testid="column-Applied"]');

    // Spy on the PUT request
    const putRequestPromise = page.waitForRequest(req => 
      req.url().includes('/api/jobs') && 
      req.method() === 'PUT'
    );

    // Perform Drag and Drop
    await card.dragTo(targetColumn);

    // Assert that the card moved instantly in UI (optimistic update)
    await expect(targetColumn.locator('[data-testid="job-card"]')).toContainText('Frontend Engineer');

    // Wait for the PUT request to be sent and verify its payload
    const putRequest = await putRequestPromise;
    const postData = JSON.parse(putRequest.postData());
    expect(postData.id).toBe(10);
    expect(postData.status).toBe('Applied');

    // Assert database is updated successfully
    const dbJob = dbHelper.db.prepare('SELECT status FROM jobs WHERE id = 10').get();
    expect(dbJob.status).toBe('Applied');
  });

  test('Board State Persistence', async ({ page }) => {
    dbHelper.seedJobs([
      {
        id: 10,
        title: 'Frontend Engineer',
        company: 'Bauhaus Design',
        status: 'Interested'
      }
    ]);

    await page.goto('/');

    const card = page.locator('[data-testid="job-card"]').filter({ hasText: 'Frontend Engineer' });
    const targetColumn = page.locator('[data-testid="column-Applied"]');

    // Drag from Interested to Applied
    await card.dragTo(targetColumn);
    await expect(targetColumn.locator('[data-testid="job-card"]')).toContainText('Frontend Engineer');

    // Reload the page
    await page.reload();

    // Verify card is still in Applied column
    await expect(page.locator('[data-testid="column-Applied"]').locator('[data-testid="job-card"]')).toContainText('Frontend Engineer');
    await expect(page.locator('[data-testid="column-Interested"]').locator('[data-testid="job-card"]').filter({ hasText: 'Frontend Engineer' })).toBeHidden();
  });

  test('Settings Panel Integration', async ({ page }) => {
    dbHelper.seedSettings({
      target_platforms: ['104', 'CakeResume'] // LinkedIn is disabled
    });
    dbHelper.seedJobs([
      { id: 10, title: 'Job 104', company: 'Corp A', source: '104', status: 'Interested' },
      { id: 11, title: 'Job LinkedIn', company: 'Corp B', source: 'LinkedIn', status: 'Interested' }
    ]);

    await page.goto('/');

    // Verify that Job 104 is visible, while Job LinkedIn is filtered out or flagged visually
    await expect(page.locator('[data-testid="job-card"]').filter({ hasText: 'Job 104' })).toBeVisible();
    
    // Per spec: "Indeed/LinkedIn job cards are filtered out or flagged visually"
    // Let's assert it is either hidden or marked with a data attribute for filtered out
    const linkedInCard = page.locator('[data-testid="job-card"]').filter({ hasText: 'Job LinkedIn' });
    const isVisible = await linkedInCard.isVisible();
    if (isVisible) {
      await expect(linkedInCard).toHaveAttribute('data-filtered', 'true');
    } else {
      await expect(linkedInCard).toBeHidden();
    }
  });
});
