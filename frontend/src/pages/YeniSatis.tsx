import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getCustomers } from '@/api/customers'
import { previewInstallments, createSale, type PreviewRow } from '@/api/sales'
import { formatMoney, formatDate } from '@/lib/format'
import { useDebounce } from '@/lib/useDebounce'

const schema = z.object({
  description: z.string().optional(),
  total_amount: z.string().min(1, 'Toplam tutar zorunludur.'),
  down_payment: z.string().optional(),
  installment_count: z.string().optional(),
  sale_date: z.string().min(1, 'Satış tarihi zorunludur.'),
  first_due_date: z.string().min(1, 'İlk vade tarihi zorunludur.'),
})

type FormData = z.infer<typeof schema>

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40'
const labelClass = 'block text-xs font-medium text-muted-foreground mb-1'

export default function YeniSatis() {
  const navigate = useNavigate()
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [customerError, setCustomerError] = useState('')
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const debouncedSearch = useDebounce(customerSearch, 250)

  const { data: customers } = useQuery({
    queryKey: ['customers-search', debouncedSearch],
    queryFn: () => getCustomers(debouncedSearch, 1),
    enabled: debouncedSearch.length > 0,
  })

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const watchedFields = watch(['total_amount', 'down_payment', 'installment_count', 'first_due_date'])

  async function loadPreview() {
    const [total, down, count, date] = watchedFields
    if (!total || !date) return
    setPreviewLoading(true)
    try {
      const rows = await previewInstallments(
        Number(total),
        Number(down ?? 0),
        Number(count ?? 1),
        date,
      )
      setPreview(rows)
    } catch {
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

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
    })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-foreground">Yeni Satış</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Senet / taksit planı oluştur</p>
      </div>

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

        {/* Preview button */}
        <div>
          <button
            type="button"
            onClick={loadPreview}
            disabled={previewLoading}
            className="text-sm text-primary underline hover:no-underline disabled:opacity-50"
          >
            {previewLoading ? 'Hesaplanıyor…' : 'Taksit planını önizle'}
          </button>
        </div>

        {/* Preview table */}
        {preview && preview.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-muted text-xs text-muted-foreground font-medium">
              Taksit Planı Önizleme
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Tutar</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Vade Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.sequence} className="border-t border-border">
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.sequence}</td>
                    <td className="px-4 py-2 tabular-nums text-right font-medium">{formatMoney(row.amount)}</td>
                    <td className="px-4 py-2 tabular-nums">{formatDate(row.due_date)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 border-t border-border">
                <tr>
                  <td className="px-4 py-2 text-xs text-muted-foreground" colSpan={3}>
                    {preview.length} taksit
                  </td>
                </tr>
              </tfoot>
            </table>
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
            disabled={mutation.isPending}
            className="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {mutation.isPending ? 'Kaydediliyor…' : 'Satışı Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
