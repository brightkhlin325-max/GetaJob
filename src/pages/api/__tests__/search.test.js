import { createMocks } from 'node-mocks-http';
import searchHandler from '../scrape/search';
import db from '../../../lib/db';

describe('/api/scrape/search Joint Scraper API Endpoint', () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    await db.prepare('DELETE FROM jobs').run();
  });

  test('POST - should scrape and import jobs from multiple platforms in parallel', async () => {
    // Mock fetch calls for different platforms
    global.fetch = jest.fn((url) => {
      if (url.includes('104.com.tw')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              list: [
                {
                  jobName: '104 React Dev',
                  custName: '104 Company',
                  addressArea: 'Taipei',
                  salaryDesc: 'NT$ 50,000+',
                  link: { job: '//www.104.com.tw/job/104' },
                  description: 'React developer job details'
                }
              ]
            }
          })
        });
      } else if (url.includes('cakeresume.com') || url.includes('cake.me')) {
        // Return fake NEXT_DATA containing a hit
        const fakeNextData = JSON.stringify({
          props: {
            pageProps: {
              initialJobSearchResponse: {
                results: [{
                  hits: [{
                    title: 'Cake Vue Dev',
                    companyName: 'Cake Company',
                    location: 'Taipei',
                    salary_range: 'NT$ 60,000+',
                    path: 'cake-path',
                    description: 'Vue developer details'
                  }]
                }]
              }
            }
          }
        });
        const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${fakeNextData}</script></body></html>`;
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(html)
        });
      } else if (url.includes('linkedin.com')) {
        // Return mock LinkedIn HTML fragment
        const html = `
          <ul>
            <li class="base-card">
              <h3 class="base-search-card__title">LinkedIn Python Dev</h3>
              <h4 class="base-search-card__subtitle">LinkedIn Company</h4>
              <span class="job-search-card__location">Taipei City</span>
              <a href="https://www.linkedin.com/jobs/view/1234">Link</a>
            </li>
          </ul>
        `;
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(html)
        });
      } else if (url.includes('1111.com.tw')) {
        // Return mock 1111 HTML fragment
        const html = `
          <div class="job_item_info">
            <a href="//www.1111.com.tw/job/555/" title="1111 Node Dev">1111 Node Dev</a>
            <span class="company_name">1111 Company</span>
            <span class="job_item_detail">New Taipei</span>
            <span class="job_item_salary">NT$ 70k</span>
          </div>
        `;
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(html)
        });
      }
      return Promise.resolve({ ok: false });
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        keyword: 'developer',
        platforms: ['104', 'cakeresume', 'linkedin', '1111']
      }
    });

    await searchHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const body = res._getJSONData();
    expect(body.success).toBe(true);
    expect(body.count).toBe(4); // 1 job from each platform

    // Verify written to database
    const jobs = db.prepare('SELECT * FROM jobs').all();
    expect(jobs.length).toBe(4);

    const sources = jobs.map(j => j.source);
    expect(sources).toContain('104');
    expect(sources).toContain('Cake');
    expect(sources).toContain('LinkedIn');
    expect(sources).toContain('1111');
  });

  test('POST - should return 400 when keyword is empty', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { keyword: '' }
    });

    await searchHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().success).toBe(false);
  });
});
