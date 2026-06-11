import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Phone, BookOpen, Wallet, Calendar, CreditCard } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { getCustomer } from '@/api/customers'
import { getCustomerBalance, recordPayment } from '@/api/payments'
import { getCustomerSales } from '@/api/sales'
import { getTimeline } from '@/api/callTasks'
import { formatMoney, formatDate } from '@/lib/format'
import StatusBadge from '@/components/StatusBadge'
import { DataTable } from '@/components/DataTable'
import type { Installment } from '@/api/sales'

function PaymentModal({
  installment,
  onClose,
}: {
  installment: Installment
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      recordPayment(installment.id, {
        amount: Number(amount),
        paid_at: paidAt,
        note: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-balance'] })
      qc.invalidateQueries({ queryKey: ['sale'] })
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e.response?.data?.message ?? 'Bir hata oluştu.')
    },
  })

  const remaining = Number(installment.remaining)

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm shadow-md">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Taksit #{installment.sequence} — Ödeme Al
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Kalan: <span className="font-medium tabular-nums">{formatMoney(remaining)}</span>
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Tutar (₺) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Ödeme Tarihi *
            </label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Not</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {error && <p className="text-xs text-status-overdue">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="bg-muted text-foreground rounded-md px-4 py-1.5 text-sm hover:bg-border transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              disabled={!amount || mutation.isPending}
              onClick={() => { setError(''); mutation.mutate() }}
              className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {mutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildInstallmentColumns(onPay: (i: Installment) => void): ColumnDef<Installment, unknown>[] {
  return [
    {
      accessorKey: 'sequence',
      header: '#',
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue() as number}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Tutar',
      cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatMoney(getValue() as string)}</span>,
    },
    {
      accessorKey: 'paid_amount',
      header: 'Ödenen',
      cell: ({ getValue }) => {
        const v = getValue() as string
        return <span className="tabular-nums text-muted-foreground">{Number(v) > 0 ? formatMoney(v) : '—'}</span>
      },
    },
    {
      accessorKey: 'due_date',
      header: 'Vade',
      cell: ({ getValue }) => <span className="tabular-nums">{formatDate(getValue() as string)}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status !== 'paid' ? (
          <button onClick={() => onPay(row.original)} className="text-xs text-primary hover:underline">
            Ödeme Al
          </button>
        ) : null,
    },
  ]
}

export default function MusteriDetay() {
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const [payingInstallment, setPayingInstallment] = useState<Installment | null>(null)

  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(customerId),
  })

  const { data: balance } = useQuery({
    queryKey: ['customer-balance', customerId],
    queryFn: () => getCustomerBalance(customerId),
  })

  const { data: salesData } = useQuery({
    queryKey: ['customer-sales', customerId],
    queryFn: () => getCustomerSales(customerId),
  })

  const { data: timeline } = useQuery({
    queryKey: ['timeline', customerId],
    queryFn: () => getTimeline(customerId),
  })

  if (!customer) return <div className="p-6 text-sm text-muted-foreground">Yükleniyor…</div>

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-5">
        <Link to="/musteriler" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={13} />Müşteriler
        </Link>
      </div>

      {/* Customer header */}
      <div className="bg-card border border-border rounded-lg p-5 mb-5">
        <h1 className="text-lg font-semibold text-foreground">{customer.name}</h1>
        {customer.phone && (
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Phone size={13} />{customer.phone}
          </p>
        )}
        {customer.ledger_name && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <BookOpen size={12} />
            <span className="font-medium">{customer.ledger_name}</span>
            {customer.ledger_page && ` / Sayfa: ${customer.ledger_page}`}
            {customer.ledger_row && ` / Satır: ${customer.ledger_row}`}
          </p>
        )}
      </div>

      {/* Balance summary */}
      {balance && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet size={13} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Toplam Borç</p>
            </div>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatMoney(balance.total_debt)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard size={13} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Kalan Taksit</p>
            </div>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {balance.remaining_installments}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar size={13} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Sıradaki Ödeme</p>
            </div>
            {balance.next_due_date ? (
              <>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {formatMoney(balance.next_payment_amount ?? '0')}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(balance.next_due_date)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      )}

      {/* Sales / installments */}
      {salesData && salesData.length > 0 ? (
        <div className="space-y-4">
          {salesData.map((sale) => (
            <div key={sale.id} className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-muted flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {sale.description ?? `Satış #${sale.id}`}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">{formatDate(sale.sale_date)}</span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  Toplam: {formatMoney(sale.total_amount)}
                </span>
              </div>
              <div className="p-4">
                <DataTable
                  data={sale.installments}
                  columns={buildInstallmentColumns(setPayingInstallment)}
                  searchPlaceholder="Vadeye göre ara…"
                  searchColumn="due_date"
                  pageSize={12}
                  emptyText="Taksit kaydı yok."
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Bu müşteriye ait satış kaydı yok.</p>
      )}

      {/* Timeline */}
      {timeline && timeline.length > 0 && (
        <div className="mt-6 border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted border-b border-border">
            <span className="text-xs font-medium text-foreground">Geçmiş</span>
          </div>
          <div className="p-4 space-y-2">
            {timeline.map((ev, i) => (
              <div key={i} className="flex gap-3 text-xs">
                <span className="tabular-nums text-muted-foreground shrink-0 w-20">
                  {formatDate(ev.date)}
                </span>
                <div>
                  <span
                    className={`font-medium ${
                      ev.type === 'payment'
                        ? 'text-emerald-700'
                        : ev.type === 'call'
                          ? 'text-sky-700'
                          : 'text-foreground'
                    }`}
                  >
                    {ev.title}
                  </span>
                  {ev.detail && (
                    <span className="text-muted-foreground ml-1">— {ev.detail}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {payingInstallment && (
        <PaymentModal
          installment={payingInstallment}
          onClose={() => setPayingInstallment(null)}
        />
      )}
    </div>
  )
}
