interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

// Простий бінарний перемикач (увімк/вимк) — design-tokens, як і решта
// UI. На відміну від сегмент-контролів (ExpenseIncomeTabs, CurrencySwitch)
// — не для вибору з набору опцій, а для булевого стану (напр. "Зробити
// регулярним", "Активний/Призупинений").
export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 rounded-full transition-colors disabled:opacity-60"
      style={{
        width: 44,
        height: 26,
        backgroundColor: checked ? 'var(--color-accent)' : 'rgba(255,255,255,0.16)',
      }}
    >
      <span
        className="absolute top-0.5 rounded-full transition-transform"
        style={{
          width: 22,
          height: 22,
          left: 2,
          backgroundColor: '#fff',
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
        }}
      />
    </button>
  )

  if (!label) return track

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </span>
      {track}
    </div>
  )
}
