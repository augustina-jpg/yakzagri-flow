import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    DriverManifestForm,
    normalizePhoneNumber,
    isValidPhoneNumber,
    isValidLicensePlate,
} from '../DriverManifestForm';

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

    describe('Nigerian phone normalization and plate validation', () => {
        it('normalizes local Nigerian numbers starting with 070, 080, 081, 090, 091 to +234 on submit', () => {
            const onComplete = jest.fn();
            const { container } = render(<DriverManifestForm {...defaultProps} onComplete={onComplete} />);

            const driverNameInput = screen.getByPlaceholderText('e.g. Amina Khalid');
            const driverPhoneInput = screen.getByPlaceholderText('e.g. +234 803 000 0000');
            const licensePlateInput = screen.getByPlaceholderText('e.g. GEG 1123 H');

            fireEvent.change(driverNameInput, { target: { value: 'Amina Khalid' } });
            fireEvent.change(driverPhoneInput, { target: { value: '08031234567' } });
            fireEvent.change(licensePlateInput, { target: { value: 'GEG 1123 H' } });

            const form = container.querySelector('form')!;
            fireEvent.submit(form);

            expect(onComplete).toHaveBeenCalledWith({
                driverName: 'Amina Khalid',
                driverPhone: '+2348031234567',
                licensePlate: 'GEG 1123 H',
            });
        });

        it('normalizes local phone numbers on blur', () => {
            render(<DriverManifestForm {...defaultProps} />);

            const driverPhoneInput = screen.getByPlaceholderText('e.g. +234 803 000 0000');
            fireEvent.change(driverPhoneInput, { target: { value: '09012345678' } });
            fireEvent.blur(driverPhoneInput);

            expect(driverPhoneInput).toHaveValue('+2349012345678');
        });

        it('displays inline field error for invalid phone number', () => {
            render(<DriverManifestForm {...defaultProps} />);

            const driverPhoneInput = screen.getByPlaceholderText('e.g. +234 803 000 0000');
            fireEvent.change(driverPhoneInput, { target: { value: '12345' } });
            fireEvent.blur(driverPhoneInput);

            const phoneError = screen.getByTestId('error-driver-phone');
            expect(phoneError).toBeInTheDocument();
            expect(phoneError).toHaveTextContent(/Please enter a valid Nigerian or E\.164 phone number/i);
        });

        it('displays inline field error when vehicle plate is empty or invalid', () => {
            render(<DriverManifestForm {...defaultProps} />);

            const licensePlateInput = screen.getByPlaceholderText('e.g. GEG 1123 H');
            fireEvent.change(licensePlateInput, { target: { value: '' } });
            fireEvent.blur(licensePlateInput);

            const plateError = screen.getByTestId('error-license-plate');
            expect(plateError).toBeInTheDocument();
            expect(plateError).toHaveTextContent(/Vehicle license plate is required/i);

            fireEvent.change(licensePlateInput, { target: { value: '!!!invalid!!!' } });
            expect(screen.getByTestId('error-license-plate')).toHaveTextContent(/Please enter a valid license plate/i);
        });

        it('normalizePhoneNumber helper handles regional prefixes correctly', () => {
            expect(normalizePhoneNumber('07012345678')).toBe('+2347012345678');
            expect(normalizePhoneNumber('08023456789')).toBe('+2348023456789');
            expect(normalizePhoneNumber('08134567890')).toBe('+2348134567890');
            expect(normalizePhoneNumber('09045678901')).toBe('+2349045678901');
            expect(normalizePhoneNumber('09156789012')).toBe('+2349156789012');
            expect(normalizePhoneNumber('+2348030000000')).toBe('+2348030000000');
        });

        it('isValidPhoneNumber validates E.164 and Nigerian numbers', () => {
            expect(isValidPhoneNumber('08031234567')).toBe(true);
            expect(isValidPhoneNumber('+2348031234567')).toBe(true);
            expect(isValidPhoneNumber('12345')).toBe(false);
            expect(isValidPhoneNumber('')).toBe(false);
        });

        it('isValidLicensePlate accepts valid formats and rejects invalid ones', () => {
            expect(isValidLicensePlate('GEG 1123 H')).toBe(true);
            expect(isValidLicensePlate('ABC 123')).toBe(true);
            expect(isValidLicensePlate('KJA-456-AA')).toBe(true);
            expect(isValidLicensePlate('')).toBe(false);
            expect(isValidLicensePlate('123')).toBe(false);
        });
    });
});
