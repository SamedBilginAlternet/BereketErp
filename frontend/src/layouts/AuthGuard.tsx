import { Navigate, Outlet } from 'react-router-dom'
import { getStoredToken } from '@/store/auth'

export default function AuthGuard() {
  if (!getStoredToken()) {
    return <Navigate to="/giris" replace />
  }
  return <Outlet />
}
