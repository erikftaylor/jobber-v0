import React, { useState } from 'react';
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

  return (
    <div className={styles.container}>
      <button className={styles.button} onClick={() => setIsOpen(!isOpen)}>
        <span>{activeSession ? activeSession.company : 'Select Session'}</span>
        <span className={styles.arrow}>▼</span>
      </button>

      {isOpen && (
        <div className={styles.menu}>
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`${styles.item} ${session.id === activeSessionId ? styles.active : ''}`}
              onClick={() => handleSelectSession(session.id)}
            >
              <div className={styles.itemTitle}>
                {session.title} at {session.company}
              </div>
              <div className={styles.itemDate}>
                {new Date(session.added_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
