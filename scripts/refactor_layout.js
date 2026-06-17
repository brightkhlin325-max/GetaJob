const fs = require('fs');

let content = fs.readFileSync('src/pages/index.js', 'utf8');

// 1. Add activeTab state
if (!content.includes("const [activeTab")) {
  content = content.replace(
    "const [viewMode, setViewMode] = useState('grid');",
    "const [viewMode, setViewMode] = useState('grid');\n  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'scraper', 'resume'"
  );
}

// 2. We need to extract the parts.
const resumesPanelStart = content.indexOf('{/* Resumes Panel */}');
const jobPrefPanelStart = content.indexOf('{/* Job Preferences Panel */}');
const extensionInstStart = content.indexOf('{/* Extension Usage Instructions */}');
const rightColumnStart = content.indexOf('{/* Right Column: Main Content (Kanban/Board Jobs list) */}');
const modalsStart = content.indexOf('{/* Manual Add/Edit Job Modal */}');

if (resumesPanelStart === -1 || rightColumnStart === -1 || modalsStart === -1) {
  console.error("Could not find markers!");
  process.exit(1);
}

const resumesPanelCode = content.substring(resumesPanelStart, jobPrefPanelStart);
const scraperPanelCode = content.substring(jobPrefPanelStart, rightColumnStart);

// The right column starts at rightColumnStart and ends at modalsStart (excluding the closing divs of main-layout)
// Let's find the closing divs.
// The right column is inside `<div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>`
// It ends right before `{/* Job Edit Modal */}`. Wait, there are two closing `</div>` before the modal.
// Let's extract the exact right column content.
const rightColStr = content.substring(rightColumnStart, modalsStart);
// remove the last two `</div>` from rightColStr
const rightColContent = rightColStr.replace(/<\/div>\s*<\/div>\s*$/, '');

// 3. Rebuild the main layout
const sidebarHTML = `
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
`;

const newMainLayout = `          /* App Shell Layout */
          <div className="main-layout" style={{ display: 'flex', gap: '2rem', marginTop: '2rem', alignItems: 'flex-start' }}>
${sidebarHTML}
            {/* Main Content Area */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {activeTab === 'resume' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
                  ${resumesPanelCode}
                </div>
              )}

              {activeTab === 'scraper' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
                  ${scraperPanelCode}
                </div>
              )}

              {activeTab === 'dashboard' && (
                <>
                  ${rightColContent.replace('{/* Right Column: Main Content (Kanban/Board Jobs list) */}\n            <div style={{ flex: 2, display: \'flex\', flexDirection: \'column\', gap: \'1.5rem\', minWidth: 0 }}>', '')}
                </>
              )}
            </div>
          </div>
`;

// Replace from `/* Dual-column Art Gallery Layout */` down to right before ` {/* Job Edit Modal */}`
const layoutStart = content.indexOf('/* Dual-column Art Gallery Layout */');
if (layoutStart !== -1) {
  content = content.substring(0, layoutStart) + newMainLayout + '\n      ' + content.substring(modalsStart);
  fs.writeFileSync('src/pages/index.js', content, 'utf8');
  console.log('Layout refactored successfully.');
} else {
  console.error("Could not find Dual-column layout comment.");
  process.exit(1);
}
