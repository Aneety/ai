export const CONTRACT_VERSION = '2026-06-28.pagamentos.invoice-dashboard.v1';

export type PaymentMethod = 'pix' | 'card' | 'bank_slip' | 'transfer' | 'cash';
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitAmount: number;
}

export interface InvoiceFormState {
  customer: {
    name: string;
    document: string;
    email: string;
    address: string;
  };
  invoice: {
    number: string;
    issuedAt: string;
    dueAt: string;
    paymentMethod: PaymentMethod;
    status: InvoiceStatus;
    notes: string;
  };
  items: InvoiceItem[];
  discountAmount: number;
  surchargeAmount: number;
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card: 'Cartão',
  bank_slip: 'Boleto',
  transfer: 'Transferência',
  cash: 'Dinheiro',
};

export const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencida',
};

export const initialInvoiceState: InvoiceFormState = {
  customer: {
    name: 'Cliente Exemplo',
    document: '123.456.789-00',
    email: 'cliente@example.com',
    address: 'Rua das Faturas, 100',
  },
  invoice: {
    number: 'FAT-0001',
    issuedAt: '2026-06-29',
    dueAt: '2026-07-06',
    paymentMethod: 'pix',
    status: 'pending',
    notes: 'Fatura gerada para conferência operacional.',
  },
  items: [
    { description: 'Serviço operacional', quantity: 1, unitAmount: 350 },
    { description: 'Ajuste de atendimento', quantity: 2, unitAmount: 75 },
  ],
  discountAmount: 0,
  surchargeAmount: 0,
};

export function calculateSubtotal(items: InvoiceItem[]): number {
  return roundMoney(items.reduce((total, item) => total + safeNumber(item.quantity) * safeNumber(item.unitAmount), 0));
}

export function calculateTotal(state: Pick<InvoiceFormState, 'items' | 'discountAmount' | 'surchargeAmount'>): number {
  return Math.max(0, roundMoney(calculateSubtotal(state.items) - safeNumber(state.discountAmount) + safeNumber(state.surchargeAmount)));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(value));
}

export function validateInvoice(state: InvoiceFormState): string[] {
  const errors: string[] = [];
  if (!state.customer.name.trim()) errors.push('Informe o nome do cliente.');
  if (!state.customer.document.trim()) errors.push('Informe o documento do cliente.');
  if (!state.customer.address.trim()) errors.push('Informe o endereço do cliente.');
  if (!state.invoice.number.trim()) errors.push('Informe o número da fatura.');
  if (!state.invoice.issuedAt) errors.push('Informe a data de emissão.');
  if (!state.invoice.dueAt) errors.push('Informe o vencimento.');
  if (state.invoice.issuedAt && state.invoice.dueAt && new Date(state.invoice.dueAt).getTime() < new Date(state.invoice.issuedAt).getTime()) {
    errors.push('O vencimento deve ser posterior à emissão.');
  }
  const filledItems = state.items.filter((item) => item.description.trim());
  if (!filledItems.length) errors.push('Adicione pelo menos um item.');
  if (filledItems.length > 20) errors.push('Use no máximo 20 itens.');
  for (const item of filledItems) {
    if (safeNumber(item.quantity) <= 0) errors.push('Cada item precisa ter quantidade maior que zero.');
    if (safeNumber(item.unitAmount) < 0) errors.push('Cada item precisa ter valor válido.');
  }
  return [...new Set(errors)];
}

export function toInvoicePayload(state: InvoiceFormState): InvoiceFormState {
  return {
    customer: {
      name: state.customer.name.trim(),
      document: state.customer.document.trim(),
      email: state.customer.email.trim(),
      address: state.customer.address.trim(),
    },
    invoice: {
      number: state.invoice.number.trim(),
      issuedAt: state.invoice.issuedAt,
      dueAt: state.invoice.dueAt,
      paymentMethod: state.invoice.paymentMethod,
      status: state.invoice.status,
      notes: state.invoice.notes.trim(),
    },
    items: state.items
      .filter((item) => item.description.trim())
      .slice(0, 20)
      .map((item) => ({
        description: item.description.trim(),
        quantity: safeNumber(item.quantity),
        unitAmount: safeNumber(item.unitAmount),
      })),
    discountAmount: safeNumber(state.discountAmount),
    surchargeAmount: safeNumber(state.surchargeAmount),
  };
}

export function nextItem(): InvoiceItem {
  return { description: '', quantity: 1, unitAmount: 0 };
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
