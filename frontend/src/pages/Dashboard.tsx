import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { AlertCircle, CalendarClock, CalendarCheck, ChevronDown, ChevronUp, Phone } from 'lucide-react'
import { getDailyDashboard, type DashboardBucketItem } from '@/api/payments'
import { formatMoney, formatDate } from '@/lib/format'
import StatusBadge from '@/components/StatusBadge'
import { DataTable } from '@/components/DataTable'

const bucketColumns: ColumnDef<DashboardBucketItem, unknown>[] = [
  {
    accessorKey: 'customer_name',
    header: 'Müşteri',
    cell: ({ row }) => (
      <div>
        <Link
          to={`/musteriler/${row.original.customer_id}`}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {row.original.customer_name}
        </Link>
        {row.original.phone && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums mt-0.5">
            <Phone size={10} />{row.original.phone}
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'sequence',
    header: 'Taksit',
    cell: ({ getValue }) => (
      <span className="tabular-nums text-muted-foreground text-xs">#{getValue() as number}</span>
    ),
  },
  {
    accessorKey: 'remaining',
    header: 'Kalan',
    cell: ({ getValue }) => (
      <span className="tabular-nums font-medium">{formatMoney(getValue() as string)}</span>
    ),
  },
  {
    accessorKey: 'due_date',
    header: 'Vade',
    cell: ({ getValue }) => (
      <span className="tabular-nums text-muted-foreground">{formatDate(getValue() as string)}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Durum',
    cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
  },
]

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
      className={`flex-1 rounded-lg border p-5 text-left transition-all ${active ? cfg.accent : 'bg-card border-border hover:bg-muted/40'}`}
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
    <div className="p-6 max-w-4xl">
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
            const Icon = cfg.icon
            const items = bucket === 'today' ? data.due_today : bucket === 'overdue' ? data.overdue : data.due_tomorrow
            return (
              <div key={bucket} className={`border rounded-lg overflow-hidden mb-4 ${cfg.accent}`}>
                <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${cfg.headerBg} ${cfg.accent.split(' ')[1]}`}>
                  <Icon size={14} className={cfg.iconColor} />
                  <span className={`text-xs font-medium ${cfg.headerText}`}>{cfg.label}</span>
                </div>
                <div className="bg-card p-4">
                  <DataTable
                    data={items}
                    columns={bucketColumns}
                    searchPlaceholder="Müşteri adı ile ara…"
                    searchColumn="customer_name"
                    pageSize={10}
                    emptyText="Kayıt yok."
                  />
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
