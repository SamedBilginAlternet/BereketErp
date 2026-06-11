import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type Customer,
  type CustomerPayload,
} from '@/api/customers'
import { useDebounce } from '@/lib/useDebounce'

const schema = z.object({
  name: z.string().min(1, 'Müşteri adı zorunludur.'),
  phone: z.string().optional(),
  address: z.string().optional(),
  note: z.string().optional(),
  ledger_name: z.string().optional(),
  ledger_page: z.string().optional(),
  ledger_row: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function CustomerForm({
  initial,
  onClose,
}: {
  initial?: Customer
  onClose: () => void
}) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          name: initial.name,
          phone: initial.phone ?? '',
          address: initial.address ?? '',
          note: initial.note ?? '',
          ledger_name: initial.ledger_name ?? '',
          ledger_page: initial.ledger_page != null ? String(initial.ledger_page) : '',
          ledger_row: initial.ledger_row != null ? String(initial.ledger_row) : '',
        }
      : {},
  })

  const mutation = useMutation({
    mutationFn: (data: CustomerPayload) =>
      initial ? updateCustomer(initial.id, data) : createCustomer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    },
  })

  const onSubmit: SubmitHandler<FormData> = (data) => {
    const payload: CustomerPayload = {
      name: data.name,
      phone: data.phone || undefined,
      address: data.address || undefined,
      note: data.note || undefined,
      ledger_name: data.ledger_name || undefined,
      ledger_page: data.ledger_page ? Number(data.ledger_page) : undefined,
      ledger_row: data.ledger_row ? Number(data.ledger_row) : undefined,
    }
    mutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-md">
        <h2 className="text-base font-semibold text-foreground mb-4">
          {initial ? 'Müşteri Düzenle' : 'Yeni Müşteri'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Ad Soyad *" error={errors.name?.message}>
            <input autoFocus {...register('name')} className={inputClass} />
          </Field>
          <Field label="Telefon" error={errors.phone?.message}>
            <input {...register('phone')} className={inputClass} />
          </Field>
          <Field label="Adres" error={errors.address?.message}>
            <input {...register('address')} className={inputClass} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Defter" error={errors.ledger_name?.message}>
              <input {...register('ledger_name')} className={inputClass} placeholder="A" />
            </Field>
            <Field label="Sayfa" error={errors.ledger_page?.message}>
              <input type="number" {...register('ledger_page')} className={inputClass} />
            </Field>
            <Field label="Satır" error={errors.ledger_row?.message}>
              <input type="number" {...register('ledger_row')} className={inputClass} />
            </Field>
          </div>
          <Field label="Not" error={errors.note?.message}>
            <textarea {...register('note')} rows={2} className={inputClass} />
          </Field>
          {mutation.error && (
            <p className="text-xs text-status-overdue">Bir hata oluştu, tekrar deneyin.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btnSecondary}>
              İptal
            </button>
            <button type="submit" disabled={isSubmitting || mutation.isPending} className={btnPrimary}>
              {mutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-status-overdue mt-0.5">{error}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40'
const btnPrimary =
  'bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity'
const btnSecondary =
  'bg-muted text-foreground rounded-md px-4 py-1.5 text-sm font-medium hover:bg-border transition-colors'

export default function Musteriler() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'create' | Customer | null>(null)
  const debouncedSearch = useDebounce(search, 250)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch, page],
    queryFn: () => getCustomers(debouncedSearch, page),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })

  function handleDelete(c: Customer) {
    if (confirm(`"${c.name}" müşterisini silmek istediğinizden emin misiniz?`)) {
      deleteMutation.mutate(c.id)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Müşteriler</h1>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.meta.total} kayıt</p>
          )}
        </div>
        <button onClick={() => setModal('create')} className={btnPrimary}>
          + Yeni Müşteri
        </button>
      </div>

      <input
        type="search"
        placeholder="Ad veya telefon ile ara…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/40"
        autoFocus
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : !data?.data.length ? (
        <p className="text-sm text-muted-foreground">
          {search ? 'Arama sonucu bulunamadı.' : 'Henüz müşteri eklenmemiş.'}
        </p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Ad Soyad</th>
                <th className="px-4 py-2.5 text-left font-medium">Telefon</th>
                <th className="px-4 py-2.5 text-left font-medium">Defter</th>
                <th className="px-4 py-2.5 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((c, i) => (
                <tr
                  key={c.id}
                  className={`border-t border-border ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <Link to={`/musteriler/${c.id}`} className="hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                    {c.phone ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums text-xs">
                    {c.ledger_name
                      ? `${c.ledger_name} / ${c.ledger_page ?? '?'} / ${c.ledger_row ?? '?'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-2">
                    <button
                      onClick={() => setModal(c)}
                      className="text-xs text-primary hover:underline"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="text-xs text-status-overdue hover:underline"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span>
            Sayfa {data.meta.current_page} / {data.meta.last_page}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border border-border disabled:opacity-40"
            >
              ← Önceki
            </button>
            <button
              disabled={page === data.meta.last_page}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border border-border disabled:opacity-40"
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {modal && (
        <CustomerForm
          initial={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
