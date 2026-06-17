import React, { useState } from 'react';
import type { Document } from '../../shared/types';

interface UploadZoneProps {
  onUpload: (file: File, type: Document['type']) => Promise<void>;
  isLoading: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onUpload, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedType, setSelectedType] = useState<Document['type']>('resume');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'];
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt', '.md'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      alert('Please upload a PDF, DOCX, TXT, or Markdown file');
      return;
    }

    await onUpload(file, selectedType);
  };

  return (
    <div className="upload-zone">
      <div className="upload-type-selector">
        <label>Document Type:</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as Document['type'])}
          disabled={isLoading}
        >
          <option value="resume">Resume</option>
          <option value="cover_letter">Cover Letter</option>
          <option value="case_study">Case Study</option>
          <option value="linkedin">LinkedIn Profile</option>
          <option value="portfolio">Portfolio / Project Notes</option>
        </select>
      </div>

      <div
        className={`dropzone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          onChange={handleChange}
          disabled={isLoading}
          accept=".pdf,.docx,.doc,.txt,.md"
          className="hidden"
        />
        <label htmlFor="file-input" className="dropzone-label">
          {isLoading ? (
            <>
              <div className="spinner"></div>
              <p>Uploading and parsing...</p>
            </>
          ) : (
            <>
              <p className="dropzone-text">Drop your file here or click to select</p>
              <p className="dropzone-subtext">Supports PDF, DOCX, TXT, and Markdown (max 10MB)</p>
            </>
          )}
        </label>
      </div>

      <style>{`
        .upload-zone {
          padding: 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .upload-type-selector {
          margin-bottom: 16px;
        }

        .upload-type-selector label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 8px;
          color: var(--text-secondary);
        }

        .upload-type-selector select {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--input-bg);
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
        }

        .dropzone {
          border: 2px dashed var(--border-color);
          border-radius: 8px;
          padding: 32px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .dropzone.active {
          border-color: var(--accent);
          background: var(--accent-bg);
        }

        .dropzone-label {
          cursor: pointer;
          display: block;
        }

        .dropzone-text {
          margin: 0 0 8px 0;
          font-weight: 500;
          color: var(--text-primary);
        }

        .dropzone-subtext {
          margin: 0;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border-color);
          border-top: 2px solid var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        #file-input.hidden {
          display: none;
        }

        select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
