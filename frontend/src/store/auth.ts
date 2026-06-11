import { useState } from 'react'
import type { User } from '@/api/auth'

let _user: User | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

export function getStoredToken(): string | null {
  return localStorage.getItem('token')
}

export function setAuth(token: string, user: User): void {
  localStorage.setItem('token', token)
  _user = user
  notify()
}

export function clearAuth(): void {
  localStorage.removeItem('token')
  _user = null
  notify()
}

export function getUser(): User | null {
  return _user
}

export function useAuthUser(): User | null {
  const [, rerender] = useState(0)
  useState(() => {
    const fn = () => rerender((n) => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  })
  return _user
}
