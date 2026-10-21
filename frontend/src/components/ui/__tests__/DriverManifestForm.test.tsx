import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriverManifestForm, normalizeNigerianPhone, validatePlate } from '../DriverManifestForm';

// Mock the FormField component
jest.mock('../FormField', () => ({
    FormField: ({ label, name, hint, error, children }: { label: string, name: string, required?: boolean, hint?: string, error?: string, children: React.ReactNode }) => (
        <div data-testid={`form-field-${name}`}>
            <label>{label}</label>
            {children}
            {hint && <span data-testid={`hint-${name}`}>{hint}</span>}
            {error && <span data-testid={`error-${name}`}>{error}</span>}
        </div>
    ),
}));

// Mock the Icon component
jest.mock('../Icon', () => ({
    Icon: ({ name, size, className, ...props }: { name: string, size?: string, className?: string, [key: string]: unknown }) => (
        <svg data-testid={`icon-${name}`} data-size={size} className={className} {...props} />
    ),
}));

// Mock Radix Dialog
jest.mock('@radix-ui/react-dialog', () => ({
    Root: ({ children, open }: { children: React.ReactNode; open: boolean; onOpenChange?: (open: boolean) => void }) => (
        <div data-testid="dialog-root" data-open={open}>
            {children}
        </div>
    ),
    Portal: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-portal">{children}</div>,
    Overlay: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div data-testid="dialog-overlay" className={className}>
            {children}
        </div>
    ),
    Content: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div data-testid="dialog-content" className={className}>
            {children}
        </div>
    ),
    Title: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <h2 data-testid="dialog-title" className={className}>
            {children}
        </h2>
    ),
    Description: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <p data-testid="dialog-description" className={className}>
            {children}
        </p>
    ),
    Close: ({ children, onClick, className, ...props }: { children: React.ReactNode; onClick?: () => void; className?: string; [key: string]: unknown }) => (
        <button data-testid="dialog-close" onClick={onClick} className={className} {...props}>
            {children}
        </button>
    ),
}));

describe('DriverManifestForm Component', () => {
    const defaultProps = {
        isOpen: true,
        onComplete: jest.fn(),
        onDismiss: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders without crashing when isOpen is true', () => {
        const { container } = render(<DriverManifestForm {...defaultProps} />);
        expect(container.firstChild).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
        const { container } = render(<DriverManifestForm {...defaultProps} isOpen={false} />);
        const dialogRoot = container.querySelector('[data-testid="dialog-root"]');
        expect(dialogRoot).toHaveAttribute('data-open', 'false');
    });

    it('displays the dialog title', () => {
        render(<DriverManifestForm {...defaultProps} />);
        expect(screen.getByText('Driver Manifest')).toBeInTheDocument();
    });

    it('displays the dialog description', () => {
        render(<DriverManifestForm {...defaultProps} />);
        expect(screen.getByText('Enter driver and vehicle data for the Ship-First transit phase.')).toBeInTheDocument();
    });

    it('renders driver name field', () => {
        render(<DriverManifestForm {...defaultProps} />);
        expect(screen.getByText('Driver Name')).toBeInTheDocument();
    });

    it('renders driver phone field', () => {
        render(<DriverManifestForm {...defaultProps} />);
        expect(screen.getByText('Driver Phone')).toBeInTheDocument();
    });

    it('renders license plate field', () => {
        render(<DriverManifestForm {...defaultProps} />);
        expect(screen.getByText('License Plate')).toBeInTheDocument();
    });

    it('displays hint for driver phone field', () => {
        render(<DriverManifestForm {...defaultProps} />);
        expect(screen.getByText('Include country code for best routing')).toBeInTheDocument();
    });

    it('renders cancel button', () => {
        render(<DriverManifestForm {...defaultProps} />);
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders submit button', () => {
        render(<DriverManifestForm {...defaultProps} />);
        expect(screen.getByText('Submit Manifest')).toBeInTheDocument();
    });

    it('disables submit button when form is empty', () => {
        render(<DriverManifestForm {...defaultProps} />);
        const submitButton = screen.getByText('Submit Manifest');
        expect(submitButton).toBeDisabled();
    });

    it('enables submit button when all fields are filled', () => {
        render(<DriverManifestForm {...defaultProps} />);

        const driverNameInput = screen.getByPlaceholderText('e.g. Amina Khalid');
        const driverPhoneInput = screen.getByPlaceholderText('e.g. +234 803 000 0000');
        const licensePlateInput = screen.getByPlaceholderText('e.g. GEG 1123 H');

        fireEvent.change(driverNameInput, { target: { value: 'John Doe' } });
        fireEvent.change(driverPhoneInput, { target: { value: '+2348030000000' } });
        fireEvent.change(licensePlateInput, { target: { value: 'ABC 123' } });

        const submitButton = screen.getByText('Submit Manifest');
        expect(submitButton).not.toBeDisabled();
    });

    it('calls onComplete with form data when submit is clicked', () => {
        const onComplete = jest.fn();
        const { container } = render(<DriverManifestForm {...defaultProps} onComplete={onComplete} />);

        const driverNameInput = screen.getByPlaceholderText('e.g. Amina Khalid');
        const driverPhoneInput = screen.getByPlaceholderText('e.g. +234 803 000 0000');
        const licensePlateInput = screen.getByPlaceholderText('e.g. GEG 1123 H');

        fireEvent.change(driverNameInput, { target: { value: 'John Doe' } });
        fireEvent.change(driverPhoneInput, { target: { value: '+2348030000000' } });
        fireEvent.change(licensePlateInput, { target: { value: 'ABC 123' } });

        const form = container.querySelector('form')!;
        fireEvent.submit(form);

        expect(onComplete).toHaveBeenCalledWith({
            driverName: 'John Doe',
            driverPhone: '+2348030000000',
            licensePlate: 'ABC 123',
        });
    });

    it('calls onDismiss when cancel button is clicked', () => {
        const onDismiss = jest.fn();
        render(<DriverManifestForm {...defaultProps} onDismiss={onDismiss} />);

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('clears form fields after successful submission', () => {
        const onComplete = jest.fn();
        const { container } = render(<DriverManifestForm {...defaultProps} onComplete={onComplete} />);

        const driverNameInput = screen.getByPlaceholderText('e.g. Amina Khalid');
        const driverPhoneInput = screen.getByPlaceholderText('e.g. +234 803 000 0000');
        const licensePlateInput = screen.getByPlaceholderText('e.g. GEG 1123 H');

        fireEvent.change(driverNameInput, { target: { value: 'John Doe' } });
        fireEvent.change(driverPhoneInput, { target: { value: '+2348030000000' } });
        fireEvent.change(licensePlateInput, { target: { value: 'ABC 123' } });

        const form = container.querySelector('form')!;
        fireEvent.submit(form);

        expect(driverNameInput).toHaveValue('');
        expect(driverPhoneInput).toHaveValue('');
        expect(licensePlateInput).toHaveValue('');
    });

    it('renders the truck icon', () => {
        const { container } = render(<DriverManifestForm {...defaultProps} />);
        const truckIcon = container.querySelector('[data-testid="icon-truck"]');
        expect(truckIcon).toBeInTheDocument();
    });

    it('applies correct styling to form inputs', () => {
        render(<DriverManifestForm {...defaultProps} />);

        const driverNameInput = screen.getByPlaceholderText('e.g. Amina Khalid');
        expect(driverNameInput).toHaveClass('w-full', 'rounded-xl', 'border', 'border-border-default');
    });

    it('applies correct styling to submit button', () => {
        render(<DriverManifestForm {...defaultProps} />);

        const submitButton = screen.getByText('Submit Manifest');
        expect(submitButton).toHaveClass('flex-1', 'px-4', 'py-2', 'rounded-lg', 'bg-gold');
    });

    it('applies correct styling to cancel button', () => {
        render(<DriverManifestForm {...defaultProps} />);

        const cancelButton = screen.getByText('Cancel');
        expect(cancelButton).toHaveClass('flex-1', 'px-4', 'py-2', 'rounded-lg', 'border', 'border-border-default');
    });

    it('handles form validation', () => {
        render(<DriverManifestForm {...defaultProps} />);

        const driverNameInput = screen.getByPlaceholderText('e.g. Amina Khalid');
        const driverPhoneInput = screen.getByPlaceholderText('e.g. +234 803 000 0000');
        const licensePlateInput = screen.getByPlaceholderText('e.g. GEG 1123 H');

        // Fill only driver name
        fireEvent.change(driverNameInput, { target: { value: 'John Doe' } });

        const submitButton = screen.getByText('Submit Manifest');
        expect(submitButton).toBeDisabled();

        // Fill driver phone
        fireEvent.change(driverPhoneInput, { target: { value: '+2348030000000' } });

        expect(submitButton).toBeDisabled();

        // Fill license plate
        fireEvent.change(licensePlateInput, { target: { value: 'ABC 123' } });

        expect(submitButton).not.toBeDisabled();
    });

    it('trims whitespace from form data', () => {
        const onComplete = jest.fn();
        const { container } = render(<DriverManifestForm {...defaultProps} onComplete={onComplete} />);

        const driverNameInput = screen.getByPlaceholderText('e.g. Amina Khalid');
        const driverPhoneInput = screen.getByPlaceholderText('e.g. +234 803 000 0000');
        const licensePlateInput = screen.getByPlaceholderText('e.g. GEG 1123 H');

        fireEvent.change(driverNameInput, { target: { value: '  John Doe  ' } });
        fireEvent.change(driverPhoneInput, { target: { value: '  +2348030000000  ' } });
        fireEvent.change(licensePlateInput, { target: { value: '  ABC 123  ' } });

        const form = container.querySelector('form')!;
        fireEvent.submit(form);

        expect(onComplete).toHaveBeenCalledWith({
            driverName: 'John Doe',
            driverPhone: '+2348030000000',
            licensePlate: 'ABC 123',
        });
    });

    it('locks body scroll when modal is open', () => {
        render(<DriverManifestForm {...defaultProps} isOpen={true} />);
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('unlocks body scroll when modal is closed', () => {
        const { rerender } = render(<DriverManifestForm {...defaultProps} isOpen={true} />);
        expect(document.body.style.overflow).toBe('hidden');

        rerender(<DriverManifestForm {...defaultProps} isOpen={false} />);
        expect(document.body.style.overflow).toBe('unset');
    });

    describe('normalizeNigerianPhone', () => {
        it.each([
            ['070', '07031234567'],
            ['080', '08031234567'],
            ['081', '08131234567'],
            ['090', '09031234567'],
            ['091', '09131234567'],
        ])('normalizes local %s prefix to E.164', (_prefix, local) => {
            expect(normalizeNigerianPhone(local)).toBe(`+234${local.slice(1)}`);
        });

        it('normalizes local numbers with spaces and dashes', () => {
            expect(normalizeNigerianPhone('0803 123 4567')).toBe('+2348031234567');
            expect(normalizeNigerianPhone('0803-123-4567')).toBe('+2348031234567');
        });

        it('passes through already-E.164 numbers', () => {
            expect(normalizeNigerianPhone('+2348031234567')).toBe('+2348031234567');
            expect(normalizeNigerianPhone('+234 803 123 4567')).toBe('+2348031234567');
        });

        it('returns null for invalid numbers', () => {
            expect(normalizeNigerianPhone('')).toBeNull();
            expect(normalizeNigerianPhone('12345')).toBeNull();
            expect(normalizeNigerianPhone('06031234567')).toBeNull();
            expect(normalizeNigerianPhone('+15551234567')).toBeNull();
        });
    });

    describe('validatePlate', () => {
        it('accepts valid plate formats', () => {
            expect(validatePlate('ABC 123')).toBeNull();
            expect(validatePlate('GEG 1123 H')).toBeNull();
            expect(validatePlate('ABC-123-XY')).toBeNull();
        });

        it('rejects empty or whitespace-only plates', () => {
            expect(validatePlate('')).not.toBeNull();
            expect(validatePlate('   ')).not.toBeNull();
        });

        it('rejects malformed plates', () => {
            expect(validatePlate('A')).not.toBeNull();
            expect(validatePlate('!!!')).not.toBeNull();
        });
    });

    describe('phone normalization and validation in the form', () => {
        it('normalizes a local phone number on submit', () => {
            const onComplete = jest.fn();
            const { container } = render(<DriverManifestForm {...defaultProps} onComplete={onComplete} />);

            fireEvent.change(screen.getByPlaceholderText('e.g. Amina Khalid'), { target: { value: 'John Doe' } });
            fireEvent.change(screen.getByPlaceholderText('e.g. +234 803 000 0000'), { target: { value: '08031234567' } });
            fireEvent.change(screen.getByPlaceholderText('e.g. GEG 1123 H'), { target: { value: 'ABC 123' } });

            fireEvent.submit(container.querySelector('form')!);

            expect(onComplete).toHaveBeenCalledWith({
                driverName: 'John Doe',
                driverPhone: '+2348031234567',
                licensePlate: 'ABC 123',
            });
        });

        it('shows an inline error for an invalid phone number and keeps submit disabled', () => {
            render(<DriverManifestForm {...defaultProps} />);

            fireEvent.change(screen.getByPlaceholderText('e.g. Amina Khalid'), { target: { value: 'John Doe' } });
            fireEvent.change(screen.getByPlaceholderText('e.g. +234 803 000 0000'), { target: { value: '12345' } });
            fireEvent.change(screen.getByPlaceholderText('e.g. GEG 1123 H'), { target: { value: 'ABC 123' } });

            expect(screen.getByTestId('error-driverPhone')).toBeInTheDocument();
            expect(screen.getByText('Submit Manifest')).toBeDisabled();
        });

        it('shows an inline error for an empty license plate', () => {
            render(<DriverManifestForm {...defaultProps} />);

            fireEvent.change(screen.getByPlaceholderText('e.g. Amina Khalid'), { target: { value: 'John Doe' } });
            fireEvent.change(screen.getByPlaceholderText('e.g. +234 803 000 0000'), { target: { value: '+2348030000000' } });
            fireEvent.change(screen.getByPlaceholderText('e.g. GEG 1123 H'), { target: { value: '   ' } });

            expect(screen.getByTestId('error-licensePlate')).toBeInTheDocument();
            expect(screen.getByText('Submit Manifest')).toBeDisabled();
        });
    });
});
