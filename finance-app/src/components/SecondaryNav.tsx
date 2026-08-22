import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export interface SecondaryNavItem {
  to: string
  icon: LucideIcon
  label: string
  onClick?: () => void
}

interface SecondaryNavProps {
  items: SecondaryNavItem[]
}

// Другий ряд навігації — сторінки всередині поточного розділу
// (Транзакції: Огляд/Список/Графіки/Регулярні платежі,
//  Інвестиції: Огляд/Депозити/Облігації/Крипта/Акції).
// Той самий візуальний стиль що й BottomNav (іконка + підпис),
// але трохи менший — щоб було зрозуміло, що це другорядний рівень.
export function SecondaryNav({ items }: SecondaryNavProps) {
  return (
    <nav
      className="flex items-stretch justify-around"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        height: 56,
      }}
    >
      {items.map(({ to, icon: Icon, label, onClick }) => (
        <NavLink
          key={to}
          to={to}
          end
          onClick={onClick}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[10px] font-medium transition-colors"
          style={({ isActive }) => ({
            color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          })}
        >
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
