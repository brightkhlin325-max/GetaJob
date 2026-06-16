// Listen for message from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape') {
    try {
      const data = scrapeJobPage();
      sendResponse(data);
    } catch (err) {
      sendResponse({ error: err.message });
    }
  }
  return true; // Keep message channel open for async response if needed
});

function scrapeJobPage() {
  const url = window.location.href;
  let title = '';
  let company = '';
  let location = '';
  let salary = '';
  let description = '';
  let source = '';

  if (url.includes('104.com.tw')) {
    source = '104';
    // Title
    title = document.querySelector('h1, [class*="job-header__title"], .job-header__title')?.innerText || '';
    // Company
    company = document.querySelector('[class*="company"] a, .company-name, [class*="job-header__btn-company"]')?.innerText || '';
    if (!company) {
      const compAnchor = document.querySelector('a[href*="company"]');
      if (compAnchor) company = compAnchor.innerText;
    }
    // Location
    location = document.querySelector('[class*="job-address"], [class*="job-header-info__item"]') &&
               document.querySelector('[class*="job-address"]')?.innerText || '';
    // Salary
    salary = document.querySelector('.job-description-table__data, [class*="job-meta"]')?.innerText || '';
    // Description
    description = document.querySelector('.job-description-detail, [class*="job-detail-content"], .job-description__content')?.innerText || '';
  } else if (url.includes('cakeresume.com') || url.includes('cake.me')) {
    source = 'Cake';
    title = document.querySelector('h1, [class*="jobTitle"], .job-title')?.innerText || '';
    company = document.querySelector('[class*="companyName"], .company-name, [class*="companyTitle"]')?.innerText || '';
    location = document.querySelector('[class*="location"], .location')?.innerText || '';
    salary = document.querySelector('[class*="salary"], .salary')?.innerText || '';
    description = document.querySelector('[class*="description"], .job-description, [class*="jobDescription"]')?.innerText || '';
  } else if (url.includes('linkedin.com')) {
    source = 'LinkedIn';
    title = document.querySelector('.job-details-jobs-unified-top-card__job-title, h1')?.innerText || '';
    company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')?.innerText || '';
    location = document.querySelector('.job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__bullet')?.innerText || '';
    description = document.querySelector('.jobs-description__content, #job-details, .job-details-jobs-unified-top-card__description-container')?.innerText || '';
  } else if (url.includes('1111.com.tw')) {
    source = '1111';
    title = document.querySelector('h1, .job_title, [class*="jobTitle"]')?.innerText || '';
    company = document.querySelector('a[href*="/corp/"], .company_name, [class*="companyName"]')?.innerText || '';
    location = document.querySelector('.job_info, .job_item_detail, [class*="jobInfo"]')?.innerText || '';
    salary = document.querySelector('.salary, .job_item_salary, [class*="salary"]')?.innerText || '';
    description = document.querySelector('.job_description, .job_info_content, [class*="whitespace-pre-line"], .content')?.innerText || '';
  } else {
    // Fallback for indeed, glassdoor, and generic pages
    source = url.includes('indeed.com') ? 'Indeed' : (url.includes('glassdoor.com') ? 'Glassdoor' : 'Web');
    title = document.querySelector('h1')?.innerText || document.title || '';
    company = document.querySelector('[class*="company"], [class*="Company"], [id*="company"]')?.innerText || '';
    description = document.body.innerText;
  }

  // Clean up whitespace
  title = title.trim();
  company = company.trim().replace(/\s+/g, ' ');
  location = location.trim().replace(/\s+/g, ' ');
  salary = salary.trim().replace(/\s+/g, ' ');
  description = description.trim();

  // If title/company parsing still empty, do last-ditch fallback
  if (!title) title = document.title;
  if (!company) company = 'Unknown Company';

  return {
    title,
    company,
    location,
    salary,
    description,
    source
  };
}
