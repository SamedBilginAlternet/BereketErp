import { api } from '@/lib/api'

export interface Customer {
  id: number
  name: string
  phone: string | null
  address: string | null
  note: string | null
  ledger_name: string | null
  ledger_page: number | null
  ledger_row: number | null
  created_at: string | null
}

export interface CustomerPayload {
  name: string
  phone?: string
  address?: string
  note?: string
  ledger_name?: string
  ledger_page?: number
  ledger_row?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: { current_page: number; last_page: number; total: number; per_page: number }
  links: { first: string; last: string; prev: string | null; next: string | null }
}

export async function getCustomers(search = '', page = 1): Promise<PaginatedResponse<Customer>> {
  const params: Record<string, string | number> = { page }
  if (search) params.search = search
  const { data } = await api.get<PaginatedResponse<Customer>>('/customers', { params })
  return data
}

export async function getCustomer(id: number): Promise<Customer> {
  const { data } = await api.get<{ data: Customer }>(`/customers/${id}`)
  return data.data
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  const { data } = await api.post<{ data: Customer }>('/customers', payload)
  return data.data
}

export async function updateCustomer(id: number, payload: CustomerPayload): Promise<Customer> {
  const { data } = await api.put<{ data: Customer }>(`/customers/${id}`, payload)
  return data.data
}

export async function deleteCustomer(id: number): Promise<void> {
  await api.delete(`/customers/${id}`)
}
