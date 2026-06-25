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

    const companyInput = document.getElementById('company-input') as HTMLInputElement;
    const roleInput = document.getElementById('role-input') as HTMLInputElement;
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

    const companyInput = document.getElementById('company-input') as HTMLInputElement;
    expect(companyInput.value).toBe('Acme Corp');
  });

  it('should disable confirm button when inputs are empty', () => {
    const mockOnConfirm = vi.fn();
    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: null, role: null, confidence: 0 }}
        onConfirm={mockOnConfirm}
        onCancel={vi.fn()}
      />
    );

    const confirmButton = screen.getByText(/Confirm/i) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });

  it('should enable confirm button when both fields are filled', () => {
    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: null, role: null, confidence: 0 }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const companyInput = document.getElementById('company-input') as HTMLInputElement;
    const roleInput = document.getElementById('role-input') as HTMLInputElement;
    const confirmButton = screen.getByText(/Confirm/i) as HTMLButtonElement;

    fireEvent.change(companyInput, { target: { value: 'Acme' } });
    fireEvent.change(roleInput, { target: { value: 'Engineer' } });

    expect(confirmButton.disabled).toBe(false);
  });

  it('should call onCancel when cancel button is clicked', () => {
    const mockOnCancel = vi.fn();

    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: null, role: null, confidence: 0 }}
        onConfirm={vi.fn()}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText(/Cancel/i));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should trim whitespace from inputs before confirming', () => {
    const mockOnConfirm = vi.fn();

    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: null, role: null, confidence: 0 }}
        onConfirm={mockOnConfirm}
        onCancel={vi.fn()}
      />
    );

    const companyInput = document.getElementById('company-input') as HTMLInputElement;
    const roleInput = document.getElementById('role-input') as HTMLInputElement;

    fireEvent.change(companyInput, { target: { value: '  Acme  ' } });
    fireEvent.change(roleInput, { target: { value: '  Engineer  ' } });
    fireEvent.click(screen.getByText(/Confirm/i));

    expect(mockOnConfirm).toHaveBeenCalledWith({
      company: 'Acme',
      role: 'Engineer'
    });
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <SessionWarningDialog
        isOpen={false}
        extracted={{ company: null, role: null, confidence: 0 }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should pre-fill both company and role if extracted', () => {
    render(
      <SessionWarningDialog
        isOpen={true}
        extracted={{ company: 'Acme Corp', role: 'Engineer', confidence: 0.8 }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const companyInput = document.getElementById('company-input') as HTMLInputElement;
    const roleInput = document.getElementById('role-input') as HTMLInputElement;

    expect(companyInput.value).toBe('Acme Corp');
    expect(roleInput.value).toBe('Engineer');
  });
});
