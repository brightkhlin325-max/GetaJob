const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');
const path = require('path');

test.describe('F1: Resume Import & Management', () => {
  let dbHelper;

  test.beforeEach(async () => {
    dbHelper = new DbHelper();
    dbHelper.clearDatabase();
  });

  test.afterEach(async () => {
    dbHelper.close();
  });

  test('Upload Valid Resume PDF', async ({ page }) => {
    await page.goto('/resumes');

    // Handle file upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../../fixtures/resumes/resume_john_react.pdf'));

    // Wait for the parsing and UI update
    const resumeCard = page.locator('[data-testid="resume-card"]').first();
    await expect(resumeCard).toBeVisible({ timeout: 10000 });
    
    // Assert extracted/parsed fields appear in the UI
    await expect(resumeCard.locator('[data-testid="resume-name"]')).toHaveText('John Doe');
    await expect(resumeCard.locator('[data-testid="resume-email"]')).toHaveText('john@example.com');
    await expect(resumeCard.locator('[data-testid="resume-skills"]')).toContainText('React');
  });

  test('Toggle Active Resume', async ({ page }) => {
    // Seed two resumes: A (active) and B (inactive)
    dbHelper.seedResumes([
      {
        id: 1,
        file_name: 'resume_john_react.pdf',
        raw_text: 'John Doe React Developer',
        parsed_json: {
          name: 'John Doe',
          contact: { email: 'john@example.com' },
          skills: ['React', 'TypeScript']
        },
        is_active: 1
      },
      {
        id: 2,
        file_name: 'resume_sarah_python.pdf',
        raw_text: 'Sarah Python Django Developer',
        parsed_json: {
          name: 'Sarah Python',
          contact: { email: 'sarah@example.com' },
          skills: ['Python', 'Django']
        },
        is_active: 0
      }
    ]);

    await page.goto('/resumes');

    // Confirm initial active state in UI
    const cardA = page.locator('[data-testid="resume-card"]').filter({ hasText: 'John Doe' });
    const cardB = page.locator('[data-testid="resume-card"]').filter({ hasText: 'Sarah Python' });
    await expect(cardA.locator('[data-testid="active-badge"]')).toBeVisible();
    await expect(cardB.locator('[data-testid="active-badge"]')).toBeHidden();

    // Click "Set Active" on Resume B
    await cardB.locator('[data-testid="btn-toggle-active"]').click();

    // Confirm UI toggled active states
    await expect(cardB.locator('[data-testid="active-badge"]')).toBeVisible();
    await expect(cardA.locator('[data-testid="active-badge"]')).toBeHidden();

    // Verify DB state
    const resumes = dbHelper.db.prepare('SELECT id, is_active FROM resumes ORDER BY id').all();
    expect(resumes[0].is_active).toBe(0); // John Doe inactive
    expect(resumes[1].is_active).toBe(1); // Sarah Python active
  });

  test('Delete Resume', async ({ page }) => {
    dbHelper.seedResumes([
      {
        id: 1,
        file_name: 'resume_john_react.pdf',
        raw_text: 'John Doe React Developer',
        parsed_json: {
          name: 'John Doe',
          contact: { email: 'john@example.com' },
          skills: ['React']
        },
        is_active: 1
      }
    ]);

    await page.goto('/resumes');

    const card = page.locator('[data-testid="resume-card"]').first();
    await expect(card).toBeVisible();

    // Handle delete confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('delete');
      await dialog.accept();
    });

    // Click Delete button
    await card.locator('[data-testid="btn-delete-resume"]').click();

    // Assert card is removed from UI
    await expect(card).toBeHidden();

    // Assert deleted in SQLite DB
    const count = dbHelper.db.prepare('SELECT COUNT(*) as count FROM resumes').get().count;
    expect(count).toBe(0);
  });

  test('List Multiple Resumes', async ({ page }) => {
    dbHelper.seedResumes([
      {
        id: 1,
        file_name: 'resume_john_react.pdf',
        raw_text: 'John Doe React Developer',
        parsed_json: { name: 'John Doe', contact: { email: 'john@example.com' }, skills: ['React'] },
        is_active: 1
      },
      {
        id: 2,
        file_name: 'resume_sarah_python.pdf',
        raw_text: 'Sarah Python Django Developer',
        parsed_json: { name: 'Sarah Python', contact: { email: 'sarah@example.com' }, skills: ['Python'] },
        is_active: 0
      }
    ]);

    await page.goto('/resumes');

    const cards = page.locator('[data-testid="resume-card"]');
    await expect(cards).toHaveCount(2);

    await expect(cards.nth(0).locator('[data-testid="resume-name"]')).toHaveText('John Doe');
    await expect(cards.nth(1).locator('[data-testid="resume-name"]')).toHaveText('Sarah Python');
  });

  test('Edit Structured Fields', async ({ page }) => {
    dbHelper.seedResumes([
      {
        id: 1,
        file_name: 'resume_john_react.pdf',
        raw_text: 'John Doe React Developer',
        parsed_json: {
          name: 'John Doe',
          contact: { email: 'john@example.com' },
          skills: ['React']
        },
        is_active: 1
      }
    ]);

    await page.goto('/resumes');

    const card = page.locator('[data-testid="resume-card"]').first();
    
    // Click "Edit"
    await card.locator('[data-testid="btn-edit-resume"]').click();

    // Modify fields in form/inputs
    await card.locator('[data-testid="input-resume-name"]').fill('Johnathan Doe');
    await card.locator('[data-testid="input-resume-email"]').fill('johnathan@example.com');
    await card.locator('[data-testid="input-resume-skills"]').fill('React, TypeScript, Next.js');

    // Click "Save"
    await card.locator('[data-testid="btn-save-resume"]').click();

    // Verify changes in UI
    await expect(card.locator('[data-testid="resume-name"]')).toHaveText('Johnathan Doe');
    await expect(card.locator('[data-testid="resume-email"]')).toHaveText('johnathan@example.com');
    await expect(card.locator('[data-testid="resume-skills"]')).toContainText('Next.js');

    // Verify DB update
    const dbRow = dbHelper.db.prepare('SELECT parsed_json FROM resumes WHERE id = 1').get();
    const parsed = JSON.parse(dbRow.parsed_json);
    expect(parsed.name).toBe('Johnathan Doe');
    expect(parsed.contact.email).toBe('johnathan@example.com');
    expect(parsed.skills).toContain('Next.js');
  });
});
