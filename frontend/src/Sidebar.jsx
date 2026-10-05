// Sidebar.jsx — Persistent navigation sidebar
import React from 'react';

const NavItem = ({ icon, label, badge, active, onClick }) => (
  <li
    className={`sidebar__nav-item ${active ? 'active' : ''}`}
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={e => e.key === 'Enter' && onClick?.()}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icon}
    </svg>
    <span>{label}</span>
    {badge != null && <span className="sidebar__badge">{badge}</span>}
  </li>
);

export default function Sidebar({ view, setView, escalatedCount, totalCount }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">🏥</div>
        <div className="sidebar__logo-text">
          <div className="sidebar__logo-name">SwasthiQ</div>
          <div className="sidebar__logo-sub">Front Desk AI</div>
        </div>
      </div>

      <div className="sidebar__section-label">Operations</div>
      <ul className="sidebar__nav">
        <NavItem
          icon={<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}
          label="Dashboard"
          active={view === 'queue'}
          onClick={() => setView('queue')}
          badge={escalatedCount > 0 ? escalatedCount : null}
        />
        <NavItem
          icon={<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>}
          label="All Conversations"
          active={view === 'all'}
          onClick={() => setView('all')}
          badge={totalCount || null}
        />
        <NavItem
          icon={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          label="Run Agent"
          active={view === 'run'}
          onClick={() => setView('run')}
        />
      </ul>

      <div className="sidebar__section-label">System</div>
      <ul className="sidebar__nav">
        <NavItem
          icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>}
          label="Documentation"
          active={false}
          onClick={() => window.open('https://github.com/yash0260/SwasthiQQ/blob/main/README.md', '_blank')}
        />
        <NavItem
          icon={<><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></>}
          label="API Health"
          active={view === 'health'}
          onClick={() => setView('health')}
        />
      </ul>
    </aside>
  );
}
