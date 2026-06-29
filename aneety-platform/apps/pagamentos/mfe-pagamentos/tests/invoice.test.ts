import { describe, expect, it } from 'vitest';
import { calculateSubtotal, calculateTotal, initialInvoiceState, toInvoicePayload, validateInvoice } from '../src/invoice';

describe('invoice helpers', () => {
  it('calculates subtotal and total with discount and surcharge', () => {
    const state = {
      items: [
        { description: 'A', quantity: 2, unitAmount: 50 },
        { description: 'B', quantity: 1, unitAmount: 25.5 },
      ],
      discountAmount: 5,
      surchargeAmount: 10,
    };
    expect(calculateSubtotal(state.items)).toBe(125.5);
    expect(calculateTotal(state)).toBe(130.5);
  });

  it('validates required invoice fields', () => {
    const errors = validateInvoice({ ...initialInvoiceState, customer: { ...initialInvoiceState.customer, name: '' } });
    expect(errors).toContain('Informe o nome do cliente.');
  });

  it('normalizes payload and drops empty items', () => {
    const payload = toInvoicePayload({
      ...initialInvoiceState,
      customer: { ...initialInvoiceState.customer, name: ' Cliente ' },
      items: [...initialInvoiceState.items, { description: ' ', quantity: 1, unitAmount: 1 }],
    });
    expect(payload.customer.name).toBe('Cliente');
    expect(payload.items).toHaveLength(initialInvoiceState.items.length);
  });
});
