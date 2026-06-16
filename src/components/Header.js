import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import Link from 'next/link';

export default function Header() {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  return (
    <header
      style={{
        background: 'var(--glass-bg)',
        borderBottom: '1px solid var(--glass-border)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        color: 'var(--text-primary)',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 'var(--glass-shadow)',
        borderRadius: '0 0 var(--radius) var(--radius)',
        transition: 'var(--transition-fast)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
        {/* Geometric Bauhaus Logo Mark */}
        <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', marginRight: '0.5rem' }}>
          <div style={{ width: '12px', height: '24px', background: 'var(--bauhaus-red)', borderRadius: '6px 0 0 6px' }}></div>
          <div style={{ width: '12px', height: '12px', background: 'var(--bauhaus-yellow)', borderRadius: '50%' }}></div>
          <div style={{ width: '12px', height: '32px', background: 'var(--color-accent)', borderRadius: '0 6px 6px 0' }}></div>
        </div>
        <span style={{ fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.05em', background: 'linear-gradient(to right, var(--text-primary), var(--color-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'var(--font-base)' }}>
          GetaJob
        </span>
      </div>
      <nav>
        <Link href="/" style={{ marginRight: '1rem', color: 'var(--text-primary)', fontWeight: '600' }}>首頁</Link>
        <Link href="/settings" style={{ marginRight: '1rem', color: 'var(--text-primary)', fontWeight: '600' }}>設定</Link>
        <button
          onClick={toggleDarkMode}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            transition: 'var(--transition-fast)'
          }}
          aria-label="Toggle dark mode"
        >
          {darkMode ? '🌙' : '☀️'}
        </button>
      </nav>
    </header>
  );
}
