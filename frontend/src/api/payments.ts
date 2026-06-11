import { api } from '@/lib/api'

export interface PaymentPayload {
  amount: number
  paid_at: string
  note?: string
}

export interface PaymentRecord {
  id: number
  installment_id: number
  amount: string
  paid_at: string
  note: string | null
  created_at: string
}

export interface CustomerBalance {
  total_debt: string
  remaining_installments: number
  next_payment_amount: string | null
  next_due_date: string | null
}

export interface DashboardBucketItem {
  customer_id: number
  customer_name: string
  phone: string | null
  installment_id: number
  sequence: number
  amount: string
  paid_amount: string
  remaining: string
  due_date: string
  status: string
}

export interface DailyDashboard {
  due_today_count: number
  overdue_count: number
  due_tomorrow_count: number
  due_today: DashboardBucketItem[]
  overdue: DashboardBucketItem[]
  due_tomorrow: DashboardBucketItem[]
}

export async function getCustomerBalance(customerId: number): Promise<CustomerBalance> {
  const { data } = await api.get<{ data: CustomerBalance }>(`/customers/${customerId}/balance`)
  return data.data
}

export async function recordPayment(installmentId: number, payload: PaymentPayload): Promise<PaymentRecord> {
  const { data } = await api.post<{ data: PaymentRecord }>(
    `/installments/${installmentId}/payments`,
    payload,
  )
  return data.data
}

export async function getDailyDashboard(): Promise<DailyDashboard> {
  const { data } = await api.get<{ data: DailyDashboard }>('/dashboard/daily')
  return data.data
}
