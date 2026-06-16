import { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import JobCard from '../components/JobCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [settings, setSettings] = useState({ 
    ai_provider: 'gemini',
    gemini_api_key: '', 
    openai_api_key: '', 
    anthropic_api_key: '' 
  });
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showJobModal, setShowJobModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewResume, setPreviewResume] = useState(null);

  // Form states
  const [newJob, setNewJob] = useState({ title: '', company: '', location: '', salary: '', url: '', description: '', status: 'Interested' });
  const [editingJobId, setEditingJobId] = useState(null);
  const [scraperKeyword, setScraperKeyword] = useState('');
  const [scraperLoading, setScraperLoading] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);

  // AI keyword planner states
  const [aiKeywordQuery, setAiKeywordQuery] = useState('');
  const [isPlanningKeywords, setIsPlanningKeywords] = useState(false);
  const [aiPlanResult, setAiPlanResult] = useState(null);

  // Filter states
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // AI recommending state
  const [isAiRecommending, setIsAiRecommending] = useState(false);

  // Scraper selections
  const [selectedPlatforms, setSelectedPlatforms] = useState(['104', 'cakeresume', 'linkedin', '1111']);
  const [searchLocation, setSearchLocation] = useState('taipei_both');

  // Selected details for modals
  const [selectedJobForAnalysis, setSelectedJobForAnalysis] = useState(null);
  const [selectedJobForLetter, setSelectedJobForLetter] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [coverLetterText, setCoverLetterText] = useState('');
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);

  // View mode and Swiper states
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', 'swipe'
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swipeAction, setSwipeAction] = useState(null); // 'left', 'right', or null
  const [aiFilterEnabled, setAiFilterEnabled] = useState(false);

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      fetchJobs(),
      fetchResumes(),
      fetchSettings()
    ]).finally(() => setLoading(false));
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (data.success) setJobs(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchResumes = async () => {
    try {
      const res = await fetch('/api/resumes');
      const data = await res.json();
      if (data.success) setResumes(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data) {
        setSettings({
          ai_provider: data.ai_provider || 'gemini',
          gemini_api_key: data.gemini_api_key || '',
          openai_api_key: data.openai_api_key || '',
          anthropic_api_key: data.anthropic_api_key || ''
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Job Actions
  const handleSaveJob = async () => {
    const isEdit = !!editingJobId;
    const url = '/api/jobs';
    const method = isEdit ? 'PUT' : 'POST';
    const body = isEdit ? { id: editingJobId, ...newJob } : newJob;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      setShowJobModal(false);
      setNewJob({ title: '', company: '', location: '', salary: '', url: '', description: '', status: 'Interested' });
      setEditingJobId(null);
      fetchJobs();
    }
  };

  const handleDeleteJob = async (id) => {
    if (confirm('確定要刪除此職缺嗎？')) {
      await fetch(`/api/jobs?id=${id}`, { method: 'DELETE' });
      fetchJobs();
    }
  };

  const handleSwipeLeft = async (id) => {
    setSwipeAction('left');
    setTimeout(async () => {
      await fetch(`/api/jobs?id=${id}`, { method: 'DELETE' });
      await fetchJobs();
      setSwipeAction(null);
    }, 250);
  };

  const handleSwipeRight = () => {
    setSwipeAction('right');
    setTimeout(() => {
      setSwipeIndex((prev) => prev + 1);
      setSwipeAction(null);
    }, 250);
  };

  // Resume Actions
  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeUploading(true);
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch('/api/resumes', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        alert('履歷上傳與解析成功！');
        fetchResumes();
      } else {
        alert(data.error || '履歷上傳失敗');
      }
    } catch (err) {
      console.error(err);
      alert('上傳履歷時發生錯誤');
    } finally {
      setResumeUploading(false);
    }
  };

  const handleSetActiveResume = async (id) => {
    const res = await fetch(`/api/resumes?id=${id}`, { method: 'PUT' });
    if (res.ok) {
      fetchResumes();
      fetchJobs();
    } else {
      alert('無法啟用該履歷');
    }
  };

  const handleDeleteResume = async (id) => {
    if (confirm('確定要刪除此履歷嗎？')) {
      await fetch(`/api/resumes?id=${id}`, { method: 'DELETE' });
      fetchResumes();
      fetchJobs();
    }
  };

  // Settings Action
  const handleSaveSettings = async () => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (data.success) {
      alert('設定儲存成功！');
    } else {
      alert('設定儲存失敗');
    }
  };

  // Joint Multi-Platform Scraper Action
  const handleScrapeJobs = async () => {
    if (!scraperKeyword.trim()) return;
    if (selectedPlatforms.length === 0) {
      alert('請至少選擇一個平台進行爬取。');
      return;
    }
    setScraperLoading(true);
    try {
      const res = await fetch('/api/scrape/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: scraperKeyword,
          platforms: selectedPlatforms,
          location: searchLocation,
          aiFilter: aiFilterEnabled
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`成功從 ${selectedPlatforms.join(', ')} 爬取並匯入 ${data.count} 筆職缺！`);
        setScraperKeyword('');
        fetchJobs();
      } else {
        alert(data.error || '爬取職缺失敗');
      }
    } catch (e) {
      console.error(e);
      alert('搜尋職缺時發生錯誤');
    } finally {
      setScraperLoading(false);
    }
  };

  // AI Keyword Planning Action
  const handlePlanKeywords = async () => {
    if (!aiKeywordQuery.trim()) return;
    setIsPlanningKeywords(true);
    try {
      const res = await fetch('/api/ai/plan-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiKeywordQuery })
      });
      const data = await res.json();
      if (data.success) {
        setAiPlanResult(data.data);
      } else {
        alert(data.error || '規劃關鍵字失敗');
      }
    } catch (e) {
      console.error(e);
      alert('AI 規劃時發生錯誤');
    } finally {
      setIsPlanningKeywords(false);
    }
  };

  // AI Fit Analysis
  const triggerJobAnalysis = async (job) => {
    setSelectedJobForAnalysis(job);
    setAnalysisResult(null);
    setAnalysisLoading(true);
    setShowAnalysisModal(true);

    try {
      const res = await fetch('/api/ai/analyze-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id })
      });
      const data = await res.json();
      if (data.success) {
        setAnalysisResult(data.data);
        fetchJobs();
      } else {
        alert(data.error || '媒合分析失敗。');
        setShowAnalysisModal(false);
      }
    } catch (err) {
      console.error(err);
      alert('進行 AI 分析時發生錯誤。');
      setShowAnalysisModal(false);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // AI Cover Letter
  const triggerCoverLetter = async (job) => {
    setSelectedJobForLetter(job);
    setCoverLetterText(job.cover_letter || '');
    setCoverLetterLoading(false);
    setShowCoverLetterModal(true);
  };

  const generateLetter = async () => {
    setCoverLetterLoading(true);
    try {
      const res = await fetch('/api/ai/generate-cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJobForLetter.id })
      });
      const data = await res.json();
      if (data.success) {
        setCoverLetterText(data.data.coverLetter);
        fetchJobs();
      } else {
        alert(data.error || '生成求職信失敗。');
      }
    } catch (err) {
      console.error(err);
      alert('生成求職信時發生錯誤。');
    } finally {
      setCoverLetterLoading(false);
    }
  };

  const handleCopyLetter = () => {
    navigator.clipboard.writeText(coverLetterText);
    alert('求職信已複製到剪貼簿！');
  };

  const handleAiSort = async () => {
    if (jobs.length === 0) return;
    const activeRes = resumes.find(r => r.is_active === 1);
    if (!activeRes) {
      alert('請先上傳並啟用一份履歷！');
      return;
    }
    setIsAiRecommending(true);
    try {
      const unscoredJobs = jobs.filter(j => j.match_score === null || j.match_score === undefined);
      if (unscoredJobs.length > 0) {
        alert(`正在使用啟用的履歷為 ${unscoredJobs.length} 個尚未分析的職缺評估契合度評分，請稍候...`);
        for (const job of unscoredJobs) {
          await fetch('/api/ai/analyze-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id })
          });
        }
        await fetchJobs();
      }
      setJobs(prevJobs => [...prevJobs].sort((a, b) => (b.match_score || 0) - (a.match_score || 0)));
      alert('已根據履歷合適度完成 AI 推薦排序！');
    } catch (err) {
      console.error(err);
      alert('推薦排序失敗。');
    } finally {
      setIsAiRecommending(false);
    }
  };

  const activeResume = resumes.find(r => r.is_active === 1);

  // Apply filters locally
  const filteredJobs = jobs.filter(job => {
    if (filterKeyword && 
        !job.title.toLowerCase().includes(filterKeyword.toLowerCase()) && 
        !job.company.toLowerCase().includes(filterKeyword.toLowerCase()) && 
        !(job.description || '').toLowerCase().includes(filterKeyword.toLowerCase())) {
      return false;
    }
    if (filterLocation && !(job.location || '').toLowerCase().includes(filterLocation.toLowerCase())) {
      return false;
    }
    if (filterStatus !== 'All' && job.status !== filterStatus) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <Head>
        <title>GetaJob — AI 智慧求職助手</title>
      </Head>

      {/* Bauhaus Artwork Geometric shapes in background */}
      <div className="bg-glow-container">
        <div className="bg-glow-sphere sphere-red"></div>
        <div className="bg-glow-sphere sphere-blue"></div>
        <div className="bg-glow-sphere sphere-yellow"></div>
      </div>

      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <Header />

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6rem' }}><LoadingSpinner /></div>
        ) : (
          /* Dual-column Art Gallery Layout */
          <div className="main-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
            
            {/* Left Column: Side Control Panel (Resume, Settings, Scraper) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'start' }}>
              
              {/* Resumes Panel */}
              <div className="glass-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                <h2 style={{ fontSize: '1.2rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📄</span> 履歷管理
                </h2>
                
                <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                  <label className="glass-btn" style={{ display: 'block', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                    {resumeUploading ? '解析履歷中...' : '＋ 上傳 PDF / 文字履歷'}
                    <input type="file" accept=".pdf,.txt" onChange={handleResumeUpload} disabled={resumeUploading} style={{ display: 'none' }} />
                  </label>
                </div>

                {resumes.length === 0 ? (
                  <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--color-secondary)' }}>尚未上傳履歷。</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                    {resumes.map(r => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: r.is_active ? 'rgba(74, 122, 150, 0.12)' : 'rgba(0,0,0,0.02)', padding: '0.4rem 0.6rem', borderRadius: '6px', border: r.is_active ? '2px solid var(--color-accent)' : '2px solid var(--glass-border)', boxShadow: r.is_active ? '2px 2px 0px var(--color-accent)' : 'none' }}>
                        <span 
                          onClick={() => { setPreviewResume(r); setShowPreviewModal(true); }}
                          style={{ fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px', fontWeight: r.is_active ? '700' : 'normal', cursor: 'pointer', textDecoration: 'underline' }} 
                          title="點擊預覽履歷內文"
                        >
                          {r.file_name} {r.is_active ? '⭐' : ''}
                        </span>
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                          {!r.is_active && (
                            <button onClick={() => handleSetActiveResume(r.id)} style={{ fontSize: '0.7rem', cursor: 'pointer', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontWeight: '700' }}>
                              啟用
                            </button>
                          )}
                          <button onClick={() => handleDeleteResume(r.id)} style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', border: '2px solid var(--glass-border)', background: 'var(--bauhaus-red)', color: '#fff', padding: 0 }} title="刪除履歷">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Multi-Platform Scraper Panel */}
              <div className="glass-card" style={{ borderLeft: '4px solid var(--bauhaus-yellow)' }}>
                <h2 style={{ fontSize: '1.2rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🔍</span> 多平台職缺爬蟲
                </h2>
                
                {/* AI Keyword Planner Assistant Section */}
                <div style={{ background: 'rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: '6px', border: '2px solid var(--glass-border)', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '800' }}>
                    <span>💡</span> AI 關鍵字規劃助理
                  </h4>
                  <textarea
                    placeholder="用自然語言輸入想法，例如：想找 PM，要綠能/硬體整合、有 5 年經驗..."
                    value={aiKeywordQuery}
                    onChange={(e) => setAiKeywordQuery(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', fontSize: '0.75rem', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', resize: 'none' }}
                  />
                  <button
                    onClick={handlePlanKeywords}
                    disabled={isPlanningKeywords}
                    className="glass-btn"
                    style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem', marginTop: '0.4rem', border: '2px solid var(--glass-border)', boxShadow: '2px 2px 0px var(--glass-border)' }}
                  >
                    {isPlanningKeywords ? 'AI 分析中...' : 'AI 規劃關鍵字'}
                  </button>
                  
                  {aiPlanResult && (
                    <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', borderTop: '1px dashed var(--glass-border)', paddingTop: '0.5rem' }}>
                      <p style={{ margin: '0 0 0.3rem 0', fontWeight: '800', color: 'var(--color-accent)' }}>🎯 AI 建議與分析：</p>
                      <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-secondary)', lineHeight: '1.4' }}>{aiPlanResult.explanation}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', margin: '0.4rem 0' }}>
                        {aiPlanResult.keywords?.map((kw, idx) => (
                          <span
                            key={idx}
                            onClick={() => setScraperKeyword(kw)}
                            style={{ background: 'var(--bauhaus-yellow)', border: '2px solid var(--glass-border)', padding: '0.15rem 0.45rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '800', fontSize: '0.7rem' }}
                            title="點擊帶入此搜尋關鍵字"
                          >
                            🔑 {kw}
                          </span>
                        ))}
                      </div>
                      {aiPlanResult.suggestedFilters && (
                        <p style={{ margin: '0', color: 'var(--color-secondary)', fontSize: '0.7rem' }}>
                          📌 建議產業：<strong>{aiPlanResult.suggestedFilters.industry}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {/* Location Select */}
                    <select
                      value={searchLocation}
                      onChange={(e) => setSearchLocation(e.target.value)}
                      style={{ padding: '0.4rem 0.5rem', borderRadius: 'var(--radius)', border: '2px solid var(--glass-border)', background: '#2e303f', color: '#ffffff', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="taipei_both">雙北市</option>
                      <option value="taipei">台北市</option>
                      <option value="new_taipei">新北市</option>
                      <option value="global">全球</option>
                    </select>

                    <input
                      placeholder="關鍵字，如：前端工程師"
                      value={scraperKeyword}
                      onChange={(e) => setScraperKeyword(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 'var(--radius)', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>
                  
                  <button onClick={handleScrapeJobs} disabled={scraperLoading} className="glass-btn" style={{ width: '100%', marginTop: '0.25rem' }}>
                    {scraperLoading ? '正在爬取職缺細節中...' : '開始爬取職缺'}
                  </button>
                </div>

                {/* Platforms Grid Checkboxes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: '6px' }}>
                  {['104', 'Cake', 'LinkedIn', '1111'].map(platform => {
                    const val = platform === 'Cake' ? 'cakeresume' : platform.toLowerCase();
                    const isChecked = selectedPlatforms.includes(val);
                    return (
                      <label key={platform} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8rem', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedPlatforms(selectedPlatforms.filter(p => p !== val));
                            } else {
                              setSelectedPlatforms([...selectedPlatforms, val]);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        {platform}
                      </label>
                    );
                  })}
                </div>

                {/* AI Relevance Filter Option */}
                <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(129, 140, 248, 0.08)', borderRadius: '6px', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '800', color: '#818cf8', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={aiFilterEnabled}
                      onChange={(e) => setAiFilterEnabled(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    🤖 啟用 AI 相關性過濾 (自動過濾無關職缺)
                  </label>
                </div>
              </div>

              {/* Multi-Provider AI Settings Panel */}
              <div className="glass-card" style={{ borderLeft: '4px solid var(--bauhaus-red)' }}>
                <h2 style={{ fontSize: '1.2rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚙️</span> AI 服務整合設定
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.25rem' }}>使用 AI 核心模型</label>
                    <select
                      value={settings.ai_provider}
                      onChange={(e) => setSettings({ ...settings, ai_provider: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: 'var(--radius)', border: '2px solid var(--glass-border)', background: '#2e303f', color: '#ffffff', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="gemini">Google Gemini (推薦)</option>
                      <option value="openai">OpenAI ChatGPT</option>
                      <option value="anthropic">Anthropic Claude</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.25rem' }}>Gemini API Key</label>
                    <input
                      type="password"
                      placeholder="輸入 Gemini API Key"
                      value={settings.gemini_api_key}
                      onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius)', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.25rem' }}>OpenAI API Key</label>
                    <input
                      type="password"
                      placeholder="輸入 OpenAI API Key"
                      value={settings.openai_api_key}
                      onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius)', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '800', display: 'block', marginBottom: '0.25rem' }}>Claude API Key</label>
                    <input
                      type="password"
                      placeholder="輸入 Claude/Anthropic API Key"
                      value={settings.anthropic_api_key}
                      onChange={(e) => setSettings({ ...settings, anthropic_api_key: e.target.value })}
                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius)', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>

                  <button onClick={handleSaveSettings} className="glass-btn" style={{ width: '100%', marginTop: '0.5rem' }}>儲存設定</button>
                </div>
              </div>

            </div>

            {/* Right Column: Main Content (Kanban/Board Jobs list) */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Toolbar with Action Buttons & Filters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <h1 style={{ fontSize: '1.6rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800' }}>
                    💼 追蹤的職缺職位
                  </h1>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleAiSort}
                      disabled={isAiRecommending}
                      className="glass-btn"
                      style={{ fontWeight: '700', border: '2px solid #818cf8', color: '#818cf8', background: 'rgba(129, 140, 248, 0.05)', boxShadow: '3px 3px 0px #818cf8' }}
                    >
                      {isAiRecommending ? '評估推薦中...' : '✨ AI 推薦排序'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingJobId(null);
                        setNewJob({ title: '', company: '', location: '', salary: '', url: '', description: '', status: 'Interested' });
                        setShowJobModal(true);
                      }}
                      className="glass-btn"
                      style={{ fontWeight: '700', border: '2px solid var(--color-accent)', color: 'var(--color-accent)', background: 'rgba(74, 122, 150, 0.05)', boxShadow: '3px 3px 0px var(--color-accent)' }}
                    >
                      ＋ 手動新增職缺
                    </button>
                  </div>
                </div>

                {/* Filter bar */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '2px solid var(--glass-border)' }}>
                  {/* View Mode Toggle Controls */}
                  <div style={{ display: 'flex', gap: '0.3rem', background: 'rgba(0,0,0,0.15)', padding: '0.2rem', borderRadius: '6px', border: '1px solid var(--glass-border)', marginRight: 'auto' }}>
                    <button
                      onClick={() => setViewMode('grid')}
                      style={{ padding: '0.25rem 0.6rem', borderRadius: '4px', border: 'none', background: viewMode === 'grid' ? 'var(--color-accent)' : 'transparent', color: '#fff', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', outline: 'none' }}
                    >
                      🎴 網格
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      style={{ padding: '0.25rem 0.6rem', borderRadius: '4px', border: 'none', background: viewMode === 'list' ? 'var(--color-accent)' : 'transparent', color: '#fff', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', outline: 'none' }}
                    >
                      ☰ 條列
                    </button>
                    <button
                      onClick={() => { setViewMode('swipe'); setSwipeIndex(0); }}
                      style={{ padding: '0.25rem 0.6rem', borderRadius: '4px', border: 'none', background: viewMode === 'swipe' ? 'var(--bauhaus-red)' : 'transparent', color: '#fff', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', outline: 'none' }}
                      title="快速左右滑動/刪除職缺"
                    >
                      🔥 左右汰選
                    </button>
                  </div>
                  <input
                    placeholder="篩選職稱 / 公司 / 描述..."
                    value={filterKeyword}
                    onChange={(e) => setFilterKeyword(e.target.value)}
                    style={{ flex: 1.5, minWidth: '150px', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
                  />
                  <input
                    placeholder="篩選地區..."
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    style={{ flex: 1, minWidth: '100px', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ minWidth: '100px', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '2px solid var(--glass-border)', background: '#2e303f', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                  >
                    <option value="All">全部狀態</option>
                    <option value="Interested">有興趣</option>
                    <option value="Applied">已申請</option>
                    <option value="Interviewing">面試中</option>
                    <option value="Offered">已錄取</option>
                    <option value="Rejected">被拒絕</option>
                  </select>
                </div>
              </div>

              {filteredJobs.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>目前無相符職缺。</h3>
                  <p style={{ color: 'var(--color-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    請先透過爬蟲搜尋匯入，或點選手動新增按鈕加入您的第一筆追蹤職缺！
                  </p>
                </div>
              ) : viewMode === 'swipe' ? (
                (() => {
                  const activeIndex = Math.min(swipeIndex, filteredJobs.length - 1);
                  const activeJob = filteredJobs[activeIndex];
                  
                  if (!activeJob || swipeIndex >= filteredJobs.length) {
                    return (
                      <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', border: '3px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>🎉 恭喜！已完成所有職缺汰選！</h3>
                        <p style={{ color: 'var(--color-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                          所有職缺已整理完畢，您可以點選上方切換至「網格」或「條列」檢視。
                        </p>
                        <button onClick={() => setSwipeIndex(0)} className="glass-btn" style={{ marginTop: '1rem', background: 'var(--color-accent)' }}>
                          重新汰選
                        </button>
                      </div>
                    );
                  }

                  const score = activeJob.match_score;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', maxWidth: '480px', margin: '0 auto' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-secondary)', fontWeight: '800' }}>
                        📋 汰選進度：{activeIndex + 1} / {filteredJobs.length}
                      </div>

                      <div 
                        className="glass-card swipe-card" 
                        style={{ 
                          width: '100%', 
                          minHeight: '380px', 
                          padding: '1.5rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          justifyContent: 'space-between',
                          border: '3px solid #000000',
                          borderRadius: '12px',
                          boxShadow: '8px 8px 0px #000000',
                          background: 'var(--glass-bg)',
                          transform: swipeAction === 'left' ? 'translateX(-150%) rotate(-15deg)' : (swipeAction === 'right' ? 'translateX(150%) rotate(15deg)' : 'none'),
                          opacity: swipeAction ? 0 : 1,
                          transition: swipeAction ? 'all 0.25s ease-out' : 'transform 0.1s ease-out, opacity 0.1s ease-out',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-accent)' }}>
                              {activeJob.title}
                            </h2>
                            {score !== undefined && score !== null && (
                              <div style={{ background: score >= 80 ? 'var(--color-accent)' : (score >= 60 ? 'var(--bauhaus-yellow)' : 'var(--bauhaus-red)'), color: score >= 60 && score < 80 ? '#000' : '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '800', fontSize: '0.8rem', border: '2px solid #000' }}>
                                {score}% 契合
                              </div>
                            )}
                          </div>
                          <h3 style={{ margin: '0.5rem 0 0.75rem 0', fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '700' }}>
                            🏢 {activeJob.company}
                          </h3>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.5rem 0' }}>
                            {activeJob.location && <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>📍 {activeJob.location}</span>}
                            {activeJob.salary && <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>💰 {activeJob.salary}</span>}
                            {activeJob.source && <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>🌐 {activeJob.source}</span>}
                          </div>

                          <div style={{ 
                            marginTop: '1rem', 
                            padding: '0.75rem', 
                            background: 'rgba(0,0,0,0.15)', 
                            borderRadius: '8px', 
                            border: '1px solid var(--glass-border)',
                            fontSize: '0.85rem',
                            color: 'var(--color-secondary)',
                            maxHeight: '180px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.4'
                          }}>
                            {activeJob.description || '無詳細工作描述。'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
                          <button onClick={() => triggerJobAnalysis(activeJob)} className="glass-btn" style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem' }}>
                            ✨ AI 媒合分析
                          </button>
                          {activeJob.url && (
                            <a href={activeJob.url} target="_blank" rel="noopener noreferrer" className="glass-btn" style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem', textDecoration: 'none', textAlign: 'center' }}>
                              🔗 前往來源網站
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Swipe Control Buttons */}
                      <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
                        <button 
                          onClick={() => handleSwipeLeft(activeJob.id)} 
                          style={{ 
                            width: '64px', 
                            height: '64px', 
                            borderRadius: '50%', 
                            border: '3px solid #000000', 
                            background: 'var(--bauhaus-red)', 
                            color: '#ffffff', 
                            fontSize: '1.5rem', 
                            fontWeight: '800', 
                            cursor: 'pointer', 
                            boxShadow: '4px 4px 0px #000000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            outline: 'none',
                            transition: 'all 0.1s'
                          }}
                          onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
                          onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
                          title="向左滑：不感興趣（刪除）"
                        >
                          ✕
                        </button>
                        <button 
                          onClick={handleSwipeRight} 
                          style={{ 
                            width: '64px', 
                            height: '64px', 
                            borderRadius: '50%', 
                            border: '3px solid #000000', 
                            background: '#4a7a96', 
                            color: '#ffffff', 
                            fontSize: '1.5rem', 
                            fontWeight: '800', 
                            cursor: 'pointer', 
                            boxShadow: '4px 4px 0px #000000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            outline: 'none',
                            transition: 'all 0.1s'
                          }}
                          onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
                          onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
                          title="向右滑：保留此職缺"
                        >
                          ❤️
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : viewMode === 'list' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                  {filteredJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      viewMode="list"
                      onEdit={() => {
                        setEditingJobId(job.id);
                        setNewJob({
                          title: job.title,
                          company: job.company,
                          location: job.location || '',
                          salary: job.salary || '',
                          url: job.url || '',
                          description: job.description || '',
                          status: job.status
                        });
                        setShowJobModal(true);
                      }}
                      onDelete={() => handleDeleteJob(job.id)}
                      onAnalyze={triggerJobAnalysis}
                      onViewCoverLetter={triggerCoverLetter}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.25rem' }}>
                  {filteredJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      viewMode="grid"
                      onEdit={() => {
                        setEditingJobId(job.id);
                        setNewJob({
                          title: job.title,
                          company: job.company,
                          location: job.location || '',
                          salary: job.salary || '',
                          url: job.url || '',
                          description: job.description || '',
                          status: job.status
                        });
                        setShowJobModal(true);
                      }}
                      onDelete={() => handleDeleteJob(job.id)}
                      onAnalyze={triggerJobAnalysis}
                      onViewCoverLetter={triggerCoverLetter}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Manual Add/Edit Job Modal */}
      {showJobModal && (
        <Modal title={editingJobId ? '編輯職缺資料' : '手動新增職缺'} onClose={() => setShowJobModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
            <input placeholder="職缺名稱 *" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} style={inputStyle} />
            <input placeholder="公司名稱 *" value={newJob.company} onChange={(e) => setNewJob({ ...newJob, company: e.target.value })} style={inputStyle} />
            <input placeholder="工作地點" value={newJob.location} onChange={(e) => setNewJob({ ...newJob, location: e.target.value })} style={inputStyle} />
            <input placeholder="薪資待遇" value={newJob.salary} onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })} style={inputStyle} />
            <input placeholder="職缺連結 URL" value={newJob.url} onChange={(e) => setNewJob({ ...newJob, url: e.target.value })} style={inputStyle} />
            <textarea placeholder="職缺描述 / 需求條件 (將用於 AI 媒合與求職信)" value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} rows={4} style={inputStyle} />
            <select value={newJob.status} onChange={(e) => setNewJob({ ...newJob, status: e.target.value })} style={inputStyle}>
              <option value="Interested">有興趣</option>
              <option value="Applied">已申請</option>
              <option value="Interviewing">面試中</option>
              <option value="Offered">已錄取</option>
              <option value="Rejected">被拒絕</option>
            </select>
            <button onClick={handleSaveJob} className="glass-btn" style={{ background: 'var(--color-accent)', color: '#fff', fontWeight: '700', padding: '0.6rem' }}>
              儲存職缺
            </button>
          </div>
        </Modal>
      )}

      {/* AI Analysis Modal */}
      {showAnalysisModal && (
        <Modal title="AI 職缺契合度評找與分析" onClose={() => setShowAnalysisModal(false)}>
          {analysisLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
              <LoadingSpinner />
              <p style={{ fontSize: '0.9rem', color: 'var(--color-secondary)' }}>AI 正在深入分析您與該職缺的媒合契合度...</p>
            </div>
          ) : (
            analysisResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  {/* Glowing Score Badge */}
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: analysisResult.matchScore >= 80 ? 'var(--bauhaus-blue-grad)' : (analysisResult.matchScore >= 60 ? 'var(--bauhaus-yellow-grad)' : 'var(--bauhaus-red-grad)'),
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '1.3rem',
                    fontWeight: '800',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                  }}>
                    {analysisResult.matchScore}%
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: '700' }}>配對契合分數</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-secondary)' }}>
                      使用履歷：<strong>{activeResume?.file_name}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '2px solid var(--glass-border)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#4ea8de', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: '700' }}>
                    ✓ 核心匹配優勢 (Key Matches)
                  </h4>
                  <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-primary)' }}>
                    {analysisResult.matches?.map((m, idx) => <li key={idx}>{m}</li>)}
                  </ul>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '2px solid var(--glass-border)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: '700' }}>
                    ✗ 待補足技能與經歷 (Gap Areas)
                  </h4>
                  <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-primary)' }}>
                    {analysisResult.gaps?.map((g, idx) => <li key={idx}>{g}</li>)}
                  </ul>
                </div>
              </div>
            )
          )}
        </Modal>
      )}

      {/* Cover Letter Modal */}
      {showCoverLetterModal && (
        <Modal title="AI 客製化求職信" onClose={() => setShowCoverLetterModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-secondary)' }}>
              專屬定制職缺：<strong>{selectedJobForLetter?.company}</strong> - <strong>{selectedJobForLetter?.title}</strong>
            </p>

            {coverLetterLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
                <LoadingSpinner />
                <p style={{ fontSize: '0.9rem', color: 'var(--color-secondary)' }}>AI 正在撰寫客製化求職信中...</p>
              </div>
            ) : coverLetterText ? (
              <>
                <textarea
                  readOnly
                  value={coverLetterText}
                  rows={14}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '2px solid var(--glass-border)',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    color: '#e2e8f0',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleCopyLetter} className="glass-btn" style={{ flex: 1, fontWeight: '700', background: 'var(--color-accent)', color: '#fff' }}>
                    📋 複製求職信
                  </button>
                  <button onClick={generateLetter} className="glass-btn" style={{ flex: 1, fontWeight: '600' }}>
                    🔄 重新生成
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>目前尚未為此職缺生成求職信。</p>
                <button onClick={generateLetter} className="glass-btn" style={{ background: 'var(--color-accent)', color: '#fff', fontWeight: '700', width: '100%' }}>
                  ✍ 使用 AI 生成
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Resume Preview Modal */}
      {showPreviewModal && previewResume && (
        <Modal title={`履歷內文預覽 - ${previewResume.file_name}`} onClose={() => setShowPreviewModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-secondary)' }}>
              以下為後端解析出的純文字內容。如果看到不正常字符，請確認配置 API Key 後重新上傳以獲得高品質解析。
            </p>
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.25)',
              padding: '1rem',
              borderRadius: '8px',
              border: '2px solid var(--glass-border)',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              color: '#cbd5e1',
              lineHeight: '1.5'
            }}>
              {previewResume.raw_text || '該履歷無純文字內容。'}
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

const inputStyle = {
  padding: '0.5rem 0.75rem',
  borderRadius: 'var(--radius)',
  border: '2px solid var(--glass-border)',
  background: 'var(--glass-bg)',
  color: 'var(--text-primary)',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none'
};
