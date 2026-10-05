// App.jsx — Root component, handles routing and data fetching
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import QueueView from './QueueView';
import DetailView from './DetailView';
import RunView from './RunView';
import { listConversations, getConversation } from './api';

export default function App() {
  const [view, setView] = useState('queue');
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const convs = await listConversations();
      setConversations(convs);
    } catch {
      // Backend may not be running yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    // Poll every 10 seconds
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  async function handleSelect(id) {
    try {
      const conv = await getConversation(id);
      setSelectedConv(conv);
      setView('detail');
    } catch {
      // fall through
    }
  }

  const escalatedCount = conversations.filter(c => c.terminal_state === 'escalated').length;
  const totalCount = conversations.length;

  const headerInfo = {
    queue: { title: 'Handoff Queue', sub: 'Open escalations and conversation history' },
    all: { title: 'All Conversations', sub: 'Full conversation log' },
    run: { title: 'Run Agent', sub: 'Test the agent with custom conversation scripts' },
    detail: { title: `Conversation: ${selectedConv?.conversation_id || ''}`, sub: 'Transcript with inline tool call grounding' },
    health: { title: 'API Health', sub: 'Backend status' },
  };

  const info = headerInfo[view] || headerInfo.queue;

  return (
    <>
      <Sidebar
        view={view === 'detail' ? 'queue' : view}
        setView={v => { setView(v); setSelectedConv(null); }}
        escalatedCount={escalatedCount}
        totalCount={totalCount}
      />
      <div className="main">
        <header className="header">
          <div>
            <span className="header__title">{info.title}</span>
            <span className="header__sub">/ {info.sub}</span>
          </div>
          <div className="header__right">
            <span className="dot-status">API Online</span>
            <button
              className="btn btn--secondary btn--sm"
              onClick={fetchConversations}
              disabled={loading}
            >
              {loading ? '⟳ Refreshing…' : '⟳ Refresh'}
            </button>
          </div>
        </header>

        <div className="content">
          {view === 'queue' && (
            <QueueView
              conversations={conversations}
              onSelect={handleSelect}
              loading={loading}
            />
          )}
          {view === 'all' && (
            <QueueView
              conversations={conversations}
              onSelect={handleSelect}
              loading={loading}
            />
          )}
          {view === 'run' && (
            <RunView onResult={fetchConversations} />
          )}
          {view === 'detail' && selectedConv && (
            <DetailView
              conversation={selectedConv}
              onBack={() => setView('queue')}
            />
          )}
          {view === 'health' && (
            <div className="animate-in">
              <div className="table-card">
                <div className="table-header">
                  <span className="table-header__title">Backend Health</span>
                </div>
                <div style={{ padding: 20 }}>
                  <p style={{ fontSize: 13, color: 'var(--slate)' }}>
                    Visit <a href="http://localhost:8000/health" target="_blank" rel="noreferrer"
                    style={{ color: 'var(--teal-800)' }}>http://localhost:8000/health</a> to check the backend.
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 8 }}>
                    API docs: <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer"
                    style={{ color: 'var(--teal-800)' }}>http://localhost:8000/docs</a>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
