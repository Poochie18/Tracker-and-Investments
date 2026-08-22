import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart2, List, LineChart, Repeat, PieChart, Landmark, FileText, Bitcoin, TrendingUp } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { SecondaryNav, type SecondaryNavItem } from './SecondaryNav'
import { useFilterStore } from '@/stores/filter-store'

// Екрани-"дриль-даун" (форми Додати/Редагувати, детальна картка активу) —
// там нема другого рівня навігації, зосереджуємось на самому екрані
// (є власна стрілка "назад" у шапці).
const DRILLDOWN_PATH_PATTERNS = [
  /^\/add$/,
  /^\/transactions\/.+\/edit$/,
  /^\/investments\/add$/,
  /^\/investments\/.+\/edit$/,
  // Детальна картка активу: /investments/<uuid> (без /type/ і /add)
  /^\/investments\/(?!type\/|add$)[^/]+$/,
]

// AppLayout — обгортка для захищених екранів.
// SyncStatusIndicator і AccountIconButton вбудовані в шапку кожного екрану.
//
// Структура низу: SecondaryNav (сторінки поточного розділу) над BottomNav
// (розділи верхнього рівня). Тема (.theme-investments) перемикає акцент
// і колір шапки для всього піддерева — і сторінок, і обох навбарів.
export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const setCategoryFilter = useFilterStore((s) => s.setCategoryFilter)
  const { pathname } = location

  const isInvestmentsSection = pathname.startsWith('/investments')
  const isSettingsSection = pathname === '/settings' || pathname.startsWith('/settings/')
  const isFormScreen = DRILLDOWN_PATH_PATTERNS.some((re) => re.test(pathname))

  let secondaryItems: SecondaryNavItem[] | null = null
  if (isInvestmentsSection && !isFormScreen) {
    secondaryItems = [
      { to: '/investments', icon: PieChart, label: 'Огляд' },
      { to: '/investments/type/deposit', icon: Landmark, label: 'Депозити' },
      { to: '/investments/type/bond', icon: FileText, label: 'Облігації' },
      { to: '/investments/type/crypto', icon: Bitcoin, label: 'Крипта' },
      { to: '/investments/type/stock', icon: TrendingUp, label: 'Акції' },
    ]
  } else if (!isInvestmentsSection && !isSettingsSection && !isFormScreen) {
    secondaryItems = [
      { to: '/overview', icon: BarChart2, label: 'Огляд' },
      { to: '/list', icon: List, label: 'Список', onClick: () => setCategoryFilter(null) },
      { to: '/charts', icon: LineChart, label: 'Графіки' },
      { to: '/recurring', icon: Repeat, label: 'Регулярні' },
    ]
  }

  return (
    <div
      className={isInvestmentsSection ? 'theme-investments' : undefined}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div
        className="flex flex-col"
        style={{
          height: '100%',
          paddingBottom: `calc(64px + ${secondaryItems ? '56px' : '0px'} + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        <div className="fixed bottom-0 left-0 right-0">
          {secondaryItems && <SecondaryNav items={secondaryItems} />}
          <BottomNav onAddClick={() => navigate('/add')} />
        </div>
      </div>
    </div>
  )
}
