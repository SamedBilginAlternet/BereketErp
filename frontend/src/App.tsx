import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthGuard from '@/layouts/AuthGuard'
import AppShell from '@/layouts/AppShell'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Musteriler from '@/pages/Musteriler'
import MusteriDetay from '@/pages/MusteriDetay'
import YeniSatis from '@/pages/YeniSatis'
import DefterAktarim from '@/pages/DefterAktarim'
import Aktarim from '@/pages/Aktarim'
import Tahsilat from '@/pages/Tahsilat'
import Raporlar from '@/pages/Raporlar'

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
              <Route path="/musteriler/:id" element={<MusteriDetay />} />
              <Route path="/satislar" element={<div className="p-6">Satışlar</div>} />
              <Route path="/satislar/yeni" element={<YeniSatis />} />
              <Route path="/defter" element={<DefterAktarim />} />
              <Route path="/defter-aktarim" element={<DefterAktarim />} />
              <Route path="/aktarim" element={<Aktarim />} />
              <Route path="/tahsilat" element={<Tahsilat />} />
              <Route path="/raporlar" element={<Raporlar />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
