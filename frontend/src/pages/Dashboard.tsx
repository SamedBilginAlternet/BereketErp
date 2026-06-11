import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CalendarClock, CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { getDailyDashboard, type DashboardBucketItem } from '@/api/payments'
import { formatMoney, formatDate } from '@/lib/format'
import StatusBadge from '@/components/StatusBadge'

function BucketTable({ items }: { items: DashboardBucketItem[] }) {
  if (!items.length) {
    return <p className="px-4 pb-4 text-xs text-muted-foreground">Kayıt yok.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-t border-border">
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Müşteri</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Taksit</th>
          <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Kalan</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Vade</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Durum</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.installment_id} className="border-t border-border">
            <td className="px-4 py-2.5">
              <Link
                to={`/musteriler/${item.customer_id}`}
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                {item.customer_name}
              </Link>
              {item.phone && (
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {item.phone}
                </span>
              )}
            </td>
            <td className="px-4 py-2.5 tabular-nums text-muted-foreground text-xs">
              #{item.sequence}
            </td>
            <td className="px-4 py-2.5 tabular-nums text-right font-medium">
              {formatMoney(item.remaining)}
            </td>
            <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
              {formatDate(item.due_date)}
            </td>
            <td className="px-4 py-2.5">
              <StatusBadge status={item.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type Bucket = 'today' | 'overdue' | 'tomorrow'

const BUCKET_CONFIG = {
  today: {
    label: 'Bugün Vadesi Gelen',
    icon: CalendarCheck,
    accent: 'bg-amber-50 border-amber-200',
    headerBg: 'bg-amber-50 border-amber-200',
    headerText: 'text-amber-800',
    iconColor: 'text-amber-500',
  },
  overdue: {
    label: 'Gecikmiş',
    icon: AlertCircle,
    accent: 'bg-red-50 border-red-200',
    headerBg: 'bg-red-50 border-red-200',
    headerText: 'text-red-800',
    iconColor: 'text-red-500',
  },
  tomorrow: {
    label: 'Yarın Vadesi Gelen',
    icon: CalendarClock,
    accent: 'bg-sky-50 border-sky-200',
    headerBg: 'bg-sky-50 border-sky-200',
    headerText: 'text-sky-800',
    iconColor: 'text-sky-500',
  },
} as const

function StatCard({
  bucket,
  count,
  active,
  onClick,
}: {
  bucket: Bucket
  count: number
  active: boolean
  onClick: () => void
}) {
  const cfg = BUCKET_CONFIG[bucket]
  const Icon = cfg.icon
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border p-5 text-left transition-all ${
        active ? cfg.accent : 'bg-card border-border hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <Icon size={18} className={active ? cfg.iconColor : 'text-muted-foreground'} />
        {active ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">{count}</p>
      <p className="text-xs text-muted-foreground mt-1">{cfg.label}</p>
    </button>
  )
}

export default function Dashboard() {
  const [open, setOpen] = useState<Bucket | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-daily'],
    queryFn: getDailyDashboard,
    refetchInterval: 60_000,
  })

  function toggle(bucket: Bucket) {
    setOpen((prev) => (prev === bucket ? null : bucket))
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-lg font-semibold text-foreground mb-5">Panel</h1>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : (
        <>
          <div className="flex gap-3 mb-5">
            <StatCard bucket="today" count={data.due_today_count} active={open === 'today'} onClick={() => toggle('today')} />
            <StatCard bucket="overdue" count={data.overdue_count} active={open === 'overdue'} onClick={() => toggle('overdue')} />
            <StatCard bucket="tomorrow" count={data.due_tomorrow_count} active={open === 'tomorrow'} onClick={() => toggle('tomorrow')} />
          </div>

          {(['today', 'overdue', 'tomorrow'] as const).map((bucket) => {
            if (open !== bucket) return null
            const cfg = BUCKET_CONFIG[bucket]
            const items = bucket === 'today' ? data.due_today : bucket === 'overdue' ? data.overdue : data.due_tomorrow
            const Icon = cfg.icon
            return (
              <div key={bucket} className={`border rounded-lg overflow-hidden mb-4 ${cfg.accent}`}>
                <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${cfg.headerBg} ${cfg.accent.split(' ')[1]}`}>
                  <Icon size={14} className={cfg.iconColor} />
                  <span className={`text-xs font-medium ${cfg.headerText}`}>{cfg.label}</span>
                </div>
                <div className="bg-card">
                  <BucketTable items={items} />
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
