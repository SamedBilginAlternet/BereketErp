import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout } from '@/api/auth'
import { clearAuth } from '@/store/auth'

const navItems = [
  { to: '/', label: 'Panel', end: true },
  { to: '/musteriler', label: 'Müşteriler' },
  { to: '/satislar', label: 'Satışlar' },
  { to: '/defter', label: 'Defter Aktarımı' },
  { to: '/tahsilat', label: 'Tahsilat' },
]

export default function AppShell() {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
    } finally {
      clearAuth()
      navigate('/giris', { replace: true })
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-52 border-r border-border flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-border">
          <span className="font-semibold text-sm text-foreground">Bereket ERP</span>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-5 py-2 text-sm transition-colors ${
                  isActive
                    ? 'text-primary font-medium bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
