import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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

function StatCard({
  label,
  count,
  accent,
  active,
  onClick,
}: {
  label: string
  count: number
  accent: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg border p-5 text-left transition-colors ${
        active ? accent : 'bg-card border-border hover:bg-muted/40'
      }`}
    >
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-3xl font-bold tabular-nums text-foreground">{count}</p>
      <p className="text-xs text-muted-foreground mt-1">taksit</p>
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
            <StatCard
              label="Bugün Vadesi Gelen"
              count={data.due_today_count}
              accent="bg-amber-50 border-amber-200"
              active={open === 'today'}
              onClick={() => toggle('today')}
            />
            <StatCard
              label="Gecikmiş"
              count={data.overdue_count}
              accent="bg-red-50 border-red-200"
              active={open === 'overdue'}
              onClick={() => toggle('overdue')}
            />
            <StatCard
              label="Yarın Vadesi Gelen"
              count={data.due_tomorrow_count}
              accent="bg-sky-50 border-sky-200"
              active={open === 'tomorrow'}
              onClick={() => toggle('tomorrow')}
            />
          </div>

          {open === 'today' && (
            <div className="border border-amber-200 rounded-lg overflow-hidden mb-4">
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                <span className="text-xs font-medium text-amber-800">Bugün Vadesi Gelen</span>
              </div>
              <BucketTable items={data.due_today} />
            </div>
          )}
          {open === 'overdue' && (
            <div className="border border-red-200 rounded-lg overflow-hidden mb-4">
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-200">
                <span className="text-xs font-medium text-red-800">Gecikmiş Taksitler</span>
              </div>
              <BucketTable items={data.overdue} />
            </div>
          )}
          {open === 'tomorrow' && (
            <div className="border border-sky-200 rounded-lg overflow-hidden mb-4">
              <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-200">
                <span className="text-xs font-medium text-sky-800">Yarın Vadesi Gelen</span>
              </div>
              <BucketTable items={data.due_tomorrow} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
