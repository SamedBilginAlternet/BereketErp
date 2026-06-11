import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthGuard from '@/layouts/AuthGuard'
import AppShell from '@/layouts/AppShell'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Musteriler from '@/pages/Musteriler'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/giris" element={<Login />} />
          <Route element={<AuthGuard />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/musteriler" element={<Musteriler />} />
              <Route path="/satislar" element={<div className="p-6">Satışlar</div>} />
              <Route path="/tahsilat" element={<div className="p-6">Tahsilat</div>} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
