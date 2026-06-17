import React, { useEffect, useState } from 'react';
import { UploadZone } from './components/UploadZone';
import type { Document } from '../shared/types';

interface Session {
  id: string;
  name: string;
  created_at: Date;
}

interface DocumentItem {
  id: string;
  type: Document['type'];
  filename: string;
  size_chars: number;
  uploaded_at: Date;
}

interface ResumeArtifact {
  id: string;
  version: number;
  status: 'draft' | 'generated' | 'exported';
  content: string;
  html: string | null;
  generatedAt: Date;
  jobDescription: string;
}

export const App: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string>('default');
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [currentArtifact, setCurrentArtifact] = useState<ResumeArtifact | null>(null);
  // Legacy state - kept for backward compatibility during transition
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
    loadDocuments();
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

  const loadDocuments = async () => {
    try {
      setIsLoadingDocs(true);
      const response = await fetch('/api/kb');
      if (!response.ok) throw new Error('Failed to load documents');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleUpload = async (file: File, type: Document['type']) => {
    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await fetch('/api/kb/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      await loadDocuments();
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setIsUploading(false);
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
      await loadDocuments();
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
      await loadDocuments();
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
      await loadDocuments();
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
      await loadDocuments();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear session');
    }
  };

  /**
   * Generate a resume from job description and uploaded documents
   * Returns a ResumeArtifact with generated content and HTML
   */
  const generateResume = async (jd: string = jobDescription): Promise<ResumeArtifact | null> => {
    if (!jd.trim()) {
      setError('Please paste a job description');
      return null;
    }
    if (documents.length === 0) {
      setError('Upload documents first');
      return null;
    }

    try {
      const response = await fetch('/api/kb/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_description: jd,
          material_type: 'resume',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      // Create artifact
      const artifact: ResumeArtifact = {
        id: `artifact-${Date.now()}`,
        version: 1,
        status: 'generated',
        content: data.generated_content,
        html: data.formatted_html,
        generatedAt: new Date(),
        jobDescription: jd,
      };

      return artifact;
    } catch (err) {
      throw err;
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const artifact = await generateResume();
      if (!artifact) return;

      // Update artifact state
      setCurrentArtifact(artifact);
      // Keep legacy state in sync
      setGeneratedContent(artifact.content);
      setGeneratedHtml(artifact.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    let htmlToExport = currentArtifact?.html || generatedHtml;

    try {
      setIsExporting(true);
      setError(null);

      // If no artifact exists, generate one
      if (!currentArtifact) {
        setExportStatus('Generating tailored resume…');
        const artifact = await generateResume();
        if (!artifact) return;
        setCurrentArtifact(artifact);
        setGeneratedContent(artifact.content);
        setGeneratedHtml(artifact.html);
        htmlToExport = artifact.html;
      }

      // Validate artifact has necessary content
      if (!htmlToExport) {
        if (!currentArtifact?.content) {
          throw new Error('No resume content found. Please generate a resume first.');
        }
        // If we have content but no HTML, create a basic HTML wrapper
        setExportStatus('Preparing resume for export…');
        htmlToExport = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Resume</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; margin: 40px; }
    h2 { margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
  </style>
</head>
<body>
<pre>${currentArtifact.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
      }

      // Open HTML in new tab for user to print/save as PDF
      setExportStatus('Opening resume in new tab…');
      const htmlBlob = new Blob([htmlToExport], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(htmlBlob);
      const newTab = window.open(url, '_blank', 'noopener,noreferrer');

      if (!newTab) {
        throw new Error('Could not open new tab. Please check popup blocker settings.');
      }

      // Allow the blob to persist for the new tab
      setTimeout(() => {
        // Clean up after the tab has loaded (1 second should be enough)
        // Actually, keep the URL alive for the tab's lifetime
      }, 1000);

      // Mark artifact as exported
      if (currentArtifact) {
        setCurrentArtifact({ ...currentArtifact, status: 'exported' });
      }
      setExportStatus(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export resume');
      setExportStatus(null);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      const response = await fetch(`/api/kb/documents/${docId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete document');
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
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
      {exportStatus && <div className="status-banner">{exportStatus}</div>}

      <div className="app-layout">
        <aside className="left-panel">
          <UploadZone onUpload={handleUpload} isLoading={isUploading} />

          <div className="documents-panel">
            <h3>Uploaded Documents ({documents.length})</h3>
            {isLoadingDocs ? (
              <p className="loading">Loading...</p>
            ) : documents.length === 0 ? (
              <p className="empty">No documents uploaded yet</p>
            ) : (
              <div className="documents-list">
                {documents.map(doc => (
                  <div key={doc.id} className="document-item">
                    <div className="doc-info">
                      <p className="doc-name">{doc.filename}</p>
                      <p className="doc-type">{doc.type.replace('_', ' ')}</p>
                      <p className="doc-size">{Math.round(doc.size_chars / 1000)}KB</p>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="btn-small-danger"
                      title="Delete document"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="center-panel">
          <div className="generator-section">
            <h2>Generate Tailored Resume</h2>
            <div className="generator-form">
              <label>Job Description</label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                rows={8}
                disabled={isGenerating}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || documents.length === 0}
                className="btn-primary btn-large"
              >
                {isGenerating ? 'Generating...' : 'Generate Resume'}
              </button>
            </div>
          </div>

          {generatedContent && (
            <div className="generated-section">
              <div className="generated-header">
                <h2>Generated Resume</h2>
                <button
                  onClick={() => {
                    setCurrentArtifact(null);
                    setGeneratedContent(null);
                    setGeneratedHtml(null);
                    setJobDescription('');
                    setExportStatus(null);
                  }}
                  className="btn-small-danger"
                  title="Clear generated resume and job description"
                >
                  Clear
                </button>
              </div>
              <div className="generated-content">
                {generatedContent.split('\n').map((line, i) => (
                  <p key={i}>{line || <br />}</p>
                ))}
              </div>
              <div className="button-group">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedContent);
                    alert('Copied to clipboard!');
                  }}
                  className="btn-secondary"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isExporting || documents.length === 0 || !jobDescription.trim()}
                  className="btn-primary"
                  title={documents.length === 0 ? 'Upload documents first' : !jobDescription.trim() ? 'Enter job description first' : 'Open resume in new tab to print/save as PDF'}
                >
                  {exportStatus || (isExporting ? 'Exporting...' : 'Export as PDF')}
                </button>
              </div>
            </div>
          )}
        </main>

        <aside className="right-panel">
          <div className="info-panel">
            <h3>How it works</h3>
            <ol>
              <li>Upload your background documents (resume, case studies, etc.)</li>
              <li>Paste a job description</li>
              <li>Click Generate Resume</li>
              <li>Claude tailors a resume to match the job</li>
            </ol>
            <p className="context-info">
              📄 <strong>{documents.length} document{documents.length !== 1 ? 's' : ''}</strong> uploaded
              <br/>
              {documents.length > 0 && (
                <>Total: {Math.round(documents.reduce((sum, d) => sum + d.size_chars, 0) / 1000)}KB</>
              )}
            </p>
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

        .btn-primary, .btn-secondary, .btn-danger, .btn-small-danger {
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

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-large {
          padding: 12px 24px !important;
          font-size: 14px !important;
          width: 100%;
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

        .btn-small-danger {
          padding: 4px 8px !important;
          font-size: 12px !important;
          background: transparent;
          color: var(--danger-text);
          border: 1px solid var(--border-color);
        }

        .btn-small-danger:hover {
          background: var(--danger-bg);
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

        .status-banner {
          padding: 12px 24px;
          background: #e3f2fd;
          color: #1565c0;
          border-bottom: 1px solid var(--border-color);
          font-size: 14px;
          font-weight: 500;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @media (prefers-color-scheme: dark) {
          .status-banner {
            background: #1a3a52;
            color: #64b5f6;
          }
        }

        .app-layout {
          display: grid;
          grid-template-columns: 25% 50% 25%;
          flex: 1;
          overflow: hidden;
          gap: 0;
        }

        .left-panel,
        .center-panel,
        .right-panel {
          overflow: auto;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-color);
        }

        .right-panel {
          border-right: none;
        }

        .documents-panel {
          padding: 20px;
          border-top: 1px solid var(--border-color);
        }

        .documents-panel h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .documents-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .document-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-secondary);
          font-size: 13px;
        }

        .doc-info {
          flex: 1;
        }

        .doc-name {
          margin: 0 0 4px 0;
          font-weight: 500;
          color: var(--text-primary);
          word-break: break-word;
        }

        .doc-type {
          margin: 0;
          font-size: 12px;
          color: var(--text-secondary);
          text-transform: capitalize;
        }

        .doc-size {
          margin: 2px 0 0 0;
          font-size: 11px;
          color: var(--text-secondary);
        }

        .empty, .loading {
          color: var(--text-secondary);
          font-size: 13px;
          text-align: center;
          padding: 20px;
        }

        .generator-section {
          padding: 24px;
        }

        .generator-section h2 {
          margin: 0 0 16px 0;
          font-size: 18px;
        }

        .generator-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .generator-form label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .generator-form textarea {
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--input-bg);
          color: var(--text-primary);
          font-family: monospace;
          font-size: 13px;
          resize: vertical;
        }

        .generator-form textarea:disabled {
          opacity: 0.6;
        }

        .generated-section {
          padding: 24px;
          border-top: 1px solid var(--border-color);
        }

        .generated-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .generated-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .generated-content {
          background: var(--bg-secondary);
          padding: 16px;
          border-radius: 4px;
          margin-bottom: 16px;
          white-space: pre-wrap;
          word-wrap: break-word;
          max-height: 400px;
          overflow-y: auto;
          font-size: 13px;
          line-height: 1.5;
        }

        .generated-content p {
          margin: 0;
        }

        .button-group {
          display: flex;
          gap: 8px;
        }

        .button-group button {
          flex: 1;
        }

        .info-panel {
          padding: 24px;
        }

        .info-panel h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
        }

        .info-panel ol {
          margin: 0 0 16px 0;
          padding-left: 20px;
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-secondary);
        }

        .info-panel li {
          margin-bottom: 6px;
        }

        .context-info {
          background: var(--bg-secondary);
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          margin: 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};
