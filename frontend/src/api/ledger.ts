import { api } from '@/lib/api'
import type { Sale } from './sales'

export interface LedgerEntryPayload {
  ledger_name: string
  ledger_page: number
  ledger_row: number
  name: string
  phone?: string
  tc_kimlik?: string
  description?: string
  total_amount: number
  down_payment: number
  installment_count: number
  sale_date: string
  first_due_date: string
}

export async function createLedgerEntry(payload: LedgerEntryPayload): Promise<Sale> {
  const { data } = await api.post<{ data: Sale }>('/ledger/entry', payload)
  return data.data
}
