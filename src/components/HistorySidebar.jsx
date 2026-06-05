import React, { useState } from 'react';

export default function HistorySidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  theme,
  toggleTheme,
  onLogoClick,
  isSidebarOpen,
  onCloseSidebar
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = sessions.filter(session => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (session.title || '').toLowerCase().includes(searchLower) ||
      (session.patientName || '').toLowerCase().includes(searchLower) ||
      (session.date || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className={`sidebar-container glass-panel ${isSidebarOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="logo-group" onClick={onLogoClick} style={{ cursor: 'pointer', margin: 0 }} title="Go to Welcome Page">
            <div className="logo-icon"></div>
            <h2>MediScribe</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="btn-theme-toggle" 
              onClick={toggleTheme} 
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '8px',
                transition: 'background 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-subtle)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <button 
              className="btn-sidebar-close-mobile" 
              onClick={onCloseSidebar} 
              title="Close Sidebar"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '8px',
                transition: 'background 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-subtle)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <button className="btn-new-session" onClick={onNewSession}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Session
        </button>
      </div>

      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search patient or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="history-list-wrapper">
        <h3 className="section-title">Session History ({filteredSessions.length})</h3>
        {filteredSessions.length === 0 ? (
          <div className="empty-history">
            <p>{searchTerm ? 'No matching records found' : 'No past sessions yet'}</p>
          </div>
        ) : (
          <div className="history-list">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`history-item ${activeSessionId === session.id ? 'active' : ''}`}
                onClick={() => onSelectSession(session)}
              >
                <div className="history-item-body">
                  <h4 className="patient-name">{session.patientName || 'Unnamed Patient'}</h4>
                  <p className="session-title-text">{session.title || 'General Consultation'}</p>
                  <div className="session-meta">
                    <span className="session-date">{session.date}</span>
                    <span className="session-badge">{session.language}</span>
                    {(session.audioUrl || session.id.startsWith('demo-')) && (
                      <span style={{ fontSize: '11px', color: 'var(--accent-secondary)' }} title="Contains Audio Recording">
                        🔊
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn-delete-session"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this session?')) {
                      onDeleteSession(session.id);
                    }
                  }}
                  title="Delete Session"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <span className="status-dot online"></span>
          <span>Multilingual Scribe Engine</span>
        </div>
      </div>
    </div>
  );
}
