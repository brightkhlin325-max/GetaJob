import db from '../../../lib/db';
import { callLlm } from '../../../lib/gemini';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { keyword, platforms = ['104', 'cakeresume', 'linkedin', '1111'], location = 'taipei_both', aiFilter = false } = req.body || {};
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ success: false, error: 'Keyword is required' });
  }

  const kw = keyword.trim();
  const importedJobs = [];

  try {
    const scraperPromises = [];

    if (platforms.includes('104')) {
      scraperPromises.push(scrape104(kw, location));
    }
    if (platforms.includes('cakeresume') || platforms.includes('cake')) {
      scraperPromises.push(scrapeCakeResume(kw, location));
    }
    if (platforms.includes('linkedin')) {
      scraperPromises.push(scrapeLinkedIn(kw, location));
    }
    if (platforms.includes('1111')) {
      scraperPromises.push(scrape1111(kw, location));
    }

    const results = await Promise.all(scraperPromises);
    let allJobs = results.flat();

    // 1. Filter out already existing jobs first to avoid checking them
    allJobs = allJobs.filter(job => {
      if (job.url) {
        const exists = db.prepare('SELECT 1 FROM jobs WHERE url = ?').get(job.url);
        return !exists;
      }
      return true;
    });

    // 2. Perform AI Relevance filtering if enabled and active resume exists
    if (aiFilter && allJobs.length > 0) {
      const activeResume = db.prepare('SELECT * FROM resumes WHERE is_active = 1').get();
      if (activeResume) {
        const resumeText = activeResume.raw_text || '';
        // Check relevance in parallel
        const checkedJobs = await Promise.all(
          allJobs.map(async (job) => {
            const isRelevant = await judgeRelevance(job, kw, resumeText);
            return isRelevant ? job : null;
          })
        );
        allJobs = checkedJobs.filter(Boolean);
      }
    }

    const insertStmt = db.prepare(`
      INSERT INTO jobs (title, company, location, salary, url, description, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const job of allJobs) {
      const info = insertStmt.run(
        job.title,
        job.company,
        job.location,
        job.salary,
        job.url,
        job.description,
        job.source,
        'Interested'
      );

      importedJobs.push({
        id: info.lastInsertRowid,
        ...job,
        status: 'Interested'
      });
    }

    return res.status(200).json({ success: true, count: importedJobs.length, data: importedJobs });
  } catch (error) {
    console.error('Joint Scraper API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// AI Relevance helper
async function judgeRelevance(job, keyword, resumeText) {
  try {
    const prompt = `
你是一位專業的求職助理與系統過濾器。請判斷以下職缺是否與使用者的搜尋關鍵字或其履歷技能大綱基本相關。
搜尋關鍵字: "${keyword}"
使用者履歷大綱:
"""
${resumeText.slice(0, 1000)}
"""

職缺資訊:
公司: "${job.company}"
職稱: "${job.title}"
描述: "${(job.description || '').slice(0, 450)}"

請回答該職缺是否「基本相關」（若明顯毫不相干，例如搜尋 PM 而職缺是洗碗工，或者搜尋 Frontend 卻是硬體產線助理，則為不相關）。
請回傳一個 JSON 物件，格式如下：
{
  "relevant": true 或 false,
  "reason": "簡短的原因說明"
}
`;
    const responseText = await callLlm(prompt, true);
    const cleanJson = responseText.replace(/```json/i, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);
    return !!result.relevant;
  } catch (err) {
    console.error('Relevance check error:', err);
    return true; // Fallback to true on error so we don't drop jobs
  }
}

// Helper to strip HTML tags and clean whitespaces
function cleanHtmlText(text) {
  if (!text) return '';
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // remove styles
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // remove scripts
    .replace(/<[^>]*>/g, ' ') // remove HTML tags
    .replace(/\s+/g, ' ')   // collapse consecutive spaces
    .trim();
}

// 104 Job Detail fetcher
async function get104Details(jobUrl) {
  try {
    const match = jobUrl.match(/\/job\/([a-zA-Z0-9]+)/);
    if (!match) return '';
    const jobId = match[1];
    const res = await fetch(`https://www.104.com.tw/job/ajax/content/${jobId}`, {
      headers: {
        'Referer': `https://www.104.com.tw/job/${jobId}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return '';
    const data = await res.json();
    const jobDescription = data?.data?.jobDetail?.jobDescription || '';
    const jobRequirement = data?.data?.jobDetail?.other || '';
    const items = [];
    if (jobDescription) items.push(jobDescription);
    if (jobRequirement) items.push(`工作要求/其他條件：\n${jobRequirement}`);
    return cleanHtmlText(items.join('\n\n'));
  } catch (e) {
    console.error(`104 detail fetch failed for ${jobUrl}:`, e);
    return '';
  }
}

// LinkedIn Job Detail fetcher
async function getLinkedInDetails(jobUrl) {
  try {
    const match = jobUrl.match(/\/view\/(\d+)/) || jobUrl.match(/-(\d+)(?:\?|$)/);
    if (!match) return '';
    const jobId = match[1];
    const detailsUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
    const res = await fetch(detailsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return '';
    const html = await res.text();
    const descMatch = html.match(/<div class="[^"]*show-more-less-html__markup[^"]*">([\s\S]*?)<\/div>/) || html.match(/<div class="[^"]*description__text[^"]*">([\s\S]*?)<\/div>/);
    if (descMatch) {
      return cleanHtmlText(descMatch[1]);
    }
    return cleanHtmlText(html).slice(0, 1000);
  } catch (e) {
    console.error(`LinkedIn detail fetch failed for ${jobUrl}:`, e);
    return '';
  }
}

// 1111 Job Detail fetcher
async function get1111Details(jobUrl) {
  try {
    const res = await fetch(jobUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return '';
    const html = await res.text();
    const descMatch = html.match(/class="[^"]*whitespace-pre-line[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<div class="[^"]*job_description[^"]*">([\s\S]*?)<\/div>/i) || 
                      html.match(/<div class="[^"]*job_info_content[^"]*">([\s\S]*?)<\/div>/i) || 
                      html.match(/<div class="[^"]*content[^"]*">([\s\S]*?)<\/div>/i);
    if (descMatch) {
      return cleanHtmlText(descMatch[1]);
    }
    return cleanHtmlText(html).slice(0, 1000);
  } catch (e) {
    console.error(`1111 detail fetch failed for ${jobUrl}:`, e);
    return '';
  }
}

// 1. 104 Scraper (API)
async function scrape104(keyword, location) {
  try {
    let areaParam = '';
    if (location === 'taipei') {
      areaParam = '&area=6001001000';
    } else if (location === 'new_taipei') {
      areaParam = '&area=6001002000';
    } else if (location === 'taipei_both') {
      areaParam = '&area=6001001000,6001002000';
    }

    const url = `https://www.104.com.tw/jobs/search/list?ro=0&kw=${encodeURIComponent(keyword)}&order=1&asc=0&page=1&mode=s${areaParam}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.104.com.tw/jobs/search/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.data?.list || [];

    // Limit to 10 jobs
    const targetJobs = list.slice(0, 10).map(item => ({
      title: cleanHtmlText(item.jobName),
      company: cleanHtmlText(item.custName),
      location: cleanHtmlText(item.jobAddrNoDesc || item.addressArea || ''),
      salary: cleanHtmlText(item.salaryDesc || ''),
      url: item.link?.job ? `https:${item.link.job}` : '',
      description: '',
      source: '104'
    }));

    // Fetch details asynchronously
    await Promise.all(targetJobs.map(async (job) => {
      if (job.url) {
        const details = await get104Details(job.url);
        job.description = details || '請至來源網站查看工作內容。';
      } else {
        job.description = '無職缺連結。';
      }
    }));

    return targetJobs;
  } catch (e) {
    console.error('104 scrape sub-error:', e);
    return [];
  }
}

// 2. Cake Scraper
async function scrapeCakeResume(keyword, location) {
  try {
    const url = `https://www.cake.me/jobs?q=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) return [];
    const html = await res.text();

    const jobs = [];
    const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    
    if (jsonMatch && jsonMatch[1]) {
      const parsedData = JSON.parse(jsonMatch[1]);
      const hits = parsedData?.props?.pageProps?.initialState?.algoliaJobs?.hits || 
                   parsedData?.props?.pageProps?.initialJobSearchResponse?.results?.[0]?.hits || [];
      
      for (const hit of hits) {
        if (jobs.length >= 10) break; // Limit to 10 jobs
        
        const rawLoc = hit.location || hit.flat_locations?.join(', ') || '';
        const lowerLoc = rawLoc.toLowerCase();
        
        if (location === 'taipei' && !lowerLoc.includes('taipei') && !lowerLoc.includes('台北')) continue;
        if (location === 'new_taipei' && !lowerLoc.includes('new taipei') && !lowerLoc.includes('新北')) continue;
        if (location === 'taipei_both' && !lowerLoc.includes('taipei') && !lowerLoc.includes('new taipei') && !lowerLoc.includes('台北') && !lowerLoc.includes('新北')) continue;
        
        jobs.push({
          title: cleanHtmlText(hit.title),
          company: cleanHtmlText(hit.page?.name || hit.companyName || 'Cake Company'),
          location: cleanHtmlText(rawLoc),
          salary: cleanHtmlText(hit.salary_range || ''),
          url: hit.path ? `https://www.cake.me/jobs/${hit.path}` : `https://www.cake.me/jobs/${hit.uuid}`,
          description: cleanHtmlText(hit.description || hit.description_plain || 'Cake Job Posting'),
          source: 'Cake'
        });
      }
    }
    
    if (jobs.length === 0) {
      const titleMatches = html.matchAll(/<a[^>]*href="([^"]*\/jobs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
      let count = 0;
      for (const match of titleMatches) {
        if (count >= 10) break;
        const jobUrl = match[1].startsWith('http') ? match[1] : `https://www.cake.me${match[1]}`;
        const titleText = cleanHtmlText(match[2]);
        if (!titleText || titleText.length > 80) continue;
        
        jobs.push({
          title: titleText,
          company: 'Cake Company',
          location: location === 'global' ? '' : '雙北市',
          salary: '',
          url: jobUrl,
          description: 'Cake Job Posting',
          source: 'Cake'
        });
        count++;
      }
    }

    return jobs;
  } catch (e) {
    console.error('Cake scrape sub-error:', e);
    return [];
  }
}

// 3. LinkedIn Scraper (HTML Guest API)
async function scrapeLinkedIn(keyword, location) {
  try {
    let locParam = '';
    if (location === 'taipei') {
      locParam = '&location=Taipei%20City%2C%20Taiwan';
    } else if (location === 'new_taipei') {
      locParam = '&location=New%20Taipei%20City%2C%20Taiwan';
    } else if (location === 'taipei_both') {
      locParam = '&location=Taipei%20Metropolitan%20Area';
    }

    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}${locParam}&position=1&pageNum=0`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();

    const jobs = [];
    const jobBlocks = html.split('</li>');
    for (const block of jobBlocks) {
      if (jobs.length >= 10) break; // Limit to 10 jobs
      if (!block.includes('base-card')) continue;
      
      const titleMatch = block.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/);
      const companyMatch = block.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/a>/) || block.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/);
      const linkMatch = block.match(/href="([^"]+)"/);
      const locationMatch = block.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/);

      const title = titleMatch ? cleanHtmlText(titleMatch[1]) : 'LinkedIn Job';
      const company = companyMatch ? cleanHtmlText(companyMatch[1]) : 'LinkedIn Employer';
      const urlLink = linkMatch ? linkMatch[1].split('?')[0] : '';
      const rawLoc = locationMatch ? cleanHtmlText(locationMatch[1]) : '';

      if (urlLink) {
        jobs.push({
          title,
          company,
          location: rawLoc,
          salary: '',
          url: urlLink,
          description: '',
          source: 'LinkedIn'
        });
      }
    }

    // Fetch details asynchronously
    await Promise.all(jobs.map(async (job) => {
      if (job.url) {
        const details = await getLinkedInDetails(job.url);
        job.description = details || `LinkedIn Job Opportunity in ${job.location}. Please visit LinkedIn to view description.`;
      } else {
        job.description = '無職缺連結。';
      }
    }));

    return jobs;
  } catch (e) {
    console.error('LinkedIn scrape sub-error:', e);
    return [];
  }
}

// 4. 1111 Scraper
async function scrape1111(keyword, location) {
  try {
    let augmentedKw = keyword;
    if (location === 'taipei') augmentedKw += ' 台北市';
    else if (location === 'new_taipei') augmentedKw += ' 新北市';
    else if (location === 'taipei_both') augmentedKw += ' 台北市 新北市';

    const url = `https://www.1111.com.tw/search/job?ks=${encodeURIComponent(augmentedKw)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();

    const jobs = [];
    // Enhanced regex matching both absolute and relative HTML links
    const linkRegex = /href="([^"]*job\/\d+[^"]*)"[^>]*title="([^"]+)"/g;
    const links = [...html.matchAll(linkRegex)];

    for (const link of links) {
      if (jobs.length >= 10) break;
      const rawUrl = link[1];
      const jobUrl = rawUrl.startsWith('http') ? rawUrl : (rawUrl.startsWith('//') ? `https:${rawUrl}` : `https://www.1111.com.tw${rawUrl}`);
      const title = cleanHtmlText(link[2]);

      // Filter out sponsored/featured ads that are completely irrelevant to the keyword
      if (!isTitleRelevant(title, keyword)) continue;

      // Simple company name lookup by scanning HTML after link index
      const jobIndex = html.indexOf(link[0]);
      let company = '1111 雇主';
      if (jobIndex !== -1) {
        const snippet = html.slice(jobIndex, jobIndex + 1500);
        const corpMatch = snippet.match(/href="\/corp\/\d+[^"]*"[^>]*title="([^"]+)"/) || snippet.match(/>([^<]+公司)</);
        if (corpMatch) {
          company = cleanHtmlText(corpMatch[1]);
        }
      }

      jobs.push({
        title,
        company,
        location: location === 'global' ? '' : '雙北市',
        salary: '面議',
        url: jobUrl,
        description: '',
        source: '1111'
      });
    }

    // Fetch details asynchronously
    await Promise.all(jobs.map(async (job) => {
      if (job.url) {
        const details = await get1111Details(job.url);
        job.description = details || '1111 Job Opportunity';
      } else {
        job.description = '無職缺連結。';
      }
    }));

    return jobs;
  } catch (e) {
    console.error('1111 scrape sub-error:', e);
    return [];
  }
}

// Helper to determine if a job title is relevant to search keyword terms
function isTitleRelevant(title, keyword) {
  if (!keyword) return true;
  const cleanTitle = title.toLowerCase();
  const kw = keyword.toLowerCase();
  
  const queryWords = kw.split(/[\s,./+\-_&|()（）]+/).filter(w => w.trim().length > 0);
  if (queryWords.length === 0) return true;
  
  for (const qWord of queryWords) {
    if (/[\u4e00-\u9fa5]/.test(qWord)) {
      if (qWord.length >= 2) {
        for (let i = 0; i < qWord.length - 1; i++) {
          const sub = qWord.slice(i, i + 2);
          if (cleanTitle.includes(sub)) return true;
        }
      } else {
        if (cleanTitle.includes(qWord)) return true;
      }
    } else {
      if (cleanTitle.includes(qWord)) return true;
      // English stem matching (e.g. "dev" and "developer")
      const titleWords = cleanTitle.split(/[\s,./+\-_&|()（）]+/);
      for (const tWord of titleWords) {
        const minLen = Math.min(tWord.length, qWord.length);
        if (minLen >= 3 && tWord.slice(0, minLen) === qWord.slice(0, minLen)) {
          return true;
        }
      }
    }
  }
  return false;
}
