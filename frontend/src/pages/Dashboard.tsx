import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Phone } from 'lucide-react'
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
        <Link to={`/musteriler/${row.original.customer_id}`} className="font-medium text-foreground hover:text-primary hover:underline">
          {row.original.customer_name}
        </Link>
        {row.original.phone && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Phone size={10} />{row.original.phone}
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'sequence',
    header: 'Taksit',
    cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground text-xs">#{getValue() as number}</span>,
  },
  {
    accessorKey: 'remaining',
    header: 'Kalan',
    cell: ({ getValue }) => <span className="tabular-nums font-semibold">{formatMoney(getValue() as string)}</span>,
  },
  {
    accessorKey: 'due_date',
    header: 'Vade',
    cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{formatDate(getValue() as string)}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Durum',
    cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
  },
]

type Bucket = 'overdue' | 'today' | 'tomorrow'

const TABS: { key: Bucket; label: string; dot: string }[] = [
  { key: 'overdue',  label: 'Gecikmiş',           dot: 'bg-red-500' },
  { key: 'today',   label: 'Bugün Vadesi Gelen',  dot: 'bg-amber-400' },
  { key: 'tomorrow',label: 'Yarın Vadesi Gelen',  dot: 'bg-sky-400' },
]

export default function Dashboard() {
  const [active, setActive] = useState<Bucket>('overdue')

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-daily'],
    queryFn: getDailyDashboard,
    refetchInterval: 60_000,
  })

  const counts: Record<Bucket, number> = {
    overdue:  data?.overdue_count ?? 0,
    today:    data?.due_today_count ?? 0,
    tomorrow: data?.due_tomorrow_count ?? 0,
  }

  const items: Record<Bucket, DashboardBucketItem[]> = {
    overdue:  data?.overdue ?? [],
    today:    data?.due_today ?? [],
    tomorrow: data?.due_tomorrow ?? [],
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-8 pt-7 pb-5 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">Panel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Günlük taksit özeti</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border px-8 flex gap-1">
        {TABS.map(({ key, label, dot }) => {
          const count = counts[key]
          const isActive = active === key
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot} ${!isActive && 'opacity-50'}`} />
              {label}
              <span className={`tabular-nums text-xs rounded-full px-2 py-0.5 ${
                isActive ? 'bg-foreground/8 text-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : (
          <DataTable
            data={items[active]}
            columns={bucketColumns}
            searchPlaceholder="Müşteri adı ile ara…"
            searchColumn="customer_name"
            pageSize={15}
            emptyText="Bu kategoride kayıt yok."
          />
        )}
      </div>
    </div>
  )
}
