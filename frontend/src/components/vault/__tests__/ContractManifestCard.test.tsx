import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContractManifestCard } from '../ContractManifestCard';

// Mock the BentoCard component
jest.mock('@/components/ui/BentoCard', () => ({
    BentoCard: ({ children, title, glowVariant, className }: { children: React.ReactNode, title?: string, icon?: React.ReactNode, glowVariant?: string, className?: string }) => (
        <div data-testid="bento-card" data-title={title} data-glow={glowVariant} className={className}>
            {title && <h3>{title}</h3>}
            {children}
        </div>
    ),
}));

// Mock next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
        /* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */
        <img {...props} />
    ),
}));

describe('ContractManifestCard Component', () => {
    const sorobanContractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
    const wasmHash = 'a3f1c9d2e4b5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f';

    const defaultProps = {
        contractId: 'AMN-772-VLT-09',
        agreementDate: 'September 24, 2023',
        settlementType: 'Immediate / Fiat-Backed',
        originParty: {
            initials: 'GB',
            name: 'Global Biotech Inc.',
            color: 'teal' as const,
        },
        recipientParty: {
            initials: 'NS',
            name: 'Nova Solutions Ltd.',
            color: 'emerald' as const,
        },
        onExportPdf: jest.fn(),
        onViewClauses: jest.fn(),
    };

    const sorobanProps = {
        ...defaultProps,
        sorobanContractId,
        network: 'testnet' as const,
        wasmHash,
        wasmHashVerified: true,
    };

    const originalClipboard = navigator.clipboard;

    beforeEach(() => {
        jest.clearAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: jest.fn().mockResolvedValue(undefined),
            },
        });
    });

    afterEach(() => {
        Object.assign(navigator, { clipboard: originalClipboard });
    });

    it('renders without crashing with all props', () => {
        const { container } = render(<ContractManifestCard {...defaultProps} />);
        expect(container.firstChild).toBeInTheDocument();
    });

    it('displays the contract manifest title', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('Contract Manifest')).toBeInTheDocument();
    });

    it('displays the contract ID', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('AMN-772-VLT-09')).toBeInTheDocument();
    });

    it('displays the agreement date label', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('Agreement Date')).toBeInTheDocument();
    });

    it('displays the agreement date value', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('September 24, 2023')).toBeInTheDocument();
    });

    it('displays the settlement type label', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('Settlement Type')).toBeInTheDocument();
    });

    it('displays the settlement type value', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('Immediate / Fiat-Backed')).toBeInTheDocument();
    });

    it('displays the origin party label', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('Origin Party')).toBeInTheDocument();
    });

    it('displays the origin party initials', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('GB')).toBeInTheDocument();
    });

    it('displays the origin party name', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('Global Biotech Inc.')).toBeInTheDocument();
    });

    it('displays the recipient party label', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('Recipient Party')).toBeInTheDocument();
    });

    it('displays the recipient party initials', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('NS')).toBeInTheDocument();
    });

    it('displays the recipient party name', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('Nova Solutions Ltd.')).toBeInTheDocument();
    });

    it('displays the Export PDF button', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('Export PDF')).toBeInTheDocument();
    });

    it('displays the View Clauses button', () => {
        render(<ContractManifestCard {...defaultProps} />);
        expect(screen.getByText('View Clauses')).toBeInTheDocument();
    });

    it('calls onExportPdf when Export PDF button is clicked', () => {
        const onExportPdf = jest.fn();
        render(<ContractManifestCard {...defaultProps} onExportPdf={onExportPdf} />);

        const button = screen.getByText('Export PDF');
        fireEvent.click(button);

        expect(onExportPdf).toHaveBeenCalledTimes(1);
    });

    it('calls onViewClauses when View Clauses button is clicked', () => {
        const onViewClauses = jest.fn();
        render(<ContractManifestCard {...defaultProps} onViewClauses={onViewClauses} />);

        const button = screen.getByText('View Clauses');
        fireEvent.click(button);

        expect(onViewClauses).toHaveBeenCalledTimes(1);
    });

    it('applies teal background color for origin party', () => {
        const { container } = render(<ContractManifestCard {...defaultProps} />);
        const tealBadge = container.querySelector('.bg-teal');
        expect(tealBadge).toBeInTheDocument();
    });

    it('applies emerald background color for recipient party', () => {
        const { container } = render(<ContractManifestCard {...defaultProps} />);
        const emeraldBadge = container.querySelector('.bg-emerald');
        expect(emeraldBadge).toBeInTheDocument();
    });

    it('renders the file text icon', () => {
        const { container } = render(<ContractManifestCard {...defaultProps} />);
        const svgIcon = container.querySelector('svg');
        expect(svgIcon).toBeInTheDocument();
    });

    it('renders the eye icon in View Clauses button', () => {
        render(<ContractManifestCard {...defaultProps} />);
        const viewClausesButton = screen.getByText('View Clauses').closest('button');
        const svgIcon = viewClausesButton?.querySelector('svg');
        expect(svgIcon).toBeInTheDocument();
    });

    it('renders the export icon in Export PDF button', () => {
        render(<ContractManifestCard {...defaultProps} />);
        const exportButton = screen.getByText('Export PDF').closest('button');
        const imgIcon = exportButton?.querySelector('img');
        expect(imgIcon).toBeInTheDocument();
    });

    it('handles different contract IDs', () => {
        render(<ContractManifestCard {...defaultProps} contractId="XYZ-123" />);
        expect(screen.getByText('XYZ-123')).toBeInTheDocument();
    });

    it('handles different agreement dates', () => {
        render(<ContractManifestCard {...defaultProps} agreementDate="January 1, 2024" />);
        expect(screen.getByText('January 1, 2024')).toBeInTheDocument();
    });

    it('handles different settlement types', () => {
        render(<ContractManifestCard {...defaultProps} settlementType="Delayed / Crypto-Backed" />);
        expect(screen.getByText('Delayed / Crypto-Backed')).toBeInTheDocument();
    });

    it('applies gold glow variant', () => {
        const { container } = render(<ContractManifestCard {...defaultProps} />);
        const card = container.querySelector('[data-testid="bento-card"]');
        expect(card).toHaveAttribute('data-glow', 'gold');
    });

    it('applies correct styling classes to the card', () => {
        const { container } = render(<ContractManifestCard {...defaultProps} />);
        const card = container.querySelector('[data-testid="bento-card"]');
        expect(card).toHaveClass('h-104');
    });

    describe('Soroban contract ID verification', () => {
        it('displays the full Soroban contract ID', () => {
            render(<ContractManifestCard {...sorobanProps} />);
            expect(screen.getByText(sorobanContractId)).toBeInTheDocument();
        });

        it('renders a copy button with an accessible label', () => {
            render(<ContractManifestCard {...sorobanProps} />);
            expect(
                screen.getByRole('button', { name: /copy soroban contract id/i })
            ).toBeInTheDocument();
        });

        it('copies the contract ID to the clipboard when the copy button is clicked', () => {
            render(<ContractManifestCard {...sorobanProps} />);
            fireEvent.click(screen.getByRole('button', { name: /copy soroban contract id/i }));
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(sorobanContractId);
        });

        it('shows a copied confirmation after clicking the copy button', async () => {
            render(<ContractManifestCard {...sorobanProps} />);
            fireEvent.click(screen.getByRole('button', { name: /copy soroban contract id/i }));
            expect(await screen.findByText(/copied/i)).toBeInTheDocument();
        });

        it('announces the copy result to screen readers via a live region', async () => {
            render(<ContractManifestCard {...sorobanProps} />);
            fireEvent.click(screen.getByRole('button', { name: /copy soroban contract id/i }));
            const status = await screen.findByRole('status');
            expect(status).toHaveTextContent(/copied/i);
        });

        it('renders an explorer link for the contract ID', () => {
            render(<ContractManifestCard {...sorobanProps} />);
            const link = screen.getByRole('link', { name: /view .* on stellar explorer/i });
            expect(link).toHaveAttribute('href', expect.stringContaining(sorobanContractId));
            expect(link).toHaveAttribute('target', '_blank');
        });

        it('displays the Testnet network badge', () => {
            render(<ContractManifestCard {...sorobanProps} />);
            expect(screen.getByText(/testnet/i)).toBeInTheDocument();
        });

        it('displays the Mainnet network badge when network is public', () => {
            render(<ContractManifestCard {...sorobanProps} network="public" />);
            expect(screen.getByText(/mainnet/i)).toBeInTheDocument();
        });

        it('shows verified status when the WASM hash is verified', () => {
            render(<ContractManifestCard {...sorobanProps} />);
            expect(screen.getByText(/wasm hash verified/i)).toBeInTheDocument();
        });

        it('shows unverified status when the WASM hash is not verified', () => {
            render(<ContractManifestCard {...sorobanProps} wasmHashVerified={false} />);
            expect(screen.getByText(/wasm hash unverified/i)).toBeInTheDocument();
        });

        it('displays the WASM hash value', () => {
            render(<ContractManifestCard {...sorobanProps} />);
            expect(screen.getByText(wasmHash)).toBeInTheDocument();
        });
    });
});
