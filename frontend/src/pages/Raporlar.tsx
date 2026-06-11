import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TrendingDown, TrendingUp, Users, AlertTriangle, BarChart3, Phone } from 'lucide-react'
import { getReportSummary, getAgingReport, type AgingBucketItem } from '@/api/reports'
import { formatMoney, formatDate } from '@/lib/format'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = 'default',
}: {
  label: string
  value: string
  sub?: string
  icon: typeof BarChart3
  variant?: 'default' | 'danger' | 'success' | 'warning'
}) {
  const colors = {
    default: 'text-foreground',
    danger:  'text-red-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
  }
  const iconColors = {
    default: 'text-muted-foreground',
    danger:  'text-red-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
  }
  return (
    <div className="border border-border rounded-lg p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon size={16} className={iconColors[variant]} />
      </div>
      <p className={`text-2xl font-bold tabular-nums ${colors[variant]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

const BUCKET_COLOR: Record<string, string> = {
  '1-30':  'text-amber-600 bg-amber-50 border-amber-200',
  '31-60': 'text-orange-600 bg-orange-50 border-orange-200',
  '61-90': 'text-red-500 bg-red-50 border-red-200',
  '90+':   'text-red-700 bg-red-100 border-red-300',
}

function AgingRow({ item }: { item: AgingBucketItem }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <Link
          to={`/musteriler/${item.customer_id}`}
          className="text-sm font-medium text-foreground hover:text-primary hover:underline"
        >
          {item.customer_name}
        </Link>
        {item.phone && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Phone size={10} />{item.phone}
          </p>
        )}
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(item.remaining)}</p>
        <p className="text-xs text-muted-foreground">
          Taksit #{item.sequence} · Vade {formatDate(item.due_date)}
        </p>
        <p className="text-xs text-red-500">{item.days_overdue} gün gecikmiş</p>
      </div>
    </div>
  )
}

export default function Raporlar() {
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null)

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary'],
    queryFn: getReportSummary,
    staleTime: 60_000,
  })

  const { data: aging, isLoading: agingLoading } = useQuery({
    queryKey: ['reports-aging'],
    queryFn: getAgingReport,
    staleTime: 60_000,
  })

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-7 pb-5 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">Raporlar</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tahsilat özeti ve gecikme analizi</p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-8">

        {/* Summary stats */}
        {summaryLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : summary && (
          <div>
            <p className="text-xs font-semibold tracking-widest text-muted-foreground/60 uppercase mb-4">Genel Durum</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                label="Toplam Kalan Borç"
                value={formatMoney(summary.total_remaining_debt)}
                sub="Tüm aktif taksitler"
                icon={TrendingDown}
                variant="default"
              />
              <StatCard
                label="Gecikmiş Tutar"
                value={formatMoney(summary.overdue_total)}
                sub={`${summary.overdue_count} taksit`}
                icon={AlertTriangle}
                variant="danger"
              />
              <StatCard
                label="Bu Ay Tahsilat"
                value={formatMoney(summary.collected_this_month)}
                sub="Bu ay ödeme alınan toplam"
                icon={TrendingUp}
                variant="success"
              />
              <StatCard
                label="Toplam Tahsilat"
                value={formatMoney(summary.collected_all_time)}
                sub="Tüm zamanlar"
                icon={BarChart3}
                variant="success"
              />
              <StatCard
                label="Aktif Müşteri"
                value={String(summary.active_customers)}
                sub="Ödenmemiş taksiti olan"
                icon={Users}
                variant="default"
              />
            </div>
          </div>
        )}

        {/* Aging analysis */}
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground/60 uppercase mb-4">Gecikme Analizi</p>

          {agingLoading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : aging && (
            <div className="space-y-3">
              {aging.map((bucket) => {
                const isExpanded = expandedBucket === bucket.bucket
                const colorClass = BUCKET_COLOR[bucket.bucket] ?? 'text-muted-foreground bg-muted border-border'

                return (
                  <div key={bucket.bucket} className="border border-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedBucket(isExpanded ? null : bucket.bucket)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${colorClass}`}>
                          {bucket.bucket} gün
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {bucket.count} taksit
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold tabular-nums text-foreground">
                          {formatMoney(bucket.total)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {isExpanded && bucket.items.length > 0 && (
                      <div className="border-t border-border px-5 py-2 bg-muted/20 max-h-80 overflow-y-auto">
                        {bucket.items.map((item, i) => (
                          <AgingRow key={i} item={item} />
                        ))}
                      </div>
                    )}

                    {isExpanded && bucket.items.length === 0 && (
                      <div className="border-t border-border px-5 py-4 bg-muted/20">
                        <p className="text-xs text-muted-foreground text-center">Bu kategoride kayıt yok.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
