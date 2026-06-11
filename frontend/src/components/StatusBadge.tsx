type Status = 'pending' | 'partial' | 'paid' | 'overdue' | string

const config: Record<string, { label: string; className: string }> = {
  pending: { label: 'Bekliyor', className: 'bg-muted text-muted-foreground' },
  partial: { label: 'Kısmi', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  paid: { label: 'Ödendi', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  overdue: { label: 'Gecikmiş', className: 'bg-red-50 text-red-700 border border-red-200' },
}

export default function StatusBadge({ status }: { status: Status }) {
  const { label, className } = config[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
