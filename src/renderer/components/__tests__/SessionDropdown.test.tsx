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

    const dropdownButton = screen.getByRole('button', { name: /Current session: Acme Corp/i });
    fireEvent.click(dropdownButton);

    const techcorpItem = screen.getByRole('menuitem', { name: /Manager at TechCorp/i });
    fireEvent.click(techcorpItem);

    expect(mockOnSelect).toHaveBeenCalledWith('2');
  });

  it('should close dropdown when Escape key is pressed', () => {
    const sessions = [
      { id: '1', company: 'Acme Corp', title: 'Senior Engineer', added_at: new Date() }
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

    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should render empty state when no sessions available', () => {
    render(
      <SessionDropdown
        sessions={[]}
        activeSessionId=""
        onSelectSession={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /No sessions available/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/No sessions/i)).toBeInTheDocument();
  });

  it('should have proper ARIA attributes for accessibility', () => {
    const sessions = [
      { id: '1', company: 'Acme Corp', title: 'Senior Engineer', added_at: new Date() }
    ];

    const { rerender } = render(
      <SessionDropdown
        sessions={sessions}
        activeSessionId="1"
        onSelectSession={vi.fn()}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);

    rerender(
      <SessionDropdown
        sessions={sessions}
        activeSessionId="1"
        onSelectSession={vi.fn()}
      />
    );

    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
