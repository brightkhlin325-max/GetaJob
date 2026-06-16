/**
 * Resumes Boundary & Corner Case Tests (F1)
 * File: tests/e2e/tier2_boundary_corner/resumes_boundary.spec.js
 */
const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');
const path = require('path');
const fs = require('fs');

test.describe('F1: Resume Import & Management Boundary Cases', () => {
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

  test('F1-T2-1: Upload Non-PDF Format', async ({ page }) => {
    await page.goto('/');
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    // Look for file input or upload zone
    const uploadInput = page.locator('input[type="file"], #resume-upload-zone');
    
    const isFileInput = await uploadInput.evaluate(el => el.tagName === 'INPUT');
    const invalidFilePath = path.join(__dirname, '../../fixtures/resumes/invalid_format.docx');
    
    if (isFileInput) {
      await uploadInput.setInputFiles(invalidFilePath);
    } else {
      await uploadInput.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(invalidFilePath);
    }

    // Assert UI warning is displayed
    const warning = page.locator('text=Only PDF files are supported');
    await expect(warning).toBeVisible();

    // Verify DB remains empty
    const resumes = dbHelper.db.prepare('SELECT * FROM resumes').all();
    expect(resumes.length).toBe(0);
  });

  test('F1-T2-2: Upload Password-Protected PDF', async ({ page }) => {
    await page.goto('/');

    const fileChooserPromise = page.waitForEvent('filechooser');
    const uploadInput = page.locator('input[type="file"], #resume-upload-zone');
    
    // Create an encrypted mock PDF if not present
    const encryptedPath = path.join(__dirname, '../../fixtures/resumes/encrypted.pdf');
    if (!fs.existsSync(encryptedPath)) {
      fs.writeFileSync(encryptedPath, '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Encrypt 2 0 R >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    }

    const isFileInput = await uploadInput.evaluate(el => el.tagName === 'INPUT');
    if (isFileInput) {
      await uploadInput.setInputFiles(encryptedPath);
    } else {
      await uploadInput.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(encryptedPath);
    }

    // Server-side parser fails, UI shows warning
    await expect(page.locator('text=Failed to parse password-protected PDF')).toBeVisible();

    // Verify database remains empty
    const resumes = dbHelper.db.prepare('SELECT * FROM resumes').all();
    expect(resumes.length).toBe(0);

    // Clean up mock file
    try {
      fs.unlinkSync(encryptedPath);
    } catch (e) {}
  });

  test('F1-T2-3: Upload Scanned/Empty PDF', async ({ page }) => {
    await page.goto('/');

    const fileChooserPromise = page.waitForEvent('filechooser');
    const uploadInput = page.locator('input[type="file"], #resume-upload-zone');
    
    // Create scanned/empty mock PDF if not present
    const emptyPdfPath = path.join(__dirname, '../../fixtures/resumes/scanned_empty.pdf');
    if (!fs.existsSync(emptyPdfPath)) {
      fs.writeFileSync(emptyPdfPath, '%PDF-1.4\n%âãÏÓ\n%%EOF');
    }

    const isFileInput = await uploadInput.evaluate(el => el.tagName === 'INPUT');
    if (isFileInput) {
      await uploadInput.setInputFiles(emptyPdfPath);
    } else {
      await uploadInput.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(emptyPdfPath);
    }

    // Text extraction returns empty; UI alerts user and prompts for manual entry
    await expect(page.locator('text=No readable text was found')).toBeVisible();
    await expect(page.locator('text=Please enter details manually')).toBeVisible();

    // Verify DB remains empty of empty text resumes
    const resumes = dbHelper.db.prepare('SELECT * FROM resumes').all();
    expect(resumes.length).toBe(0);

    // Clean up mock file
    try {
      fs.unlinkSync(emptyPdfPath);
    } catch (e) {}
  });

  test('F1-T2-4: Gemini Parser API Failure', async ({ page }) => {
    // Force server 503 error on mock
    await page.request.post('http://localhost:8089/__mock/config', {
      data: { forceServerError: true }
    });

    await page.goto('/');

    const fileChooserPromise = page.waitForEvent('filechooser');
    const uploadInput = page.locator('input[type="file"], #resume-upload-zone');
    const validPdfPath = path.join(__dirname, '../../fixtures/resumes/resume_john_react.pdf');

    const isFileInput = await uploadInput.evaluate(el => el.tagName === 'INPUT');
    if (isFileInput) {
      await uploadInput.setInputFiles(validPdfPath);
    } else {
      await uploadInput.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(validPdfPath);
    }

    // System saves raw text, displays warning "AI parser unavailable", enables manual editing
    await expect(page.locator('text=AI parser unavailable. Please edit fields manually.')).toBeVisible();

    // Verify raw text was saved to database
    const resumes = dbHelper.db.prepare('SELECT * FROM resumes').all();
    expect(resumes.length).toBeGreaterThan(0);
    expect(resumes[0].raw_text).toContain('John Doe');

    // UI shows manual edit fields
    await expect(page.locator('#manual-resume-editor, .resume-manual-edit')).toBeVisible();

    // Reset mock server state
    await page.request.post('http://localhost:8089/__mock/reset');
  });

  test('F1-T2-5: Upload Large File (Boundary)', async ({ page }) => {
    await page.goto('/');

    const fileChooserPromise = page.waitForEvent('filechooser');
    const uploadInput = page.locator('input[type="file"], #resume-upload-zone');
    
    // Create an 11MB file to exceed the 10MB limit
    const largePath = path.join(__dirname, '../../fixtures/resumes/large_resume.pdf');
    if (!fs.existsSync(largePath)) {
      const buffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      fs.writeFileSync(largePath, buffer);
    }

    const isFileInput = await uploadInput.evaluate(el => el.tagName === 'INPUT');
    if (isFileInput) {
      await uploadInput.setInputFiles(largePath);
    } else {
      await uploadInput.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(largePath);
    }

    // Upload is blocked; UI displays "File size exceeds 10MB limit"
    await expect(page.locator('text=File size exceeds 10MB limit')).toBeVisible();

    // Verify database remains empty
    const resumes = dbHelper.db.prepare('SELECT * FROM resumes').all();
    expect(resumes.length).toBe(0);

    // Clean up large file
    try {
      fs.unlinkSync(largePath);
    } catch (e) {}
  });
});
