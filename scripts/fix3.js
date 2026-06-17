const fs = require('fs');

const replacement = `          <div className="main-layout" style={{ display: 'flex', gap: '2rem', marginTop: '2rem', alignItems: 'flex-start' }}>

            {/* Sidebar Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '240px', flexShrink: 0 }}>
              <div 
                onClick={() => setActiveTab('dashboard')}
                className="glass-card"
                style={{ padding: '0.8rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800', background: activeTab === 'dashboard' ? 'var(--color-accent)' : 'var(--glass-bg)', color: activeTab === 'dashboard' ? '#fff' : 'var(--text-primary)', border: activeTab === 'dashboard' ? '2px solid var(--color-accent)' : '2px solid var(--glass-border)' }}
              >
                📊 儀表板與職缺
              </div>
              <div 
                onClick={() => setActiveTab('scraper')}
                className="glass-card"
                style={{ padding: '0.8rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800', background: activeTab === 'scraper' ? 'var(--color-accent)' : 'var(--glass-bg)', color: activeTab === 'scraper' ? '#fff' : 'var(--text-primary)', border: activeTab === 'scraper' ? '2px solid var(--color-accent)' : '2px solid var(--glass-border)' }}
              >
                🔍 爬蟲設定
              </div>
              <div 
                onClick={() => setActiveTab('resume')}
                className="glass-card"
                style={{ padding: '0.8rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800', background: activeTab === 'resume' ? 'var(--color-accent)' : 'var(--glass-bg)', color: activeTab === 'resume' ? '#fff' : 'var(--text-primary)', border: activeTab === 'resume' ? '2px solid var(--color-accent)' : '2px solid var(--glass-border)' }}
              >
                📄 履歷管理
              </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {activeTab === 'resume' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
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
                </div>
              )}

              {activeTab === 'scraper' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
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
              )}

              {activeTab === 'dashboard' && (
                <>
                  {/* Right Column: Main Content (Kanban/Board Jobs list) */}
                  <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
                    
                    {/* Dashboard Row */}
                    <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.2rem', scrollbarWidth: 'none' }}>
                      {[
                        { label: '總職缺', value: jobs.length, color: 'var(--text-primary)' },
                        { label: '有興趣', value: jobs.filter(j => j.status === 'Interested').length, color: 'var(--color-accent)' },
                        { label: '已申請', value: jobs.filter(j => j.status === 'Applied').length, color: 'var(--bauhaus-yellow)' },
                        { label: '面試中', value: jobs.filter(j => j.status === 'Interviewing').length, color: 'var(--bauhaus-red)' },
                        { label: '已錄取', value: jobs.filter(j => j.status === 'Offered').length, color: '#10b981' }
                      ].map(stat => (
                        <div key={stat.label} className="glass-card" style={{ flex: '1 0 auto', minWidth: '110px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '2px solid var(--glass-border)', boxShadow: '4px 4px 0px var(--glass-border)', background: 'var(--glass-bg)' }}>
                          <span style={{ fontSize: '2.2rem', fontWeight: '900', color: stat.color, lineHeight: '1' }}>{stat.value}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-secondary)' }}>{stat.label}</span>
                        </div>
                      ))}
                    </div>

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
                            onStatusChange={handleStatusChange}
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
                            onStatusChange={handleStatusChange}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>`;

// Now we need to splice this replacement into the file between 411 and wherever the Modals start.
let code = fs.readFileSync('src/pages/index.js', 'utf8');

// Find the start:
const startToken = '          <div className="main-layout"';
const endToken = '      {/* Manual Add/Edit Job Modal */}';

const startIndex = code.indexOf(startToken);
const endIndex = code.indexOf(endToken);

if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + replacement + '\n\n' + code.substring(endIndex);
    fs.writeFileSync('src/pages/index.js', code);
    console.log('Fixed file perfectly!');
} else {
    console.log('Tokens not found!', startIndex, endIndex);
}
