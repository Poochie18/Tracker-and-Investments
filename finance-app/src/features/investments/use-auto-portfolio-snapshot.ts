import { useEffect } from 'react'
import { getCurrentFiscalYear, type FiscalYear } from '@/lib/settings/fiscal-year'
import { useSavePortfolioSnapshot } from '@/hooks/use-portfolio-snapshots'
import type { ExchangeRates } from '@/lib/investments/exchange-rate'
import type { PortfolioSummary } from './portfolio-summary'

const STORAGE_KEY = 'last_seen_fiscal_year'

// ============================================================
// Автоматичний зліпок портфеля при переході в новий фінансовий рік.
//
// Офлайн-застосунок без бекенд-крону не може спрацювати РІВНО на межі
// року — тому best-effort підхід: щоразу, коли рахується "Огляд" (з
// живими даними), звіряємо поточний фінансовий рік з тим, що бачили
// минулого разу (localStorage). Якщо рік змінився — значить, з часу
// останнього відвідування рік закрився, і зараз найкращий момент його
// зафіксувати (дані ще свіжі, недалеко від фактичної дати завершення).
//
// Викликати з PortfolioOverview — там уже є summary + rates з живих даних.
// ============================================================
export function useAutoPortfolioSnapshot(
  userId: string | undefined,
  summary: PortfolioSummary | null,
  rates: ExchangeRates | undefined,
  fiscalYearStartMonth: number
): void {
  const saveSnapshot = useSavePortfolioSnapshot(userId ?? '')

  useEffect(() => {
    if (!userId || !summary || !rates || summary.rows.length === 0) return

    const current = getCurrentFiscalYear(fiscalYearStartMonth)
    const lastSeenRaw = localStorage.getItem(STORAGE_KEY)
    const lastSeen: FiscalYear | null = lastSeenRaw ? JSON.parse(lastSeenRaw) : null

    if (!lastSeen) {
      // Перший запуск взагалі — нема з чим порівнювати, просто запам'ятовуємо.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
      return
    }

    if (lastSeen.key !== current.key) {
      saveSnapshot.mutate({
        fiscalYearKey: lastSeen.key,
        fiscalYearLabel: lastSeen.label,
        snapshotDate: new Date().toISOString(),
        ratesUsd: rates.usd,
        ratesEur: rates.eur,
        rows: summary.rows.map((r) => ({ type: r.type, invested: r.invested, currentValue: r.currentValue })),
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, summary, rates, fiscalYearStartMonth])
}
