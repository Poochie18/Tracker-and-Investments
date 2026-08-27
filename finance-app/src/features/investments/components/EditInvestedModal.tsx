import { useState } from 'react'
import { X } from 'lucide-react'
import { Money } from '@/lib/utils/money'

interface EditInvestedModalProps {
  title: string           // напр. "Скільки всього вкладено в крипту"
  description: string     // пояснення, чому редагується єдиним числом
  currentInvested: Money  // поточне агреговане "Вкладено" (мінімальні одиниці валюти)
  onClose: () => void
  onSave: (newTotalUnits: number) => Promise<void>
}

// Модалка пенсіла біля агрегованого "Вкладено" (Крипта, Акції). Сума —
// похідна від N рядків, тож редагуємо її як одне число: введене значення
// пропорційно розподіляється по собівартості всіх рядків цього типу
// (investmentsRepo.scaleInvestedByType) — тому й "Огляд", і сама вкладка
// одразу відображають нову суму консистентно (одні дані, не окремий
// override десь збоку).
export function EditInvestedModal({ title, description, currentInvested, onClose, onSave }: EditInvestedModalProps) {
  const [value, setValue] = useState(currentInvested.toUah().toString())
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const num = parseFloat(value.replace(',', '.'))
    if (isNaN(num) || num < 0) return
    setSaving(true)
    try {
      await onSave(Math.round(num * 100))
      onClose()
    } finally {
      setSaving(false)
    }
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
            {title}
          </p>
          <button type="button" onClick={onClose} className="p-1">
            <X size={20} color="var(--color-text-secondary)" />
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
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
          disabled={saving}
          className="w-full py-3 rounded-2xl font-semibold text-sm disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
        >
          {saving ? 'Зберігаємо...' : 'Зберегти'}
        </button>
      </div>
    </div>
  )
}
