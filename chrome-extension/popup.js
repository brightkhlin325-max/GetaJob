document.addEventListener('DOMContentLoaded', async () => {
  const titleEl = document.getElementById('page-title');
  const urlEl = document.getElementById('page-url');
  const scrapeBtn = document.getElementById('scrape-btn');
  const statusMsg = document.getElementById('status-msg');

  // Helper to show status
  function showStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = 'status ' + type;
  }

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    titleEl.textContent = '無作用中的分頁';
    return;
  }

  const url = tab.url || '';
  urlEl.textContent = url.length > 40 ? url.substring(0, 37) + '...' : url;

  // Check if supported site
  const isSupported = /linkedin\.com|indeed\.com|glassdoor\.com|104\.com\.tw|cakeresume\.com|cake\.me|1111\.com\.tw/.test(url);
  if (isSupported) {
    titleEl.textContent = '偵測到支援的職缺網站';
    scrapeBtn.removeAttribute('disabled');

    const isListPage = url.includes('/search') || url.includes('/jobs?') || (url.includes('cake.me/jobs') && !url.includes('/jobs/')) || (url.includes('104.com.tw/jobs/search') && !url.includes('/job/'));
    if (isListPage) {
      showStatus('⚠️ 偵測到搜尋列表頁。請進入特定職缺的「詳細頁面」後再點擊匯入。', 'error');
    }
  } else {
    titleEl.textContent = '不支援此網站';
    urlEl.textContent = '請前往 104、Cake (CakeResume)、LinkedIn、Indeed、1111 或 Glassdoor。';
    scrapeBtn.setAttribute('disabled', 'true');
  }

  scrapeBtn.addEventListener('click', () => {
    showStatus('正在擷取職缺資料...', 'loading');
    scrapeBtn.setAttribute('disabled', 'true');

    // Message content.js to extract data
    chrome.tabs.sendMessage(tab.id, { action: 'scrape' }, async (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        showStatus('網頁擷取錯誤，請確保網頁已完全載入。', 'error');
        scrapeBtn.removeAttribute('disabled');
        return;
      }

      showStatus('正在儲存至 GetaJob...', 'loading');
      try {
        const payload = {
          title: response.title,
          company: response.company,
          location: response.location,
          salary: response.salary,
          url: url,
          description: response.description,
          source: response.source
        };

        let res;
        try {
          // Try port 3000 first
          res = await fetch('http://localhost:3000/api/scrape/extension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (e3000) {
          // Fallback to port 3001
          res = await fetch('http://localhost:3001/api/scrape/extension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        const data = await res.json();
        if (res.ok && data.success) {
          showStatus('成功匯入職缺！', 'success');
        } else {
          showStatus(data.error || '伺服器拒絕請求', 'error');
          scrapeBtn.removeAttribute('disabled');
        }
      } catch (err) {
        console.error(err);
        showStatus('網路錯誤，請確認 GetaJob 伺服器正在運行。', 'error');
        scrapeBtn.removeAttribute('disabled');
      }
    });
  });
});
