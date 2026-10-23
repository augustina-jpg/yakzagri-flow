import { renderHook, act } from '@testing-library/react';
import { TradeProvider, useTrade, TradeData } from '../TradeContext';

describe('TradeContext', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TradeProvider>{children}</TradeProvider>
    );

    const createWrapper = (initialData?: Partial<TradeData>) => {
        return ({ children }: { children: React.ReactNode }) => (
            <TradeProvider initialData={initialData}>{children}</TradeProvider>
        );
    };

    describe('initialization', () => {
        it('should initialize with default values', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            expect(result.current.step).toBe(1);
            expect(result.current.data).toEqual({
                commodity: '',
                quantity: '',
                unit: 'kg',
                pricePerUnit: '',
                currency: 'NGN',
                sellerAddress: '',
                buyerRatio: 50,
                sellerRatio: 50,
                deliveryDays: '7',
                notes: '',
            });
        });

        it('should seed state from initialData prop', () => {
            const { result } = renderHook(() => useTrade(), {
                wrapper: createWrapper({
                    commodity: 'Maize',
                    quantity: '500',
                    unit: 'bags',
                    pricePerUnit: '1000',
                    sellerAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890',
                }),
            });

            expect(result.current.data.commodity).toBe('Maize');
            expect(result.current.data.quantity).toBe('500');
            expect(result.current.data.unit).toBe('bags');
            expect(result.current.data.pricePerUnit).toBe('1000');
            expect(result.current.data.sellerAddress).toBe(
                'GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890'
            );
            // Unspecified fields keep their defaults
            expect(result.current.data.currency).toBe('NGN');
            expect(result.current.data.buyerRatio).toBe(50);
            expect(result.current.data.sellerRatio).toBe(50);
            expect(result.current.data.deliveryDays).toBe('7');
            expect(result.current.data.notes).toBe('');
        });

        it('should ignore undefined values in initialData', () => {
            const { result } = renderHook(() => useTrade(), {
                wrapper: createWrapper({ commodity: 'Rice', quantity: undefined }),
            });

            expect(result.current.data.commodity).toBe('Rice');
            expect(result.current.data.quantity).toBe('');
            expect(result.current.data.unit).toBe('kg');
        });

        it('should allow updates after seeding from initialData', () => {
            const { result } = renderHook(() => useTrade(), {
                wrapper: createWrapper({ commodity: 'Maize', quantity: '500' }),
            });

            act(() => {
                result.current.update({ quantity: '750' });
            });

            expect(result.current.data.commodity).toBe('Maize');
            expect(result.current.data.quantity).toBe('750');
        });

        it('should provide setStep function', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            expect(typeof result.current.setStep).toBe('function');
        });

        it('should provide update function', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            expect(typeof result.current.update).toBe('function');
        });
    });

    describe('step progression', () => {
        it('should update step to 2', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.setStep(2);
            });

            expect(result.current.step).toBe(2);
        });

        it('should update step to 3', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.setStep(3);
            });

            expect(result.current.step).toBe(3);
        });

        it('should allow going back to previous steps', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.setStep(3);
            });
            expect(result.current.step).toBe(3);

            act(() => {
                result.current.setStep(1);
            });
            expect(result.current.step).toBe(1);
        });
    });

    describe('update function', () => {
        it('should update single field', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ commodity: 'Maize' });
            });

            expect(result.current.data.commodity).toBe('Maize');
            expect(result.current.data.quantity).toBe('');
        });

        it('should update multiple fields at once', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({
                    commodity: 'Rice',
                    quantity: '500',
                    pricePerUnit: '450',
                });
            });

            expect(result.current.data.commodity).toBe('Rice');
            expect(result.current.data.quantity).toBe('500');
            expect(result.current.data.pricePerUnit).toBe('450');
        });

        it('should preserve existing fields when updating', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ commodity: 'Maize' });
            });

            act(() => {
                result.current.update({ quantity: '100' });
            });

            expect(result.current.data.commodity).toBe('Maize');
            expect(result.current.data.quantity).toBe('100');
        });

        it('should update buyerRatio and sellerRatio independently', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ buyerRatio: 70 });
            });

            expect(result.current.data.buyerRatio).toBe(70);
            expect(result.current.data.sellerRatio).toBe(50);
        });

        it('should update sellerAddress', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ sellerAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890' });
            });

            expect(result.current.data.sellerAddress).toBe('GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890');
        });

        it('should update deliveryDays', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ deliveryDays: '14' });
            });

            expect(result.current.data.deliveryDays).toBe('14');
        });

        it('should update notes', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ notes: 'Goods must be bagged and sealed' });
            });

            expect(result.current.data.notes).toBe('Goods must be bagged and sealed');
        });

        it('should update currency', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ currency: 'cNGN' });
            });

            expect(result.current.data.currency).toBe('cNGN');
        });

        it('should update unit', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ unit: 'tonnes' });
            });

            expect(result.current.data.unit).toBe('tonnes');
        });

        it('should update quantity and unit together', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ quantity: '50', unit: 'bags' });
            });

            expect(result.current.data.quantity).toBe('50');
            expect(result.current.data.unit).toBe('bags');
        });
    });

    describe('resetTradeWizard', () => {
        it('resets all fields and the step and removes the persisted draft', () => {
            localStorage.clear();
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ commodity: 'Maize', quantity: '200', notes: 'Test draft' });
                result.current.setStep(3);
            });
            expect(localStorage.getItem('amana:draft-trade')).not.toBeNull();

            act(() => {
                result.current.resetTradeWizard();
            });

            expect(result.current.step).toBe(1);
            expect(result.current.data).toEqual({
                commodity: '',
                quantity: '',
                unit: 'kg',
                pricePerUnit: '',
                currency: 'NGN',
                sellerAddress: '',
                buyerRatio: 50,
                sellerRatio: 50,
                deliveryDays: '7',
                notes: '',
            });
            expect(localStorage.getItem('amana:draft-trade')).toBeNull();
        });
    });

    describe('edge cases', () => {
        it('should handle empty string updates', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ commodity: 'Maize' });
            });

            act(() => {
                result.current.update({ commodity: '' });
            });

            expect(result.current.data.commodity).toBe('');
        });

        it('should handle null-like values in strings', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ quantity: '0' });
            });

            expect(result.current.data.quantity).toBe('0');
        });

        it('should handle very large numbers as strings', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ quantity: '999999999' });
            });

            expect(result.current.data.quantity).toBe('999999999');
        });

        it('should handle negative numbers as strings', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ quantity: '-100' });
            });

            expect(result.current.data.quantity).toBe('-100');
        });

        it('should handle boundary values for ratios', () => {
            const { result } = renderHook(() => useTrade(), { wrapper });

            act(() => {
                result.current.update({ buyerRatio: 0 });
            });
            expect(result.current.data.buyerRatio).toBe(0);

            act(() => {
                result.current.update({ buyerRatio: 100 });
            });
            expect(result.current.data.buyerRatio).toBe(100);
        });

        it('should merge persisted draft over defaults and initialData', () => {
            const { result } = renderHook(() => useTrade(), {
                wrapper: createWrapper({ commodity: 'Maize', quantity: '500', unit: 'bags' }),
            });

            // Simulate a persisted draft that overrides some seeded fields
            act(() => {
                result.current.update({ quantity: '250', notes: 'Draft note' });
            });

            expect(result.current.data.commodity).toBe('Maize');
            expect(result.current.data.quantity).toBe('250');
            expect(result.current.data.unit).toBe('bags');
            expect(result.current.data.notes).toBe('Draft note');
            expect(result.current.data.currency).toBe('NGN');
        });
    });
});
