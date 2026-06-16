const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');

test.describe('F4: AI Fit Analysis & Cover Letter', () => {
  let dbHelper;

  test.beforeEach(async ({ context }) => {
    dbHelper = new DbHelper();
    dbHelper.clearDatabase();
    // Grant clipboard read/write permissions for testing Copy Cover Letter
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test.afterEach(async () => {
    dbHelper.close();
  });

  test('Fit Analysis Generation', async ({ page }) => {
    // Seed active resume, job card, and settings API key
    dbHelper.seedSettings({ gemini_api_key: 'AIzaSyTestKey' });
    dbHelper.seedResumes([
      {
        id: 1,
        file_name: 'resume_john_react.pdf',
        raw_text: 'John Doe React Developer',
        parsed_json: { name: 'John Doe', contact: { email: 'john@example.com' }, skills: ['React'] },
        is_active: 1
      }
    ]);
    dbHelper.seedJobs([
      {
        id: 10,
        title: 'React Developer',
        company: 'Bauhaus Tech',
        status: 'Interested'
      }
    ]);

    await page.goto('/');

    // Open job card modal
    const card = page.locator('[data-testid="job-card"]').filter({ hasText: 'React Developer' });
    await card.click();

    const modal = page.locator('[data-testid="analysis-modal"]');
    await expect(modal).toBeVisible();

    // Click "Analyze Fit"
    await modal.locator('[data-testid="btn-analyze-fit"]').click();

    // Wait for AI results to render
    await expect(modal.locator('[data-testid="match-score"]')).toHaveText('90%');
    await expect(modal.locator('[data-testid="match-advantages"]')).toContainText('Proficient in React');
    await expect(modal.locator('[data-testid="match-gaps"]')).toContainText('No backend node experience');

    // Verify record saved in SQLite job_analyses table
    const analysis = dbHelper.db.prepare('SELECT * FROM job_analyses WHERE job_id = 10 AND resume_id = 1').get();
    expect(analysis).toBeDefined();
    expect(analysis.match_score).toBe(90);
  });

  test('Cover Letter Generation', async ({ page }) => {
    dbHelper.seedSettings({ gemini_api_key: 'AIzaSyTestKey' });
    dbHelper.seedResumes([
      {
        id: 1,
        file_name: 'resume_john_react.pdf',
        raw_text: 'John Doe React Developer',
        parsed_json: { name: 'John Doe' },
        is_active: 1
      }
    ]);
    dbHelper.seedJobs([
      {
        id: 10,
        title: 'React Developer',
        company: 'Bauhaus Tech',
        status: 'Interested'
      }
    ]);
    // Seed the fit analysis since cover letter generation depends on it
    dbHelper.seedJobAnalyses([
      {
        id: 5,
        job_id: 10,
        resume_id: 1,
        match_score: 90,
        match_analysis: { advantages: ['React'], gaps: [] },
        cover_letter: null
      }
    ]);

    await page.goto('/');
    await page.locator('[data-testid="job-card"]').filter({ hasText: 'React Developer' }).click();

    const modal = page.locator('[data-testid="analysis-modal"]');
    await expect(modal).toBeVisible();

    // Click "Generate Cover Letter"
    await modal.locator('[data-testid="btn-generate-cover-letter"]').click();

    // Assert tailored cover letter is populated in Markdown editor/textbox
    const editor = modal.locator('[data-testid="cover-letter-editor"]');
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('Dear Hiring Manager');
    await expect(editor).toContainText('React experience');

    // Assert updated cover letter is saved in DB
    const dbRow = dbHelper.db.prepare('SELECT cover_letter FROM job_analyses WHERE id = 5').get();
    expect(dbRow.cover_letter).toContain('Dear Hiring Manager');
  });

  test('Cover Letter Editing & Save', async ({ page }) => {
    dbHelper.seedResumes([
      { id: 1, file_name: 'r.pdf', is_active: 1 }
    ]);
    dbHelper.seedJobs([
      { id: 10, title: 'React Developer', company: 'Bauhaus Tech' }
    ]);
    dbHelper.seedJobAnalyses([
      {
        id: 5,
        job_id: 10,
        resume_id: 1,
        match_score: 90,
        match_analysis: {},
        cover_letter: 'Original Cover Letter text'
      }
    ]);

    await page.goto('/');
    await page.locator('[data-testid="job-card"]').filter({ hasText: 'React Developer' }).click();

    const modal = page.locator('[data-testid="analysis-modal"]');
    const editor = modal.locator('[data-testid="cover-letter-editor"]');
    await expect(editor).toHaveValue('Original Cover Letter text');

    // Modify text in editor
    await editor.fill('Updated Cover Letter text by applicant');

    // Click "Save"
    await modal.locator('[data-testid="btn-save-cover-letter"]').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Assert update persisted in DB
    const dbRow = dbHelper.db.prepare('SELECT cover_letter FROM job_analyses WHERE id = 5').get();
    expect(dbRow.cover_letter).toBe('Updated Cover Letter text by applicant');
  });

  test('Copy Cover Letter', async ({ page }) => {
    dbHelper.seedResumes([
      { id: 1, file_name: 'r.pdf', is_active: 1 }
    ]);
    dbHelper.seedJobs([
      { id: 10, title: 'React Developer', company: 'Bauhaus Tech' }
    ]);
    dbHelper.seedJobAnalyses([
      {
        id: 5,
        job_id: 10,
        resume_id: 1,
        match_score: 90,
        match_analysis: {},
        cover_letter: 'This is the cover letter text to copy.'
      }
    ]);

    await page.goto('/');
    await page.locator('[data-testid="job-card"]').filter({ hasText: 'React Developer' }).click();

    const modal = page.locator('[data-testid="analysis-modal"]');
    
    // Click "Copy to Clipboard"
    await modal.locator('[data-testid="btn-copy-cover-letter"]').click();

    // Read clipboard value and assert it matches
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe('This is the cover letter text to copy.');
  });

  test('DB-Backed Caching', async ({ page, request }) => {
    dbHelper.seedSettings({ gemini_api_key: 'AIzaSyTestKey' });
    dbHelper.seedResumes([
      { id: 1, file_name: 'r.pdf', is_active: 1 }
    ]);
    dbHelper.seedJobs([
      { id: 10, title: 'React Developer', company: 'Bauhaus Tech' }
    ]);
    // Seed existing analysis
    dbHelper.seedJobAnalyses([
      {
        id: 5,
        job_id: 10,
        resume_id: 1,
        match_score: 95,
        match_analysis: { advantages: ['Cached Adv'], gaps: ['Cached Gaps'] },
        cover_letter: 'Cached Cover Letter'
      }
    ]);

    // Reset Gemini Mock request logs to ensure fresh count
    await request.post('http://localhost:8089/__mock/reset');

    await page.goto('/');
    await page.locator('[data-testid="job-card"]').filter({ hasText: 'React Developer' }).click();

    const modal = page.locator('[data-testid="analysis-modal"]');

    // Trigger analysis (should hit Cache)
    await modal.locator('[data-testid="btn-analyze-fit"]').click();

    // Verification: Match score should appear instantly
    await expect(modal.locator('[data-testid="match-score"]')).toHaveText('95%');

    // Verification: Request to Mock Gemini API should NOT have been made
    const response = await request.get('http://localhost:8089/__mock/logs');
    const body = await response.json();
    expect(body.count).toBe(0); // 0 calls to Gemini Mock API because it was served from DB cache!
  });
});
