import React, { useState } from 'react';
import type { KnowledgeBase } from '../../shared/types';

interface KnowledgeBaseBrowserProps {
  knowledgeBase: KnowledgeBase | null;
  isLoading: boolean;
}

type TabType = 'skills' | 'achievements' | 'technologies' | 'writing' | 'values';

export const KnowledgeBaseBrowser: React.FC<KnowledgeBaseBrowserProps> = ({
  knowledgeBase,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('skills');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="kb-browser loading">
        <div className="spinner"></div>
        <p>Loading knowledge base...</p>
      </div>
    );
  }

  if (!knowledgeBase) {
    return (
      <div className="kb-browser empty">
        <p>Upload documents to build your knowledge base</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  return (
    <div className="kb-browser">
      <div className="kb-header">
        <h2>Knowledge Base</h2>
        <div className="kb-stats">
          <span>{knowledgeBase.skills.length} skills</span>
          <span>{knowledgeBase.achievements.length} achievements</span>
        </div>
      </div>

      <div className="kb-tabs">
        <button
          className={`tab ${activeTab === 'skills' ? 'active' : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          Skills ({knowledgeBase.skills.length})
        </button>
        <button
          className={`tab ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          Achievements ({knowledgeBase.achievements.length})
        </button>
        <button
          className={`tab ${activeTab === 'technologies' ? 'active' : ''}`}
          onClick={() => setActiveTab('technologies')}
        >
          Technologies ({knowledgeBase.technologies.length})
        </button>
        <button
          className={`tab ${activeTab === 'writing' ? 'active' : ''}`}
          onClick={() => setActiveTab('writing')}
        >
          Writing Style
        </button>
        <button
          className={`tab ${activeTab === 'values' ? 'active' : ''}`}
          onClick={() => setActiveTab('values')}
        >
          Values ({knowledgeBase.values.length})
        </button>
      </div>

      <div className="kb-content">
        {activeTab === 'skills' && (
          <div className="kb-list">
            {knowledgeBase.skills.length === 0 ? (
              <p className="empty-message">No skills extracted yet</p>
            ) : (
              knowledgeBase.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="kb-item"
                  onClick={() => toggleExpand(skill.id)}
                >
                  <div className="item-header">
                    <strong>{skill.name}</strong>
                    <span className="category">{skill.category}</span>
                    <span className="confidence">
                      {Math.round(skill.confidence * 100)}%
                    </span>
                  </div>
                  {expandedItem === skill.id && (
                    <div className="item-details">
                      {skill.years_experience && (
                        <p>
                          <strong>Experience:</strong> {skill.years_experience}{' '}
                          years
                        </p>
                      )}
                      <p>
                        <strong>Source:</strong> {skill.source_document_id}
                      </p>
                      <p>
                        <strong>Quote:</strong> "{skill.source_excerpt}"
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="kb-list">
            {knowledgeBase.achievements.length === 0 ? (
              <p className="empty-message">No achievements extracted yet</p>
            ) : (
              knowledgeBase.achievements.map((ach) => (
                <div
                  key={ach.id}
                  className="kb-item"
                  onClick={() => toggleExpand(ach.id)}
                >
                  <div className="item-header">
                    <strong>{ach.title}</strong>
                    <span className="confidence">
                      {Math.round(ach.confidence * 100)}%
                    </span>
                  </div>
                  {expandedItem === ach.id && (
                    <div className="item-details">
                      <p>
                        <strong>Context:</strong> {ach.context}
                      </p>
                      {ach.metrics.length > 0 && (
                        <p>
                          <strong>Metrics:</strong> {ach.metrics.join(', ')}
                        </p>
                      )}
                      {ach.skills_demonstrated.length > 0 && (
                        <p>
                          <strong>Skills:</strong>{' '}
                          {ach.skills_demonstrated.join(', ')}
                        </p>
                      )}
                      <p>
                        <strong>Source:</strong> {ach.source_document_id}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'technologies' && (
          <div className="kb-list">
            {knowledgeBase.technologies.length === 0 ? (
              <p className="empty-message">No technologies extracted yet</p>
            ) : (
              knowledgeBase.technologies.map((tech) => (
                <div
                  key={tech.id}
                  className="kb-item"
                  onClick={() => toggleExpand(tech.id)}
                >
                  <div className="item-header">
                    <strong>{tech.name}</strong>
                    <span className="proficiency">{tech.proficiency}</span>
                    <span className="confidence">
                      {Math.round(tech.confidence * 100)}%
                    </span>
                  </div>
                  {expandedItem === tech.id && (
                    <div className="item-details">
                      <p>
                        <strong>Source:</strong> {tech.source_document_id}
                      </p>
                      <p>
                        <strong>Quote:</strong> "{tech.source_excerpt}"
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'writing' && (
          <div className="kb-item single">
            <div className="item-header">
              <strong>Writing Style</strong>
              <span className="confidence">
                {Math.round(knowledgeBase.writing_style.confidence * 100)}%
              </span>
            </div>
            <div className="item-details">
              <p>
                <strong>Tone:</strong> {knowledgeBase.writing_style.tone}
              </p>
              {knowledgeBase.writing_style.voice_markers.length > 0 && (
                <p>
                  <strong>Voice Markers:</strong>{' '}
                  {knowledgeBase.writing_style.voice_markers.join(', ')}
                </p>
              )}
              {knowledgeBase.writing_style.examples.length > 0 && (
                <p>
                  <strong>Examples:</strong>{' '}
                  {knowledgeBase.writing_style.examples.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'values' && (
          <div className="kb-list">
            {knowledgeBase.values.length === 0 ? (
              <p className="empty-message">No values extracted yet</p>
            ) : (
              knowledgeBase.values.map((value) => (
                <div
                  key={value.value}
                  className="kb-item"
                  onClick={() => toggleExpand(value.value)}
                >
                  <div className="item-header">
                    <strong>{value.value}</strong>
                    <span className="confidence">
                      {Math.round(value.confidence * 100)}%
                    </span>
                  </div>
                  {expandedItem === value.value && (
                    <div className="item-details">
                      <p>
                        <strong>Source:</strong> {value.source_document_id}
                      </p>
                      <p>
                        <strong>Quote:</strong> "{value.source_excerpt}"
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        .kb-browser {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary);
          border-right: 1px solid var(--border-color);
        }

        .kb-browser.empty {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }

        .kb-browser.loading {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
        }

        .kb-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .kb-header h2 {
          margin: 0 0 8px 0;
          font-size: 18px;
        }

        .kb-stats {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .kb-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
          overflow-x: auto;
        }

        .tab {
          padding: 12px 16px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 13px;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .tab:hover {
          color: var(--text-primary);
        }

        .tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        .kb-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .kb-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .kb-item {
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .kb-item:hover {
          border-color: var(--accent);
          background: var(--accent-bg);
        }

        .kb-item.single {
          cursor: default;
        }

        .item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .item-header strong {
          flex: 1;
        }

        .category,
        .proficiency {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 3px;
          background: var(--tag-bg);
          color: var(--tag-text);
        }

        .confidence {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .item-details {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color);
          font-size: 12px;
          color: var(--text-secondary);
        }

        .item-details p {
          margin: 4px 0;
        }

        .empty-message {
          text-align: center;
          color: var(--text-secondary);
          padding: 32px 16px;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border-color);
          border-top: 2px solid var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
