import { useEffect, useState, useContext } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import JobCard from '../components/JobCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { LanguageContext } from '../context/LanguageContext';

export default function Dashboard() {
  const { language, t } = useContext(LanguageContext);
  const [jobs, setJobs] = useState([]);
  const [resumes, setResumes] = useState([]);
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
  const [targetPosition, setTargetPosition] = useState('');
  const [targetLocations, setTargetLocations] = useState(['台北市', '新北市']);

  // Fetch initial data and listen to extension messages
  useEffect(() => {
    Promise.all([
      fetchJobs(),
      fetchResumes(),
      fetchPreferences()
    ]).finally(() => setLoading(false));

    const handleExtensionMessage = (event) => {
      if (event.data && event.data.type === 'GETAJOB_JOB_IMPORTED') {
        fetchJobs();
      }
    };
    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data) {
        if (data.target_position) setTargetPosition(data.target_position);
        if (data.target_locations) {
          try {
            setTargetLocations(JSON.parse(data.target_locations));
          } catch (e) {
            setTargetLocations(data.target_locations.split(','));
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch preferences', e);
    }
  };

  const handleSavePreferences = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_position: targetPosition,
          target_locations: JSON.stringify(targetLocations)
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(t('zh' === language ? '求職偏好已儲存！' : 'Job preferences saved!'));
      } else {
        alert('Failed to save preferences');
      }
    } catch (e) {
      console.error(e);
    }
  };

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

  // Joint Multi-Platform Scraper Action (Deprecated on Web, moved to Extension)
  const handleScrapeJobs = () => {
    alert(t('zh' === language ? '請打開 GetaJob 瀏覽器擴充功能開始抓取職缺！' : 'Please open GetaJob Chrome Extension to start scraping!'));
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
            
            {/* Left Column: Side Control Panel (Resume, Scraper) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'start' }}>
              
              {/* Resumes Panel */}
              <div className="glass-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                <h2 style={{ fontSize: '1.2rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📄</span> {t('resumeTitle')}
                </h2>
                
                <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                  <label className="glass-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', boxSizing: 'border-box', cursor: resumeUploading ? 'not-allowed' : 'pointer' }}>
                    {resumeUploading ? (
                      <>
                        <span className="spinner-inline"></span>
                        <span>{t('parsingResume')}</span>
                      </>
                    ) : (
                      t('uploadResume')
                    )}
                    <input type="file" accept=".pdf,.txt" onChange={handleResumeUpload} disabled={resumeUploading} style={{ display: 'none' }} />
                  </label>
                </div>

                {resumes.length === 0 ? (
                  <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--color-secondary)' }}>{t('noResume')}</p>
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
                              {t('activeResume')}
                            </button>
                          )}
                          <button onClick={() => handleDeleteResume(r.id)} style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', border: '2px solid var(--glass-border)', background: 'var(--bauhaus-red)', color: '#fff', padding: 0 }} title={t('deleteResume')}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Job Preferences Panel */}
              <div className="glass-card" style={{ borderLeft: '4px solid var(--bauhaus-yellow)' }}>
                <h2 style={{ fontSize: '1.2rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🎯</span> {t('zh' === language ? '求職偏好' : 'Job Preferences')}
                </h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem' }}>
                      {t('zh' === language ? '目標職位 *' : 'Target Position *')}
                    </label>
                    <input
                      placeholder="例如：PM / 產品經理"
                      value={targetPosition}
                      onChange={(e) => setTargetPosition(e.target.value)}
                      style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius)', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '800', display: 'block', marginBottom: '0.35rem' }}>
                      {t('zh' === language ? '搜尋地點 (可複選)' : 'Search Locations')}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {['台灣 (不限縣市)', '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市', '基隆市', '新竹市', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義市', '屏東縣', '宜蘭縣', '花蓮縣', '台東縣'].map(loc => {
                        const isChecked = targetLocations.includes(loc);
                        return (
                          <label key={loc} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.75rem', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setTargetLocations(targetLocations.filter(l => l !== loc));
                                } else {
                                  setTargetLocations([...targetLocations, loc]);
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            {loc}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <button onClick={handleSavePreferences} className="glass-btn" style={{ width: '100%', marginTop: '0.25rem', background: 'var(--color-accent)', color: '#fff' }}>
                    {t('zh' === language ? '儲存偏好' : 'Save Preferences')}
                  </button>
                </div>
              </div>

              {/* Extension Usage Instructions */}
              <div className="glass-card" style={{ borderLeft: '4px solid var(--bauhaus-red)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span>🔌</span> {t('zh' === language ? '爬蟲使用教學' : 'Scraper Instructions')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', lineHeight: '1.4' }}>
                  <div>
                    <strong>1. {t('zh' === language ? '設定求職偏好' : 'Set Preferences')}</strong>
                    <div style={{ color: 'var(--color-secondary)', fontSize: '0.75rem' }}>
                      {t('zh' === language ? '在上方填寫「目標職位」與地點，按下「儲存偏好」。' : 'Fill in target position and locations, click "Save".')}
                    </div>
                  </div>
                  <div>
                    <strong>2. {t('zh' === language ? '開啟擴充功能' : 'Open Extension')}</strong>
                    <div style={{ color: 'var(--color-secondary)', fontSize: '0.75rem' }}>
                      {t('zh' === language ? '打開 GetaJob 擴充功能視窗。' : 'Open GetaJob Chrome Extension popup window.')}
                    </div>
                  </div>
                  <div>
                    <strong>3. {t('zh' === language ? '點選開始抓取' : 'Start Scraping')}</strong>
                    <div style={{ color: 'var(--color-secondary)', fontSize: '0.75rem' }}>
                      {t('zh' === language ? '勾選平台並點選「開始抓取職缺」，擴充功能會自動同步您的偏好並執行全站深度抓取！' : 'Check platforms, click "Start Scraping". It will sync your preferences and scrape.')}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Main Content (Kanban/Board Jobs list) */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Toolbar with Action Buttons & Filters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <h1 style={{ fontSize: '1.6rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800' }}>
                    💼 {t('trackedJobs')}
                  </h1>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleAiSort}
                      disabled={isAiRecommending}
                      className="glass-btn"
                      style={{ fontWeight: '700', border: '2px solid #818cf8', color: '#818cf8', background: 'rgba(129, 140, 248, 0.05)', boxShadow: '3px 3px 0px #818cf8' }}
                    >
                      {isAiRecommending ? t('aiSorting') : t('aiSortButton')}
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
                      {t('manualAddButton')}
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
                      🎴 {t('zh' === language ? '網格' : 'Grid')}
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      style={{ padding: '0.25rem 0.6rem', borderRadius: '4px', border: 'none', background: viewMode === 'list' ? 'var(--color-accent)' : 'transparent', color: '#fff', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', outline: 'none' }}
                    >
                      ☰ {t('zh' === language ? '條列' : 'List')}
                    </button>
                    <button
                      onClick={() => { setViewMode('swipe'); setSwipeIndex(0); }}
                      style={{ padding: '0.25rem 0.6rem', borderRadius: '4px', border: 'none', background: viewMode === 'swipe' ? 'var(--bauhaus-red)' : 'transparent', color: '#fff', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', outline: 'none' }}
                      title="快速左右滑動/刪除職缺"
                    >
                      🔥 {t('zh' === language ? '左右汰選' : 'Swipe Vetting')}
                    </button>
                  </div>
                  <input
                    placeholder={t('filterPlaceholder')}
                    value={filterKeyword}
                    onChange={(e) => setFilterKeyword(e.target.value)}
                    style={{ flex: 1.5, minWidth: '150px', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
                  />
                  <input
                    placeholder={t('filterLocationPlaceholder')}
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    style={{ flex: 1, minWidth: '100px', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '2px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none' }}
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ minWidth: '100px', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '2px solid var(--glass-border)', background: '#2e303f', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                  >
                    <option value="All">{t('allStatus')}</option>
                    <option value="Interested">{t('interested')}</option>
                    <option value="Applied">{t('applied')}</option>
                    <option value="Interviewing">{t('interviewing')}</option>
                    <option value="Offered">{t('offered')}</option>
                    <option value="Rejected">{t('rejected')}</option>
                  </select>
                </div>
              </div>

              {filteredJobs.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{t('noJobs')}</h3>
                  <p style={{ color: 'var(--color-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    {t('noJobsSub')}
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
