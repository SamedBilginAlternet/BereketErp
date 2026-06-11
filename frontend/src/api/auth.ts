import type { AxiosError } from 'axios'
import { api } from '@/lib/api'

export interface User {
  id: number
  name: string
  email: string
}

export interface LoginResponse {
  token: string
  user: User
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}

export function isAxiosError(e: unknown): e is AxiosError {
  return (e as AxiosError).isAxiosError === true
}
