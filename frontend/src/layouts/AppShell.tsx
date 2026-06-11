import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  BookOpen,
  Upload,
  PhoneCall,
  BarChart3,
  LogOut,
} from 'lucide-react'
import { logout } from '@/api/auth'
import { clearAuth } from '@/store/auth'

const navItems = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/musteriler', label: 'Müşteriler', icon: Users },
  { to: '/satislar', label: 'Satışlar', icon: ShoppingBag },
  { to: '/defter', label: 'Defter Aktarımı', icon: BookOpen },
  { to: '/aktarim', label: 'CSV Aktarım', icon: Upload },
  { to: '/tahsilat', label: 'Tahsilat', icon: PhoneCall },
  { to: '/raporlar', label: 'Raporlar', icon: BarChart3 },
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
      <aside className="w-56 border-r border-border flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-border">
          <span className="font-bold text-sm text-foreground tracking-tight">Bereket ERP</span>
          <p className="text-xs text-muted-foreground mt-0.5">Tekstil Yönetim</p>
        </div>
        <nav className="flex-1 py-2">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? 'text-primary font-medium bg-primary/8'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-primary' : ''} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <LogOut size={14} />
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
