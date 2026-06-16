import React from 'react';

export default function Modal({ title, children, onClose }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-base)' }}>{title}</h2>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </header>
        <section style={{ marginTop: '1rem' }}>{children}</section>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalStyle = {
  background: '#fff',
  padding: '1.5rem',
  borderRadius: 'var(--radius)',
  width: '90%',
  maxWidth: '400px',
  boxShadow: 'var(--shadow)',
  fontFamily: 'var(--font-base)',
};

const closeBtnStyle = {
  background: 'transparent',
  border: 'none',
  fontSize: '1.2rem',
  cursor: 'pointer',
  color: 'var(--color-primary)',
};
