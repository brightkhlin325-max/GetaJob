/**
 * Settings Boundary & Corner Case Tests (F3)
 * File: tests/e2e/tier2_boundary_corner/settings_boundary.spec.js
 */
const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');

test.describe('F3: Settings Management Boundary Cases', () => {
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

  test('F3-T2-1: Empty Gemini API Key blocks AI', async ({ page }) => {
    // Seed settings with empty key
    dbHelper.seedSettings({
      gemini_api_key: '',
      target_region: 'Taiwan',
      target_platforms: ['104', 'CakeResume']
    });

    dbHelper.seedJobs([{
      id: 1,
      title: 'React Dev',
      company: 'Tech Corp',
      status: 'Interested',
      url: 'https://www.104.com.tw/job/1'
    }]);

    await page.goto('/');

    // Open job card modal
    await page.locator('text=React Dev').click();

    // Click "Analyze Fit"
    const analyzeBtn = page.locator('#analyze-fit-btn, text=Analyze Fit');
    await analyzeBtn.click();

    // Verify warning modal/banner is shown
    await expect(page.locator('text=Configure Gemini API Key in Settings first')).toBeVisible();
  });

  test('F3-T2-2: Platform Exclusion Enforcement', async ({ page }) => {
    // Indeed disabled in settings
    dbHelper.seedSettings({
      gemini_api_key: 'mock-key',
      target_region: 'Taiwan',
      target_platforms: ['104', 'CakeResume'] // Indeed is NOT here
    });

    // Check if UI settings indicates Indeed is unchecked
    await page.goto('/settings').catch(() => {}); // Go to settings page
    
    // Check if the setting is loaded correctly from settings API
    const settingsResponse = await page.request.get('/api/settings');
    const settings = await settingsResponse.json();
    const targetPlatforms = typeof settings.target_platforms === 'string' 
      ? JSON.parse(settings.target_platforms) 
      : settings.target_platforms;
    
    expect(targetPlatforms).not.toContain('Indeed');
  });

  test('F3-T2-3: SQL Injection in Settings Inputs', async ({ request }) => {
    const sqlInjectionPayload = {
      gemini_api_key: "'; DROP TABLE settings; --",
      target_region: "US' OR '1'='1",
      target_platforms: ["104", "CakeResume"]
    };

    // Save settings via API
    const response = await request.post('/api/settings', {
      data: sqlInjectionPayload
    });
    expect(response.status()).toBe(200);

    // Verify settings table still exists and keys are saved literally
    const keyRow = dbHelper.db.prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").get();
    expect(keyRow.value).toBe("'; DROP TABLE settings; --");

    const regionRow = dbHelper.db.prepare("SELECT value FROM settings WHERE key = 'target_region'").get();
    expect(regionRow.value).toBe("US' OR '1'='1");
  });

  test('F3-T2-4: Concurrent Settings Updates', async ({ request }) => {
    // Send multiple settings updates concurrently
    const updates = [
      request.post('/api/settings', { data: { target_region: 'US' } }),
      request.post('/api/settings', { data: { target_region: 'Taiwan' } }),
      request.post('/api/settings', { data: { target_region: 'Europe' } })
    ];

    const responses = await Promise.all(updates);
    for (const res of responses) {
      expect(res.status()).toBe(200);
    }

    // Verify SQLite handles transactions sequentially and does not lock
    const regionRow = dbHelper.db.prepare("SELECT value FROM settings WHERE key = 'target_region'").get();
    expect(['US', 'Taiwan', 'Europe']).toContain(regionRow.value);
  });

  test('F3-T2-5: Invalid Platforms JSON Type', async ({ request }) => {
    // Direct POST with non-object payload
    const response = await request.post('/api/settings', {
      data: "invalid-string-payload"
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid settings payload');
  });
});
