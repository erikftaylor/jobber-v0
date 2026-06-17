import React, { useEffect, useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { KnowledgeBaseBrowser } from './components/KnowledgeBaseBrowser';
import type { KnowledgeBase, Document } from '../shared/types';

interface Session {
  id: string;
  name: string;
  created_at: Date;
}

export const App: React.FC = () => {
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingKB, setIsLoadingKB] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string>('default');
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  // Load knowledge base and sessions on mount
  useEffect(() => {
    loadSessions();
    loadKnowledgeBase();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/kb/sessions');
      if (!response.ok) throw new Error('Failed to load sessions');
      const data = await response.json();
      setSessions(data.sessions);
      setActiveSession(data.activeSession);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadKnowledgeBase = async () => {
    try {
      setIsLoadingKB(true);
      const response = await fetch('/api/kb');
      if (!response.ok) throw new Error('Failed to load knowledge base');
      const data = await response.json();
      setKnowledgeBase(data.knowledgeBase);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingKB(false);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    try {
      const response = await fetch('/api/kb/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSessionName }),
      });
      if (!response.ok) throw new Error('Failed to create session');
      setNewSessionName('');
      setShowNewSession(false);
      await loadSessions();
      await loadKnowledgeBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }
  };

  const handleSwitchSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/kb/sessions/${sessionId}/switch`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to switch session');
      setActiveSession(sessionId);
      await loadKnowledgeBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(`Delete session "${sessions.find(s => s.id === sessionId)?.name}"?`)) return;
    try {
      const response = await fetch(`/api/kb/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete session');
      await loadSessions();
      await loadKnowledgeBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const handleClearSession = async () => {
    if (!confirm('Clear all documents in this session? This cannot be undone.')) return;
    try {
      const response = await fetch('/api/kb/clear', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to clear session');
      await loadKnowledgeBase();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear session');
    }
  };

  const handleUpload = async (file: File, type: Document['type']) => {
    try {
      setIsUploading(true);
      setError(null);

      console.log('Uploading:', { filename: file.name, type, size: file.size });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      console.log('Sending fetch to /api/kb/upload');
      const response = await fetch('/api/kb/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      console.log('Upload successful, reloading KB');
      // Reload knowledge base after successful upload
      await loadKnowledgeBase();
      console.log('KB reloaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      console.error('Upload error:', msg);
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div>
            <h1>Jobber v0</h1>
            <p className="subtitle">AI-Powered Job Application Assistant</p>
          </div>
          <div className="session-controls">
            <select value={activeSession} onChange={(e) => handleSwitchSession(e.target.value)} className="session-selector">
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button onClick={() => setShowNewSession(!showNewSession)} className="btn-secondary">
              + New
            </button>
            <button onClick={handleClearSession} className="btn-danger" title="Clear all documents">
              Clear
            </button>
            {activeSession !== 'default' && (
              <button onClick={() => handleDeleteSession(activeSession)} className="btn-danger" title="Delete this session">
                Delete
              </button>
            )}
          </div>
        </div>
        {showNewSession && (
          <div className="new-session-form">
            <input
              type="text"
              placeholder="Session name (e.g., Google PM, Acme Frontend)"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              autoFocus
            />
            <button onClick={handleCreateSession} className="btn-primary">Create</button>
            <button onClick={() => setShowNewSession(false)} className="btn-secondary">Cancel</button>
          </div>
        )}
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="app-layout">
        <aside className="left-panel">
          <UploadZone onUpload={handleUpload} isLoading={isUploading} />
          <KnowledgeBaseBrowser knowledgeBase={knowledgeBase} isLoading={isLoadingKB} />
        </aside>

        <main className="center-panel">
          <div className="placeholder">
            <h2>Resume & Cover Letter Generator</h2>
            <p>Coming soon...</p>
            <p className="subtitle">
              Paste a job description to generate tailored resume and cover letter
            </p>
          </div>
        </main>

        <aside className="right-panel">
          <div className="placeholder">
            <h2>Document Preview</h2>
            <p>Coming soon...</p>
          </div>
        </aside>
      </div>

      <style>{`
        :root {
          --bg-primary: #ffffff;
          --bg-secondary: #f5f5f5;
          --text-primary: #1a1a1a;
          --text-secondary: #666666;
          --border-color: #e0e0e0;
          --accent: #0066cc;
          --accent-bg: #e6f0ff;
          --tag-bg: #f0f0f0;
          --tag-text: #333;
          --input-bg: #ffffff;
          --error-bg: #fff3cd;
          --error-text: #856404;
          --danger-bg: #f8d7da;
          --danger-text: #721c24;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --bg-primary: #1a1a1a;
            --bg-secondary: #2a2a2a;
            --text-primary: #ffffff;
            --text-secondary: #999999;
            --border-color: #333333;
            --accent: #4a9eff;
            --accent-bg: #1a3a5a;
            --tag-bg: #333333;
            --tag-text: #cccccc;
            --input-bg: #2a2a2a;
            --error-bg: #664400;
            --error-text: #ffaa66;
            --danger-bg: #5a2a2a;
            --danger-text: #ff9999;
          }
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue',
            sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        .app-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .app-header h1 {
          margin: 0;
          font-size: 24px;
        }

        .app-header .subtitle {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .session-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .session-selector {
          padding: 6px 12px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--input-bg);
          color: var(--text-primary);
          font-size: 13px;
          cursor: pointer;
        }

        .btn-primary, .btn-secondary, .btn-danger {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: var(--accent);
          color: white;
        }

        .btn-primary:hover {
          opacity: 0.9;
        }

        .btn-secondary {
          background: var(--tag-bg);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
          background: var(--border-color);
        }

        .btn-danger {
          background: var(--danger-bg);
          color: var(--danger-text);
          border: 1px solid var(--danger-text);
          font-size: 12px;
        }

        .btn-danger:hover {
          opacity: 0.9;
        }

        .new-session-form {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color);
        }

        .new-session-form input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--input-bg);
          color: var(--text-primary);
          font-size: 13px;
        }

        .error-banner {
          padding: 12px 24px;
          background: var(--error-bg);
          color: var(--error-text);
          border-bottom: 1px solid var(--border-color);
          font-size: 14px;
        }

        .app-layout {
          display: grid;
          grid-template-columns: 25% 35% 40%;
          flex: 1;
          overflow: hidden;
          gap: 0;
        }

        .left-panel,
        .center-panel,
        .right-panel {
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .left-panel {
          border-right: 1px solid var(--border-color);
        }

        .center-panel {
          border-right: 1px solid var(--border-color);
        }

        .placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
          text-align: center;
          padding: 24px;
        }

        .placeholder h2 {
          margin: 0 0 8px 0;
          color: var(--text-primary);
        }

        .placeholder p {
          margin: 4px 0;
        }

        .placeholder .subtitle {
          font-size: 13px;
          margin-top: 8px;
        }

        @media (max-width: 1200px) {
          .app-layout {
            grid-template-columns: 1fr;
          }

          .left-panel,
          .center-panel,
          .right-panel {
            border-right: none;
            display: none;
          }

          .left-panel.active,
          .center-panel.active,
          .right-panel.active {
            display: flex;
          }
        }
      `}</style>
    </div>
  );
};
