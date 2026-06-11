import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { createLedgerEntry } from '@/api/ledger'
import { formatMoney, formatDate } from '@/lib/format'
import type { Sale } from '@/api/sales'

const today = new Date().toISOString().slice(0, 10)

type FieldName =
  | 'ledger_name'
  | 'ledger_page'
  | 'ledger_row'
  | 'name'
  | 'phone'
  | 'description'
  | 'total_amount'
  | 'down_payment'
  | 'installment_count'
  | 'sale_date'
  | 'first_due_date'

const FIELDS: FieldName[] = [
  'ledger_name',
  'ledger_page',
  'ledger_row',
  'name',
  'phone',
  'description',
  'total_amount',
  'down_payment',
  'installment_count',
  'sale_date',
  'first_due_date',
]

const LABELS: Record<FieldName, string> = {
  ledger_name: 'Defter',
  ledger_page: 'Sayfa',
  ledger_row: 'Satır',
  name: 'Müşteri Adı *',
  phone: 'Telefon',
  description: 'Açıklama',
  total_amount: 'Toplam Tutar *',
  down_payment: 'Peşinat',
  installment_count: 'Taksit Sayısı *',
  sale_date: 'Satış Tarihi *',
  first_due_date: 'İlk Vade *',
}

const REQUIRED: Set<FieldName> = new Set([
  'ledger_name',
  'ledger_page',
  'ledger_row',
  'name',
  'total_amount',
  'installment_count',
  'sale_date',
  'first_due_date',
])

type FormValues = Record<FieldName, string>

const defaultValues: FormValues = {
  ledger_name: '',
  ledger_page: '',
  ledger_row: '',
  name: '',
  phone: '',
  description: '',
  total_amount: '',
  down_payment: '0',
  installment_count: '',
  sale_date: today,
  first_due_date: '',
}

function validate(values: FormValues): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {}
  for (const f of REQUIRED) {
    if (!values[f].trim()) errors[f] = 'Zorunlu alan'
  }
  if (values.total_amount && isNaN(Number(values.total_amount))) {
    errors.total_amount = 'Geçersiz tutar'
  }
  if (values.down_payment && isNaN(Number(values.down_payment))) {
    errors.down_payment = 'Geçersiz tutar'
  }
  if (
    values.total_amount &&
    values.down_payment &&
    Number(values.down_payment) > Number(values.total_amount)
  ) {
    errors.down_payment = 'Peşinat toplam tutardan büyük olamaz'
  }
  if (values.installment_count && isNaN(Number(values.installment_count))) {
    errors.installment_count = 'Geçersiz sayı'
  }
  return errors
}

export default function DefterAktarim() {
  const navigate = useNavigate()
  const [values, setValues] = useState<FormValues>(defaultValues)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [saved, setSaved] = useState<Sale | null>(null)
  const refs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({})

  const mutation = useMutation({
    mutationFn: createLedgerEntry,
    onSuccess: (sale) => {
      setSaved(sale)
      setValues(defaultValues)
      setErrors({})
      // Focus ledger_page for next entry (same defter)
      const savedLedgerName = sale.customer?.name ?? ''
      void savedLedgerName
      setTimeout(() => refs.current.ledger_page?.focus(), 50)
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const apiErrors = e.response?.data?.errors
      if (apiErrors) {
        const mapped: Partial<Record<FieldName, string>> = {}
        for (const [key, msgs] of Object.entries(apiErrors)) {
          if (FIELDS.includes(key as FieldName)) {
            mapped[key as FieldName] = msgs[0]
          }
        }
        setErrors(mapped)
      }
    },
  })

  function set(field: FieldName, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function advanceFocus(current: FieldName) {
    const idx = FIELDS.indexOf(current)
    const next = FIELDS[idx + 1]
    if (next) refs.current[next]?.focus()
    else submit()
  }

  function handleKey(e: React.KeyboardEvent, field: FieldName) {
    if (e.key === 'Enter') {
      e.preventDefault()
      advanceFocus(field)
    }
  }

  function submit() {
    const errs = validate(values)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const firstErr = FIELDS.find((f) => errs[f])
      if (firstErr) refs.current[firstErr]?.focus()
      return
    }

    mutation.mutate({
      ledger_name: values.ledger_name.trim(),
      ledger_page: Number(values.ledger_page),
      ledger_row: Number(values.ledger_row),
      name: values.name.trim(),
      phone: values.phone.trim() || undefined,
      description: values.description.trim() || undefined,
      total_amount: Number(values.total_amount),
      down_payment: Number(values.down_payment || '0'),
      installment_count: Number(values.installment_count),
      sale_date: values.sale_date,
      first_due_date: values.first_due_date,
    })
  }

  const inputClass = (f: FieldName) =>
    `w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${
      errors[f] ? 'border-red-400 bg-red-50' : 'border-border bg-background'
    }`

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-lg font-semibold text-foreground mb-1">Defter Aktarımı</h1>
      <p className="text-xs text-muted-foreground mb-5">
        Her alanda Enter ile sonraki alana geçin. Son alanda Enter kayıt oluşturur.
      </p>

      {saved && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-medium text-emerald-800">
            Kaydedildi — {saved.customer?.name ?? 'Müşteri'}
          </p>
          <p className="text-xs text-emerald-700 mt-0.5">
            {saved.installment_count} taksit · {formatMoney(saved.total_amount)} ·
            İlk vade {formatDate(saved.first_due_date)}
          </p>
          <button
            onClick={() => navigate(`/musteriler/${saved.customer_id}`)}
            className="mt-2 text-xs text-emerald-700 underline"
          >
            Müşteri detayını aç →
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        {/* Ledger coords */}
        <div className="grid grid-cols-3 gap-2">
          {(['ledger_name', 'ledger_page', 'ledger_row'] as const).map((f) => (
            <div key={f}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {LABELS[f]}
              </label>
              <input
                ref={(el) => { refs.current[f] = el }}
                type={f === 'ledger_name' ? 'text' : 'number'}
                min={1}
                value={values[f]}
                onChange={(e) => set(f, e.target.value)}
                onKeyDown={(e) => handleKey(e, f)}
                autoFocus={f === 'ledger_name'}
                className={inputClass(f)}
              />
              {errors[f] && <p className="text-xs text-red-500 mt-0.5">{errors[f]}</p>}
            </div>
          ))}
        </div>

        {/* Customer */}
        {(['name', 'phone'] as const).map((f) => (
          <div key={f}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {LABELS[f]}
            </label>
            <input
              ref={(el) => { refs.current[f] = el }}
              type="text"
              value={values[f]}
              onChange={(e) => set(f, e.target.value)}
              onKeyDown={(e) => handleKey(e, f)}
              className={inputClass(f)}
            />
            {errors[f] && <p className="text-xs text-red-500 mt-0.5">{errors[f]}</p>}
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {LABELS.description}
          </label>
          <input
            ref={(el) => { refs.current.description = el }}
            type="text"
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            onKeyDown={(e) => handleKey(e, 'description')}
            className={inputClass('description')}
          />
        </div>

        {/* Sale amounts */}
        <div className="grid grid-cols-3 gap-2">
          {(['total_amount', 'down_payment', 'installment_count'] as const).map((f) => (
            <div key={f}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {LABELS[f]}
              </label>
              <input
                ref={(el) => { refs.current[f] = el }}
                type="number"
                step={f === 'installment_count' ? '1' : '0.01'}
                min="0"
                value={values[f]}
                onChange={(e) => set(f, e.target.value)}
                onKeyDown={(e) => handleKey(e, f)}
                className={inputClass(f)}
              />
              {errors[f] && <p className="text-xs text-red-500 mt-0.5">{errors[f]}</p>}
            </div>
          ))}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2">
          {(['sale_date', 'first_due_date'] as const).map((f) => (
            <div key={f}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {LABELS[f]}
              </label>
              <input
                ref={(el) => { refs.current[f] = el }}
                type="date"
                value={values[f]}
                onChange={(e) => set(f, e.target.value)}
                onKeyDown={(e) => handleKey(e, f)}
                className={inputClass(f)}
              />
              {errors[f] && <p className="text-xs text-red-500 mt-0.5">{errors[f]}</p>}
            </div>
          ))}
        </div>

        {mutation.error && (
          <p className="text-xs text-red-500">Sunucu hatası. Bilgileri kontrol edin.</p>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={mutation.isPending}
            className="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {mutation.isPending ? 'Kaydediliyor…' : 'Kaydet (Enter)'}
          </button>
        </div>
      </div>
    </div>
  )
}
