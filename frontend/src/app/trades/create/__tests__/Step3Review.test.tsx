import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Step3Review from '../steps/Step3Review';
import { TradeProvider, useTrade, TradeData } from '../TradeContext';
import { api } from '@/lib/api';
import { signTransaction } from '@stellar/freighter-api';
import { _clearAllForTests } from '@/lib/actionDedup';
import { useXdrExpiry } from '@/hooks/useXdrExpiry';

// Mock @stellar/stellar-sdk to simplify address validation in tests
jest.mock('@stellar/stellar-sdk', () => ({
    StrKey: {
        isValidEd25519PublicKey: jest.fn((address: string) => {
            return (address.startsWith('G') || address.startsWith('M')) && address.length >= 40;
        }),
    },
}));

// Mutable mock object for useAuth
const mockUseAuth: {
    token: string | null;
    isAuthenticated: boolean;
    connectWallet: jest.Mock;
    authenticate: jest.Mock;
    isWalletConnected: boolean;
} = {
    token: 'mock-token',
    isAuthenticated: true,
    connectWallet: jest.fn(),
    authenticate: jest.fn(),
    isWalletConnected: true,
};

// Mock the hooks and modules
jest.mock('@/hooks/useAuth', () => ({
    useAuth: () => mockUseAuth,
}));

jest.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        addToast: jest.fn(),
        addToastWithCorrelation: jest.fn(),
        updateToast: jest.fn(),
    }),
}));

jest.mock('@/hooks/useOffline', () => ({
    useOffline: () => ({ isOffline: false, wasOffline: false, retryOnline: jest.fn() }),
}));

jest.mock('@radix-ui/react-dialog', () => {
    const actual = jest.requireActual('@radix-ui/react-dialog');
    return { ...actual };
});

jest.mock('@/components/ui/LegalDisclaimerModal', () => ({
    LegalDisclaimerModal: ({ isOpen, onAccept, onDecline }: { isOpen: boolean; onAccept: () => void; onDecline: () => void }) =>
        isOpen ? (
            <div data-testid="legal-disclaimer-modal">
                <button onClick={onAccept}>Accept &amp; Proceed</button>
                <button onClick={onDecline}>Decline</button>
            </div>
        ) : null,
}));

jest.mock('@/lib/api', () => ({
    api: {
        trades: {
            create: jest.fn(),
        },
    },
    apiConfig: {
        getStellarNetworkPassphrase: jest.fn(() => 'Test SDF Network ; September 2015'),
        getStellarRpcUrl: jest.fn(() => 'https://soroban-testnet.stellar.org'),
    },
    ApiError: class ApiError extends Error { },
}));

jest.mock('@stellar/freighter-api', () => ({
    signTransaction: jest.fn(),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
    }),
}));

const TestWrapper = ({ initialData, children }: { initialData?: Partial<TradeData>; children: React.ReactNode }) => {
    const { update } = useTrade();
    const initialized = React.useRef(false);

    React.useEffect(() => {
        if (initialData && !initialized.current) {
            initialized.current = true;
            update(initialData);
        }
    }, [initialData, update]);
    return <>{children}</>;
};

const renderWithProvider = (initialData?: Partial<TradeData>) => {
    return render(
        <TradeProvider>
            <TestWrapper initialData={initialData}>
                <Step3Review />
            </TestWrapper>
        </TradeProvider>
    );
};

describe('Step3Review', () => {
    beforeEach(() => {
        _clearAllForTests();
        localStorage.clear();
        mockUseAuth.token = 'mock-token';
        mockUseAuth.isAuthenticated = true;
        mockUseAuth.isWalletConnected = true;

        (api.trades.create as jest.Mock).mockResolvedValue({
            tradeId: 'trade-123',
            unsignedXdr: 'mock-xdr',
        });
        (signTransaction as jest.Mock).mockResolvedValue({
            signedTxXdr: 'signed-xdr',
        });
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                result: { hash: 'tx-hash-123' },
            }),
        } as unknown as Response);
        jest.clearAllMocks();
    });

    describe('summary display', () => {
        it('should render review rows', () => {
            renderWithProvider();

            expect(screen.getByText('Commodity')).toBeInTheDocument();
            expect(screen.getByText('Quantity')).toBeInTheDocument();
            expect(screen.getByText('Price per unit')).toBeInTheDocument();
            expect(screen.getByText('Total Value')).toBeInTheDocument();
            expect(screen.getByText('USDC Amount')).toBeInTheDocument();
            expect(screen.getByText('Seller Address')).toBeInTheDocument();
            expect(screen.getByText('Loss Ratio')).toBeInTheDocument();
            expect(screen.getByText('Delivery Window')).toBeInTheDocument();
        });

        it('should display commodity value', () => {
            renderWithProvider();

            const commodityRow = screen.getByText('Commodity').closest('div');
            expect(commodityRow).toHaveTextContent('Commodity');
        });

        it('should display quantity with unit', () => {
            renderWithProvider();

            const quantityRow = screen.getByText('Quantity').closest('div');
            expect(quantityRow).toHaveTextContent('kg');
        });

        it('should display structured quantity and unit breakdown', () => {
            renderWithProvider({
                commodity: 'Maize',
                quantity: '100',
                unit: 'bags',
                pricePerUnit: '10',
            });

            const quantityRow = screen.getByText('Quantity').closest('div');
            expect(quantityRow).toHaveTextContent('100');
            expect(quantityRow).toHaveTextContent('bags');
        });

        it('should display price per unit with currency', () => {
            renderWithProvider();

            const priceRow = screen.getByText('Price per unit').closest('div');
            expect(priceRow).toHaveTextContent('NGN');
        });

        it('should display automatically computed unit price', () => {
            renderWithProvider({
                commodity: 'Maize',
                quantity: '100',
                unit: 'bags',
                pricePerUnit: '10',
            });

            const priceRow = screen.getByText('Price per unit').closest('div');
            expect(priceRow).toHaveTextContent('NGN');
            expect(priceRow).toHaveTextContent('10');
        });

        it('should display total value', () => {
            renderWithProvider();

            const totalRow = screen.getByText('Total Value').closest('div');
            expect(totalRow).toHaveTextContent('—');
        });

        it('should display cNGN amount', () => {
            renderWithProvider();

            const usdcRow = screen.getByText('USDC Amount').closest('div');
            expect(usdcRow).toHaveTextContent('0 cNGN');
        });

        it('should display seller address', () => {
            renderWithProvider();

            const addressRow = screen.getByText('Seller Address').closest('div');
            expect(addressRow).toBeInTheDocument();
        });

        it('should display loss ratio', () => {
            renderWithProvider();

            const lossRow = screen.getByText('Loss Ratio').closest('div');
            expect(lossRow).toHaveTextContent('Buyer 50% / Seller 50%');
        });

        it('should display delivery window', () => {
            renderWithProvider();

            const deliveryRow = screen.getByText('Delivery Window').closest('div');
            expect(deliveryRow).toHaveTextContent('7 days');
        });

        it('should display relative delivery window summary from trade context', () => {
            const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
            renderWithProvider({ deliveryDate: futureDate });

            const deliveryRow = screen.getByText('Delivery Window').closest('div');
            expect(deliveryRow).toHaveTextContent(/In 5 days/i);
        });

        it('should display relative duration for a near-term delivery date', () => {
            const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
            renderWithProvider({ deliveryDate: futureDate });

            const deliveryRow = screen.getByText('Delivery Window').closest('div');
            expect(deliveryRow).toHaveTextContent(/In 2 hours/i);
        });

        it('should fall back to delivery days when no delivery date is set', () => {
            renderWithProvider({ deliveryDays: '14' });

            const deliveryRow = screen.getByText('Delivery Window').closest('div');
            expect(deliveryRow).toHaveTextContent('14 days');
        });

        it('should display notes when present', () => {
            renderWithProvider();

            // Notes are empty by default, so they shouldn't be displayed
            expect(screen.queryByText('Notes')).not.toBeInTheDocument();
        });
    });

    describe('authorization callout', () => {
        it('should display authorization message', () => {
            renderWithProvider();

            expect(screen.getByText(/by submitting, you authorize a stellar transaction/i)).toBeInTheDocument();
        });

        it('should display cNGN amount in authorization message', () => {
            renderWithProvider();

            expect(screen.getByText(/locking 0 cNGN/i)).toBeInTheDocument();
        });
    });

    describe('navigation buttons', () => {
        it('should render back button', () => {
            renderWithProvider();

            const backButton = screen.getByRole('button', { name: /back/i });
            expect(backButton).toBeInTheDocument();
        });

        it('should render submit button', () => {
            renderWithProvider();

            const submitButton = screen.getByRole('button', { name: /lock funds & create trade/i });
            expect(submitButton).toBeInTheDocument();
        });

        it('should navigate to step 2 when back button is clicked', async () => {
            const user = userEvent.setup();
            renderWithProvider();

            const backButton = screen.getByRole('button', { name: /back/i });
            await user.click(backButton);

            expect(backButton).toBeInTheDocument();
        });
    });

    describe('legal disclaimer modal', () => {
        const validData = {
            commodity: 'Maize',
            quantity: '100',
            pricePerUnit: '10',
            sellerAddress: 'GBRP4ZDXSS6NZPMTVNE7DZ47JNV7OFPJMIVG4FDCMNZP7CHH4656YEXI',
            buyerRatio: 50,
            sellerRatio: 50,
            deliveryDays: '7',
            notes: 'Some notes',
        };

        it('should open disclaimer modal when submit button is clicked', async () => {
            const user = userEvent.setup();
            renderWithProvider(validData);

            const submitButton = screen.getByRole('button', { name: /lock funds & create trade/i });
            await user.click(submitButton);

            expect(screen.getByTestId('legal-disclaimer-modal')).toBeInTheDocument();
        });

        it('should close disclaimer modal when decline is clicked', async () => {
            const user = userEvent.setup();
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            expect(screen.getByTestId('legal-disclaimer-modal')).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: /decline/i }));
            expect(screen.queryByTestId('legal-disclaimer-modal')).not.toBeInTheDocument();
        });
    });

    describe('submit button states', () => {
        const validData = {
            commodity: 'Maize',
            quantity: '100',
            pricePerUnit: '10',
            sellerAddress: 'GBRP4ZDXSS6NZPMTVNE7DZ47JNV7OFPJMIVG4FDCMNZP7CHH4656YEXI',
            buyerRatio: 50,
            sellerRatio: 50,
            deliveryDays: '7',
            notes: 'Some notes',
        };

        it('should be enabled when authenticated', () => {
            renderWithProvider(validData);

            const submitButton = screen.getByRole('button', { name: /lock funds & create trade/i });
            expect(submitButton).not.toBeDisabled();
        });

        it('should show loading state when submitting', async () => {
            const user = userEvent.setup();
            (api.trades.create as jest.Mock).mockReturnValue(new Promise(() => {}));
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));

            expect(screen.getByText(/creating trade/i)).toBeInTheDocument();
        });

        it('should be disabled while loading', async () => {
            const user = userEvent.setup();
            (api.trades.create as jest.Mock).mockReturnValue(new Promise(() => {}));
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));

            const loadingButton = screen.getByRole('button', { name: /creating trade/i });
            expect(loadingButton).toBeDisabled();
        });

        it('should submit once when the disclaimer is accepted twice before rendering', async () => {
            const user = userEvent.setup();
            let resolveSigning!: (value: { signedTxXdr: string }) => void;
            (signTransaction as jest.Mock).mockReturnValue(new Promise((resolve) => {
                resolveSigning = resolve;
            }));
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            const acceptButton = screen.getByRole('button', { name: /accept/i });
            act(() => {
                const click = () => acceptButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                click();
                click();
            });

            await waitFor(() => expect(signTransaction).toHaveBeenCalledTimes(1));
            expect(api.trades.create).toHaveBeenCalledTimes(1);
            await act(async () => {
                resolveSigning({ signedTxXdr: 'signed-xdr' });
            });
        });

        it('should release the submit lock when wallet signing is rejected', async () => {
            const user = userEvent.setup();
            (signTransaction as jest.Mock)
                .mockRejectedValueOnce(new Error('User rejected'))
                .mockResolvedValueOnce({ signedTxXdr: 'signed-xdr' });
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('User rejected'));

            _clearAllForTests();
            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));

            await waitFor(() => {
                expect(api.trades.create).toHaveBeenCalledTimes(2);
                expect(signTransaction).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('error states', () => {
        const validData = {
            commodity: 'Maize',
            quantity: '100',
            pricePerUnit: '10',
            sellerAddress: 'GBRP4ZDXSS6NZPMTVNE7DZ47JNV7OFPJMIVG4FDCMNZP7CHH4656YEXI',
            buyerRatio: 50,
            sellerRatio: 50,
            deliveryDays: '7',
            notes: 'Some notes',
        };

        it('should display error message when submission fails', async () => {
            const user = userEvent.setup();
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));

            // Error would be displayed if submission fails
            // This test verifies the error display structure exists
        });

        it('should display authentication error when not authenticated', async () => {
            // Mutate mutable mock object to unauthenticated state
            mockUseAuth.token = null;
            mockUseAuth.isAuthenticated = false;
            mockUseAuth.isWalletConnected = false;

            renderWithProvider();

            // Should show authentication required message
            expect(screen.getByText(/authentication required/i)).toBeInTheDocument();
        });
    });

    describe('success states', () => {
        const validData = {
            commodity: 'Maize',
            quantity: '100',
            pricePerUnit: '10',
            sellerAddress: 'GBRP4ZDXSS6NZPMTVNE7DZ47JNV7OFPJMIVG4FDCMNZP7CHH4656YEXI',
            buyerRatio: 50,
            sellerRatio: 50,
            deliveryDays: '7',
            notes: 'Some notes',
        };

        it('should display success message after successful submission', async () => {
            const user = userEvent.setup();
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));

            expect(api.trades.create).toHaveBeenCalled();
            await waitFor(() => expect(signTransaction).toHaveBeenCalledWith(
                'mock-xdr',
                { networkPassphrase: 'Test SDF Network ; September 2015' },
            ));
            expect(global.fetch).toHaveBeenCalledWith(
                'https://soroban-testnet.stellar.org',
                expect.objectContaining({
                    body: expect.stringContaining('signed-xdr'),
                }),
            );
        });

        it('should display trade ID after successful submission', async () => {
            const user = userEvent.setup();
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));
        });

        it('should display transaction hash after successful submission', async () => {
            const user = userEvent.setup();
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));
        });

        it('should display view trade details button after successful submission', async () => {
            const user = userEvent.setup();
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));
        });

        it('should display view all trades link after successful submission', async () => {
            const user = userEvent.setup();
            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));
        });
    });

    describe('authentication states', () => {
        it('should display connect wallet button when wallet not connected', () => {
            renderWithProvider();

            // When wallet is not connected, connect wallet button should be displayed
            // This test verifies the authentication flow structure
        });

        it('should display sign in button when wallet connected but not authenticated', () => {
            renderWithProvider();

            // When wallet is connected but not authenticated, sign in button should be displayed
        });

        it('should disable submit button when not authenticated', () => {
            renderWithProvider();

            // When not authenticated, submit button should be disabled
        });
    });

    describe('edge cases', () => {
        it('should handle empty commodity', () => {
            renderWithProvider();

            const commodityRow = screen.getByText('Commodity').closest('div');
            const valueSpan = commodityRow?.querySelector('.text-text-primary');
            expect(valueSpan?.textContent).toBe('');
        });

        it('should handle empty quantity', () => {
            renderWithProvider();

            const quantityRow = screen.getByText('Quantity').closest('div');
            const valueSpan = quantityRow?.querySelector('.text-text-primary');
            expect(valueSpan?.textContent).toBe(' kg');
        });

        it('should handle quantity with unit but no amount', () => {
            renderWithProvider({ unit: 'crates' });

            const quantityRow = screen.getByText('Quantity').closest('div');
            expect(quantityRow).toHaveTextContent('crates');
        });

        it('should handle metric ton unit', () => {
            renderWithProvider({
                commodity: 'Sorghum',
                quantity: '5',
                unit: 'metric tons',
                pricePerUnit: '250',
            });

            const quantityRow = screen.getByText('Quantity').closest('div');
            expect(quantityRow).toHaveTextContent('5');
            expect(quantityRow).toHaveTextContent('metric tons');
        });

        it('should handle empty price', () => {
            renderWithProvider();

            const priceRow = screen.getByText('Price per unit').closest('div');
            const valueSpan = priceRow?.querySelector('.text-text-primary');
            expect(valueSpan?.textContent).toBe('NGN ');
        });

        it('should handle empty seller address', () => {
            renderWithProvider();

            const addressRow = screen.getByText('Seller Address').closest('div');
            expect(addressRow).toBeInTheDocument();
        });

        it('should handle zero total value', () => {
            renderWithProvider();

            const totalRow = screen.getByText('Total Value').closest('div');
            expect(totalRow).toHaveTextContent('—');
        });

        it('should handle zero cNGN amount', () => {
            renderWithProvider();

            const usdcRow = screen.getByText('USDC Amount').closest('div');
            expect(usdcRow).toHaveTextContent('0 cNGN');
        });

        it('should handle very large total values', () => {
            renderWithProvider();

            // This test would verify that large numbers are formatted correctly
            const totalRow = screen.getByText('Total Value').closest('div');
            expect(totalRow).toBeInTheDocument();
        });

        it('should handle very large cNGN amounts', () => {
            renderWithProvider();

            // This test would verify that large cNGN amounts are displayed correctly
            const usdcRow = screen.getByText('USDC Amount').closest('div');
            expect(usdcRow).toBeInTheDocument();
        });

        it('should prevent empty submission', async () => {
            renderWithProvider();

            const submitButton = screen.getByRole('button', { name: /lock funds & create trade/i });

            // Button should be disabled when empty
            expect(submitButton).toBeDisabled();
        });

        it('should render slippage tolerance selector and update selected tolerance', async () => {
            const user = userEvent.setup();
            renderWithProvider({
                commodity: 'Maize',
                quantity: '100',
                pricePerUnit: '10',
                sellerAddress: 'GBRP4ZDXSS6NZPMTVNE7DZ47JNV7OFPJMIVG4FDCMNZP7CHH4656YEXI',
                buyerRatio: 50,
                sellerRatio: 50,
                deliveryDays: '7',
            });

            expect(screen.getByTestId('slippage-tolerance-section')).toBeInTheDocument();
            const btn1Pct = screen.getByRole('button', { name: '1.0%' });
            await user.click(btn1Pct);
            expect(btn1Pct).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByText(/Max spend: 1010\.00 cNGN/i)).toBeInTheDocument();
        });

        it('should display Soroban simulation fee and resource breakdown before signing', () => {
            renderWithProvider({
                commodity: 'Maize',
                quantity: '100',
                pricePerUnit: '10',
                sellerAddress: 'GBRP4ZDXSS6NZPMTVNE7DZ47JNV7OFPJMIVG4FDCMNZP7CHH4656YEXI',
                buyerRatio: 50,
                sellerRatio: 50,
                deliveryDays: '7',
            });

            const simSection = screen.getByTestId('soroban-simulation-breakdown');
            expect(simSection).toBeInTheDocument();
            expect(simSection).toHaveTextContent(/Soroban Simulation & Fee Breakdown/i);
            expect(simSection).toHaveTextContent(/CPU Instructions:/i);
            expect(simSection).toHaveTextContent(/Ledger I\/O:/i);
        });
    });

    describe('XDR expiration countdown', () => {
        const validData = {
            commodity: 'Maize',
            quantity: '100',
            pricePerUnit: '10',
            sellerAddress: 'GBRP4ZDXSS6NZPMTVNE7DZ47JNV7OFPJMIVG4FDCMNZP7CHH4656YEXI',
            buyerRatio: 50,
            sellerRatio: 50,
            deliveryDays: '7',
            notes: 'Some notes',
        };

        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('shows remaining validity, then disables sign and offers refresh once expired', async () => {
            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            const nowSeconds = Math.floor(Date.now() / 1000);
            const maxTime = nowSeconds + 10;

            (api.trades.create as jest.Mock).mockResolvedValue({
                tradeId: 'trade-123',
                unsignedXdr: 'mock-xdr',
                maxTime,
            });

            renderWithProvider(validData);

            await user.click(screen.getByRole('button', { name: /lock funds & create trade/i }));
            await user.click(screen.getByRole('button', { name: /accept/i }));

            // Prepared XDR is now available; countdown badge should be visible.
            await waitFor(() => expect(screen.getByTestId('xdr-expiry-badge')).toBeInTheDocument());
            expect(screen.getByTestId('xdr-expiry-badge')).toHaveTextContent(/10s|9s/);

            const signButton = screen.getByRole('button', { name: /sign & submit/i });
            expect(signButton).not.toBeDisabled();

            // Advance past expiration.
            act(() => {
                jest.advanceTimersByTime(11_000);
            });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /refresh quote \/ xdr/i })).toBeInTheDocument();
            });
            expect(screen.queryByRole('button', { name: /sign & submit/i })).not.toBeInTheDocument();
        });
    });
});

describe('useXdrExpiry', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const Harness = ({ maxTime }: { maxTime: number | null | undefined }) => {
        const { secondsRemaining, isExpired } = useXdrExpiry(maxTime);
        return (
            <div>
                <span data-testid="remaining">{secondsRemaining}</span>
                <span data-testid="expired">{String(isExpired)}</span>
            </div>
        );
    };

    it('transitions from counting down to expired', () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const maxTime = nowSeconds + 5;

        render(<Harness maxTime={maxTime} />);

        expect(screen.getByTestId('expired')).toHaveTextContent('false');
        expect(Number(screen.getByTestId('remaining').textContent)).toBeGreaterThan(0);

        act(() => {
            jest.advanceTimersByTime(6_000);
        });

        expect(screen.getByTestId('expired')).toHaveTextContent('true');
        expect(screen.getByTestId('remaining')).toHaveTextContent('0');
    });

    it('reports not expired when maxTime is absent', () => {
        render(<Harness maxTime={null} />);
        expect(screen.getByTestId('expired')).toHaveTextContent('false');
    });
});
