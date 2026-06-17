import db from '../../../lib/db';
import { callLlm } from '../../../lib/gemini';

// In-memory tasks database
global.scrapeTasks = global.scrapeTasks || {};

// Helper to normalize URLs for de-duplication
function normalizeUrl(url) {
  if (!url) return '';
  try {
    let clean = url.trim();
    // Strip query string and hash
    clean = clean.split('?')[0].split('#')[0];
    // Strip trailing slash
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    // Standardize protocol
    if (clean.startsWith('http://')) {
      clean = 'https://' + clean.slice(7);
    }
    return clean;
  } catch (e) {
    return url;
  }
}

// Helper for delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, process.env.NODE_ENV === 'test' ? 0 : ms));

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
  const taskId = Math.random().toString(36).substring(2, 15);

  // Initialize task status in global memory
  global.scrapeTasks[taskId] = {
    status: 'processing',
    progress: 0,
    importedCount: 0,
    errors: [],
    updatedAt: Date.now()
  };

  // Run the scraping job asynchronously in the background
  runScraperTask(taskId, kw, platforms, location, aiFilter);

  // Instantly return task ID to client
  return res.status(202).json({ success: true, taskId });
}

// Background Task Executor
async function runScraperTask(taskId, keyword, platforms, location, aiFilter) {
  const task = global.scrapeTasks[taskId];
  let allJobs = [];

  const updateProgress = (prog, count, err = null) => {
    if (!global.scrapeTasks[taskId]) return;
    if (prog !== null) global.scrapeTasks[taskId].progress = Math.min(Math.round(prog), 99);
    if (count !== null) global.scrapeTasks[taskId].importedCount = count;
    if (err) global.scrapeTasks[taskId].errors.push(err);
    global.scrapeTasks[taskId].updatedAt = Date.now();
  };

  try {
    const totalPlatforms = platforms.length;
    let platformIndex = 0;

    for (const platform of platforms) {
      const startProg = (platformIndex / totalPlatforms) * 80; // reserve 80% for scraping
      const endProg = ((platformIndex + 1) / totalPlatforms) * 80;
      
      try {
        let platformJobs = [];
        if (platform === '104') {
          platformJobs = await scrape104(keyword, location, (p) => updateProgress(startProg + p * (endProg - startProg), null));
        } else if (platform === 'cakeresume' || platform === 'cake') {
          platformJobs = await scrapeCakeResume(keyword, location, (p) => updateProgress(startProg + p * (endProg - startProg), null));
        } else if (platform === 'linkedin') {
          platformJobs = await scrapeLinkedIn(keyword, location, (p) => updateProgress(startProg + p * (endProg - startProg), null));
        } else if (platform === '1111') {
          platformJobs = await scrape1111(keyword, location, (p) => updateProgress(startProg + p * (endProg - startProg), null));
        }
        allJobs.push(...platformJobs);
      } catch (err) {
        console.error(`Error scraping platform ${platform}:`, err);
        updateProgress(null, null, `Platform ${platform} failed: ${err.message}`);
      }
      
      platformIndex++;
      await sleep(1000); // Friendly delay between platforms
    }

    updateProgress(80, null);

    // 1. Normalize URLs and filter out duplicates
    allJobs = allJobs.map(job => ({ ...job, url: normalizeUrl(job.url) }));
    
    // De-duplicate in allJobs itself
    const uniqueUrlMap = new Map();
    for (const job of allJobs) {
      if (job.url && !uniqueUrlMap.has(job.url)) {
        uniqueUrlMap.set(job.url, job);
      }
    }
    allJobs = Array.from(uniqueUrlMap.values());

    // Filter out already existing jobs in DB
    allJobs = allJobs.filter(job => {
      if (job.url) {
        const exists = db.prepare('SELECT 1 FROM jobs WHERE url = ?').get(job.url);
        return !exists;
      }
      return true;
    });

    updateProgress(85, null);

    // 2. Perform AI Relevance filtering if enabled and active resume exists
    if (aiFilter && allJobs.length > 0) {
      const activeResume = db.prepare('SELECT * FROM resumes WHERE is_active = 1').get();
      if (activeResume) {
        const resumeText = activeResume.raw_text || '';
        const filteredJobs = [];
        
        // Rate-controlled AI Relevance check
        for (let i = 0; i < allJobs.length; i++) {
          const job = allJobs[i];
          const isRelevant = await judgeRelevance(job, keyword, resumeText);
          if (isRelevant) {
            filteredJobs.push(job);
          }
          const checkProg = 85 + (i / allJobs.length) * 10;
          updateProgress(checkProg, null);
          await sleep(500); // Prevent AI rate limits
        }
        allJobs = filteredJobs;
      }
    }

    updateProgress(95, null);

    // 3. Insert into Database
    const insertStmt = db.prepare(`
      INSERT INTO jobs (title, company, location, salary, url, description, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let importedCount = 0;
    for (const job of allJobs) {
      try {
        insertStmt.run(
          job.title,
          job.company,
          job.location,
          job.salary,
          job.url,
          job.description,
          job.source,
          'Interested'
        );
        importedCount++;
        updateProgress(95 + (importedCount / allJobs.length) * 5, importedCount);
      } catch (err) {
        console.error('Error inserting job:', err);
      }
    }

    // Mark task completed
    if (global.scrapeTasks[taskId]) {
      global.scrapeTasks[taskId].status = 'completed';
      global.scrapeTasks[taskId].progress = 100;
      global.scrapeTasks[taskId].importedCount = importedCount;
      global.scrapeTasks[taskId].updatedAt = Date.now();
    }
  } catch (error) {
    console.error(`Task ${taskId} encountered fatal error:`, error);
    if (global.scrapeTasks[taskId]) {
      global.scrapeTasks[taskId].status = 'failed';
      global.scrapeTasks[taskId].errors.push(error.message);
      global.scrapeTasks[taskId].updatedAt = Date.now();
    }
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

// Concurrency-limited Details Fetcher Helper
async function fetchJobDetailsInBatches(jobsList, detailFetcher, limit = 2) {
  const results = [];
  for (let i = 0; i < jobsList.length; i += limit) {
    const chunk = jobsList.slice(i, i + limit);
    await Promise.all(chunk.map(async (job) => {
      if (job.url) {
        const desc = await detailFetcher(job.url);
        job.description = desc || '請至來源網站查看工作內容。';
      } else {
        job.description = '無職缺連結。';
      }
      results.push(job);
    }));
    await sleep(600); // Anti-scraping throttle delay between chunks
  }
  return results;
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

// 1. 104 Scraper (Asynchronous Deep Search)
async function scrape104(keyword, location, onProgress) {
  const jobs = [];
  try {
    let areaParam = '';
    if (location === 'taipei') {
      areaParam = '&area=6001001000';
    } else if (location === 'new_taipei') {
      areaParam = '&area=6001002000';
    } else if (location === 'taipei_both') {
      areaParam = '&area=6001001000,6001002000';
    }

    // Fetch 3 pages (up to 90 listings)
    for (let page = 1; page <= 3; page++) {
      onProgress((page - 1) / 3 * 0.5); // 0% -> 50% for list fetch
      const url = `https://www.104.com.tw/jobs/search/list?ro=0&kw=${encodeURIComponent(keyword)}&order=1&asc=0&page=${page}&mode=s${areaParam}`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://www.104.com.tw/jobs/search/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) break;
      const data = await res.json();
      const list = data?.data?.list || [];
      if (list.length === 0) break;

      for (const item of list) {
        const title = cleanHtmlText(item.jobName);
        if (!isTitleRelevant(title, keyword)) continue;

        jobs.push({
          title,
          company: cleanHtmlText(item.custName),
          location: cleanHtmlText(item.jobAddrNoDesc || item.addressArea || ''),
          salary: cleanHtmlText(item.salaryDesc || ''),
          url: item.link?.job ? `https:${item.link.job}` : '',
          description: '',
          source: '104'
        });
      }
      await sleep(500); // Politeness delay
    }

    onProgress(0.5); // List fetch complete

    // Fetch details in rate-limited batches
    const targetJobs = jobs.slice(0, 30); // Scrape max 30 jobs to balance depth and response times
    const total = targetJobs.length;
    
    await fetchJobDetailsInBatches(targetJobs, get104Details, 2);
    onProgress(1.0);

    return targetJobs;
  } catch (e) {
    console.error('104 scrape sub-error:', e);
    return [];
  }
}

// 2. Cake Scraper (Asynchronous Deep Search)
async function scrapeCakeResume(keyword, location, onProgress) {
  const jobs = [];
  try {
    onProgress(0.1);
    const url = `https://www.cake.me/jobs?q=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    if (!res.ok) return [];
    const html = await res.text();
    onProgress(0.4);

    const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (jsonMatch && jsonMatch[1]) {
      const parsedData = JSON.parse(jsonMatch[1]);
      const hits = parsedData?.props?.pageProps?.initialState?.algoliaJobs?.hits || 
                   parsedData?.props?.pageProps?.initialJobSearchResponse?.results?.[0]?.hits || [];
      
      for (const hit of hits) {
        const rawLoc = hit.location || hit.flat_locations?.join(', ') || '';
        const lowerLoc = rawLoc.toLowerCase();
        
        if (location === 'taipei' && !lowerLoc.includes('taipei') && !lowerLoc.includes('台北')) continue;
        if (location === 'new_taipei' && !lowerLoc.includes('new taipei') && !lowerLoc.includes('新北')) continue;
        if (location === 'taipei_both' && !lowerLoc.includes('taipei') && !lowerLoc.includes('new taipei') && !lowerLoc.includes('台北') && !lowerLoc.includes('新北')) continue;
        
        const title = cleanHtmlText(hit.title);
        if (!isTitleRelevant(title, keyword)) continue;

        jobs.push({
          title,
          company: cleanHtmlText(hit.page?.name || hit.companyName || 'Cake Company'),
          location: cleanHtmlText(rawLoc),
          salary: cleanHtmlText(hit.salary_range || ''),
          url: hit.path ? `https://www.cake.me/jobs/${hit.path}` : `https://www.cake.me/jobs/${hit.uuid}`,
          description: cleanHtmlText(hit.description || hit.description_plain || 'Cake Job Posting'),
          source: 'Cake'
        });
      }
    }
    
    // Fallback parsing
    if (jobs.length === 0) {
      const titleMatches = html.matchAll(/<a[^>]*href="([^"]*\/jobs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
      for (const match of titleMatches) {
        if (jobs.length >= 30) break;
        const jobUrl = match[1].startsWith('http') ? match[1] : `https://www.cake.me${match[1]}`;
        
        // Anti-pattern filter: Exclude language, category, and simple landing links
        if (jobUrl.match(/\/jobs\/(zh-TW|zh-CN|en|ja|vi|id|ko|de|fr|es|pt|ru|it|th|pl|tr|uk|ms|ar|companies|categories|collections|search)(?:\?|\/|$)/i)) continue;
        
        // Ensure url has enough segments to be a job posting page (either 2 levels or UUID)
        const pathSegments = jobUrl.split('cake.me/jobs/')[1]?.split('/') || [];
        if (pathSegments.length < 1) continue;

        const titleText = cleanHtmlText(match[2]);
        if (!titleText || titleText.length > 80) continue;
        if (!isTitleRelevant(titleText, keyword)) continue;
        
        // Parse company name dynamically from URL
        let company = 'Cake Company';
        if (pathSegments.length >= 2) {
          company = pathSegments[0].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        
        jobs.push({
          title: titleText,
          company,
          location: location === 'global' ? '' : '雙北市',
          salary: '',
          url: jobUrl,
          description: 'Cake Job Posting',
          source: 'Cake'
        });
      }
    }

    onProgress(1.0);
    return jobs;
  } catch (e) {
    console.error('Cake scrape sub-error:', e);
    return [];
  }
}

// 3. LinkedIn Scraper (Asynchronous Deep Search)
async function scrapeLinkedIn(keyword, location, onProgress) {
  const jobs = [];
  try {
    let locParam = '';
    if (location === 'taipei') {
      locParam = '&location=Taipei%20City%2C%20Taiwan';
    } else if (location === 'new_taipei') {
      locParam = '&location=New%20Taipei%20City%2C%20Taiwan';
    } else if (location === 'taipei_both') {
      locParam = '&location=Taipei%20Metropolitan%20Area';
    }

    onProgress(0.1);
    // Fetch 2 pages of LinkedIn guest posts (offset 0 and 25)
    for (let startNum of [0, 25]) {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}${locParam}&start=${startNum}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) break;
      const html = await res.text();
      
      const jobBlocks = html.split('</li>');
      for (const block of jobBlocks) {
        if (!block.includes('base-card')) continue;
        
        const titleMatch = block.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/);
        const companyMatch = block.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/a>/) || block.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/);
        const linkMatch = block.match(/href="([^"]+)"/);
        const locationMatch = block.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/);

        const title = titleMatch ? cleanHtmlText(titleMatch[1]) : 'LinkedIn Job';
        if (!isTitleRelevant(title, keyword)) continue;

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
      await sleep(800); // Politeness delay
    }

    onProgress(0.5);

    // Fetch details in rate-limited batches
    const targetJobs = jobs.slice(0, 15); // Scrape max 15 LinkedIn jobs due to restrictive WAFs
    await fetchJobDetailsInBatches(targetJobs, getLinkedInDetails, 2);
    onProgress(1.0);

    return targetJobs;
  } catch (e) {
    console.error('LinkedIn scrape sub-error:', e);
    return [];
  }
}

// 4. 1111 Scraper (Asynchronous Deep Search)
async function scrape1111(keyword, location, onProgress) {
  const jobs = [];
  try {
    let augmentedKw = keyword;
    if (location === 'taipei') augmentedKw += ' 台北市';
    else if (location === 'new_taipei') augmentedKw += ' 新北市';
    else if (location === 'taipei_both') augmentedKw += ' 台北市 新北市';

    onProgress(0.1);
    // Fetch 2 pages of 1111 Search results
    for (let page = 1; page <= 2; page++) {
      const url = `https://www.1111.com.tw/search/job?ks=${encodeURIComponent(augmentedKw)}&page=${page}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) break;
      const html = await res.text();

      const linkRegex = /href="([^"]*job\/\d+[^"]*)"[^>]*title="([^"]+)"/g;
      const links = [...html.matchAll(linkRegex)];

      for (const link of links) {
        if (jobs.length >= 30) break;
        const rawUrl = link[1];
        const jobUrl = rawUrl.startsWith('http') ? rawUrl : (rawUrl.startsWith('//') ? `https:${rawUrl}` : `https://www.1111.com.tw${rawUrl}`);
        const title = cleanHtmlText(link[2]);

        if (!isTitleRelevant(title, keyword)) continue;

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
      await sleep(600); // Politeness delay
    }

    onProgress(0.5);

    const targetJobs = jobs.slice(0, 20);
    await fetchJobDetailsInBatches(targetJobs, get1111Details, 2);
    onProgress(1.0);

    return targetJobs;
  } catch (e) {
    console.error('1111 scrape sub-error:', e);
    return [];
  }
}
