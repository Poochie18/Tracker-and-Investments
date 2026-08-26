import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SyncEngine, type SyncState } from './sync-engine'
import { getStorageMode, setStorageMode as persistStorageMode, type StorageMode } from '@/lib/auth/local-mode'

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
  // Перемикач "локально/хмара" для авторизованих користувачів
  // (Налаштування → "Синхронізація в хмару").
  storageMode: StorageMode
  setStorageMode: (mode: StorageMode) => void
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
  const [storageMode, setStorageModeState] = useState<StorageMode>(() => getStorageMode(userId))
  // useRef щоб engine жив між ререндерами і не перестворювався
  const engineRef = useRef<SyncEngine | null>(null)

  // storageMode у залежностях — при зміні світча старий engine зупиняється
  // (cleanup) і створюється новий; новий start() сам побачить оновлений
  // localStorage через isLocalOnly() і або мовчить, або підхоплює
  // пропущені зміни (initialPull + push), якщо хмару знову увімкнули.
  useEffect(() => {
    const engine = new SyncEngine({
      userId,
      queryClient,
      onStateChange: setSyncState,
    })
    engineRef.current = engine

    void engine.start()

    // При розмонтуванні (логаут, зміна storageMode) — зупиняємо
    return () => engine.stop()
  }, [userId, queryClient, storageMode])

  const triggerSync = () => {
    void engineRef.current?.triggerSync()
  }

  const manualSync = async () => {
    await engineRef.current?.manualSync()
  }

  const setStorageMode = (mode: StorageMode) => {
    persistStorageMode(userId, mode)
    setStorageModeState(mode)
  }

  return (
    <SyncStatusContext.Provider value={{ syncState, triggerSync, manualSync, storageMode, setStorageMode }}>
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
