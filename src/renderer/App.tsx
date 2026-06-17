import React, { useEffect, useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { KnowledgeBaseBrowser } from './components/KnowledgeBaseBrowser';
import type { KnowledgeBase, Document } from '../shared/types';

export const App: React.FC = () => {
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingKB, setIsLoadingKB] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load knowledge base on mount
  useEffect(() => {
    loadKnowledgeBase();
  }, []);

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
        <h1>Jobber v0</h1>
        <p className="subtitle">AI-Powered Job Application Assistant</p>
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

        .app-header h1 {
          margin: 0;
          font-size: 24px;
        }

        .app-header .subtitle {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: var(--text-secondary);
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
