import { Link, useLocation } from 'react-router-dom'
import { Wallet, PlusCircle, TrendingUp } from 'lucide-react'
import { useFilterStore } from '@/stores/filter-store'

// Головна нижня навігація — тепер тільки 2 розділи + FAB.
// "Список", "Графіки", "Регулярні платежі" (Транзакції) і
// "Депозити"/"Облігації"/"Крипта"/"Акції" (Інвестиції) — у SecondaryNav,
// що рендериться рядком вище (див. AppLayout).
//
// matchPrefixes — бо "Транзакції" має підсвічуватись не тільки на /overview,
// а й на /list, /charts, /recurring, /add тощо (весь розділ).
const NAV_ITEMS = [
  { to: '/overview', icon: Wallet, label: 'Транзакції', matchPrefixes: ['/overview', '/list', '/charts', '/recurring', '/add', '/transactions'] },
  { to: '/investments', icon: TrendingUp, label: 'Інвестиції', matchPrefixes: ['/investments'] },
] as const

interface BottomNavProps {
  onAddClick: () => void
}

export function BottomNav({ onAddClick }: BottomNavProps) {
  const location = useLocation()
  const setCategoryFilter = useFilterStore((s) => s.setCategoryFilter)

  // Прямий перехід у "Транзакції" — це не drill-down з категорії,
  // тому фільтр (якщо лишився з Overview) скидаємо.
  const handleNavClick = (to: string) => {
    if (to === '/overview') setCategoryFilter(null)
  }

  return (
    <nav
      className="flex items-center justify-around"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        // Враховуємо safe area на iOS (є виріз або скруглені кути)
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {NAV_ITEMS.slice(0, 1).map(({ to, icon: Icon, label, matchPrefixes }) => (
        <NavItem
          key={to}
          to={to}
          icon={Icon}
          label={label}
          isActive={matchPrefixes.some((p) => location.pathname.startsWith(p))}
          onClick={() => handleNavClick(to)}
        />
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

      {NAV_ITEMS.slice(1).map(({ to, icon: Icon, label, matchPrefixes }) => (
        <NavItem
          key={to}
          to={to}
          icon={Icon}
          label={label}
          isActive={matchPrefixes.some((p) => location.pathname.startsWith(p))}
          onClick={() => handleNavClick(to)}
        />
      ))}
    </nav>
  )
}

interface NavItemProps {
  to: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  label: string
  isActive: boolean
  onClick?: () => void
}

function NavItem({ to, icon: Icon, label, isActive, onClick }: NavItemProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors"
      style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
    >
      <Icon size={22} />
      <span>{label}</span>
    </Link>
  )
}
