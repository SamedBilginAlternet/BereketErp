import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { BookOpen, CheckCircle2 } from 'lucide-react'
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
  | 'total_amount'
  | 'down_payment'
  | 'installment_count'
  | 'sale_date'
  | 'first_due_date'
  | 'description'

const FIELDS: FieldName[] = [
  'ledger_name',
  'ledger_page',
  'ledger_row',
  'name',
  'phone',
  'total_amount',
  'down_payment',
  'installment_count',
  'sale_date',
  'first_due_date',
  'description',
]

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
  total_amount: '',
  down_payment: '0',
  installment_count: '',
  sale_date: today,
  first_due_date: '',
  description: '',
}

function validate(values: FormValues): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {}
  for (const f of REQUIRED) {
    if (!values[f].trim()) errors[f] = 'Zorunlu alan'
  }
  if (values.total_amount && isNaN(Number(values.total_amount)))
    errors.total_amount = 'Geçersiz tutar'
  if (values.down_payment && isNaN(Number(values.down_payment)))
    errors.down_payment = 'Geçersiz tutar'
  if (
    values.total_amount &&
    values.down_payment &&
    Number(values.down_payment) > Number(values.total_amount)
  )
    errors.down_payment = 'Peşinat toplam tutardan büyük olamaz'
  if (values.installment_count && isNaN(Number(values.installment_count)))
    errors.installment_count = 'Geçersiz sayı'
  return errors
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
        {children}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export default function DefterAktarim() {
  const navigate = useNavigate()
  const [values, setValues] = useState<FormValues>(defaultValues)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [saved, setSaved] = useState<Sale | null>(null)
  const refs = useRef<Partial<Record<FieldName, HTMLInputElement | HTMLTextAreaElement | null>>>({})

  const mutation = useMutation({
    mutationFn: createLedgerEntry,
    onSuccess: (sale) => {
      setSaved(sale)
      setValues(defaultValues)
      setErrors({})
      setTimeout(() => refs.current.ledger_page?.focus(), 50)
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const apiErrors = e.response?.data?.errors
      if (apiErrors) {
        const mapped: Partial<Record<FieldName, string>> = {}
        for (const [key, msgs] of Object.entries(apiErrors)) {
          if (FIELDS.includes(key as FieldName)) mapped[key as FieldName] = msgs[0]
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

  const lineInput = (f: FieldName) =>
    `w-full bg-transparent border-0 border-b-2 rounded-none px-0 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-colors ${
      errors[f]
        ? 'border-red-400 focus:border-red-500'
        : 'border-border focus:border-primary'
    }`

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-8 pt-7 pb-5 border-b border-border flex items-center gap-3">
        <BookOpen size={18} className="text-primary shrink-0" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Defter Aktarımı</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Her alanda <kbd className="font-mono text-xs bg-muted border border-border rounded px-1 py-px">Enter</kbd> ile ilerleyin — son alanda kayıt oluşturulur
          </p>
        </div>
      </div>

      {/* Centered content */}
      <div className="flex-1 overflow-auto flex flex-col items-center py-8 px-4">

        {/* Success banner */}
        {saved && (
          <div className="w-full max-w-[680px] mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-800">
                Kaydedildi — {saved.customer?.name ?? 'Müşteri'}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {saved.installment_count} taksit &middot; {formatMoney(saved.total_amount)} &middot; İlk vade {formatDate(saved.first_due_date)}
              </p>
              <button
                onClick={() => navigate(`/musteriler/${saved.customer_id}`)}
                className="mt-1.5 text-xs text-emerald-700 underline"
              >
                Müşteri kartını aç →
              </button>
            </div>
          </div>
        )}

        {/* Main form card */}
        <div className="w-full max-w-[680px] bg-card border border-border rounded-xl shadow-sm overflow-hidden">

          {/* Ledger ID strip */}
          <div className="bg-muted/60 border-b border-border px-6 py-3">
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase mb-2.5">
              Defter Kimliği
            </p>
            <div className="grid grid-cols-3 gap-6">
              {(['ledger_name', 'ledger_page', 'ledger_row'] as const).map((f) => (
                <div key={f}>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    {f === 'ledger_name' ? 'Defter' : f === 'ledger_page' ? 'Sayfa' : 'Satır'}
                    <span className="text-primary ml-0.5">*</span>
                  </label>
                  <input
                    ref={(el) => { refs.current[f] = el }}
                    type={f === 'ledger_name' ? 'text' : 'number'}
                    min={1}
                    value={values[f]}
                    onChange={(e) => set(f, e.target.value)}
                    onKeyDown={(e) => handleKey(e, f)}
                    autoFocus={f === 'ledger_name'}
                    placeholder={f === 'ledger_name' ? 'A' : '1'}
                    className={lineInput(f)}
                  />
                  {errors[f] && <p className="text-[11px] text-red-500 mt-0.5">{errors[f]}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Form body */}
          <div className="px-6 py-5 space-y-5">

            <SectionLabel>Müşteri Bilgileri</SectionLabel>

            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Müşteri Adı <span className="text-primary">*</span>
                </label>
                <input
                  ref={(el) => { refs.current.name = el }}
                  type="text"
                  value={values.name}
                  onChange={(e) => set('name', e.target.value)}
                  onKeyDown={(e) => handleKey(e, 'name')}
                  placeholder="Ad Soyad"
                  className={lineInput('name')}
                />
                {errors.name && <p className="text-[11px] text-red-500 mt-0.5">{errors.name}</p>}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Telefon</label>
                <input
                  ref={(el) => { refs.current.phone = el }}
                  type="text"
                  value={values.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  onKeyDown={(e) => handleKey(e, 'phone')}
                  placeholder="05xx xxx xx xx"
                  className={lineInput('phone')}
                />
              </div>
            </div>

            <SectionLabel>Finansal Bilgiler</SectionLabel>

            <div className="grid grid-cols-3 gap-6">
              {(['total_amount', 'down_payment', 'installment_count'] as const).map((f) => (
                <div key={f}>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    {f === 'total_amount' ? 'Toplam Tutar' : f === 'down_payment' ? 'Peşinat' : 'Taksit Sayısı'}
                    {REQUIRED.has(f) && <span className="text-primary ml-0.5">*</span>}
                  </label>
                  <input
                    ref={(el) => { refs.current[f] = el }}
                    type="number"
                    step={f === 'installment_count' ? '1' : '0.01'}
                    min="0"
                    value={values[f]}
                    onChange={(e) => set(f, e.target.value)}
                    onKeyDown={(e) => handleKey(e, f)}
                    placeholder={f === 'installment_count' ? '12' : '0,00 ₺'}
                    className={lineInput(f)}
                  />
                  {errors[f] && <p className="text-[11px] text-red-500 mt-0.5">{errors[f]}</p>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {(['sale_date', 'first_due_date'] as const).map((f) => (
                <div key={f}>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    {f === 'sale_date' ? 'Satış Tarihi' : 'İlk Vade'}
                    <span className="text-primary ml-0.5">*</span>
                  </label>
                  <input
                    ref={(el) => { refs.current[f] = el }}
                    type="date"
                    value={values[f]}
                    onChange={(e) => set(f, e.target.value)}
                    onKeyDown={(e) => handleKey(e, f)}
                    className={lineInput(f)}
                  />
                  {errors[f] && <p className="text-[11px] text-red-500 mt-0.5">{errors[f]}</p>}
                </div>
              ))}
            </div>

            <SectionLabel>Açıklama</SectionLabel>

            <div>
              <textarea
                ref={(el) => { refs.current.description = el }}
                rows={2}
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
                placeholder="Ürün, not veya açıklama (isteğe bağlı)"
                className={`w-full bg-transparent border-0 border-b-2 rounded-none px-0 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-colors resize-none ${
                  errors.description ? 'border-red-400 focus:border-red-500' : 'border-border focus:border-primary'
                }`}
              />
            </div>

            {mutation.isError && (
              <p className="text-xs text-red-500 -mt-1">Sunucu hatası. Bilgileri kontrol edin.</p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-[11px] text-muted-foreground/60">
                <span className="text-primary">*</span> Zorunlu alanlar
              </p>
              <button
                type="button"
                onClick={submit}
                disabled={mutation.isPending}
                className="bg-primary text-primary-foreground rounded-lg px-6 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
              >
                {mutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
