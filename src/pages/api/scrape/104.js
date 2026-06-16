import db from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { keyword } = req.query;
  if (!keyword) {
    return res.status(400).json({ success: false, error: 'Keyword query parameter is required' });
  }

  try {
    // Call 104's public search API
    const url = `https://c104.api.104.com.tw/web-api-sf/job/search?ro=0&kw=${encodeURIComponent(keyword)}&isnew=3&mode=s`;
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://www.104.com.tw/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from 104 API: ${response.statusText}`);
    }

    const data = await response.json();
    const rawJobs = data?.data?.list || [];

    const importedJobs = [];
    const insertStmt = db.prepare(`
      INSERT INTO jobs (title, company, location, salary, url, description, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const rawJob of rawJobs.slice(0, 5)) { // Limit to top 5 jobs for performance and sanity
      const title = rawJob.jobName || 'Unknown Job';
      const company = rawJob.custName || 'Unknown Company';
      const location = rawJob.jobAddrNoDesc || rawJob.addressArea || '';
      const salary = rawJob.salaryDesc || '';
      const jobUrl = rawJob.link?.job ? `https:${rawJob.link.job}` : '';
      const description = rawJob.description || rawJob.jobDetail || '';

      const info = insertStmt.run(
        title,
        company,
        location,
        salary,
        jobUrl,
        description,
        '104',
        'Interested'
      );

      importedJobs.push({
        id: info.lastInsertRowid,
        title,
        company,
        location,
        salary,
        url: jobUrl,
        description,
        source: '104',
        status: 'Interested'
      });
    }

    return res.status(200).json({ success: true, count: importedJobs.length, data: importedJobs });
  } catch (error) {
    console.error('104 Scraper API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
