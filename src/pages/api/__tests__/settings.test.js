import { createMocks } from 'node-mocks-http';
import settingsHandler from '../settings';
import db from '../../../lib/db';

describe('/api/settings API Endpoint', () => {
  beforeEach(async () => {
    await db.prepare('DELETE FROM settings').run();
  });

  test('GET - should return empty settings flat object when no settings in DB', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await settingsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({});
  });

  test('POST - should batch save settings and update existing ones', async () => {
    const { req: req1, res: res1 } = createMocks({
      method: 'POST',
      body: {
        gemini_api_key: 'key1',
        target_region: 'US',
      },
    });

    await settingsHandler(req1, res1);

    expect(res1._getStatusCode()).toBe(200);
    expect(res1._getJSONData()).toEqual({ success: true });

    const val1 = await db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
    expect(val1.value).toBe('key1');

    const { req: req2, res: res2 } = createMocks({
      method: 'POST',
      body: {
        gemini_api_key: 'key2',
        another_setting: 'value_x',
      },
    });

    await settingsHandler(req2, res2);

    expect(res2._getStatusCode()).toBe(200);

    const rows = await db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    expect(settings).toEqual({
      gemini_api_key: 'key2',
      target_region: 'US',
      another_setting: 'value_x',
    });
  });

  test('GET - should return all settings currently saved', async () => {
    await db.prepare("INSERT INTO settings (key, value) VALUES ('k1', 'v1'), ('k2', 'v2')").run();

    const { req, res } = createMocks({
      method: 'GET',
    });

    await settingsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      k1: 'v1',
      k2: 'v2',
    });
  });

  test('POST - should return 400 for bad payloads (non-objects)', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: "not an object",
    });

    await settingsHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().success).toBe(false);
  });

  test('GET - should correctly parse and return boolean, numeric, or object setting values as their original types', async () => {
    const { req: reqPost, res: resPost } = createMocks({
      method: 'POST',
      body: {
        is_enabled: true,
        max_limit: 8080,
        nested_obj: { detail: 'value' },
        normal_str: 'hello',
      },
    });

    await settingsHandler(reqPost, resPost);
    expect(resPost._getStatusCode()).toBe(200);

    const { req: reqGet, res: resGet } = createMocks({
      method: 'GET',
    });

    await settingsHandler(reqGet, resGet);
    expect(resGet._getStatusCode()).toBe(200);

    const data = resGet._getJSONData();
    expect(data.is_enabled).toBe(true);
    expect(data.max_limit).toBe(8080);
    expect(data.nested_obj).toEqual({ detail: 'value' });
    expect(data.normal_str).toBe('hello');
  });
});
