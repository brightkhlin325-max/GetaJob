import { useEffect, useState, useContext } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import { ThemeContext } from '../context/ThemeContext';
import { LanguageContext } from '../context/LanguageContext';

export default function SettingsPage() {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const { language, setLanguage, t } = useContext(LanguageContext);
  
  const [settings, setSettings] = useState({
    ai_provider: 'gemini',
    gemini_api_key: '',
    openai_api_key: '',
    anthropic_api_key: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        alert(t('saveSettingsSuccess'));
      } else {
        alert(t('saveSettingsFailed'));
      }
    } catch (err) {
      console.error(err);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <Head>
        <title>{t('settings')} — GetaJob</title>
      </Head>

      {/* Bauhaus Artwork Geometric background decoration */}
      <div className="bg-glow-container">
        <div className="bg-glow-sphere sphere-red" style={{ top: '60%', left: '70%' }}></div>
        <div className="bg-glow-sphere sphere-yellow" style={{ top: '20%', left: '10%' }}></div>
        <div className="bg-glow-sphere sphere-blue" style={{ top: '80%', left: '30%' }}></div>
      </div>

      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <Header />

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6rem' }}>
            <LoadingSpinner />
          </div>
        ) : (
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>
              ⚙️ {t('settingsTitle')}
            </h1>

            {/* Appearance Panel */}
            <div className="glass-card" style={{ borderLeft: '5px solid var(--bauhaus-yellow)' }}>
              <h2 style={{ fontSize: '1.25rem', marginTop: 0, fontWeight: '800' }}>
                🎨 {t('appearanceTitle')}
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
                
                {/* Dark mode switcher */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: '800', display: 'block' }}>
                      {t('themeLabel')}
                    </label>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-secondary)' }}>
                      {darkMode ? t('darkTheme') : t('lightTheme')}
                    </span>
                  </div>
                  <button 
                    onClick={toggleDarkMode}
                    className="glass-btn" 
                    style={{ fontSize: '0.85rem', fontWeight: '800', padding: '0.4rem 0.8rem' }}
                  >
                    {darkMode ? '☀️ ' + t('lightTheme') : '🌙 ' + t('darkTheme')}
                  </button>
                </div>

                <hr style={{ border: 'none', borderTop: '1px dashed var(--glass-border)', margin: 0 }} />

                {/* Language switcher */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: '800', display: 'block' }}>
                      {t('languageLabel')}
                    </label>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-secondary)' }}>
                      {language === 'zh' ? '繁體中文 (Traditional Chinese)' : 'English'}
                    </span>
                  </div>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: 'var(--radius)', 
                      border: '2px solid var(--glass-border)', 
                      background: '#2e303f', 
                      color: '#ffffff', 
                      fontSize: '0.85rem', 
                      fontWeight: '800',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="zh">繁體中文</option>
                    <option value="en">English</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Model configuration Panel */}
            <div className="glass-card" style={{ borderLeft: '5px solid var(--bauhaus-red)' }}>
              <h2 style={{ fontSize: '1.25rem', marginTop: 0, fontWeight: '800' }}>
                🤖 {t('modelSettings')}
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
                
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.4rem' }}>
                    {t('aiProviderLabel')}
                  </label>
                  <select
                    value={settings.ai_provider}
                    onChange={(e) => setSettings({ ...settings, ai_provider: e.target.value })}
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem', 
                      borderRadius: 'var(--radius)', 
                      border: '2px solid var(--glass-border)', 
                      background: '#2e303f', 
                      color: '#ffffff', 
                      fontSize: '0.85rem', 
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="gemini">Google Gemini (Recommended)</option>
                    <option value="openai">OpenAI ChatGPT</option>
                    <option value="anthropic">Anthropic Claude</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.4rem' }}>
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Gemini API Key"
                    value={settings.gemini_api_key}
                    onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: 'var(--radius)', 
                      border: '2px solid var(--glass-border)', 
                      background: 'var(--glass-bg)', 
                      color: 'var(--text-primary)', 
                      fontSize: '0.85rem', 
                      boxSizing: 'border-box', 
                      outline: 'none' 
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.4rem' }}>
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Enter OpenAI API Key"
                    value={settings.openai_api_key}
                    onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })}
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: 'var(--radius)', 
                      border: '2px solid var(--glass-border)', 
                      background: 'var(--glass-bg)', 
                      color: 'var(--text-primary)', 
                      fontSize: '0.85rem', 
                      boxSizing: 'border-box', 
                      outline: 'none' 
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '800', display: 'block', marginBottom: '0.4rem' }}>
                    Claude / Anthropic API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Claude API Key"
                    value={settings.anthropic_api_key}
                    onChange={(e) => setSettings({ ...settings, anthropic_api_key: e.target.value })}
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: 'var(--radius)', 
                      border: '2px solid var(--glass-border)', 
                      background: 'var(--glass-bg)', 
                      color: 'var(--text-primary)', 
                      fontSize: '0.85rem', 
                      boxSizing: 'border-box', 
                      outline: 'none' 
                    }}
                  />
                </div>

                <button 
                  onClick={handleSaveSettings} 
                  disabled={saving} 
                  className="glass-btn" 
                  style={{ width: '100%', padding: '0.6rem', marginTop: '0.5rem', fontWeight: '800' }}
                >
                  {saving ? '...' : t('saveSettings')}
                </button>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
