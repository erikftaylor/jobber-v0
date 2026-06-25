import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionWarningDialog from '../SessionWarningDialog';

describe('SessionWarningDialog', () => {
  it('should render with empty extraction results', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: null, role: null, confidence: 0 }}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Company and job title could not be extracted/i)).toBeInTheDocument();
  });

  it('should allow user to enter company and role', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: null, role: null, confidence: 0 }}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const companyInput = screen.getByPlaceholderText(/company/i);
    const roleInput = screen.getByPlaceholderText(/job title/i);
    const confirmButton = screen.getByText(/Confirm/i);

    fireEvent.change(companyInput, { target: { value: 'Acme Corp' } });
    fireEvent.change(roleInput, { target: { value: 'Senior Engineer' } });
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledWith({
      company: 'Acme Corp',
      role: 'Senior Engineer'
    });
  });

  it('should pre-fill extracted values if available', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: 'Acme Corp', role: null, confidence: 0.8 }}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const companyInput = screen.getByPlaceholderText(/company/i) as HTMLInputElement;
    expect(companyInput.value).toBe('Acme Corp');
  });
});
