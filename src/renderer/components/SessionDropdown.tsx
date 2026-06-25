import React, { useState, useEffect } from 'react';
import styles from './SessionDropdown.module.css';

interface Session {
  id: string;
  company: string;
  title: string;
  added_at: Date;
}

interface Props {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
}

export default function SessionDropdown({ sessions, activeSessionId, onSelectSession }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const activeSession = sessions.find(s => s.id === activeSessionId);

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    setIsOpen(false);
  };

  // Handle Escape key to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle empty sessions state
  if (sessions.length === 0) {
    return (
      <div className={styles.container}>
        <button className={styles.button} disabled aria-label="No sessions available">
          No sessions
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button
        className={styles.button}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={activeSession ? `Current session: ${activeSession.company}` : 'Select session'}
      >
        <span>{activeSession ? activeSession.company : 'Select Session'}</span>
        <span className={styles.arrow}>▼</span>
      </button>

      {isOpen && (
        <div
          className={styles.menu}
          role="menu"
          aria-label="Sessions"
        >
          {sessions.map((session) => (
            <button
              key={session.id}
              role="menuitem"
              className={`${styles.item} ${session.id === activeSessionId ? styles.active : ''}`}
              onClick={() => handleSelectSession(session.id)}
              aria-selected={session.id === activeSessionId}
            >
              <div className={styles.itemTitle}>
                {session.title} at {session.company}
              </div>
              <div className={styles.itemDate}>
                {new Date(session.added_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
