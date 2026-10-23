import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuditLogCard } from '../AuditLogCard';

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

describe('AuditLogCard Component', () => {
    const defaultProps = {
        entries: [
            {
                type: 'biometric' as const,
                title: 'Biometric validation passed',
                metadata: '2m ago • 192.168.1.44',
            },
            {
                type: 'multi-sig' as const,
                title: 'Multi-sig request broadcast',
                metadata: '1h ago • ID: 494022',
            },
            {
                type: 'ledger' as const,
                title: 'Ledger synchronization',
                metadata: 'Yesterday • Block 182,990',
            },
        ],
        isLiveSync: true,
    };

    it('renders without crashing with all props', () => {
        const { container } = render(<AuditLogCard {...defaultProps} />);
        expect(container.firstChild).toBeInTheDocument();
    });

    it('displays the audit log title', () => {
        render(<AuditLogCard {...defaultProps} />);
        expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });

    it('displays the Live Sync indicator when isLiveSync is true', () => {
        render(<AuditLogCard {...defaultProps} isLiveSync={true} />);
        expect(screen.getByText('Live Sync')).toBeInTheDocument();
    });

    it('does not display the Live Sync indicator when isLiveSync is false', () => {
        render(<AuditLogCard {...defaultProps} isLiveSync={false} />);
        expect(screen.queryByText('Live Sync')).not.toBeInTheDocument();
    });

    it('renders all audit log entries', () => {
        render(<AuditLogCard {...defaultProps} />);
        expect(screen.getByText('Biometric validation passed')).toBeInTheDocument();
        expect(screen.getByText('Multi-sig request broadcast')).toBeInTheDocument();
        expect(screen.getByText('Ledger synchronization')).toBeInTheDocument();
    });

    it('displays metadata for each entry', () => {
        render(<AuditLogCard {...defaultProps} />);
        expect(screen.getByText('2m ago • 192.168.1.44')).toBeInTheDocument();
        expect(screen.getByText('1h ago • ID: 494022')).toBeInTheDocument();
        expect(screen.getByText('Yesterday • Block 182,990')).toBeInTheDocument();
    });

    it('renders biometric entry with correct icon', () => {
        render(<AuditLogCard {...defaultProps} />);
        const entryRow = screen.getByText('Biometric validation passed').closest('.flex.items-start');
        const svgIcon = entryRow?.querySelector('svg');
        expect(svgIcon).toBeInTheDocument();
    });

    it('renders multi-sig entry with correct icon', () => {
        render(<AuditLogCard {...defaultProps} />);
        const entryRow = screen.getByText('Multi-sig request broadcast').closest('.flex.items-start');
        const imgIcon = entryRow?.querySelector('img');
        expect(imgIcon).toBeInTheDocument();
    });

    it('renders ledger entry with correct icon', () => {
        render(<AuditLogCard {...defaultProps} />);
        const entryRow = screen.getByText('Ledger synchronization').closest('.flex.items-start');
        const svgIcon = entryRow?.querySelector('svg');
        expect(svgIcon).toBeInTheDocument();
    });

    it('applies correct background color for biometric entry', () => {
        const { container } = render(<AuditLogCard {...defaultProps} />);
        const biometricBg = container.querySelector('.bg-emerald-muted');
        expect(biometricBg).toBeInTheDocument();
    });

    it('applies correct background color for multi-sig entry', () => {
        const { container } = render(<AuditLogCard {...defaultProps} />);
        const multiSigBg = container.querySelector('.bg-gold-muted');
        expect(multiSigBg).toBeInTheDocument();
    });

    it('applies correct background color for ledger entry', () => {
        const { container } = render(<AuditLogCard {...defaultProps} />);
        const ledgerBg = container.querySelector('.bg-bg-elevated');
        expect(ledgerBg).toBeInTheDocument();
    });

    it('renders the shield icon', () => {
        const { container } = render(<AuditLogCard {...defaultProps} />);
        const shieldIcon = container.querySelector('svg');
        expect(shieldIcon).toBeInTheDocument();
    });

    it('handles empty entries array', () => {
        render(<AuditLogCard {...defaultProps} entries={[]} />);
        expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });

    it('handles single entry', () => {
        const singleEntry = [
            {
                type: 'biometric' as const,
                title: 'Single Entry',
                metadata: 'Just now',
            },
        ];
        render(<AuditLogCard {...defaultProps} entries={singleEntry} />);
        expect(screen.getByText('Single Entry')).toBeInTheDocument();
    });

    it('applies emerald glow variant', () => {
        const { container } = render(<AuditLogCard {...defaultProps} />);
        const card = container.querySelector('[data-testid="bento-card"]');
        expect(card).toHaveAttribute('data-glow', 'emerald');
    });

    it('applies correct styling classes to the card', () => {
        const { container } = render(<AuditLogCard {...defaultProps} />);
        const card = container.querySelector('[data-testid="bento-card"]');
        expect(card).toHaveClass('h-full');
    });

    it('renders pulse animation on Live Sync indicator', () => {
        const { container } = render(<AuditLogCard {...defaultProps} isLiveSync={true} />);
        const pulseElement = container.querySelector('.animate-pulse');
        expect(pulseElement).toBeInTheDocument();
    });

    it('handles different log types', () => {
        const differentEntries = [
            {
                type: 'biometric' as const,
                title: 'Biometric Entry',
                metadata: 'Test metadata',
            },
            {
                type: 'multi-sig' as const,
                title: 'Multi-sig Entry',
                metadata: 'Test metadata',
            },
            {
                type: 'ledger' as const,
                title: 'Ledger Entry',
                metadata: 'Test metadata',
            },
        ];
        render(<AuditLogCard {...defaultProps} entries={differentEntries} />);
        expect(screen.getByText('Biometric Entry')).toBeInTheDocument();
        expect(screen.getByText('Multi-sig Entry')).toBeInTheDocument();
        expect(screen.getByText('Ledger Entry')).toBeInTheDocument();
    });

    describe('event type filtering', () => {
        const filterEntries = [
            {
                type: 'deposit' as const,
                title: 'Deposit received',
                metadata: '2m ago',
                txHash: 'abc123deposit',
            },
            {
                type: 'release' as const,
                title: 'Funds released',
                metadata: '1h ago',
                txHash: 'abc123release',
            },
            {
                type: 'dispute' as const,
                title: 'Dispute opened',
                metadata: '3h ago',
                txHash: 'abc123dispute',
            },
            {
                type: 'rebalance' as const,
                title: 'Portfolio rebalanced',
                metadata: 'Yesterday',
                txHash: 'abc123rebalance',
            },
        ];

        it('renders filter pills for each event category', () => {
            render(<AuditLogCard {...defaultProps} entries={filterEntries} />);
            expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /deposit/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /release/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /dispute/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /rebalance/i })).toBeInTheDocument();
        });

        it('shows all entries when the All filter is selected', () => {
            render(<AuditLogCard {...defaultProps} entries={filterEntries} />);
            fireEvent.click(screen.getByRole('button', { name: /all/i }));
            expect(screen.getByText('Deposit received')).toBeInTheDocument();
            expect(screen.getByText('Funds released')).toBeInTheDocument();
            expect(screen.getByText('Dispute opened')).toBeInTheDocument();
            expect(screen.getByText('Portfolio rebalanced')).toBeInTheDocument();
        });

        it('shows only deposit entries when the deposit filter is selected', () => {
            render(<AuditLogCard {...defaultProps} entries={filterEntries} />);
            fireEvent.click(screen.getByRole('button', { name: /deposit/i }));
            expect(screen.getByText('Deposit received')).toBeInTheDocument();
            expect(screen.queryByText('Funds released')).not.toBeInTheDocument();
            expect(screen.queryByText('Dispute opened')).not.toBeInTheDocument();
            expect(screen.queryByText('Portfolio rebalanced')).not.toBeInTheDocument();
        });

        it('shows only release entries when the release filter is selected', () => {
            render(<AuditLogCard {...defaultProps} entries={filterEntries} />);
            fireEvent.click(screen.getByRole('button', { name: /release/i }));
            expect(screen.getByText('Funds released')).toBeInTheDocument();
            expect(screen.queryByText('Deposit received')).not.toBeInTheDocument();
            expect(screen.queryByText('Dispute opened')).not.toBeInTheDocument();
            expect(screen.queryByText('Portfolio rebalanced')).not.toBeInTheDocument();
        });

        it('shows only dispute entries when the dispute filter is selected', () => {
            render(<AuditLogCard {...defaultProps} entries={filterEntries} />);
            fireEvent.click(screen.getByRole('button', { name: /dispute/i }));
            expect(screen.getByText('Dispute opened')).toBeInTheDocument();
            expect(screen.queryByText('Deposit received')).not.toBeInTheDocument();
            expect(screen.queryByText('Funds released')).not.toBeInTheDocument();
            expect(screen.queryByText('Portfolio rebalanced')).not.toBeInTheDocument();
        });

        it('shows only rebalance entries when the rebalance filter is selected', () => {
            render(<AuditLogCard {...defaultProps} entries={filterEntries} />);
            fireEvent.click(screen.getByRole('button', { name: /rebalance/i }));
            expect(screen.getByText('Portfolio rebalanced')).toBeInTheDocument();
            expect(screen.queryByText('Deposit received')).not.toBeInTheDocument();
            expect(screen.queryByText('Funds released')).not.toBeInTheDocument();
            expect(screen.queryByText('Dispute opened')).not.toBeInTheDocument();
        });

        it('restores all entries when switching back to the All filter', () => {
            render(<AuditLogCard {...defaultProps} entries={filterEntries} />);
            fireEvent.click(screen.getByRole('button', { name: /deposit/i }));
            expect(screen.queryByText('Funds released')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /all/i }));
            expect(screen.getByText('Deposit received')).toBeInTheDocument();
            expect(screen.getByText('Funds released')).toBeInTheDocument();
            expect(screen.getByText('Dispute opened')).toBeInTheDocument();
            expect(screen.getByText('Portfolio rebalanced')).toBeInTheDocument();
        });
    });

    describe('transaction hash actions', () => {
        const txEntries = [
            {
                type: 'deposit' as const,
                title: 'Deposit received',
                metadata: '2m ago',
                txHash: 'deadbeefcafebabe0123456789abcdef0123456789abcdef0123456789abcdef',
            },
        ];

        const originalClipboard = navigator.clipboard;

        afterEach(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: originalClipboard,
                configurable: true,
                writable: true,
            });
            jest.restoreAllMocks();
        });

        it('renders a copy button for the transaction hash', () => {
            render(<AuditLogCard {...defaultProps} entries={txEntries} />);
            expect(
                screen.getByRole('button', { name: /copy transaction hash/i })
            ).toBeInTheDocument();
        });

        it('copies the transaction hash to the clipboard when the copy button is clicked', async () => {
            const writeText = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText },
                configurable: true,
                writable: true,
            });

            render(<AuditLogCard {...defaultProps} entries={txEntries} />);
            fireEvent.click(screen.getByRole('button', { name: /copy transaction hash/i }));

            await waitFor(() => {
                expect(writeText).toHaveBeenCalledWith(txEntries[0].txHash);
            });
        });

        it('renders a Stellar Expert link for the transaction hash', () => {
            render(<AuditLogCard {...defaultProps} entries={txEntries} />);
            const link = screen.getByRole('link', { name: /view .* on stellar expert/i });
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute(
                'href',
                expect.stringContaining(txEntries[0].txHash)
            );
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
        });
    });
});
