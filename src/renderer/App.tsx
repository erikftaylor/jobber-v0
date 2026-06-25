import React, { useEffect, useState } from 'react';
import { UploadZone } from './components/UploadZone';
import SessionDropdown from './components/SessionDropdown';
import SessionWarningDialog from './components/SessionWarningDialog';
import type { Document, ResumeQualityReport } from '../shared/types';
import { fetchSavedResumes, fetchSavedResume, formatSavedDate, type SavedResume } from './savedResumes';

interface Session {
  id: string;
  name: string;
  created_at: Date;
}

interface SessionForDropdown {
  id: string;
  company: string;
  title: string;
  added_at: Date;
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
  resumeId?: string; // Backend-persisted resume ID (for DOCX/archive exports)
  qualityReport?: ResumeQualityReport; // Quality assessment of the generated resume
}

const EXPORT_STATUS = {
  PDF: 'Exporting to PDF…',
  DOCX: 'Exporting to DOCX…',
};

const QUALITY_STATUS_CONFIG = {
  pass: { icon: '✓', label: 'Ready to Export', className: 'quality-pass' },
  warn: { icon: '⚠', label: 'Review Issues', className: 'quality-warn' },
  fail: { icon: '✗', label: 'Fix Required', className: 'quality-fail' }
};

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
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState({ company: null as string | null, role: null as string | null, confidence: 0 });
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    loadSessions();
    loadDocuments();
    loadSavedResumes();
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
      // Clear any stale error from an earlier failed load (e.g. backend not yet
      // up on first mount) so the banner self-heals once a load succeeds.
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Load saved résumé artifacts. Never blocks the generate flow — failures are
  // surfaced only in the saved-résumés section.
  const loadSavedResumes = async () => {
    try {
      setIsLoadingSaved(true);
      setSavedError(null);
      setSavedResumes(await fetchSavedResumes());
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : 'Failed to load saved résumés');
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const dismissWarning = (warningText: string) => {
    setDismissedWarnings(prev => new Set([...prev, warningText]));
  };

  const acceptAllWarnings = () => {
    if (currentArtifact?.qualityReport?.ats.warnings) {
      const allWarnings = new Set(dismissedWarnings);
      currentArtifact.qualityReport.ats.warnings.forEach(w => allWarnings.add(w));
      setDismissedWarnings(allWarnings);
    }
  };

  // Reopen a saved résumé into the same state the generate flow uses, so the
  // existing preview/export path works unchanged.
  const handleOpenSavedResume = async (id: string) => {
    try {
      setError(null);
      setSavedError(null);
      const material = await fetchSavedResume(id);
      const artifact: ResumeArtifact = {
        id: `artifact-${Date.now()}`,
        version: 1,
        status: 'generated',
        content: material.generated_content,
        html: material.formatted_html,
        generatedAt: new Date(material.created_at),
        jobDescription: '',
        qualityReport: material.quality_report ?? undefined,
      };
      setCurrentArtifact(artifact);
      setGeneratedContent(material.generated_content);
      setGeneratedHtml(material.formatted_html);
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : 'Failed to open saved résumé');
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
   * Extract company and role from job description using Claude Haiku
   */
  const handleExtractJobInfo = async (jd: string = jobDescription) => {
    if (!jd.trim()) return;

    setIsExtracting(true);
    try {
      const response = await fetch('/api/kb/jobs/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd })
      });

      const extracted = await response.json();
      setExtractedInfo(extracted);

      // If extraction is confident and complete, auto-create session
      if (extracted.confidence > 0.7 && extracted.company && extracted.role) {
        await createSessionFromExtraction(extracted.company, extracted.role);
      } else {
        // Show warning dialog for manual entry
        setShowWarningDialog(true);
      }
    } catch (error) {
      console.error('Extraction failed:', error);
      setShowWarningDialog(true);
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * Create a new session from extracted company and role information
   */
  const createSessionFromExtraction = async (company: string, role: string) => {
    try {
      // Create a session name combining company and role
      const sessionName = `${company} - ${role}`;

      const response = await fetch('/api/kb/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName })
      });

      if (!response.ok) throw new Error('Failed to create session');

      const sessionResponse = await response.json();
      const newSession = sessionResponse.session;

      // Reload sessions to update the UI
      await loadSessions();
      setActiveSession(newSession.id);
      setShowWarningDialog(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
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
        resumeId: data.artifact_id, // Persisted resume ID from backend
        qualityReport: data.qualityReport, // Quality assessment from backend
      };

      // If the backend persisted this generation, refresh the saved list
      // (fire-and-forget — never blocks the generate flow).
      if (data.artifact_id) {
        loadSavedResumes();
      }

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
      }

      // Need a resumeId (artifact_id from backend)
      if (!currentArtifact?.resumeId) {
        throw new Error('Resume not yet saved. Please try again after generation completes.');
      }

      // Call the PDF export endpoint
      setExportStatus(EXPORT_STATUS.PDF);
      const response = await fetch('/api/kb/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: currentArtifact.resumeId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export PDF');
      }

      // Get the PDF file as a blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tailored-resume.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Mark artifact as exported
      if (currentArtifact) {
        setCurrentArtifact({ ...currentArtifact, status: 'exported' });
      }
      setExportStatus(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF');
      setExportStatus(null);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDOCX = async () => {
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
      }

      // Need a resumeId (artifact_id from backend)
      if (!currentArtifact?.resumeId) {
        throw new Error('Resume not yet saved. Please try again after generation completes.');
      }

      // Call the DOCX export endpoint
      setExportStatus(EXPORT_STATUS.DOCX);
      const response = await fetch('/api/kb/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: currentArtifact.resumeId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export DOCX');
      }

      // Get the DOCX file as a blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tailored-resume.docx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Mark artifact as exported
      if (currentArtifact) {
        setCurrentArtifact({ ...currentArtifact, status: 'exported' });
      }
      setExportStatus(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export DOCX');
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

  /**
   * Convert session data to format expected by SessionDropdown component
   */
  const getSessionsForDropdown = (): SessionForDropdown[] => {
    return sessions.map(session => {
      // Try to parse company and role from session name (format: "Company - Role")
      const parts = session.name.split(' - ');
      const company = parts[0] || 'Session';
      const title = parts[1] || session.name;

      return {
        id: session.id,
        company,
        title,
        added_at: session.created_at,
      };
    });
  };

  // Render the quality report panel with P2 enhancements
  const renderQualityReport = () => {
    if (!currentArtifact?.qualityReport) {
      if (currentArtifact && !currentArtifact.qualityReport) {
        return (
          <div className="quality-report-panel">
            <p className="quality-unavailable">Quality check unavailable for this older resume.</p>
          </div>
        );
      }
      return null;
    }

    const report = currentArtifact.qualityReport;

    // Get status display with P2 styling
    const getStatusDisplay = (status: string) => {
      return QUALITY_STATUS_CONFIG[status as keyof typeof QUALITY_STATUS_CONFIG] || QUALITY_STATUS_CONFIG.pass;
    };

    const statusDisplay = getStatusDisplay(report.overallStatus);

    // Count warnings and failures for summary line
    const warningCount = report.ats?.warnings?.length || 0;
    const missingKeywordCount = report.keywords?.missing?.length || 0;

    return (
      <div className="quality-report-panel">
        {/* P2 Enhancement: Header with title and prominent status badge */}
        <div className="quality-header-p2">
          <h3>Quality Check</h3>
          <div className={`quality-badge quality-badge-${statusDisplay.className}`}>
            <span className="quality-badge-icon">{statusDisplay.icon}</span>
            <span className="quality-badge-label">{statusDisplay.label}</span>
          </div>
        </div>

        {/* P2 Enhancement: Summary line showing issue counts */}
        {report.overallStatus !== 'pass' && (
          <div className="quality-summary-line">
            <p>
              {warningCount > 0 && `${warningCount} ATS warning${warningCount !== 1 ? 's' : ''}`}
              {warningCount > 0 && missingKeywordCount > 0 && ' • '}
              {missingKeywordCount > 0 && `${missingKeywordCount} missing keyword${missingKeywordCount !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}

        {/* Source Support Section */}
        <div className="quality-section">
          <h4>Source Support</h4>
          <div className={`quality-item quality-${report.truthfulness.status === 'pass' ? 'pass' : 'warn'}`}>
            {report.truthfulness.status === 'pass' ? '✓ Pass' : '⚠ Warning'}
          </div>
          {report.truthfulness.supportedClaims.length > 0 && (
            <div className="quality-subsection">
              <p className="quality-subsection-label">✓ Supported claims ({report.truthfulness.supportedClaims.length})</p>
              {report.truthfulness.supportedClaims.slice(0, 2).map((claim, i) => (
                <p key={`claim-${i}-${claim.substring(0, 30)}`} className="quality-subsection-item">{claim.substring(0, 60)}...</p>
              ))}
              {report.truthfulness.supportedClaims.length > 2 && (
                <p className="quality-subsection-more">+{report.truthfulness.supportedClaims.length - 2} more</p>
              )}
            </div>
          )}
          {report.truthfulness.unsupportedClaims.length > 0 && (
            <div className="quality-subsection quality-subsection-warning">
              <p className="quality-subsection-label">⚠ Potential unsupported claims ({report.truthfulness.unsupportedClaims.length})</p>
              {report.truthfulness.unsupportedClaims.slice(0, 1).map((claim, i) => (
                <p key={`claim-${i}-${claim.substring(0, 30)}`} className="quality-subsection-item">{claim.substring(0, 60)}...</p>
              ))}
            </div>
          )}
        </div>

        {/* ATS Formatting Section */}
        <div className="quality-section">
          <h4>ATS Formatting</h4>
          <div className={`quality-item quality-${report.ats.status === 'pass' ? 'pass' : 'warn'}`}>
            {report.ats.status === 'pass' ? '✓ Pass' : '⚠ Warning'}
          </div>
          {report.ats.warnings.length > 0 && (
            <div className="quality-subsection quality-subsection-warning">
              {report.ats.warnings.filter(w => !dismissedWarnings.has(w)).map((warning, i) => (
                <div key={`warning-${i}-${warning.substring(0, 30)}`} className="quality-warning-item">
                  <p className="quality-warning-text">{warning}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Keywords Section */}
        <div className="quality-section">
          <h4>Keywords</h4>
          <div className={`quality-item quality-${report.keywords.missing.length === 0 ? 'pass' : 'warn'}`}>
            {report.keywords.missing.length === 0 ? '✓ Pass' : '⚠ Warning'}
          </div>
          {report.keywords.missing.length > 0 && (
            <div className="quality-subsection quality-subsection-warning">
              <p className="quality-subsection-label">Missing keywords ({report.keywords.missing.length})</p>
              {report.keywords.missing.slice(0, 3).map((keyword, i) => (
                <p key={`keyword-${i}-${keyword.substring(0, 30)}`} className="quality-subsection-item">{keyword}</p>
              ))}
              {report.keywords.missing.length > 3 && (
                <p className="quality-subsection-more">+{report.keywords.missing.length - 3} more</p>
              )}
            </div>
          )}
        </div>

        {/* Length & Pages Section */}
        {report.length && (
          <div className="quality-section">
            <h4>Length & Pages</h4>
            <div className={`quality-item quality-${report.length.warnings.length === 0 ? 'pass' : 'warn'}`}>
              {report.length.warnings.length === 0 ? '✓ Pass' : '⚠ Warning'}
            </div>
            {report.length.warnings.length > 0 && (
              <div className="quality-subsection">
                {report.length.warnings.map((warning, i) => (
                  <p key={`length-${i}-${warning.substring(0, 30)}`} className="quality-subsection-item">{warning}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
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
            {sessions.length > 0 && (
              <SessionDropdown
                sessions={getSessionsForDropdown()}
                activeSessionId={activeSession}
                onSelectSession={handleSwitchSession}
              />
            )}
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

      <SessionWarningDialog
        isOpen={showWarningDialog}
        extracted={extractedInfo}
        onConfirm={(data) => createSessionFromExtraction(data.company, data.role)}
        onCancel={() => setShowWarningDialog(false)}
      />

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

        <main className="center-panel" data-phase={currentArtifact ? 'review' : 'input'}>
          {!currentArtifact ? (
            // INPUT PHASE: Large textarea, focused input mode
            <div className="generator-section">
              <h2>Generate Tailored Resume</h2>
              <div className="generator-form">
                <label>Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  rows={12}
                  disabled={isGenerating || isExtracting}
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => handleExtractJobInfo(jobDescription)}
                    disabled={isExtracting || !jobDescription.trim()}
                    className="btn-secondary"
                    title="Auto-extract company and job title, create a new session"
                  >
                    {isExtracting ? 'Extracting...' : 'Create Session'}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || documents.length === 0}
                    className="btn-primary btn-large"
                  >
                    {isGenerating ? 'Generating...' : 'Generate Resume'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // REVIEW PHASE: Two-pane layout (resume preview + quality report) + sticky footer
            <>
              {/* Resume Preview Pane */}
              <div className="review-pane review-pane-top">
                <div className="pane-header">
                  <h3>Resume Preview</h3>
                  <button
                    onClick={() => {
                      setCurrentArtifact(null);
                      setGeneratedContent(null);
                      setGeneratedHtml(null);
                      setJobDescription('');
                      setExportStatus(null);
                      setDismissedWarnings(new Set());
                    }}
                    className="btn-small-primary"
                    title="Back to edit job description"
                  >
                    ← Back to Edit
                  </button>
                </div>
                <div className="resume-content">
                  {generatedContent && (
                    generatedContent.split('\n').map((line, i) => (
                      <p key={`line-${i}-${line.substring(0, 20)}`}>{line || <br />}</p>
                    ))
                  )}
                </div>
              </div>

              {/* Quality Report Pane */}
              <div className="review-pane review-pane-bottom">
                {renderQualityReport()}
              </div>

              {/* Sticky Footer with Export Buttons */}
              <div className="review-footer">
                <button
                  onClick={() => {
                    if (generatedContent) {
                      navigator.clipboard.writeText(generatedContent);
                      alert('Copied to clipboard!');
                    }
                  }}
                  className="btn-secondary"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isExporting}
                  className="btn-primary"
                  title="Open resume in new tab to print/save as PDF"
                >
                  {isExporting && exportStatus === EXPORT_STATUS.PDF ? 'Exporting PDF...' : 'Export as PDF'}
                </button>
                <button
                  onClick={handleDownloadDOCX}
                  disabled={isExporting}
                  className="btn-primary"
                  title="Download resume as DOCX for editing"
                >
                  {isExporting && exportStatus === EXPORT_STATUS.DOCX ? 'Exporting DOCX...' : 'Export as DOCX'}
                </button>
              </div>
            </>
          )}
        </main>

        <aside className="right-panel">
          <div className="saved-panel">
            <h3>Saved Résumés ({savedResumes.length})</h3>
            {isLoadingSaved ? (
              <p className="loading">Loading...</p>
            ) : savedError ? (
              <p className="empty">{savedError}</p>
            ) : savedResumes.length === 0 ? (
              <p className="empty">No saved résumés yet</p>
            ) : (
              <div className="saved-list">
                {savedResumes.map(m => (
                  <button
                    key={m.id}
                    className="saved-item"
                    onClick={() => handleOpenSavedResume(m.id)}
                    title="Open this saved résumé"
                  >
                    <span className="saved-title">{m.title}</span>
                    <span className="saved-meta">{m.type} · {formatSavedDate(m.created_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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

        .saved-panel {
          margin-bottom: 16px;
        }

        .saved-panel h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
        }

        .saved-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .saved-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: left;
          padding: 8px 10px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--input-bg);
          color: var(--text-primary);
          cursor: pointer;
        }

        .saved-item:hover {
          border-color: var(--accent);
          background: var(--accent-bg);
        }

        .saved-title {
          font-size: 13px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .saved-meta {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .quality-report-panel {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 16px;
          margin: 16px 0;
        }

        .quality-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          gap: 12px;
        }

        .quality-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .quality-overall {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .quality-pass {
          background: #e6ffe6;
          color: #1a5c1a;
        }

        .quality-warn {
          background: #fff4e6;
          color: #8c6600;
        }

        .quality-fail {
          background: #ffe6e6;
          color: #8c1a1a;
        }

        .quality-section {
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .quality-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .quality-section h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .quality-status {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
        }

        .quality-label {
          margin: 0 0 4px 0;
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .quality-list {
          margin: 8px 0 0 0;
        }

        .quality-list.quality-warning {
          background: rgba(255, 165, 0, 0.05);
          padding: 8px;
          border-radius: 3px;
        }

        .quality-item {
          margin: 4px 0;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .quality-item.quality-ok {
          color: #1a5c1a;
          font-weight: 500;
        }

        .quality-item-more {
          margin: 4px 0;
          font-size: 11px;
          color: var(--text-secondary);
          font-style: italic;
        }

        .quality-item-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          margin: 4px 0;
        }

        .quality-item-row .quality-item {
          flex: 1;
          margin: 0;
        }

        .quality-item-row .quality-item-more {
          flex: 1;
          margin: 0;
        }

        .dismiss-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 14px;
          padding: 2px 4px;
          line-height: 1;
          transition: color 0.2s;
          flex-shrink: 0;
        }

        .dismiss-btn:hover {
          color: var(--text-primary);
        }

        .quality-warning-export {
          background: var(--error-bg);
          border: 1px solid #ffc0c0;
          color: var(--error-text);
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          margin-top: 12px;
        }

        .quality-unavailable {
          color: var(--text-secondary);
          font-size: 12px;
          font-style: italic;
          margin: 0;
        }

        /* P1: Two-Pane Layout - Center Panel */
        .center-panel[data-phase="review"] {
          display: grid;
          grid-template-rows: 1fr 1fr auto;
          grid-template-columns: 1fr;
          height: 100%;
          overflow: hidden;
        }

        .center-panel[data-phase="input"] {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
        }

        /* Resume Preview Pane (Top) */
        .review-pane {
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: 0;
          min-height: 0;
        }

        .review-pane-top {
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-primary);
        }

        .review-pane-top .pane-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
          background: var(--bg-primary);
        }

        .review-pane-top .pane-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .review-pane-top .btn-small-primary {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .review-pane-top .btn-small-primary:hover {
          opacity: 0.9;
        }

        .resume-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: var(--bg-primary);
          font-family: 'Courier New', monospace;
          font-size: 11px;
          line-height: 1.4;
          color: var(--text-primary);
        }

        .resume-content p {
          margin: 0;
          word-wrap: break-word;
        }

        /* Quality Report Pane (Bottom) */
        .review-pane-bottom {
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          padding: 16px 20px;
          overflow-y: auto;
        }

        /* Sticky Footer with Export Buttons */
        .review-footer {
          background: var(--bg-secondary);
          border-top: 2px solid var(--border-color);
          padding: 12px 20px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
          flex-shrink: 0;
        }

        .review-footer .btn-secondary,
        .review-footer .btn-primary {
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 500;
          border-radius: 3px;
          cursor: pointer;
          transition: opacity 0.2s;
          white-space: nowrap;
        }

        .review-footer .btn-secondary {
          background: white;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
        }

        .review-footer .btn-secondary:hover:not(:disabled) {
          background: var(--bg-primary);
        }

        .review-footer .btn-primary {
          background: var(--accent);
          color: white;
          border: none;
        }

        .review-footer .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .review-footer .btn-primary:disabled,
        .review-footer .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Mobile Responsive: Stack vertically on small screens */
        @media (max-width: 600px) {
          .center-panel[data-phase="review"] {
            grid-template-rows: auto auto auto;
          }

          .review-pane-top {
            max-height: 40vh;
          }

          .review-pane-bottom {
            max-height: 40vh;
          }

          .review-footer {
            flex-direction: column;
            justify-content: stretch;
          }

          .review-footer .btn-secondary,
          .review-footer .btn-primary {
            width: 100%;
          }
        }

        /* P2: Quality Report Redesign */
        .quality-report-panel {
          background: var(--bg-secondary);
          border: none;
          border-radius: 0;
          padding: 0;
          margin: 0;
        }

        /* P2 Header with Title and Status Badge */
        .quality-header-p2 {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border-color);
        }

        .quality-header-p2 h3 {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        /* P2 Prominent Status Badge */
        .quality-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 3px;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .quality-badge-icon {
          font-size: 14px;
        }

        .quality-badge-label {
          letter-spacing: 0.3px;
        }

        .quality-badge-quality-pass {
          background: #e6ffe6;
          color: #1a5c1a;
        }

        .quality-badge-quality-warn {
          background: #fff4e6;
          color: #cc6633;
        }

        .quality-badge-quality-fail {
          background: #ffe6e6;
          color: #8c1a1a;
        }

        /* P2 Summary Line */
        .quality-summary-line {
          background: rgba(204, 102, 51, 0.05);
          border-left: 3px solid #cc6633;
          padding: 8px 10px;
          margin-bottom: 12px;
          border-radius: 2px;
        }

        .quality-summary-line p {
          margin: 0;
          font-size: 12px;
          color: #666;
          font-weight: 500;
          line-height: 1.4;
        }

        /* Quality Section with Better Hierarchy */
        .quality-section {
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border-color);
        }

        .quality-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .quality-section h4 {
          margin: 0 0 6px 0;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        /* Quality Item (Status Line) */
        .quality-item {
          margin: 0 0 6px 0;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.4;
        }

        .quality-item.quality-pass {
          color: #1a5c1a;
        }

        .quality-item.quality-warn {
          color: #cc6633;
        }

        .quality-item.quality-fail {
          color: #8c1a1a;
        }

        /* Subsection for Details */
        .quality-subsection {
          margin: 6px 0;
          padding: 0;
          font-size: 11px;
        }

        .quality-subsection-label {
          margin: 0 0 4px 0;
          font-size: 11px;
          font-weight: 600;
          color: #666;
        }

        .quality-subsection-item {
          margin: 2px 0 2px 12px;
          font-size: 11px;
          color: #999;
          line-height: 1.3;
        }

        .quality-subsection-more {
          margin: 2px 0 0 12px;
          font-size: 10px;
          color: #999;
          font-style: italic;
        }

        .quality-subsection-warning {
          background: rgba(204, 102, 51, 0.05);
          padding: 4px 8px;
          border-left: 3px solid #cc6633;
          border-radius: 2px;
          margin: 6px 0 0 0;
        }

        .quality-subsection-warning .quality-subsection-label {
          color: #cc6633;
          font-weight: 700;
        }

        /* Warning Item in ATS Section */
        .quality-warning-item {
          background: rgba(204, 102, 51, 0.03);
          padding: 4px 8px;
          margin: 4px 0;
          border-radius: 2px;
          border-left: 2px solid #cc6633;
        }

        .quality-warning-text {
          margin: 0;
          font-size: 11px;
          color: #666;
          line-height: 1.4;
        }

        /* Hide/Restyle Dismiss Buttons */
        .dismiss-btn {
          display: none;
        }
      `}</style>
    </div>
  );
};
