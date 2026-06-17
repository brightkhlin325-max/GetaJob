import { createContext, useState, useEffect } from 'react';

export const LanguageContext = createContext({
  language: 'zh',
  setLanguage: () => {},
  t: (key) => key,
});

const translations = {
  zh: {
    // Header
    home: '首頁',
    settings: '設定',
    brand: 'GetaJob — AI 智慧求職助手',
    
    // Resume Panel
    resumeTitle: '履歷管理',
    uploadResume: '＋ 上傳 PDF / 文字履歷',
    parsingResume: '解析履歷中...',
    noResume: '尚未上傳履歷。',
    activeResume: '啟用',
    deleteResume: '刪除履歷',
    
    // Scraper Panel
    scraperTitle: '多平台職缺爬蟲',
    aiPlannerTitle: 'AI 關鍵字規劃助理',
    aiPlannerPlaceholder: '用自然語言輸入想法，例如：想找 PM，要綠能/硬體整合、有 5 年經驗...',
    aiPlannerButton: 'AI 規劃關鍵字',
    aiPlanning: 'AI 分析中...',
    aiSuggestion: '🎯 AI 建議與分析：',
    suggestedIndustry: '📌 建議產業：',
    locationTaipeiBoth: '雙北市',
    locationTaipei: '台北市',
    locationNewTaipei: '新北市',
    locationGlobal: '全球',
    keywordPlaceholder: '關鍵字，如：前端工程師',
    startScraping: '開始爬取職缺',
    scrapingProgress: '正在爬取中...',
    scrapingStarted: '背景爬網已啟動！',
    aiFilterOption: '🤖 啟用 AI 相關性過濾 (自動過濾無關職缺)',
    selectPlatformAlert: '請至少選擇一個平台進行爬取。',
    enterKeywordAlert: '請輸入搜尋關鍵字。',
    
    // AI Settings (Now in separate page)
    aiSettingsTitle: 'AI 服務整合設定',
    aiProviderLabel: '使用 AI 核心模型',
    saveSettings: '儲存設定',
    saveSettingsSuccess: '設定儲存成功！',
    saveSettingsFailed: '設定儲存失敗',
    
    // Main Section
    trackedJobs: '追蹤的職缺職位',
    aiSortButton: '✨ AI 推薦排序',
    aiSorting: '評估推薦中...',
    manualAddButton: '＋ 手動新增職缺',
    filterPlaceholder: '篩選職稱 / 公司 / 描述...',
    filterLocationPlaceholder: '篩選地區...',
    allStatus: '全部狀態',
    interested: '有興趣',
    applied: '已申請',
    interviewing: '面試中',
    offered: '已錄取',
    rejected: '被拒絕',
    noJobs: '目前無相符職缺。',
    noJobsSub: '請先透過爬蟲搜尋匯入，或點選手動新增按鈕加入您的第一筆追蹤職缺！',
    
    // Swipe View
    swipeProgress: '📋 汰選進度：',
    swipeCongrats: '🎉 恭喜！已完成所有職缺汰選！',
    swipeCongratsSub: '所有職缺已整理完畢，您可以點選上方切換至「網格」或「條列」檢視。',
    restartSwipe: '重新汰選',
    fitScore: '契合',
    
    // Settings Page
    settingsTitle: 'GetaJob 偏好設定',
    appearanceTitle: '外觀與樣式設定',
    themeLabel: '介面主題',
    languageLabel: '顯示語言',
    darkTheme: '深色主題 (Dark)',
    lightTheme: '淺色主題 (Light)',
    selectLang: '選擇語言',
    modelSettings: 'AI 模型設定 (API 金鑰)',
  },
  en: {
    // Header
    home: 'Home',
    settings: 'Settings',
    brand: 'GetaJob — AI Career Assistant',
    
    // Resume Panel
    resumeTitle: 'Resume Management',
    uploadResume: '＋ Upload PDF / TXT Resume',
    parsingResume: 'Parsing Resume...',
    noResume: 'No resume uploaded yet.',
    activeResume: 'Active',
    deleteResume: 'Delete Resume',
    
    // Scraper Panel
    scraperTitle: 'Job Scraper',
    aiPlannerTitle: 'AI Keyword Planner',
    aiPlannerPlaceholder: 'Enter your thoughts in natural language, e.g.: looking for PM, green energy/hardware integration, 5 years exp...',
    aiPlannerButton: 'AI Plan Keywords',
    aiPlanning: 'AI Analyzing...',
    aiSuggestion: '🎯 AI Suggestion:',
    suggestedIndustry: '📌 Suggested Industry:',
    locationTaipeiBoth: 'Taipei & New Taipei',
    locationTaipei: 'Taipei City',
    locationNewTaipei: 'New Taipei',
    locationGlobal: 'Global',
    keywordPlaceholder: 'Keywords, e.g. Frontend Developer',
    startScraping: 'Start Scraping Jobs',
    scrapingProgress: 'Scraping...',
    scrapingStarted: 'Background scraping started!',
    aiFilterOption: '🤖 Enable AI Filter (Filter irrelevant jobs)',
    selectPlatformAlert: 'Please select at least one platform to scrape.',
    enterKeywordAlert: 'Please enter search keyword.',
    
    // AI Settings
    aiSettingsTitle: 'AI Service Integration',
    aiProviderLabel: 'Select AI Model Provider',
    saveSettings: 'Save Settings',
    saveSettingsSuccess: 'Settings saved successfully!',
    saveSettingsFailed: 'Failed to save settings',
    
    // Main Section
    trackedJobs: 'Tracked Job Positions',
    aiSortButton: '✨ AI Recommend Sort',
    aiSorting: 'Evaluating Fit...',
    manualAddButton: '＋ Add Job Manually',
    filterPlaceholder: 'Filter by title, company, description...',
    filterLocationPlaceholder: 'Filter by location...',
    allStatus: 'All Status',
    interested: 'Interested',
    applied: 'Applied',
    interviewing: 'Interviewing',
    offered: 'Offered',
    rejected: 'Rejected',
    noJobs: 'No matching jobs found.',
    noJobsSub: 'Use the scraper to import jobs or click manual add to start tracking your jobs!',
    
    // Swipe View
    swipeProgress: '📋 Progress: ',
    swipeCongrats: '🎉 Congrats! Finished vetting all jobs!',
    swipeCongratsSub: 'All jobs are vetted. Switch to Grid or List view above to inspect them.',
    restartSwipe: 'Restart Vetting',
    fitScore: 'Match',
    
    // Settings Page
    settingsTitle: 'GetaJob Preferences',
    appearanceTitle: 'Appearance Settings',
    themeLabel: 'Interface Theme',
    languageLabel: 'Display Language',
    darkTheme: 'Dark Theme',
    lightTheme: 'Light Theme',
    selectLang: 'Select Language',
    modelSettings: 'AI Model Settings (API Keys)',
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('zh');

  useEffect(() => {
    const saved = localStorage.getItem('getaJobLanguage');
    if (saved) {
      setLanguage(saved);
    }
  }, []);

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('getaJobLanguage', lang);
  };

  const t = (key) => {
    return translations[language]?.[key] || translations['zh']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
