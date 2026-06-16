const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');
const fs = require('fs');
const path = require('path');

test.describe('F2: Chrome Extension clipping & API', () => {
  let dbHelper;

  test.beforeEach(async () => {
    dbHelper = new DbHelper();
    dbHelper.clearDatabase();
  });

  test.afterEach(async () => {
    dbHelper.close();
  });

  test('Successful Job Clip POST', async ({ request }) => {
    const jobPayload = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../fixtures/scraped_jobs/104_job.json'), 'utf8')
    );

    const response = await request.post('/api/scrape/extension', {
      data: jobPayload,
      headers: {
        'Origin': 'chrome-extension://mock-extension-id'
      }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBeDefined();

    // Verify job exists in SQLite DB
    const dbJob = dbHelper.db.prepare('SELECT * FROM jobs WHERE id = ?').get(body.jobId);
    expect(dbJob.title).toBe('Frontend Engineer (React)');
    expect(dbJob.company).toBe('Bauhaus Innovations');
    expect(dbJob.status).toBe('Interested');
  });

  test('CORS Preflight OPTIONS', async ({ request }) => {
    const response = await request.options('/api/scrape/extension', {
      headers: {
        'Origin': 'chrome-extension://mock-extension-id',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });

    // OPTIONS preflight should return 200 or 204
    expect([200, 204]).toContain(response.status());

    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
    expect(headers['access-control-allow-methods']).toContain('POST');
    expect(headers['access-control-allow-headers']).toContain('content-type');
  });

  test('Job Visible in Kanban', async ({ page }) => {
    // Seed a job in "Interested" column
    dbHelper.seedJobs([
      {
        id: 10,
        title: 'Clipped Job Title',
        company: 'Clipped Corp',
        location: 'Taipei',
        salary: 'N/A',
        url: 'http://example.com/job',
        description: 'Scraped description',
        source: '104',
        status: 'Interested'
      }
    ]);

    await page.goto('/');

    // Verify the card is visible in the Interested column
    const column = page.locator('[data-testid="column-Interested"]');
    const card = column.locator('[data-testid="job-card"]').filter({ hasText: 'Clipped Job Title' });
    
    await expect(card).toBeVisible();
    await expect(card.locator('[data-testid="job-company"]')).toHaveText('Clipped Corp');
    await expect(card.locator('[data-testid="job-source"]')).toHaveText('104');
  });

  test('Mock Scraper on LinkedIn DOM', async ({ page }) => {
    // 1. Load a mock LinkedIn HTML DOM structure into Playwright browser page
    const mockLinkedInHTML = `
      <html>
        <body>
          <h1 class="jobs-unified-top-card__job-title">Senior React Developer</h1>
          <span class="jobs-unified-top-card__company-name">LinkedIn Tech Inc</span>
          <span class="jobs-unified-top-card__bullet">New York, NY (Hybrid)</span>
          <div class="jobs-description__content">
            <span id="job-details">We need a Senior React Developer with 5+ years experience.</span>
          </div>
        </body>
      </html>
    `;
    await page.setContent(mockLinkedInHTML);

    // 2. Evaluate the DOM extraction logic (representing extension's content scraper script)
    const scrapedJob = await page.evaluate(() => {
      const titleEl = document.querySelector('.jobs-unified-top-card__job-title');
      const companyEl = document.querySelector('.jobs-unified-top-card__company-name');
      const locationEl = document.querySelector('.jobs-unified-top-card__bullet');
      const descEl = document.querySelector('#job-details') || document.querySelector('.jobs-description__content');
      
      return {
        title: titleEl ? titleEl.textContent.trim() : '',
        company: companyEl ? companyEl.textContent.trim() : '',
        location: locationEl ? locationEl.textContent.trim() : '',
        description: descEl ? descEl.textContent.trim() : '',
        url: window.location.href,
        source: 'LinkedIn'
      };
    });

    // 3. Assert correct parsing of fields
    expect(scrapedJob.title).toBe('Senior React Developer');
    expect(scrapedJob.company).toBe('LinkedIn Tech Inc');
    expect(scrapedJob.location).toBe('New York, NY (Hybrid)');
    expect(scrapedJob.description).toContain('Senior React Developer');
    expect(scrapedJob.source).toBe('LinkedIn');
  });

  test('Create Job Record Manually', async ({ page }) => {
    await page.goto('/');

    // Click "Add Job Manually"
    await page.locator('[data-testid="btn-add-job-manual"]').click();

    // Verify modal is open
    const modal = page.locator('[data-testid="add-job-modal"]');
    await expect(modal).toBeVisible();

    // Fill in job form
    await modal.locator('[data-testid="input-job-title"]').fill('Manual Job Title');
    await modal.locator('[data-testid="input-job-company"]').fill('Manual Company Ltd');
    await modal.locator('[data-testid="input-job-location"]').fill('Remote');
    await modal.locator('[data-testid="input-job-salary"]').fill('NT$ 100,000');
    await modal.locator('[data-testid="input-job-url"]').fill('https://manualjob.com');
    await modal.locator('[data-testid="input-job-description"]').fill('Manual job description details');
    await modal.locator('[data-testid="select-job-status"]').selectOption('Interested');

    // Click Save
    await modal.locator('[data-testid="btn-save-job"]').click();

    // Verify card is added to "Interested" column
    const card = page.locator('[data-testid="column-Interested"]').locator('[data-testid="job-card"]').filter({ hasText: 'Manual Job Title' });
    await expect(card).toBeVisible();

    // Verify database record
    const dbJob = dbHelper.db.prepare('SELECT * FROM jobs WHERE title = ?').get('Manual Job Title');
    expect(dbJob).toBeDefined();
    expect(dbJob.company).toBe('Manual Company Ltd');
    expect(dbJob.location).toBe('Remote');
    expect(dbJob.status).toBe('Interested');
  });
});
