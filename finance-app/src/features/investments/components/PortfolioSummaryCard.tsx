import { Pencil } from 'lucide-react'
import { Money } from '@/lib/utils/money'
import { formatPercent } from '@/lib/utils/format'

interface PortfolioSummaryCardProps {
  invested: Money
  currentValue: Money
  pnl: Money       // currentValue - invested
  pnlPercent: number
  // Гривневий еквівалент (за курсом НБУ) — показуємо поруч з основною
  // сумою, коли портфель ведеться в USD (крипта). Якщо не передано —
  // картка виглядає як раніше (лише основна валюта).
  uahEquivalent?: { invested: Money; currentValue: Money; pnl: Money }
  // Символ основної валюти картки — типово '₴' (більшість вкладок ведуть
  // підсумок у гривневому базисі). На "Крипті" все в USD, тож там передають
  // '$', інакше картка показувала б суми в доларах під знаком ₴.
  currencySymbol?: string
  // Три плитки одна під одною замість в ряд — для вузької колонки, коли
  // картка стоїть поруч з іншою (напр. таблицею по роках на "Облігаціях").
  stacked?: boolean
  // Класи контейнера — типово 'mx-4' (картка на всю ширину екрана);
  // передай свій, коли картка вкладена в ряд (напр. 'flex-1').
  className?: string
  // Пенсіл біля "Вкладено" — редагування вручну (зараз лише крипта:
  // сума похідна від N синхронізованих рядків, тому редагується як єдине
  // число, а не по монетах). Якщо не передано — без іконки.
  onEditInvested?: () => void
}

// Картка зверху екрану інвестицій: скільки вкладено, скільки зараз коштує,
// прибуток/збиток у сумі та відсотках. Три плитки одного стилю (як у
// PortfolioSummaryTable — сума + "· %" поруч), у порядку Вкладено →
// Поточна вартість → Прибуток/збиток.
export function PortfolioSummaryCard({
  invested,
  currentValue,
  pnl,
  pnlPercent,
  uahEquivalent,
  currencySymbol = '₴',
  stacked,
  className = 'mx-4',
  onEditInvested,
}: PortfolioSummaryCardProps) {
  const isProfit = pnl.isPositive() || pnl.isZero()
  const pnlColor = isProfit ? 'var(--color-income)' : 'var(--color-expense)'
  const sign = isProfit ? '+' : ''

  return (
    <div
      className={`${className} p-4 rounded-3xl grid ${stacked ? 'grid-cols-1 gap-3' : 'grid-cols-3 gap-2'} min-w-0`}
      style={{ backgroundColor: 'var(--color-bg-card)' }}
    >
      <SummaryTile
        label="Вкладено"
        value={invested.formatCompact(currencySymbol)}
        secondary={uahEquivalent && `≈ ${uahEquivalent.invested.formatWhole('₴')}`}
        onEdit={onEditInvested}
      />

      <SummaryTile
        label="Поточна вартість"
        value={currentValue.formatCompact(currencySymbol)}
        secondary={uahEquivalent && `≈ ${uahEquivalent.currentValue.formatWhole('₴')}`}
      />

      <SummaryTile
        label="Прибуток / збиток"
        value={
          <>
            {sign}{pnl.formatCompact(currencySymbol)}
            <span className="opacity-70"> {sign}{formatPercent(pnlPercent, 1)}</span>
          </>
        }
        secondary={uahEquivalent && `≈ ${sign}${uahEquivalent.pnl.formatWhole('₴')}`}
        valueColor={pnlColor}
      />
    </div>
  )
}

// Одна плитка зведення — той самий стиль для всіх трьох (Вкладено /
// Поточна вартість / Прибуток), щоб картка виглядала одним цілим, а не
// довільним набором різних за розміром чисел.
function SummaryTile({
  label,
  value,
  secondary,
  valueColor,
  onEdit,
}: {
  label: string
  value: React.ReactNode
  secondary?: string | false
  valueColor?: string
  onEdit?: () => void
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[11px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </p>
        {onEdit && (
          <button type="button" onClick={onEdit} className="p-0.5 -m-0.5 flex-shrink-0" title="Редагувати вручну">
            <Pencil size={10} color="var(--color-text-secondary)" />
          </button>
        )}
      </div>
      <p className="text-base font-bold truncate" style={{ color: valueColor ?? 'var(--color-text-primary)' }}>
        {value}
      </p>
      {secondary && (
        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {secondary}
        </p>
      )}
    </div>
  )
}
