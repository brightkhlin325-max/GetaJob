const { test, expect } = require('@playwright/test');
const DbHelper = require('../../helpers/db-helper');

test.describe('F3: Settings Management', () => {
  let dbHelper;

  test.beforeEach(async () => {
    dbHelper = new DbHelper();
    dbHelper.clearDatabase();
  });

  test.afterEach(async () => {
    dbHelper.close();
  });

  test('Save Gemini API Key', async ({ page }) => {
    await page.goto('/settings');

    // Fill in API Key
    const apiKeyInput = page.locator('[data-testid="input-gemini-key"]');
    await apiKeyInput.fill('AIzaSyMockKey123');

    // Save Settings
    await page.locator('[data-testid="btn-save-settings"]').click();

    // Verify success toast or UI indication
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Verify in SQLite Database
    const dbVal = dbHelper.db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
    expect(dbVal).toBeDefined();
    expect(dbVal.value).toBe('AIzaSyMockKey123');
  });

  test('Save Target Region', async ({ page }) => {
    await page.goto('/settings');

    // Select Target Region "US"
    const regionSelect = page.locator('[data-testid="select-target-region"]');
    await regionSelect.selectOption('US');

    // Save Settings
    await page.locator('[data-testid="btn-save-settings"]').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Verify DB
    const dbVal = dbHelper.db.prepare('SELECT value FROM settings WHERE key = ?').get('target_region');
    expect(dbVal.value).toBe('US');

    // Reload and verify persistence in UI
    await page.reload();
    await expect(regionSelect).toHaveValue('US');
  });

  test('Toggle Platforms', async ({ page }) => {
    await page.goto('/settings');

    // Uncheck "CakeResume" checkbox
    const cakeCheckbox = page.locator('[data-testid="checkbox-platform-CakeResume"]');
    await expect(cakeCheckbox).toBeChecked();
    await cakeCheckbox.uncheck();

    // Save Settings
    await page.locator('[data-testid="btn-save-settings"]').click();
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

    // Verify DB
    const dbVal = dbHelper.db.prepare('SELECT value FROM settings WHERE key = ?').get('target_platforms');
    const platforms = JSON.parse(dbVal.value);
    expect(platforms).not.toContain('CakeResume');
    expect(platforms).toContain('104');

    // Verify UI state after reload
    await page.reload();
    await expect(page.locator('[data-testid="checkbox-platform-CakeResume"]')).not.toBeChecked();
  });

  test('Load Default Settings', async ({ page }) => {
    // Ensuring settings table is completely clean
    dbHelper.db.exec('DELETE FROM settings');

    await page.goto('/settings');

    // Default inputs check
    await expect(page.locator('[data-testid="input-gemini-key"]')).toHaveValue('');
    await expect(page.locator('[data-testid="select-target-region"]')).toHaveValue('Taiwan');
    
    // All platform checkboxes should be checked by default
    await expect(page.locator('[data-testid="checkbox-platform-104"]')).toBeChecked();
    await expect(page.locator('[data-testid="checkbox-platform-CakeResume"]')).toBeChecked();
    await expect(page.locator('[data-testid="checkbox-platform-LinkedIn"]')).toBeChecked();
    await expect(page.locator('[data-testid="checkbox-platform-Indeed"]')).toBeChecked();
  });

  test('Settings API GET', async ({ request }) => {
    // Seed DB settings directly
    dbHelper.seedSettings({
      gemini_api_key: 'AIzaSySeededKey',
      target_region: 'US',
      target_platforms: ['104', 'LinkedIn']
    });

    // Make GET request
    const response = await request.get('/api/settings');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.gemini_api_key).toBe('AIzaSySeededKey');
    expect(body.target_region).toBe('US');
    
    const platforms = typeof body.target_platforms === 'string'
      ? JSON.parse(body.target_platforms)
      : body.target_platforms;
    expect(platforms).toContain('104');
    expect(platforms).toContain('LinkedIn');
    expect(platforms).not.toContain('CakeResume');
  });
});
