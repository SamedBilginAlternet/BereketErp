import { api } from '@/lib/api'

export interface ReportSummary {
  total_remaining_debt: string
  overdue_total: string
  overdue_count: number
  collected_this_month: string
  collected_all_time: string
  active_customers: number
}

export interface AgingBucketItem {
  customer_id: number
  customer_name: string
  phone: string | null
  sequence: number
  due_date: string
  remaining: string
  days_overdue: number
}

export interface AgingBucket {
  bucket: string
  count: number
  total: string
  items: AgingBucketItem[]
}

export async function getReportSummary(): Promise<ReportSummary> {
  const { data } = await api.get<{ data: ReportSummary }>('/reports/summary')
  return data.data
}

export async function getAgingReport(): Promise<AgingBucket[]> {
  const { data } = await api.get<{ data: AgingBucket[] }>('/reports/aging')
  return data.data
}
