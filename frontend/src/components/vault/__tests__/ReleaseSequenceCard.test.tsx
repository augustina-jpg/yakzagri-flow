import React from 'react';
import { render, screen } from '@testing-library/react';
import { ReleaseSequenceCard } from '../ReleaseSequenceCard';

// Mock the BentoCard component
jest.mock('@/components/ui/BentoCard', () => ({
    BentoCard: ({ children, title, icon, glowVariant, className }: { children: React.ReactNode, title?: string, icon?: React.ReactNode, glowVariant?: string, className?: string }) => (
        <div data-testid="bento-card" data-title={title} data-glow={glowVariant} className={className}>
            {title && <h3>{title}</h3>}
            {icon}
            {children}
        </div>
    ),
}));

// Mock the SettingsIcon component
jest.mock('@/components/icons', () => ({
    SettingsIcon: ({ className }: { className?: string }) => (
        <svg data-testid="settings-icon" className={className} />
    ),
}));

describe('ReleaseSequenceCard Component', () => {
    const defaultProps = {
        sequenceId: '882-AF',
        steps: [
            { label: 'Agreement', date: 'Oct 12, 2023', status: 'completed' as const },
            { label: 'Audit Phase', date: 'Processing...', status: 'in-progress' as const },
            { label: 'Final Release', date: 'Est. Nov 04', status: 'pending' as const },
        ],
    };

    it('renders without crashing with all props', () => {
        const { container } = render(<ReleaseSequenceCard {...defaultProps} />);
        expect(container.firstChild).toBeInTheDocument();
    });

    it('displays the release sequence title', () => {
        render(<ReleaseSequenceCard {...defaultProps} />);
        expect(screen.getByText('Release Sequence')).toBeInTheDocument();
    });

    it('displays the sequence ID', () => {
        render(<ReleaseSequenceCard {...defaultProps} />);
        expect(screen.getByText('SEQUENCE_ID: 882-AF')).toBeInTheDocument();
    });

    it('renders all 3 steps', () => {
        render(<ReleaseSequenceCard {...defaultProps} />);
        expect(screen.getByText('Agreement')).toBeInTheDocument();
        expect(screen.getByText('Audit Phase')).toBeInTheDocument();
        expect(screen.getByText('Final Release')).toBeInTheDocument();
    });

    it('displays step dates correctly', () => {
        render(<ReleaseSequenceCard {...defaultProps} />);
        expect(screen.getByText('Oct 12, 2023')).toBeInTheDocument();
        expect(screen.getByText('Processing...')).toBeInTheDocument();
        expect(screen.getByText('Est. Nov 04')).toBeInTheDocument();
    });

    it('renders completed step with correct icon', () => {
        render(<ReleaseSequenceCard {...defaultProps} />);
        const completedStep = screen.getByText('Agreement').closest('.flex.flex-col');
        const svgIcon = completedStep?.querySelector('svg');
        expect(svgIcon).toBeInTheDocument();
    });

    it('renders in-progress step with correct icon', () => {
        render(<ReleaseSequenceCard {...defaultProps} />);
        const inProgressStep = screen.getByText('Audit Phase').closest('.flex.flex-col');
        const svgIcon = inProgressStep?.querySelector('svg');
        expect(svgIcon).toBeInTheDocument();
    });

    it('renders pending step with correct icon', () => {
        render(<ReleaseSequenceCard {...defaultProps} />);
        const pendingStep = screen.getByText('Final Release').closest('.flex.flex-col');
        const svgIcon = pendingStep?.querySelector('svg');
        expect(svgIcon).toBeInTheDocument();
    });

    it('applies correct styling for completed step', () => {
        const { container } = render(<ReleaseSequenceCard {...defaultProps} />);
        const completedStepCircle = container.querySelector('.bg-emerald-muted');
        expect(completedStepCircle).toBeInTheDocument();
    });

    it('applies correct styling for in-progress step', () => {
        const { container } = render(<ReleaseSequenceCard {...defaultProps} />);
        const inProgressStepCircle = container.querySelector('.bg-gold-muted');
        expect(inProgressStepCircle).toBeInTheDocument();
    });

    it('applies correct styling for pending step', () => {
        const { container } = render(<ReleaseSequenceCard {...defaultProps} />);
        const pendingStepCircle = container.querySelector('.bg-bg-elevated');
        expect(pendingStepCircle).toBeInTheDocument();
    });

    it('applies pulse animation to in-progress step', () => {
        const { container } = render(<ReleaseSequenceCard {...defaultProps} />);
        const inProgressStepCircle = container.querySelector('.animate-pulse');
        expect(inProgressStepCircle).toBeInTheDocument();
    });

    it('renders connectors between steps', () => {
        const { container } = render(<ReleaseSequenceCard {...defaultProps} />);
        const connectors = container.querySelectorAll('.bg-border-default');
        expect(connectors.length).toBe(2); // 2 connectors for 3 steps
    });

    it('handles empty steps array', () => {
        render(<ReleaseSequenceCard {...defaultProps} steps={[]} />);
        expect(screen.getByText('Release Sequence')).toBeInTheDocument();
    });

    it('handles single step', () => {
        const singleStep = [
            { label: 'Only Step', date: 'Jan 01, 2024', status: 'completed' as const },
        ];
        render(<ReleaseSequenceCard {...defaultProps} steps={singleStep} />);
        expect(screen.getByText('Only Step')).toBeInTheDocument();
    });

    it('handles different sequence IDs', () => {
        render(<ReleaseSequenceCard {...defaultProps} sequenceId="123-XY" />);
        expect(screen.getByText('SEQUENCE_ID: 123-XY')).toBeInTheDocument();
    });

    it('applies gold glow variant', () => {
        const { container } = render(<ReleaseSequenceCard {...defaultProps} />);
        const card = container.querySelector('[data-testid="bento-card"]');
        expect(card).toHaveAttribute('data-glow', 'gold');
    });

    it('applies correct styling classes to the card', () => {
        const { container } = render(<ReleaseSequenceCard {...defaultProps} />);
        const card = container.querySelector('[data-testid="bento-card"]');
        expect(card).toHaveClass('h-full');
    });

    it('renders settings icon', () => {
        const { container } = render(<ReleaseSequenceCard {...defaultProps} />);
        const settingsIcon = container.querySelector('[data-testid="settings-icon"]');
        expect(settingsIcon).toBeInTheDocument();
    });

    describe('prerequisite status indicators', () => {
        const stepsWithConditions = [
            {
                label: 'Agreement',
                date: 'Oct 12, 2023',
                status: 'completed' as const,
                completedAt: 'Oct 12, 2023 14:32',
                actorRole: 'Seller',
            },
            {
                label: 'Audit Phase',
                date: 'Processing...',
                status: 'in-progress' as const,
                condition: 'Awaiting driver manifest',
            },
            {
                label: 'Final Release',
                date: 'Est. Nov 04',
                status: 'blocked' as const,
                condition: 'Awaiting buyer PoD video',
            },
        ];

        it('displays the specific unmet condition for a blocked stage', () => {
            render(<ReleaseSequenceCard {...defaultProps} steps={stepsWithConditions} />);
            expect(screen.getByText('Awaiting buyer PoD video')).toBeInTheDocument();
        });

        it('displays the unmet condition for an in-progress stage', () => {
            render(<ReleaseSequenceCard {...defaultProps} steps={stepsWithConditions} />);
            expect(screen.getByText('Awaiting driver manifest')).toBeInTheDocument();
        });

        it('exposes the blocked condition via a tooltip title', () => {
            render(<ReleaseSequenceCard {...defaultProps} steps={stepsWithConditions} />);
            const blockedCondition = screen.getByText('Awaiting buyer PoD video');
            const tooltipHost = blockedCondition.closest('[title]');
            expect(tooltipHost).toHaveAttribute('title', 'Awaiting buyer PoD video');
        });

        it('displays the completion timestamp for a completed stage', () => {
            render(<ReleaseSequenceCard {...defaultProps} steps={stepsWithConditions} />);
            expect(screen.getByText('Oct 12, 2023 14:32')).toBeInTheDocument();
        });

        it('displays the actor role for a completed stage', () => {
            render(<ReleaseSequenceCard {...defaultProps} steps={stepsWithConditions} />);
            expect(screen.getByText('Seller')).toBeInTheDocument();
        });

        it('marks blocked stages with a blocked status indicator', () => {
            const { container } = render(
                <ReleaseSequenceCard {...defaultProps} steps={stepsWithConditions} />
            );
            const blockedStep = screen.getByText('Final Release').closest('.flex.flex-col');
            expect(blockedStep).toBeInTheDocument();
            expect(blockedStep?.querySelector('[data-status="blocked"]')).toBeInTheDocument();
            expect(container.querySelector('.bg-red-muted')).toBeInTheDocument();
        });

        it('marks completed stages with a completed status indicator', () => {
            render(<ReleaseSequenceCard {...defaultProps} steps={stepsWithConditions} />);
            const completedStep = screen.getByText('Agreement').closest('.flex.flex-col');
            expect(completedStep?.querySelector('[data-status="completed"]')).toBeInTheDocument();
        });

        it('does not render a condition for stages without one', () => {
            const steps = [
                { label: 'Agreement', date: 'Oct 12, 2023', status: 'completed' as const },
            ];
            render(<ReleaseSequenceCard {...defaultProps} steps={steps} />);
            expect(screen.queryByText('Awaiting buyer PoD video')).not.toBeInTheDocument();
        });
    });
});
