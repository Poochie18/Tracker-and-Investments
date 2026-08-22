import { Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Маленька іконка акаунта/налаштувань у шапці екранів верхнього рівня.
// Раніше "Акаунт" був окремим пунктом нижньої навігації — тепер це
// компактна кнопка ліворуч у шапці кожного головного екрану.
export function AccountIconButton() {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/settings')}
      className="p-1 -ml-1 rounded-full active:opacity-60"
      aria-label="Акаунт і налаштування"
    >
      <Settings size={18} color="var(--color-text-primary)" />
    </button>
  )
}
