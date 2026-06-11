import { api } from '@/lib/api'
import type { Customer } from './customers'

export interface Installment {
  id: number
  sale_id: number
  sequence: number
  amount: string
  paid_amount: string
  remaining: string
  due_date: string
  status: 'pending' | 'partial' | 'paid' | 'overdue'
}

export interface Sale {
  id: number
  customer_id: number
  customer?: Pick<Customer, 'id' | 'name'>
  description: string | null
  total_amount: string
  down_payment: string
  financed_amount: string
  installment_count: number
  sale_date: string
  first_due_date: string
  installments: Installment[]
  created_at: string | null
}

export interface SalePayload {
  customer_id: number
  description?: string
  total_amount: number
  down_payment: number
  installment_count: number
  sale_date: string
  first_due_date: string
  amounts?: string[]
}

export interface PreviewRow {
  sequence: number
  amount: string
  due_date: string
}

export async function previewInstallments(
  totalAmount: number,
  downPayment: number,
  installmentCount: number,
  firstDueDate: string,
  amounts?: string[],
): Promise<PreviewRow[]> {
  const { data } = await api.post<{ data: PreviewRow[] }>('/sales/preview', {
    total_amount: totalAmount,
    down_payment: downPayment,
    installment_count: installmentCount,
    first_due_date: firstDueDate,
    ...(amounts ? { amounts } : {}),
  })
  return data.data
}

export async function createSale(payload: SalePayload): Promise<Sale> {
  const { data } = await api.post<{ data: Sale }>('/sales', payload)
  return data.data
}

export async function getSale(id: number): Promise<Sale> {
  const { data } = await api.get<{ data: Sale }>(`/sales/${id}`)
  return data.data
}

export async function getCustomerSales(customerId: number): Promise<Sale[]> {
  const { data } = await api.get<{ data: Sale[] }>('/sales', {
    params: { customer_id: customerId, per_page: 100 },
  })
  return data.data
}
