import { NavLink } from 'react-router-dom'
import { BarChart2, PlusCircle, TrendingUp, Settings, List } from 'lucide-react'
import { useFilterStore } from '@/stores/filter-store'

// Конфігурація вкладок нижньої навігації
const NAV_ITEMS = [
  { to: '/overview', icon: BarChart2, label: 'Витрати' },
  { to: '/list', icon: List, label: 'Список' },
  { to: '/investments', icon: TrendingUp, label: 'Інвестиції' },
  { to: '/settings', icon: Settings, label: 'Акаунт' },
] as const

interface BottomNavProps {
  onAddClick: () => void
}

export function BottomNav({ onAddClick }: BottomNavProps) {
  const setCategoryFilter = useFilterStore((s) => s.setCategoryFilter)

  // Прямий перехід у "Список" з нижньої навігації — це не drill-down
  // з категорії, тому фільтр категорії (якщо лишився з Overview) скидаємо.
  const handleNavClick = (to: string) => {
    if (to === '/list') setCategoryFilter(null)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        // Враховуємо safe area на iOS (є виріз або скруглені кути)
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {NAV_ITEMS.slice(0, 2).map(({ to, icon: Icon, label }) => (
        <NavItem key={to} to={to} icon={Icon} label={label} onClick={() => handleNavClick(to)} />
      ))}

      {/* Кнопка FAB посередині */}
      <button
        onClick={onAddClick}
        className="flex items-center justify-center w-14 h-14 rounded-full -mt-6 shadow-lg active:scale-95 transition-transform"
        style={{ backgroundColor: 'var(--color-fab)' }}
        aria-label="Додати транзакцію"
      >
        <PlusCircle size={28} color="#1B2A2A" />
      </button>

      {NAV_ITEMS.slice(2).map(({ to, icon: Icon, label }) => (
        <NavItem key={to} to={to} icon={Icon} label={label} onClick={() => handleNavClick(to)} />
      ))}
    </nav>
  )
}

interface NavItemProps {
  to: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  label: string
  onClick?: () => void
}

function NavItem({ to, icon: Icon, label, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
          isActive
            ? 'text-[var(--color-accent)]'
            : 'text-[var(--color-text-secondary)]'
        }`
      }
    >
      <Icon size={22} />
      <span>{label}</span>
    </NavLink>
  )
}
