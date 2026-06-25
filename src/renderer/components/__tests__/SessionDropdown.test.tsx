import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionDropdown from '../SessionDropdown';

describe('SessionDropdown', () => {
  it('should render current session name', () => {
    render(
      <SessionDropdown
        sessions={[
          { id: '1', company: 'Acme Corp', title: 'Senior Engineer', added_at: new Date() }
        ]}
        activeSessionId="1"
        onSelectSession={vi.fn()}
      />
    );

    expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument();
  });

  it('should show all sessions when dropdown opened', () => {
    const sessions = [
      { id: '1', company: 'Acme Corp', title: 'Senior Engineer', added_at: new Date() },
      { id: '2', company: 'TechCorp', title: 'Manager', added_at: new Date() }
    ];

    render(
      <SessionDropdown
        sessions={sessions}
        activeSessionId="1"
        onSelectSession={vi.fn()}
      />
    );

    const dropdownButton = screen.getByRole('button');
    fireEvent.click(dropdownButton);

    expect(screen.getByText(/Senior Engineer at Acme Corp/i)).toBeInTheDocument();
    expect(screen.getByText(/Manager at TechCorp/i)).toBeInTheDocument();
  });

  it('should call onSelectSession when item clicked', () => {
    const mockOnSelect = vi.fn();
    const sessions = [
      { id: '1', company: 'Acme Corp', title: 'Senior Engineer', added_at: new Date() },
      { id: '2', company: 'TechCorp', title: 'Manager', added_at: new Date() }
    ];

    render(
      <SessionDropdown
        sessions={sessions}
        activeSessionId="1"
        onSelectSession={mockOnSelect}
      />
    );

    const dropdownButton = screen.getByRole('button');
    fireEvent.click(dropdownButton);

    const techcorpItem = screen.getByText(/Manager at TechCorp/i);
    fireEvent.click(techcorpItem);

    expect(mockOnSelect).toHaveBeenCalledWith('2');
  });
});
