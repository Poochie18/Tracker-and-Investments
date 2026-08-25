import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SyncEngine, type SyncState } from './sync-engine'

// ============================================================
// SyncContext — надає стан синхронізації і triggerSync()
// усьому дереву компонентів через React Context.
// ============================================================

interface SyncContextValue {
  syncState: SyncState
  triggerSync: () => void
  // Повний pull з Supabase + push — на відміну від triggerSync (тільки
  // push pending), реально підтягує свіжі дані з інших пристроїв.
  manualSync: () => Promise<void>
}

export const SyncStatusContext = createContext<SyncContextValue | null>(null)

interface SyncProviderProps {
  userId: string
  children: React.ReactNode
}

// SyncProvider: ініціалізує SyncEngine і надає його стан через контекст.
// Монтується в AuthGuard — одразу після підтвердження авторизації.
export function SyncProvider({ userId, children }: SyncProviderProps) {
  const queryClient = useQueryClient()
  const [syncState, setSyncState] = useState<SyncState>('idle')
  // useRef щоб engine жив між ререндерами і не перестворювався
  const engineRef = useRef<SyncEngine | null>(null)

  useEffect(() => {
    const engine = new SyncEngine({
      userId,
      queryClient,
      onStateChange: setSyncState,
    })
    engineRef.current = engine

    void engine.start()

    // При розмонтуванні (логаут) — зупиняємо
    return () => engine.stop()
  }, [userId, queryClient])

  const triggerSync = () => {
    void engineRef.current?.triggerSync()
  }

  const manualSync = async () => {
    await engineRef.current?.manualSync()
  }

  return (
    <SyncStatusContext.Provider value={{ syncState, triggerSync, manualSync }}>
      {children}
    </SyncStatusContext.Provider>
  )
}

// Зручний хук (альтернатива useContext напряму)
export function useSyncContext() {
  const ctx = useContext(SyncStatusContext)
  if (!ctx) throw new Error('useSyncContext: не знайдено SyncStatusContext')
  return ctx
}
