import { useRef, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, UserCheck } from 'lucide-react'
import { createLedgerEntry } from '@/api/ledger'
import { getCustomer } from '@/api/customers'
import { formatMoney, formatDate } from '@/lib/format'
import type { Sale } from '@/api/sales'

const today = new Date().toISOString().slice(0, 10)

type FieldName =
  | 'ledger_name'
  | 'ledger_page'
  | 'ledger_row'
  | 'name'
  | 'phone'
  | 'tc_kimlik'
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
  'tc_kimlik',
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
  tc_kimlik: '',
  total_amount: '',
  down_payment: '0',
  installment_count: '',
  sale_date: today,
  first_due_date: '',
  description: '',
}

function validate(values: FormValues, skipCustomerFields = false): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {}
  const customerFields: FieldName[] = ['ledger_name', 'ledger_page', 'ledger_row', 'name']
  for (const f of REQUIRED) {
    if (skipCustomerFields && customerFields.includes(f)) continue
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
  if (values.tc_kimlik && !/^\d{11}$/.test(values.tc_kimlik))
    errors.tc_kimlik = '11 rakam olmalıdır'
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

interface InstallmentRow {
  amount: string
  due_date: string
  paid: boolean
  paid_at: string
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function buildEqualRows(total: number, down: number, count: number, firstDueDate: string): InstallmentRow[] {
  const financedCents = Math.round((total - down) * 100)
  const baseCents = Math.floor(financedCents / count)
  const remainder = financedCents - baseCents * count
  const rows: InstallmentRow[] = []
  for (let i = 0; i < count; i++) {
    const cents = i === count - 1 ? baseCents + remainder : baseCents
    rows.push({
      amount: (cents / 100).toFixed(2),
      due_date: addMonths(firstDueDate, i),
      paid: false,
      paid_at: '',
    })
  }
  return rows
}

export default function DefterAktarim() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillId = searchParams.get('customer_id') ? Number(searchParams.get('customer_id')) : null

  const [values, setValues] = useState<FormValues>(defaultValues)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [saved, setSaved] = useState<Sale | null>(null)
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([])
  const refs = useRef<Partial<Record<FieldName, HTMLInputElement | HTMLTextAreaElement | null>>>({})

  const { data: prefillCustomer } = useQuery({
    queryKey: ['customer', prefillId],
    queryFn: () => getCustomer(prefillId!),
    enabled: prefillId !== null,
  })

  useEffect(() => {
    if (!prefillCustomer) return
    setValues((v) => ({
      ...v,
      name: prefillCustomer.name,
      phone: prefillCustomer.phone ?? '',
      tc_kimlik: prefillCustomer.tc_kimlik ?? '',
      ledger_name: prefillCustomer.ledger_name ?? v.ledger_name,
      ledger_page: prefillCustomer.ledger_page ? String(prefillCustomer.ledger_page) : v.ledger_page,
      ledger_row: prefillCustomer.ledger_row ? String(prefillCustomer.ledger_row) : v.ledger_row,
    }))
  }, [prefillCustomer])

  // Auto-compute installment rows when the 4 key fields change
  useEffect(() => {
    const total = Number(values.total_amount)
    const down = Number(values.down_payment || '0')
    const count = Number(values.installment_count)
    const firstDue = values.first_due_date

    if (!values.total_amount || !values.installment_count || !firstDue) return
    if (isNaN(total) || isNaN(down) || isNaN(count) || count < 1) return
    if (total <= 0) return

    // Only auto-populate if count changed (or rows are empty)
    if (installmentRows.length !== count) {
      setInstallmentRows(buildEqualRows(total, down, count, firstDue))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.total_amount, values.down_payment, values.installment_count, values.first_due_date])

  function resetToEqual() {
    const total = Number(values.total_amount)
    const down = Number(values.down_payment || '0')
    const count = Number(values.installment_count)
    const firstDue = values.first_due_date
    if (!total || !count || !firstDue || isNaN(total) || isNaN(count) || count < 1) return
    setInstallmentRows(buildEqualRows(total, down, count, firstDue))
  }

  const financedAmount = (() => {
    const t = Number(values.total_amount || '0')
    const d = Number(values.down_payment || '0')
    return isNaN(t) || isNaN(d) ? 0 : Math.max(0, t - d)
  })()

  const rowsSum = installmentRows.reduce((acc, r) => {
    const v = parseFloat(r.amount)
    return acc + (isNaN(v) ? 0 : v)
  }, 0)

  const diff = Math.round((rowsSum - financedAmount) * 100) / 100

  const mutation = useMutation({
    mutationFn: createLedgerEntry,
    onSuccess: (sale) => {
      setSaved(sale)
      setValues(defaultValues)
      setErrors({})
      setInstallmentRows([])
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
    const errs = validate(values, prefillId !== null)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const firstErr = FIELDS.find((f) => errs[f])
      if (firstErr) refs.current[firstErr]?.focus()
      return
    }

    const paidInstallments = installmentRows
      .map((r, i) => ({ sequence: i + 1, paid: r.paid, paid_at: r.paid_at }))
      .filter((r) => r.paid && r.paid_at)
      .map((r) => ({ sequence: r.sequence, paid_at: r.paid_at }))

    mutation.mutate({
      ...(prefillId ? { customer_id: prefillId } : {
        ledger_name: values.ledger_name.trim(),
        ledger_page: Number(values.ledger_page),
        ledger_row: Number(values.ledger_row),
        name: values.name.trim(),
      }),
      // Always pass ledger coords so backend can update existing customer record
      ...(!prefillId ? {} : {
        ledger_name: values.ledger_name.trim() || undefined,
        ledger_page: values.ledger_page ? Number(values.ledger_page) : undefined,
        ledger_row: values.ledger_row ? Number(values.ledger_row) : undefined,
      }),
      phone: values.phone.trim() || undefined,
      tc_kimlik: values.tc_kimlik.trim() || undefined,
      description: values.description.trim() || undefined,
      total_amount: Number(values.total_amount),
      down_payment: Number(values.down_payment || '0'),
      installment_count: Number(values.installment_count),
      sale_date: values.sale_date,
      first_due_date: values.first_due_date,
      ...(installmentRows.length > 0 ? { amounts: installmentRows.map((r) => r.amount) } : {}),
      ...(paidInstallments.length > 0 ? { paid_installments: paidInstallments } : {}),
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

      {/* Two-column layout */}
      <div className="flex-1 overflow-auto flex">

        {/* Left — form */}
        <div className="flex-1 min-w-0 overflow-auto flex flex-col items-center py-8 px-4">

          {/* Prefill banner */}
          {prefillCustomer && !saved && (
            <div className="w-full max-w-[620px] mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4 flex items-start gap-3">
              <UserCheck size={16} className="text-sky-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-sky-800">
                  Mevcut müşteri: {prefillCustomer.name}
                </p>
                <p className="text-xs text-sky-700 mt-0.5">
                  Bu kayıt mevcut müşteriye yeni bir senet/taksit planı olarak eklenecek.
                </p>
              </div>
            </div>
          )}

          {/* Success banner */}
          {saved && (
            <div className="w-full max-w-[620px] mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
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
          <div className="w-full max-w-[620px] bg-card border border-border rounded-xl shadow-sm overflow-hidden">

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

              <div>
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
              <div className="grid grid-cols-2 gap-6">
                <div>
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
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">TC Kimlik No</label>
                  <input
                    ref={(el) => { refs.current.tc_kimlik = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    value={values.tc_kimlik}
                    onChange={(e) => set('tc_kimlik', e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => handleKey(e, 'tc_kimlik')}
                    placeholder="11 rakam"
                    className={lineInput('tc_kimlik')}
                  />
                  {errors.tc_kimlik && <p className="text-[11px] text-red-500 mt-0.5">{errors.tc_kimlik}</p>}
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
                  disabled={mutation.isPending || (installmentRows.length > 0 && diff !== 0)}
                  className="bg-primary text-primary-foreground rounded-lg px-6 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
                >
                  {mutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right — installment plan panel */}
        <div className={`w-96 shrink-0 border-l border-border flex flex-col ${installmentRows.length > 0 ? 'bg-card' : 'bg-muted/20'}`}>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Taksit Planı</p>
            {installmentRows.length > 0 && (
              <button
                type="button"
                onClick={resetToEqual}
                className="text-xs text-primary hover:underline"
              >
                Eşit Dağıt
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {installmentRows.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                  <span className="text-lg text-muted-foreground">₺</span>
                </div>
                <p className="text-sm text-muted-foreground">Taksit sayısı ve vade girilince plan burada görünür.</p>
              </div>
            )}

            {installmentRows.length > 0 && (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground w-8">#</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Vade</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-medium text-muted-foreground">Tutar (₺)</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-medium text-muted-foreground w-10">✓</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installmentRows.map((row, idx) => (
                      <>
                        <tr key={idx} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 tabular-nums text-muted-foreground text-xs">{idx + 1}</td>
                          <td className="px-3 py-2 tabular-nums text-xs">{formatDate(row.due_date)}</td>
                          <td className="px-3 py-1.5 text-right">
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
                              className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.paid}
                              onChange={(e) => {
                                const newRows = [...installmentRows]
                                newRows[idx] = { ...newRows[idx], paid: e.target.checked, paid_at: e.target.checked ? today : '' }
                                setInstallmentRows(newRows)
                              }}
                              className="accent-primary"
                            />
                          </td>
                        </tr>
                        {row.paid && (
                          <tr key={`${idx}-paid`} className="bg-emerald-50/60 border-t border-emerald-100">
                            <td colSpan={4} className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-emerald-700 shrink-0">Ödeme tarihi:</span>
                                <input
                                  type="date"
                                  value={row.paid_at}
                                  onChange={(e) => {
                                    const newRows = [...installmentRows]
                                    newRows[idx] = { ...newRows[idx], paid_at: e.target.value }
                                    setInstallmentRows(newRows)
                                  }}
                                  className="flex-1 rounded border border-emerald-200 bg-white px-2 py-0.5 text-xs text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>

                <div className={`px-4 py-3 border-t border-border text-xs font-semibold sticky bottom-0 bg-card ${diff !== 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  <div className="flex items-center justify-between">
                    <span>Toplam</span>
                    <span className="tabular-nums">{formatMoney(rowsSum.toFixed(2))}</span>
                  </div>
                  {diff !== 0 && (
                    <p className="text-xs mt-0.5 font-normal">
                      Fark: {diff > 0 ? '+' : ''}{formatMoney(diff.toFixed(2))} — tutarları düzeltin
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
