import { Outlet, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'

// AppLayout — обгортка для захищених екранів.
// SyncStatusIndicator тепер вбудований у шапку кожного екрану.
export function AppLayout() {
  const navigate = useNavigate()

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100%',
        paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <BottomNav onAddClick={() => navigate('/add')} />
    </div>
  )
}
