import { api } from '@/lib/api'

export interface CallTask {
  id: number
  task_date: string
  priority: 1 | 2 | 3
  status: 'pending' | 'done' | 'promised' | 'unreachable' | 'postponed'
  customer_id: number
  customer_name: string
  phone: string | null
  ledger_name: string | null
  ledger_page: number | null
  ledger_row: number | null
  installment_id: number
  sequence: number
  amount: string
  paid_amount: string
  remaining: string
  due_date: string
  inst_status: string
  last_log: CallLog | null
}

export interface CallLog {
  id: number
  call_task_id: number
  outcome: 'reached_paid' | 'reached_promised' | 'unreachable' | 'postponed'
  promise_date: string | null
  promise_amount: string | null
  note: string | null
  called_at: string
}

export interface CallLogPayload {
  outcome: CallLog['outcome']
  promise_date?: string
  promise_amount?: number
  note?: string
  called_at?: string
}

export interface TimelineEvent {
  type: 'sale' | 'payment' | 'call'
  date: string
  title: string
  detail: string
  sale_id?: number
}

export async function getCallTasks(date?: string): Promise<CallTask[]> {
  const { data } = await api.get<{ data: CallTask[] }>('/call-tasks', {
    params: date ? { date } : {},
  })
  return data.data
}

export async function logCall(taskId: number, payload: CallLogPayload): Promise<CallLog> {
  const { data } = await api.post<{ data: CallLog }>(`/call-tasks/${taskId}/log`, payload)
  return data.data
}

export async function getTimeline(customerId: number): Promise<TimelineEvent[]> {
  const { data } = await api.get<{ data: TimelineEvent[] }>(`/customers/${customerId}/timeline`)
  return data.data
}
