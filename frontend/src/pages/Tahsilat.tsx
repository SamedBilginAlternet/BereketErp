import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, CheckCircle2, Clock, PhoneOff, CalendarClock, History, PhoneCall } from 'lucide-react'
import {
  getCallTasks,
  getTimeline,
  logCall,
  type CallTask,
  type CallLogPayload,
} from '@/api/callTasks'
import { formatMoney, formatDate } from '@/lib/format'
import StatusBadge from '@/components/StatusBadge'

const PRIORITY_LABEL: Record<number, string> = {
  1: 'Gecikmiş',
  2: 'Bugün',
  3: 'Yarın',
}

const PRIORITY_COLOR: Record<number, string> = {
  1: 'text-red-600',
  2: 'text-amber-600',
  3: 'text-sky-600',
}

const TASK_STATUS_COLOR: Record<string, string> = {
  pending: 'text-muted-foreground',
  done: 'text-emerald-600',
  promised: 'text-amber-600',
  unreachable: 'text-red-500',
  postponed: 'text-sky-600',
}

const TASK_STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor',
  done: 'Tamamlandı',
  promised: 'Söz Alındı',
  unreachable: 'Ulaşılamadı',
  postponed: 'Ertelendi',
}

function OutcomePanel({
  task,
  onDone,
}: {
  task: CallTask
  onDone: () => void
}) {
  const qc = useQueryClient()
  const [outcome, setOutcome] = useState<CallLogPayload['outcome'] | ''>('')
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (payload: CallLogPayload) => logCall(task.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call-tasks'] })
      onDone()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e.response?.data?.message ?? 'Bir hata oluştu.')
    },
  })

  function submit() {
    if (!outcome) { setError('Sonuç seçin.'); return }
    if (outcome === 'reached_promised' && !promiseDate) {
      setError('Söz tarihi gerekli.')
      return
    }
    const payload: CallLogPayload = { outcome }
    if (outcome === 'reached_promised') {
      payload.promise_date = promiseDate
      if (promiseAmount) payload.promise_amount = Number(promiseAmount)
    }
    if (note) payload.note = note
    mutation.mutate(payload)
  }

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Arama Sonucu</p>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { val: 'reached_paid', label: 'Ödeme Aldım', icon: CheckCircle2, color: 'text-emerald-600' },
            { val: 'reached_promised', label: 'Söz Aldım', icon: CalendarClock, color: 'text-amber-600' },
            { val: 'unreachable', label: 'Ulaşamadım', icon: PhoneOff, color: 'text-red-500' },
            { val: 'postponed', label: 'Ertele', icon: Clock, color: 'text-sky-600' },
          ] as const
        ).map(({ val, label, icon: Icon, color }) => (
          <button
            key={val}
            type="button"
            onClick={() => { setOutcome(val); setError('') }}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              outcome === val
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted'
            }`}
          >
            <Icon size={14} className={outcome === val ? '' : color} />
            {label}
          </button>
        ))}
      </div>

      {outcome === 'reached_promised' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Söz Tarihi *
            </label>
            <input
              type="date"
              value={promiseDate}
              onChange={(e) => setPromiseDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Söz Tutarı (₺)
            </label>
            <input
              type="number"
              step="0.01"
              value={promiseAmount}
              onChange={(e) => setPromiseAmount(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Not</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md bg-muted text-foreground px-3 py-1.5 text-sm hover:bg-border transition-colors"
        >
          Kapat
        </button>
        <button
          type="button"
          disabled={!outcome || mutation.isPending}
          onClick={submit}
          className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {mutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}

function TimelinePanel({ customerId }: { customerId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['timeline', customerId],
    queryFn: () => getTimeline(customerId),
  })

  if (isLoading) return <p className="text-xs text-muted-foreground">Yükleniyor…</p>
  if (!data?.length) return <p className="text-xs text-muted-foreground">Kayıt yok.</p>

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {data.map((ev, i) => (
        <div key={i} className="flex gap-3 text-xs">
          <span className="tabular-nums text-muted-foreground shrink-0 w-20">{formatDate(ev.date)}</span>
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
            {ev.detail && <span className="text-muted-foreground ml-1">— {ev.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function TaskCard({ task }: { task: CallTask }) {
  const [expanded, setExpanded] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-xs font-medium ${PRIORITY_COLOR[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            <span className={`text-xs ${TASK_STATUS_COLOR[task.status]}`}>
              {TASK_STATUS_LABEL[task.status]}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            <Link to={`/musteriler/${task.customer_id}`} className="hover:underline">
              {task.customer_name}
            </Link>
          </p>
          {task.phone && (
            <p className="text-xs text-muted-foreground tabular-nums">
              <Phone size={11} className="inline mr-0.5" />
              <a href={`tel:${task.phone}`} className="hover:underline">
                {task.phone}
              </a>
            </p>
          )}
          {task.ledger_name && (
            <p className="text-xs text-muted-foreground">
              Defter: {task.ledger_name}/{task.ledger_page}/{task.ledger_row}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatMoney(task.remaining)}
          </p>
          <p className="text-xs text-muted-foreground">Taksit #{task.sequence}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            Vade: {formatDate(task.due_date)}
          </p>
          <StatusBadge status={task.inst_status} />
        </div>
      </div>

      {task.last_log && (
        <p className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">
          Son arama: {formatDate(task.last_log.called_at.slice(0, 10))} —{' '}
          {task.last_log.outcome === 'reached_paid'
            ? 'Ödeme alındı'
            : task.last_log.outcome === 'reached_promised'
              ? `Söz alındı (${task.last_log.promise_date ? formatDate(task.last_log.promise_date) : ''})`
              : task.last_log.outcome === 'unreachable'
                ? 'Ulaşılamadı'
                : 'Ertelendi'}
        </p>
      )}

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => { setExpanded((v) => !v); setShowTimeline(false) }}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <PhoneCall size={12} />{expanded ? 'Kapat' : 'Arama Yap'}
        </button>
        <button
          type="button"
          onClick={() => { setShowTimeline((v) => !v); setExpanded(false) }}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
        >
          <History size={12} />{showTimeline ? 'Geçmişi Kapat' : 'Geçmiş'}
        </button>
      </div>

      {expanded && (
        <OutcomePanel task={task} onDone={() => setExpanded(false)} />
      )}
      {showTimeline && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Müşteri Geçmişi</p>
          <TimelinePanel customerId={task.customer_id} />
        </div>
      )}
    </div>
  )
}

export default function Tahsilat() {
  const { data, isLoading } = useQuery({
    queryKey: ['call-tasks'],
    queryFn: () => getCallTasks(),
    refetchInterval: 120_000,
  })

  const pending = data?.filter((t) => t.status === 'pending') ?? []
  const done = data?.filter((t) => t.status !== 'pending') ?? []

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-7 pb-5 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">Tahsilat</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Bugünün arama listesi</p>
      </div>
      <div className="flex-1 overflow-auto px-8 py-6">

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : !data?.length ? (
        <div className="border border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">Bugün için arama görevi yok.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Komut: <code className="font-mono bg-muted px-1 rounded">php artisan app:generate-call-tasks</code>
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">
                Bekleyen ({pending.length})
              </p>
              <div className="space-y-3">
                {pending.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">
                Tamamlanan / Diğer ({done.length})
              </p>
              <div className="space-y-3">
                {done.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
