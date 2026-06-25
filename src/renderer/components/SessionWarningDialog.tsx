import React, { useState } from 'react';
import styles from './SessionWarningDialog.module.css';

interface ExtractedInfo {
  company: string | null;
  role: string | null;
  confidence: number;
}

interface Props {
  isOpen: boolean;
  extracted: ExtractedInfo;
  onConfirm: (data: { company: string; role: string }) => void;
  onCancel: () => void;
}

export default function SessionWarningDialog({ isOpen, extracted, onConfirm, onCancel }: Props) {
  const [company, setCompany] = useState(extracted.company || '');
  const [role, setRole] = useState(extracted.role || '');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (company.trim() && role.trim()) {
      onConfirm({ company: company.trim(), role: role.trim() });
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2>Complete Session Details</h2>
        <p>Company and job title could not be extracted from the job description. Please enter them manually:</p>

        <input
          type="text"
          placeholder="Company name (e.g., Acme Corporation)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={styles.input}
        />

        <input
          type="text"
          placeholder="Job title (e.g., Senior Software Engineer)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={styles.input}
        />

        <div className={styles.buttons}>
          <button onClick={onCancel} className={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!company.trim() || !role.trim()}
            className={styles.confirmBtn}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
