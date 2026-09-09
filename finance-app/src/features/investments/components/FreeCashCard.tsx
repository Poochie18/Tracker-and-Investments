import { useState } from 'react'
import { Pencil, Wallet, X } from 'lucide-react'
import { Money } from '@/lib/utils/money'
import { useAuth } from '@/hooks/use-auth'
import { useFreeCashUsdMinor, setFreeCashUsdMinor } from '@/lib/settings/investment-settings'

// Рядок "Вільні кошти" на вкладці Акції — готівка на брокерському рахунку
// в доларах, ще не інвестована. Враховується в "Вкладено" і "Поточну
// вартість" картки зверху (однаковою сумою в обидва — щоб "Прибуток" не
// спотворювався готівкою, яка сама по собі не є доходом), редагується
// вручну через пенсіл (те саме UX, що й "Вкладено" в крипті).
export function FreeCashCard() {
  const { user } = useAuth()
  const cashMinor = useFreeCashUsdMinor(user?.id ?? '')
  const [showEdit, setShowEdit] = useState(false)

  return (
    <>
      <div
        className="mx-4 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Wallet size={18} style={{ color: 'var(--color-text-secondary)' }} />
          <div className="flex items-center gap-1.5">
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              Вільні кошти
            </p>
            <button type="button" onClick={() => setShowEdit(true)} className="p-0.5 -m-0.5" title="Редагувати">
              <Pencil size={10} color="var(--color-text-secondary)" />
            </button>
          </div>
        </div>
        <p className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>
          {Money.fromKopiyky(cashMinor).formatCompact('$')}
        </p>
      </div>

      {showEdit && (
        <EditFreeCashModal userId={user?.id ?? ''} currentMinor={cashMinor} onClose={() => setShowEdit(false)} />
      )}
    </>
  )
}

function EditFreeCashModal({
  userId,
  currentMinor,
  onClose,
}: {
  userId: string
  currentMinor: number
  onClose: () => void
}) {
  const [value, setValue] = useState((currentMinor / 100).toString())

  const handleSave = () => {
    const usd = parseFloat(value.replace(',', '.'))
    if (isNaN(usd) || usd < 0) return
    void setFreeCashUsdMinor(userId, Math.round(usd * 100))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Вільні кошти на рахунку
          </p>
          <button type="button" onClick={onClose} className="p-1">
            <X size={20} color="var(--color-text-secondary)" />
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Готівка на брокерському рахунку в доларах, яку ще не інвестовано — враховується у "Вкладено" і "Поточну
          вартість" акцій, але не впливає на суму "Прибутку".
        </p>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.,]/g, ''))}
          className="w-full text-base px-3 py-2.5 rounded-xl bg-transparent border-none outline-none"
          style={{ color: 'var(--color-text-primary)', backgroundColor: 'rgba(255,255,255,0.06)' }}
        />
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 rounded-2xl font-semibold text-sm"
          style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
        >
          Зберегти
        </button>
      </div>
    </div>
  )
}
