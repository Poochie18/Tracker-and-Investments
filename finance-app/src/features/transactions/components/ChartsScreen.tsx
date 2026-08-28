import { AccountIconButton } from '@/components/AccountIconButton'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { MonthlyIncomeExpenseChart } from './MonthlyIncomeExpenseChart'

// Розширені графіки: дохід/витрати/прибуток по місяцях за рік. Розбивку
// за категоріями сюди навмисно не додаємо — вона дублювала б "Огляд"
// (там уже є пончик категорій з тим самим набором фільтрів періоду).
export function ChartsScreen() {
  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        <AccountIconButton />
        <h1 className="text-xl font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          Графіки
        </h1>
        <SyncStatusIndicator />
      </div>

      <div className="flex flex-col gap-4 py-4 pb-24">
        <MonthlyIncomeExpenseChart />
      </div>
    </div>
  )
}
