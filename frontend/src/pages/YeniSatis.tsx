import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getCustomers, getCustomer } from '@/api/customers'
import { previewInstallments, createSale } from '@/api/sales'
import { formatMoney, formatDate } from '@/lib/format'

const schema = z.object({
  description: z.string().optional(),
  total_amount: z.string().min(1, 'Toplam tutar zorunludur.'),
  down_payment: z.string().optional(),
  installment_count: z.string().optional(),
  sale_date: z.string().min(1, 'Satış tarihi zorunludur.'),
  first_due_date: z.string().min(1, 'İlk vade tarihi zorunludur.'),
})

type FormData = z.infer<typeof schema>

interface InstallmentRow {
  amount: string
  due_date: string
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

export default function YeniSatis() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillCustomerId = searchParams.get('customer_id') ? Number(searchParams.get('customer_id')) : null

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(prefillCustomerId)
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [customerError, setCustomerError] = useState('')
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: prefillCustomer } = useQuery({
    queryKey: ['customer', prefillCustomerId],
    queryFn: () => getCustomer(prefillCustomerId!),
    enabled: prefillCustomerId !== null,
  })

  useEffect(() => {
    if (prefillCustomer && !selectedCustomerName) {
      setSelectedCustomerName(prefillCustomer.name)
    }
  }, [prefillCustomer, selectedCustomerName])

  const { data: customers } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => getCustomers(customerSearch, 1),
    enabled: customerSearch.length > 0,
  })

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const watchedFields = watch(['total_amount', 'down_payment', 'installment_count', 'first_due_date'])

  useEffect(() => {
    const [total, down, count, date] = watchedFields
    if (!total || !date || !count) return

    const totalNum = Number(total)
    const downNum = Number(down ?? 0)
    const countNum = Number(count)

    if (isNaN(totalNum) || isNaN(downNum) || isNaN(countNum) || countNum < 1) return
    if (totalNum <= 0) return

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const rows = await previewInstallments(totalNum, downNum, countNum, date)
        setInstallmentRows(rows.map((r) => ({ amount: r.amount, due_date: r.due_date })))
      } catch {
        setInstallmentRows([])
      } finally {
        setPreviewLoading(false)
      }
    }, 400)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedFields[0], watchedFields[1], watchedFields[2], watchedFields[3]])

  function resetToEqual() {
    const [total, down, count, date] = watchedFields
    if (!total || !date || !count) return
    const totalNum = Number(total)
    const downNum = Number(down ?? 0)
    const countNum = Number(count)
    if (isNaN(totalNum) || isNaN(downNum) || isNaN(countNum) || countNum < 1) return

    setPreviewLoading(true)
    previewInstallments(totalNum, downNum, countNum, date)
      .then((rows) => setInstallmentRows(rows.map((r) => ({ amount: r.amount, due_date: r.due_date }))))
      .catch(() => {})
      .finally(() => setPreviewLoading(false))
  }

  const financedAmount = (() => {
    const [total, down] = watchedFields
    const t = Number(total ?? 0)
    const d = Number(down ?? 0)
    return isNaN(t) || isNaN(d) ? 0 : Math.max(0, t - d)
  })()

  const rowsSum = installmentRows.reduce((acc, r) => {
    const v = parseFloat(r.amount)
    return acc + (isNaN(v) ? 0 : v)
  }, 0)

  const diff = Math.round((rowsSum - financedAmount) * 100) / 100

  const mutation = useMutation({
    mutationFn: createSale,
    onSuccess: () => navigate('/musteriler', { replace: true }),
  })

  const onSubmit: SubmitHandler<FormData> = (data) => {
    if (!selectedCustomerId) {
      setCustomerError('Müşteri seçimi zorunludur.')
      return
    }
    setCustomerError('')
    mutation.mutate({
      customer_id: selectedCustomerId,
      description: data.description,
      total_amount: Number(data.total_amount),
      down_payment: Number(data.down_payment ?? 0),
      installment_count: Number(data.installment_count ?? 1),
      sale_date: data.sale_date,
      first_due_date: data.first_due_date,
      ...(installmentRows.length > 0 ? { amounts: installmentRows.map((r) => r.amount) } : {}),
    })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-8 pt-7 pb-5 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">Yeni Satış</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Senet / taksit planı oluştur</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Customer picker */}
            <div>
              <label className={labelClass}>Müşteri *</label>
              {selectedCustomerName ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{selectedCustomerName}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedCustomerId(null); setSelectedCustomerName('') }}
                    className="text-xs text-status-overdue hover:underline"
                  >
                    Değiştir
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="search"
                    placeholder="Ad ile ara…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className={inputClass}
                    autoFocus
                  />
                  {customers && customers.data.length > 0 && customerSearch.length > 0 && (
                    <div className="border border-border rounded-md mt-1 bg-card shadow-sm">
                      {customers.data.slice(0, 8).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id)
                            setSelectedCustomerName(c.name)
                            setCustomerSearch('')
                            setCustomerError('')
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        >
                          {c.name}
                          {c.phone && <span className="text-muted-foreground ml-2 text-xs">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {customerError && <p className="text-xs text-status-overdue mt-1">{customerError}</p>}
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Açıklama</label>
              <input {...register('description')} placeholder="Çeyiz seti, yorgan takımı vb." className={inputClass} />
            </div>

            {/* Money fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Toplam Tutar (₺) *</label>
                <input type="number" step="0.01" min="0.01" {...register('total_amount')} className={inputClass} />
                {errors.total_amount && <p className="text-xs text-status-overdue mt-1">{errors.total_amount.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Peşinat (₺)</label>
                <input type="number" step="0.01" min="0" defaultValue={0} {...register('down_payment')} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Taksit Sayısı</label>
                <input type="number" min="1" max="60" defaultValue={1} {...register('installment_count')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Satış Tarihi</label>
                <input type="date" defaultValue={today} {...register('sale_date')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>İlk Vade</label>
                <input type="date" {...register('first_due_date')} className={inputClass} />
                {errors.first_due_date && <p className="text-xs text-status-overdue mt-1">{errors.first_due_date.message}</p>}
              </div>
            </div>

            {/* Installment rows table */}
            {(installmentRows.length > 0 || previewLoading) && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-muted flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    {previewLoading ? 'Hesaplanıyor…' : 'Taksit Planı'}
                  </span>
                  {!previewLoading && (
                    <button
                      type="button"
                      onClick={resetToEqual}
                      className="text-xs text-primary hover:underline"
                    >
                      Eşit Dağıt
                    </button>
                  )}
                </div>
                {!previewLoading && installmentRows.length > 0 && (
                  <>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Tutar (₺)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Vade Tarihi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installmentRows.map((row, idx) => (
                          <tr key={idx} className="border-t border-border">
                            <td className="px-4 py-2 tabular-nums text-muted-foreground">{idx + 1}</td>
                            <td className="px-4 py-1.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={row.amount}
                                onChange={(e) => {
                                  const newRows = [...installmentRows]
                                  newRows[idx] = { ...newRows[idx], amount: e.target.value }
                                  setInstallmentRows(newRows)
                                }}
                                className="w-32 rounded border border-border bg-background px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </td>
                            <td className="px-4 py-2 tabular-nums">{formatDate(row.due_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className={`px-4 py-2 border-t border-border text-xs font-medium ${diff !== 0 ? 'text-status-overdue' : 'text-muted-foreground'}`}>
                      Toplam: {formatMoney(rowsSum.toFixed(2))}
                      {diff !== 0 && (
                        <span className="ml-2">
                          (Fark: {diff > 0 ? '+' : ''}{formatMoney(diff.toFixed(2))})
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {mutation.error && (
              <p className="text-sm text-status-overdue">Bir hata oluştu, bilgileri kontrol edip tekrar deneyin.</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="bg-muted text-foreground rounded-md px-5 py-2 text-sm font-medium hover:bg-border transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || (diff !== 0 && installmentRows.length > 0)}
                className="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {mutation.isPending ? 'Kaydediliyor…' : 'Satışı Kaydet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
