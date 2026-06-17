document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements for Single Page Import
  const titleEl = document.getElementById('page-title');
  const urlEl = document.getElementById('page-url');
  const scrapeBtn = document.getElementById('scrape-btn');
  const statusMsg = document.getElementById('status-msg');

  // UI Elements for Automated Crawler
  const prefDetails = document.getElementById('pref-details');
  const crawlStartBtn = document.getElementById('crawl-start-btn');
  const crawlStopBtn = document.getElementById('crawl-stop-btn');
  const crawlLog = document.getElementById('crawl-log');

  const chk104 = document.getElementById('chk-104');
  const chkCake = document.getElementById('chk-cake');
  const chkLinkedIn = document.getElementById('chk-linkedin');
  const chk1111 = document.getElementById('chk-1111');

  let activeTab = null;
  let backendUrl = 'http://localhost:3000';
  let targetPosition = '';
  let targetLocations = [];
  let isCrawling = false;

  // Helper to show status msg
  function showStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = 'status ' + (type || '');
  }

  // Helper to write into the scrolling logs
  function log(msg) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    crawlLog.textContent += `\n[${time}] ${msg}`;
    crawlLog.scrollTop = crawlLog.scrollHeight;
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Determine backend and sync settings
  async function syncPreferences() {
    prefDetails.textContent = '正在與後台同步求職偏好...';
    
    const candidateUrls = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001'
    ];
    
    let settings = null;
    let success = false;
    
    for (const url of candidateUrls) {
      try {
        const res = await fetch(`${url}/api/settings`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          settings = await res.json();
          backendUrl = url;
          success = true;
          break;
        }
      } catch (e) {
        console.warn(`Failed to connect to ${url}:`, e);
      }
    }

    if (success && settings) {
      if (settings.target_position) {
        targetPosition = settings.target_position;
        
        if (Array.isArray(settings.target_locations)) {
          targetLocations = settings.target_locations;
        } else if (typeof settings.target_locations === 'string') {
          try {
            targetLocations = JSON.parse(settings.target_locations);
            if (!Array.isArray(targetLocations)) {
              targetLocations = [targetLocations];
            }
          } catch (e) {
            targetLocations = settings.target_locations.split(',').map(s => s.trim()).filter(Boolean);
          }
        } else {
          targetLocations = [];
        }
        
        prefDetails.innerHTML = `職稱: <span style="color:var(--color-accent); font-weight:700;">${targetPosition}</span><br/>地點: <span style="color:var(--color-accent); font-weight:700;">${targetLocations.join(', ')}</span>`;
        crawlStartBtn.removeAttribute('disabled');
        log('求職偏好載入成功。');
      } else {
        prefDetails.innerHTML = '<span style="color:var(--bauhaus-red);">請先在網頁端儲存目標職位偏好！</span>';
        crawlStartBtn.setAttribute('disabled', 'true');
      }
    } else {
      prefDetails.innerHTML = '<span style="color:var(--bauhaus-red);">無法連線至 GetaJob 伺服器</span>';
      crawlStartBtn.setAttribute('disabled', 'true');
      log('後台同步失敗，請確認 GetaJob 首頁已開啟並在運行。');
    }
  }

  // Check active tab page support
  async function initActiveTabCheck() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      titleEl.textContent = '無作用中的分頁';
      return;
    }
    activeTab = tab;
    const url = tab.url || '';
    urlEl.textContent = url.length > 35 ? url.substring(0, 32) + '...' : url;
    urlEl.title = url;

    const isSupported = /linkedin\.com|indeed\.com|glassdoor\.com|104\.com\.tw|cakeresume\.com|cake\.me|1111\.com\.tw/.test(url);
    if (isSupported) {
      titleEl.textContent = '偵測到可匯入網頁';
      scrapeBtn.removeAttribute('disabled');

      const isListPage = url.includes('/search') || url.includes('/jobs?') || (url.includes('cake.me/jobs') && !url.includes('/jobs/')) || (url.includes('104.com.tw/jobs/search') && !url.includes('/job/'));
      if (isListPage) {
        showStatus('⚠️ 偵測到列表頁，請進入職缺「詳細頁」再點匯入。', 'error');
      }
    } else {
      titleEl.textContent = '非支援的職缺頁面';
      scrapeBtn.setAttribute('disabled', 'true');
    }
  }

  // --- Scraper Helper Functions ---
  
  function cleanHtmlText(text) {
    if (!text) return '';
    return text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

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

  function notifyWebpageJobImported() {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.url && (tab.url.includes('localhost:3000') || tab.url.includes('127.0.0.1:3000') || tab.url.includes('localhost:3001') || tab.url.includes('127.0.0.1:3001'))) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              window.postMessage({ type: 'GETAJOB_JOB_IMPORTED' }, '*');
            }
          }).catch(err => console.warn('Script execution failed:', err));
        }
      }
    });
  }

  async function checkDuplicateInBackend(url) {
    if (!url) return false;
    try {
      const res = await fetch(`${backendUrl}/api/scrape/extension`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, checkOnly: true })
      });
      const data = await res.json();
      return !!data.duplicated;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async function postJobToBackend(job) {
    try {
      const res = await fetch(`${backendUrl}/api/scrape/extension`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job)
      });
      const data = await res.json();
      const success = res.ok && data.success;
      if (success && !data.duplicated) {
        notifyWebpageJobImported();
      }
      return { success, duplicated: !!data.duplicated };
    } catch (err) {
      console.error(err);
      return { success: false, error: err };
    }
  }

  // --- Platform Scraper Implementations ---

  const AREA_MAP_104 = {
    '台北市': '6001001000', '新北市': '6001002000', '桃園市': '6001003000',
    '台中市': '6001008000', '台南市': '6001010000', '高雄市': '6001014000',
    '基隆市': '6001004000', '新竹市': '6001005000', '苗栗縣': '6001006000',
    '彰化縣': '6001009000', '南投縣': '6001011000', '雲林縣': '6001012000',
    '嘉義市': '6001013000', '屏東縣': '6001015000', '宜蘭縣': '6001016000',
    '花蓮縣': '6001017000', '台東縣': '6001018000'
  };

  async function get104Details(jobUrl) {
    try {
      const match = jobUrl.match(/\/job\/([a-zA-Z0-9]+)/);
      if (!match) return '';
      const jobId = match[1];
      const res = await fetch(`https://www.104.com.tw/job/ajax/content/${jobId}`, {
        headers: { 'Referer': `https://www.104.com.tw/job/${jobId}` }
      });
      if (!res.ok) return '';
      const data = await res.json();
      const desc = data?.data?.jobDetail?.jobDescription || '';
      const other = data?.data?.jobDetail?.other || '';
      return cleanHtmlText(desc + '\n\n' + other);
    } catch (e) {
      return '';
    }
  }

  async function run104Scraper() {
    log('開始爬取 104 人力銀行...');
    let areaCodes = [];
    for (const loc of targetLocations) {
      if (loc.includes('不限')) { areaCodes = []; break; }
      if (AREA_MAP_104[loc]) areaCodes.push(AREA_MAP_104[loc]);
    }
    const areaParam = areaCodes.length > 0 ? `&area=${areaCodes.join(',')}` : '';

    for (let page = 1; page <= 3; page++) {
      if (window.abortCrawling) return;
      log(`104 載入第 ${page} 頁列表...`);
      const listUrl = `https://c104.api.104.com.tw/web-api-sf/job/search?ro=0&kw=${encodeURIComponent(targetPosition)}&isnew=3&mode=s&page=${page}${areaParam}`;
      
      let res, data;
      try {
        res = await fetch(listUrl);
        if (!res.ok) {
          log(`104 載入失敗 (HTTP ${res.status})，可能已被防爬蟲機制阻擋。`);
          break;
        }
        data = await res.json();
      } catch (err) {
        log(`104 列表載入出錯：${err.message}`);
        break;
      }

      const list = data?.data?.list || [];
      if (list.length === 0) { log('104 無更多職缺。'); break; }

      let matchCount = 0;
      for (const item of list) {
        if (window.abortCrawling) return;
        const title = cleanHtmlText(item.jobName);
        if (!isTitleRelevant(title, targetPosition)) continue;

        const jobUrl = item.link?.job ? `https:${item.link.job}` : '';
        if (!jobUrl) continue;

        matchCount++;

        const isDup = await checkDuplicateInBackend(jobUrl);
        if (isDup) {
          log(`  [重複已略過] ${item.custName} - ${title}`);
          continue;
        }

        log(`104 擷取詳情: ${item.custName} - ${title}`);
        
        const description = await get104Details(jobUrl);
        const jobPayload = {
          title,
          company: cleanHtmlText(item.custName),
          location: cleanHtmlText(item.jobAddrNoDesc || item.addressArea || ''),
          salary: cleanHtmlText(item.salaryDesc || ''),
          url: jobUrl,
          description: description || '請點擊網址查看內容。',
          source: '104'
        };

        const postRes = await postJobToBackend(jobPayload);
        if (postRes.success) {
          log(postRes.duplicated ? `  [重複已略過] ${item.custName}` : `  [成功匯入] ${item.custName}`);
        } else {
          log(`  [匯入失敗] ${item.custName}`);
        }

        await sleep(800); // polite delay
      }
      if (matchCount === 0) log(`104 第 ${page} 頁無相符職缺。`);
      await sleep(1000);
    }
  }

  async function getCakeDetails(jobUrl) {
    try {
      const res = await fetch(jobUrl);
      if (!res.ok) return '';
      const html = await res.text();
      const dom = new DOMParser().parseFromString(html, 'text/html');
      
      // Cake content parser
      const descEl = dom.querySelector('.job-description') || dom.querySelector('[class*="JobDescription"]') || dom.querySelector('[class*="description"]');
      if (descEl) return cleanHtmlText(descEl.innerHTML);
      return cleanHtmlText(html).slice(0, 1000);
    } catch (e) {
      return '';
    }
  }

  async function runCakeScraper() {
    log('開始爬取 Cake...');
    const searchUrl = `https://www.cake.me/jobs?q=${encodeURIComponent(targetPosition)}`;
    
    let res, html;
    try {
      res = await fetch(searchUrl);
      if (!res.ok) {
        log(`Cake 載入失敗 (HTTP ${res.status})，可能已被防爬蟲機制阻擋。`);
        return;
      }
      html = await res.text();
    } catch (err) {
      log(`Cake 載入出錯: ${err.message}`);
      return;
    }

    const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    let jobs = [];

    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        const hits = parsed?.props?.pageProps?.initialState?.algoliaJobs?.hits || 
                     parsed?.props?.pageProps?.initialJobSearchResponse?.results?.[0]?.hits || [];
        
        for (const hit of hits) {
          const rawLoc = hit.location || hit.flat_locations?.join(', ') || '';
          
          // Location filter
          let isLocMatch = targetLocations.includes('台灣 (不限縣市)') || targetLocations.length === 0;
          if (!isLocMatch) {
            for (const loc of targetLocations) {
              const cleanCity = loc.replace('市', '').replace('縣', '');
              if (rawLoc.includes(cleanCity)) { isLocMatch = true; break; }
            }
          }
          if (!isLocMatch) continue;

          const title = cleanHtmlText(hit.title);
          if (!isTitleRelevant(title, targetPosition)) continue;

          jobs.push({
            title,
            company: cleanHtmlText(hit.page?.name || hit.companyName || 'Cake Company'),
            location: cleanHtmlText(rawLoc),
            salary: cleanHtmlText(hit.salary_range || ''),
            url: hit.path ? `https://www.cake.me/jobs/${hit.path}` : `https://www.cake.me/jobs/${hit.uuid}`,
            description: cleanHtmlText(hit.description || hit.description_plain || ''),
            source: 'Cake'
          });
        }
      } catch (e) {
        log('Algolia JSON 解析異常，啟用備用 RegExp 剖析器。');
      }
    }

    // Backup regex parser
    if (jobs.length === 0) {
      const titleMatches = html.matchAll(/<a[^>]*href="([^"]*\/(?:[a-zA-Z]{2}\/)?jobs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
      for (const match of titleMatches) {
        if (window.abortCrawling) return;
        let jobUrl = match[1];
        if (!jobUrl.startsWith('http')) {
          jobUrl = `https://www.cake.me${jobUrl.startsWith('/') ? '' : '/'}${jobUrl}`;
        }
        
        if (jobUrl.match(/\/jobs\/(zh-TW|zh-CN|en|ja|companies|categories|collections|search)(?:\?|\/|$)/i)) continue;
        const pathSegments = jobUrl.split(/\/jobs\//)[1]?.split('/') || [];
        if (pathSegments.length < 1) continue;

        const titleText = cleanHtmlText(match[2]);
        if (!titleText || titleText.length > 80 || !isTitleRelevant(titleText, targetPosition)) continue;

        let company = 'Cake Company';
        if (pathSegments.length >= 2) {
          company = pathSegments[0].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }

        jobs.push({
          title: titleText,
          company,
          location: '雙北市',
          salary: '',
          url: jobUrl,
          description: '',
          source: 'Cake'
        });
      }
    }

    log(`Cake 共偵測到 ${jobs.length} 筆潛在職缺，開始載入詳情...`);
    for (const job of jobs.slice(0, 25)) {
      if (window.abortCrawling) return;

      const isDup = await checkDuplicateInBackend(job.url);
      if (isDup) {
        log(`  [重複已略過] ${job.company} - ${job.title}`);
        continue;
      }

      log(`Cake 詳情: ${job.company} - ${job.title}`);
      
      if (!job.description) {
        job.description = await getCakeDetails(job.url);
      }
      
      const postRes = await postJobToBackend(job);
      if (postRes.success) {
        log(postRes.duplicated ? `  [重複已略過] ${job.company}` : `  [成功匯入] ${job.company}`);
      } else {
        log(`  [匯入失敗] ${job.company}`);
      }
      await sleep(1000);
    }
  }

  async function getLinkedInDetails(jobUrl) {
    try {
      const match = jobUrl.match(/\/view\/(\d+)/) || jobUrl.match(/-(\d+)(?:\?|$)/);
      if (!match) return '';
      const jobId = match[1];
      const detailsUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
      const res = await fetch(detailsUrl);
      if (!res.ok) return '';
      const html = await res.text();
      const descMatch = html.match(/<div class="[^"]*show-more-less-html__markup[^"]*">([\s\S]*?)<\/div>/) || html.match(/<div class="[^"]*description__text[^"]*">([\s\S]*?)<\/div>/);
      if (descMatch) return cleanHtmlText(descMatch[1]);
      return cleanHtmlText(html).slice(0, 1000);
    } catch (e) {
      return '';
    }
  }

  async function runLinkedInScraper() {
    log('開始爬取 LinkedIn Guest Jobs...');
    let locParam = '&location=Taiwan';
    const isGlobal = targetLocations.includes('台灣 (不限縣市)');
    if (!isGlobal) {
      const hasTaipei = targetLocations.includes('台北市') || targetLocations.includes('新北市');
      if (hasTaipei) locParam = '&location=Taipei%20Metropolitan%20Area';
    }

    for (let startNum of [0, 25]) {
      if (window.abortCrawling) return;
      log(`LinkedIn 搜尋起點 ${startNum}...`);
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(targetPosition)}${locParam}&start=${startNum}`;
      
      let res, html;
      try {
        res = await fetch(url);
        if (!res.ok) {
          log(`LinkedIn 載入失敗 (HTTP ${res.status})，可能已被防爬蟲機制阻擋。`);
          break;
        }
        html = await res.text();
      } catch (err) {
        log(`LinkedIn 請求受阻: ${err.message}`);
        break;
      }

      const jobBlocks = html.split('</li>');
      let foundJobs = 0;
      for (const block of jobBlocks) {
        if (window.abortCrawling) return;
        if (!block.includes('base-card')) continue;

        const titleMatch = block.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/);
        const title = titleMatch ? cleanHtmlText(titleMatch[1]) : '';
        if (!title || !isTitleRelevant(title, targetPosition)) continue;

        const companyMatch = block.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/a>/) || block.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/);
        const company = companyMatch ? cleanHtmlText(companyMatch[1]) : 'LinkedIn Employer';
        const linkMatch = block.match(/href="([^"]+)"/);
        const urlLink = linkMatch ? linkMatch[1].split('?')[0] : '';
        const locationMatch = block.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/);
        const rawLoc = locationMatch ? cleanHtmlText(locationMatch[1]) : '';

        if (!urlLink) continue;
        foundJobs++;

        const isDup = await checkDuplicateInBackend(urlLink);
        if (isDup) {
          log(`  [重複已略過] ${company} - ${title}`);
          continue;
        }

        log(`LinkedIn 詳情: ${company} - ${title}`);
        const description = await getLinkedInDetails(urlLink);
        
        const jobPayload = {
          title,
          company,
          location: rawLoc,
          salary: '',
          url: urlLink,
          description: description || '請進入網址以閱讀詳情。',
          source: 'LinkedIn'
        };

        const postRes = await postJobToBackend(jobPayload);
        if (postRes.success) {
          log(postRes.duplicated ? `  [重複已略過] ${company}` : `  [成功匯入] ${company}`);
        } else {
          log(`  [匯入失敗] ${company}`);
        }
        await sleep(1200); // throttle to avoid heavy LinkedIn WAF block
      }
      if (foundJobs === 0) log('LinkedIn 此分段無相符職缺。');
      await sleep(1500);
    }
  }

  async function get1111Details(jobUrl) {
    try {
      const res = await fetch(jobUrl);
      if (!res.ok) return '';
      const html = await res.text();
      const descMatch = html.match(/class="[^"]*whitespace-pre-line[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                        html.match(/<div class="[^"]*job_description[^"]*">([\s\S]*?)<\/div>/i) || 
                        html.match(/<div class="[^"]*job_info_content[^"]*">([\s\S]*?)<\/div>/i);
      if (descMatch) return cleanHtmlText(descMatch[1]);
      return cleanHtmlText(html).slice(0, 1000);
    } catch (e) {
      return '';
    }
  }

  async function run1111Scraper() {
    log('開始爬取 1111 人力銀行...');
    let augmentedKw = targetPosition;
    if (!targetLocations.includes('台灣 (不限縣市)')) {
      const cities = targetLocations.map(l => l.replace('市', '').replace('縣', ''));
      if (cities.length > 0) {
        augmentedKw += ' ' + cities.join(' ');
      }
    }

    for (let page = 1; page <= 2; page++) {
      if (window.abortCrawling) return;
      log(`1111 載入第 ${page} 頁列表...`);
      const searchUrl = `https://www.1111.com.tw/search/job?ks=${encodeURIComponent(augmentedKw)}&page=${page}`;
      
      let res, html;
      try {
        res = await fetch(searchUrl);
        if (!res.ok) {
          log(`1111 載入失敗 (HTTP ${res.status})，可能已被防爬蟲機制阻擋。`);
          break;
        }
        html = await res.text();
      } catch (err) {
        log(`1111 請求失敗：${err.message}`);
        break;
      }

      const linkRegex = /href="([^"]*job\/\d+[^"]*)"[^>]*title="([^"]+)"/g;
      const links = [...html.matchAll(linkRegex)];

      if (links.length === 0) { log('1111 無更多職缺。'); break; }

      let matchCount = 0;
      for (const link of links) {
        if (window.abortCrawling) return;
        const rawUrl = link[1];
        const jobUrl = rawUrl.startsWith('http') ? rawUrl : (rawUrl.startsWith('//') ? `https:${rawUrl}` : `https://www.1111.com.tw${rawUrl}`);
        const title = cleanHtmlText(link[2]);

        if (!isTitleRelevant(title, targetPosition)) continue;

        matchCount++;
        
        // Find company snippet
        const jobIndex = html.indexOf(link[0]);
        let company = '1111 雇主';
        if (jobIndex !== -1) {
          const snippet = html.slice(jobIndex, jobIndex + 1500);
          const corpMatch = snippet.match(/href="\/corp\/\d+[^"]*"[^>]*title="([^"]+)"/) || snippet.match(/>([^<]+公司)</);
          if (corpMatch) company = cleanHtmlText(corpMatch[1]);
        }

        const isDup = await checkDuplicateInBackend(jobUrl);
        if (isDup) {
          log(`  [重複已略過] ${company} - ${title}`);
          continue;
        }

        log(`1111 擷取詳情: ${company} - ${title}`);
        const description = await get1111Details(jobUrl);

        const jobPayload = {
          title,
          company,
          location: '雙北市',
          salary: '面議',
          url: jobUrl,
          description: description || '請到 1111 人力銀行閱讀詳情。',
          source: '1111'
        };

        const postRes = await postJobToBackend(jobPayload);
        if (postRes.success) {
          log(postRes.duplicated ? `  [重複已略過] ${company}` : `  [成功匯入] ${company}`);
        } else {
          log(`  [匯入失敗] ${company}`);
        }
        await sleep(1500); // Increased delay to prevent WAF 403 block on 1111
      }
      if (matchCount === 0) log(`1111 第 ${page} 頁無相符職缺。`);
      await sleep(1500);
    }
  }

  // --- Scraper Orchestration ---

  async function startCrawling() {
    if (isCrawling) return;
    isCrawling = true;
    window.abortCrawling = false;

    crawlStartBtn.setAttribute('disabled', 'true');
    crawlStopBtn.removeAttribute('disabled');
    chk104.setAttribute('disabled', 'true');
    chkCake.setAttribute('disabled', 'true');
    chkLinkedIn.setAttribute('disabled', 'true');
    chk1111.setAttribute('disabled', 'true');

    crawlLog.textContent = '==== 爬蟲啟動 ====';
    log(`職缺目標：${targetPosition}`);
    log(`地區過濾：${targetLocations.join(', ')}`);

    try {
      if (chk104.checked && !window.abortCrawling) {
        await run104Scraper();
      }
      if (chkCake.checked && !window.abortCrawling) {
        await runCakeScraper();
      }
      if (chkLinkedIn.checked && !window.abortCrawling) {
        await runLinkedInScraper();
      }
      if (chk1111.checked && !window.abortCrawling) {
        await run1111Scraper();
      }
      
      if (window.abortCrawling) {
        log('==== 爬蟲已停止 ====');
      } else {
        log('==== 爬蟲全部完成 ====');
      }
    } catch (err) {
      console.error(err);
      log(`[錯誤] 爬網過程發生異常：${err.message}`);
    } finally {
      isCrawling = false;
      crawlStartBtn.removeAttribute('disabled');
      crawlStopBtn.setAttribute('disabled', 'true');
      chk104.removeAttribute('disabled');
      chkCake.removeAttribute('disabled');
      chkLinkedIn.removeAttribute('disabled');
      chk1111.removeAttribute('disabled');
    }
  }

  function stopCrawling() {
    window.abortCrawling = true;
    log('收到停止指令，正在中斷連線與迴圈...');
    crawlStopBtn.setAttribute('disabled', 'true');
  }

  // --- Event Listeners ---

  // Single page manual import
  scrapeBtn.addEventListener('click', () => {
    showStatus('正在擷取網頁內容...', 'loading');
    scrapeBtn.setAttribute('disabled', 'true');

    chrome.tabs.sendMessage(activeTab.id, { action: 'scrape' }, async (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        showStatus('網頁擷取錯誤，請確認此頁為特定職缺詳細頁。', 'error');
        scrapeBtn.removeAttribute('disabled');
        return;
      }

      showStatus('正在匯入至資料庫...', 'loading');
      const payload = {
        title: response.title,
        company: response.company,
        location: response.location || '',
        salary: response.salary || '',
        url: activeTab.url,
        description: response.description || '',
        source: response.source || 'Extension'
      };

      const res = await postJobToBackend(payload);
      if (res.success) {
        showStatus(res.duplicated ? '此職缺之前已匯入過！' : '成功匯入此職缺！', 'success');
      } else {
        showStatus('儲存失敗，請確認後台伺服器已啟動。', 'error');
        scrapeBtn.removeAttribute('disabled');
      }
    });
  });

  // Automated Crawling triggers
  crawlStartBtn.addEventListener('click', startCrawling);
  crawlStopBtn.addEventListener('click', stopCrawling);

  // Initialize
  await syncPreferences();
  await initActiveTabCheck();
});
