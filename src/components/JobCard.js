import { useState } from 'react';
import { PencilIcon, TrashIcon, SparklesIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

export default function JobCard({ job, onEdit, onDelete, onAnalyze, onViewCoverLetter, viewMode = 'grid' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to determine match score colors based on Bauhaus palette
  const getScoreColor = (score) => {
    if (score >= 80) return '#4a7a96'; // Bauhaus Blue/Steel (High match)
    if (score >= 60) return '#ffd166'; // Bauhaus Yellow (Medium match)
    return '#ff6b6b'; // Bauhaus Red (Low match)
  };

  const translateStatus = (status) => {
    switch (status) {
      case 'Interested': return '有興趣';
      case 'Applied': return '已申請';
      case 'Interviewing': return '面試中';
      case 'Offered': return '已錄取';
      case 'Rejected': return '被拒絕';
      default: return status;
    }
  };

  const hasScore = job.match_score !== undefined && job.match_score !== null;
  const score = job.match_score || 0;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  if (viewMode === 'list') {
    return (
      <div className="glass-card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', minHeight: 'auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
          {/* Score Badge */}
          {hasScore ? (
            <div style={{ position: 'relative', width: '40px', height: '40px', flexShrink: 0 }}>
              <svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="20" cy="20" r="16" fill="transparent" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="3" />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="transparent"
                  stroke={getScoreColor(score)}
                  strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 16}
                  strokeDashoffset={2 * Math.PI * 16 - (score / 100) * (2 * Math.PI * 16)}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.65rem', fontWeight: '800', color: '#f8fafc' }}>
                {score}%
              </div>
            </div>
          ) : (
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'var(--color-secondary)' }}>
              無
            </div>
          )}

          {/* Job Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {job.url ? (
                <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <h3 className="job-title-link" style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.title}
                  </h3>
                </a>
              ) : (
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {job.title}
                </h3>
              )}
              <span style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', fontWeight: '600' }}>
                {job.company}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {job.location && <span style={{ fontSize: '0.7rem', color: 'var(--color-secondary)' }}>📍 {job.location}</span>}
              {job.salary && <span style={{ fontSize: '0.7rem', color: 'var(--color-secondary)' }}>💰 {job.salary}</span>}
              {job.source && (
                <span style={{ fontSize: '0.7rem', background: 'rgba(74, 122, 150, 0.08)', color: 'var(--color-accent)', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>
                  {job.source}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', fontWeight: '600', background: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
            {translateStatus(job.status)}
          </span>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {onAnalyze && (
              <button onClick={() => onAnalyze(job)} title="AI 媒合分析" style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '0.2rem' }}>
                <SparklesIcon className="h-4.5 w-4.5" />
              </button>
            )}
            {onViewCoverLetter && (
              <button onClick={() => onViewCoverLetter(job)} title="求職信" style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: '0.2rem' }}>
                <DocumentTextIcon className="h-4.5 w-4.5" />
              </button>
            )}
            {onEdit && (
              <button onClick={onEdit} title="編輯" style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '0.2rem' }}>
                <PencilIcon className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} title="刪除" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}>
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '190px' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          {/* Clickable Job Title Link */}
          {job.url ? (
            <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <h3 className="job-title-link" style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-accent)', cursor: 'pointer' }}>
                {job.title}
              </h3>
            </a>
          ) : (
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {job.title}
            </h3>
          )}

          {/* SVG Circular Progress Bar for Match Score */}
          {hasScore && (
            <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0, filter: `drop-shadow(0 0 4px ${getScoreColor(score)}40)` }}>
              <svg width="46" height="46" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="23"
                  cy="23"
                  r={radius}
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth="3.5"
                />
                <circle
                  cx="23"
                  cy="23"
                  r={radius}
                  fill="transparent"
                  stroke={getScoreColor(score)}
                  strokeWidth="3.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                />
              </svg>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '46px',
                height: '46px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '0.7rem',
                fontWeight: '800',
                color: '#f8fafc'
              }}>
                {score}%
              </div>
            </div>
          )}
        </div>
        
        <p style={{ margin: '0.4rem 0 0.5rem 0', color: 'var(--color-secondary)', fontWeight: '600', fontSize: '0.9rem' }}>
          {job.company}
        </p>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.5rem 0' }}>
          {job.location && (
            <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--color-secondary)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
              📍 {job.location}
            </span>
          )}
          {job.salary && (
            <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--color-secondary)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
              💰 {job.salary}
            </span>
          )}
          {job.source && (
            <span style={{ fontSize: '0.75rem', background: 'rgba(74, 122, 150, 0.08)', color: 'var(--color-accent)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(74, 122, 150, 0.15)' }}>
              {job.source}
            </span>
          )}
        </div>

        {/* Collapsible Job Description */}
        {job.description && (
          <div style={{ marginTop: '0.6rem' }}>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
                outline: 'none'
              }}
            >
              <span>{isExpanded ? '▼ 收合工作描述' : '▶ 展開工作描述'}</span>
            </button>
            {isExpanded && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.6rem',
                background: 'var(--color-bg)',
                borderRadius: '6px',
                border: '1px solid var(--glass-border)',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                maxHeight: '180px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: '1.5'
              }}>
                {job.description}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onAnalyze && (
            <button
              onClick={() => onAnalyze(job)}
              title="AI 媒合分析"
              style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '0.25rem', transition: 'transform 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <SparklesIcon className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 4px rgba(129, 140, 248, 0.3))' }} />
            </button>
          )}
          {onViewCoverLetter && (
            <button
              onClick={() => onViewCoverLetter(job)}
              title="檢視/生成求職信"
              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: '0.25rem', transition: 'transform 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <DocumentTextIcon className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.3))' }} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-secondary)', fontWeight: '600', marginRight: '0.5rem' }}>
            {translateStatus(job.status)}
          </span>
          {onEdit && (
            <button
              onClick={onEdit}
              title="編輯職缺"
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '0.25rem' }}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              title="刪除職缺"
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
