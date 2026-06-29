import { CheckCircle2, FileDown, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, MetricRow } from './components/ui/card';
import { Alert, Badge, Separator, Skeleton } from './components/ui/feedback';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from './components/ui/field';
import { Input, Select, Textarea } from './components/ui/input';
import {
  CONTRACT_VERSION,
  type InvoiceFormState,
  calculateSubtotal,
  calculateTotal,
  formatCurrency,
  initialInvoiceState,
  nextItem,
  paymentMethodLabels,
  statusLabels,
  toInvoicePayload,
  validateInvoice,
} from './invoice';

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; browserMsUsed?: string }
  | { kind: 'error'; message: string };

export default function App() {
  const [form, setForm] = useState<InvoiceFormState>(initialInvoiceState);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });

  const subtotal = useMemo(() => calculateSubtotal(form.items), [form.items]);
  const total = useMemo(() => calculateTotal(form), [form]);
  const validationErrors = useMemo(() => validateInvoice(form), [form]);
  const canSubmit = validationErrors.length === 0 && submitState.kind !== 'loading';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = validateInvoice(form);
    if (errors.length) {
      setSubmitState({ kind: 'error', message: errors[0] });
      return;
    }

    setSubmitState({ kind: 'loading' });
    try {
      const response = await fetch('/api/invoices/pdf', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-aneety-contract-version': CONTRACT_VERSION,
        },
        body: JSON.stringify(toInvoicePayload(form)),
      });

      if (!response.ok) {
        const fallback = 'Não foi possível gerar a fatura neste momento.';
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message || fallback);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = `fatura-${form.invoice.number || 'cliente'}.pdf`;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setSubmitState({ kind: 'success', browserMsUsed: response.headers.get('x-browser-ms-used') || undefined });
    } catch (error) {
      setSubmitState({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível gerar a fatura neste momento.' });
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Cabeçalho">
        <div className="brand-lockup">
          <span className="brand-mark">A</span>
          <span>Aneety</span>
        </div>
        <div className="header-copy">
          <h1>Gerar fatura</h1>
          <p>Preencha os dados do cliente e revise o resumo antes de baixar o PDF.</p>
        </div>
      </header>

      <form className="workspace" onSubmit={handleSubmit}>
        <div className="form-column">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
              <CardDescription>Dados usados para identificar quem recebe a fatura.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid-two">
                <TextField label="Nome do cliente" value={form.customer.name} onChange={(value) => updateCustomer('name', value)} required />
                <TextField label="Documento" value={form.customer.document} onChange={(value) => updateCustomer('document', value)} required />
                <TextField label="E-mail" type="email" value={form.customer.email} onChange={(value) => updateCustomer('email', value)} />
                <TextField label="Endereço" value={form.customer.address} onChange={(value) => updateCustomer('address', value)} required />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagamento</CardTitle>
              <CardDescription>Condição, prazo e situação da cobrança.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid-three">
                <TextField label="Número da fatura" value={form.invoice.number} onChange={(value) => updateInvoice('number', value)} required />
                <TextField label="Data de emissão" type="date" value={form.invoice.issuedAt} onChange={(value) => updateInvoice('issuedAt', value)} required />
                <TextField label="Vencimento" type="date" value={form.invoice.dueAt} onChange={(value) => updateInvoice('dueAt', value)} required />
                <Field>
                  <FieldLabel htmlFor="payment-method">Forma de pagamento</FieldLabel>
                  <Select id="payment-method" value={form.invoice.paymentMethod} onChange={(event) => updateInvoice('paymentMethod', event.target.value)}>
                    {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="invoice-status">Status</FieldLabel>
                  <Select id="invoice-status" value={form.invoice.status} onChange={(event) => updateInvoice('status', event.target.value)}>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                </Field>
                <NumberField label="Desconto" value={form.discountAmount} onChange={(value) => setForm((current) => ({ ...current, discountAmount: value }))} />
                <NumberField label="Acréscimos" value={form.surchargeAmount} onChange={(value) => setForm((current) => ({ ...current, surchargeAmount: value }))} />
                <Field className="wide-field">
                  <FieldLabel htmlFor="invoice-notes">Observações</FieldLabel>
                  <Textarea id="invoice-notes" rows={4} value={form.invoice.notes} onChange={(event) => updateInvoice('notes', event.target.value)} />
                  <FieldDescription>Texto curto para orientar conferência e cobrança.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="items-header">
              <div>
                <CardTitle>Itens da fatura</CardTitle>
                <CardDescription>Até 20 linhas de cobrança.</CardDescription>
              </div>
              <Button type="button" className="button-secondary" onClick={addItem}>
                <Plus data-icon="inline-start" /> Adicionar item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="items-table" role="table" aria-label="Itens da fatura">
                <div className="items-row items-head" role="row">
                  <span>Descrição</span>
                  <span>Qtd.</span>
                  <span>Valor unitário</span>
                  <span>Total</span>
                  <span aria-label="Ações" />
                </div>
                {form.items.map((item, index) => (
                  <div className="items-row" role="row" key={index}>
                    <Input aria-label={`Descrição do item ${index + 1}`} value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} />
                    <Input aria-label={`Quantidade do item ${index + 1}`} type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', numberFromEvent(event))} />
                    <Input aria-label={`Valor unitário do item ${index + 1}`} type="number" min="0" step="0.01" value={item.unitAmount} onChange={(event) => updateItem(index, 'unitAmount', numberFromEvent(event))} />
                    <strong>{formatCurrency(item.quantity * item.unitAmount)}</strong>
                    <Button type="button" className="button-ghost" aria-label={`Remover item ${index + 1}`} onClick={() => removeItem(index)} disabled={form.items.length === 1}>
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="summary-column">
          <Card className="summary-card">
            <CardHeader>
              <div className="summary-title-row">
                <CardTitle>Resumo da fatura</CardTitle>
                <Badge>{statusLabels[form.invoice.status]}</Badge>
              </div>
              <CardDescription>Revise os valores antes de gerar o documento.</CardDescription>
            </CardHeader>
            <CardContent>
              {submitState.kind === 'loading' ? <LoadingPreview /> : null}
              <MetricRow label="Subtotal" value={formatCurrency(subtotal)} />
              <MetricRow label="Desconto" value={formatCurrency(form.discountAmount)} />
              <MetricRow label="Acréscimos" value={formatCurrency(form.surchargeAmount)} />
              <Separator />
              <MetricRow label="Total" value={formatCurrency(total)} strong />
              <div className="due-box">
                <span>Vencimento</span>
                <strong>{formatDateForUser(form.invoice.dueAt)}</strong>
              </div>
              {submitState.kind === 'success' ? (
                <Alert className="alert-success"><CheckCircle2 data-icon="inline-start" /> Fatura pronta para download.</Alert>
              ) : null}
              {submitState.kind === 'error' ? <Alert className="alert-error">{submitState.message}</Alert> : null}
              {validationErrors.length ? <FieldError>{validationErrors[0]}</FieldError> : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={!canSubmit}>
                <FileDown data-icon="inline-start" /> {submitState.kind === 'loading' ? 'Gerando...' : 'Gerar PDF'}
              </Button>
              <Button type="button" className="button-secondary" onClick={resetForm}>
                <RotateCcw data-icon="inline-start" /> Limpar
              </Button>
            </CardFooter>
          </Card>
        </aside>
      </form>
    </main>
  );

  function updateCustomer(field: keyof InvoiceFormState['customer'], value: string) {
    setForm((current) => ({ ...current, customer: { ...current.customer, [field]: value } }));
    setSubmitState({ kind: 'idle' });
  }

  function updateInvoice(field: keyof InvoiceFormState['invoice'], value: string) {
    setForm((current) => ({ ...current, invoice: { ...current.invoice, [field]: value } as InvoiceFormState['invoice'] }));
    setSubmitState({ kind: 'idle' });
  }

  function updateItem(index: number, field: keyof InvoiceFormState['items'][number], value: string | number) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
    setSubmitState({ kind: 'idle' });
  }

  function addItem() {
    setForm((current) => (current.items.length >= 20 ? current : { ...current, items: [...current.items, nextItem()] }));
  }

  function removeItem(index: number) {
    setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function resetForm() {
    setForm(initialInvoiceState);
    setSubmitState({ kind: 'idle' });
  }
}

function TextField({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  const id = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  const invalid = required && !value.trim();
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type={type} value={value} required={required} aria-invalid={invalid || undefined} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(numberFromEvent(event))} />
    </Field>
  );
}

function LoadingPreview() {
  return (
    <div className="loading-preview" aria-label="Preparando fatura">
      <Skeleton />
      <Skeleton />
    </div>
  );
}

function numberFromEvent(event: ChangeEvent<HTMLInputElement>) {
  const value = Number(event.target.value);
  return Number.isFinite(value) ? value : 0;
}

function formatDateForUser(value: string) {
  if (!value) return 'Não informado';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
