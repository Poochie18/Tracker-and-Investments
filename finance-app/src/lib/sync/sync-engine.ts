import type { QueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { onlineDetector } from './online-detector'
import { flushSyncQueue, hasPendingRecords } from './sync-queue'
import { resolveConflict } from './conflict-resolver'
import { isDevOfflineMode } from '@/lib/auth/dev-bypass'
import type { LocalTransaction, LocalCategory, LocalAccount, LocalInvestment } from '@/lib/db/schema'

// ============================================================
// SyncEngine — центральний оркестратор синхронізації.
//
// Відповідає за:
// 1. Push: pending Dexie → Supabase (через sync-queue)
// 2. Pull initial: Supabase → Dexie при першому підключенні
// 3. Pull realtime: зміни з інших пристроїв → Dexie → UI
// 4. Планування повторних спроб
// ============================================================

export type SyncState =
  | 'idle'       // все синхронізовано
  | 'syncing'    // синхронізація в процесі
  | 'pending'    // є pending записи, чекаємо мережі або тригеру
  | 'error'      // є помилки синхронізації
  | 'offline'    // пристрій офлайн

interface SyncEngineOptions {
  userId: string
  queryClient: QueryClient
  onStateChange: (state: SyncState) => void
}

const SYNC_INTERVAL_MS = 30_000      // перевіряємо pending кожні 30 сек
const PAGE_SIZE = 500                 // кількість записів на сторінку при pull

export class SyncEngine {
  private userId: string
  private queryClient: QueryClient
  private onStateChange: (state: SyncState) => void

  private realtimeChannel: RealtimeChannel | null = null
  private syncIntervalId: ReturnType<typeof setInterval> | null = null
  private isSyncing = false

  constructor(opts: SyncEngineOptions) {
    this.userId = opts.userId
    this.queryClient = opts.queryClient
    this.onStateChange = opts.onStateChange
  }

  // ── Старт ────────────────────────────────────────────────

  async start(): Promise<void> {
    // Dev офлайн-режим — не звертаємось до Supabase взагалі,
    // працюємо тільки з Dexie. UI показує стан 'idle', ніби все синхронізовано.
    if (isDevOfflineMode()) {
      this.onStateChange('idle')
      return
    }

    // Слухаємо зміни мережі
    onlineDetector.subscribe((isOnline) => {
      if (isOnline) {
        // Повернулись онлайн — одразу синкаємо
        void this.sync()
      } else {
        this.onStateChange('offline')
      }
    })

    // Першочерговий pull при старті (якщо онлайн)
    if (onlineDetector.isOnline) {
      await this.initialPull()
      await this.sync()
    } else {
      this.onStateChange('offline')
    }

    // Підписуємось на Realtime
    this.startRealtime()

    // Плановий запуск кожні 30 секунд
    this.syncIntervalId = setInterval(() => {
      if (onlineDetector.isOnline) void this.sync()
    }, SYNC_INTERVAL_MS)
  }

  // ── Зупинка (при логауті або розмонтуванні) ───────────────

  stop(): void {
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId)
      this.syncIntervalId = null
    }
    if (this.realtimeChannel) {
      void supabase.removeChannel(this.realtimeChannel)
      this.realtimeChannel = null
    }
  }

  // ── Push + Push тригер ────────────────────────────────────

  // Публічний метод — викликається після кожного локального запису
  async triggerSync(): Promise<void> {
    if (isDevOfflineMode()) return
    if (onlineDetector.isOnline) {
      await this.sync()
    } else {
      this.onStateChange('pending')
    }
  }

  private async sync(): Promise<void> {
    if (this.isSyncing) return
    this.isSyncing = true
    this.onStateChange('syncing')

    try {
      const result = await flushSyncQueue(this.userId)

      if (result.errorCount > 0) {
        this.onStateChange('error')
      } else if (await hasPendingRecords(this.userId)) {
        this.onStateChange('pending')
      } else {
        this.onStateChange('idle')
      }

      if (result.successCount > 0) {
        // Записи успішно відправлені — інвалідуємо кеш UI
        this.invalidateQueries()
      }
    } catch {
      this.onStateChange('error')
    } finally {
      this.isSyncing = false
    }
  }

  // ── Initial Pull (при першому підключенні) ────────────────
  //
  // Завантажуємо всі дані з Supabase і зберігаємо в Dexie.
  // Потрібно якщо юзер увійшов на новому пристрої де Dexie порожня.

  async initialPull(): Promise<void> {
    // Якщо Dexie вже має дані цього юзера — пропускаємо initial pull
    const localCount = await db.transactions
      .where('user_id').equals(this.userId).count()

    // Рахунок вже має бути з setupFirstLogin, тому перевіряємо transactions
    // (можуть бути відсутніми на новому пристрої)
    const hasAccounts = (await db.accounts.where('user_id').equals(this.userId).count()) > 0
    if (hasAccounts && localCount > 0) return

    this.onStateChange('syncing')

    await Promise.all([
      this.pullAccounts(),
      this.pullCategories(),
      this.pullTransactions(),
      this.pullInvestments(),
    ])

    this.invalidateQueries()
  }

  private async pullAccounts(): Promise<void> {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', this.userId)

    if (!data) return

    const localAccounts: LocalAccount[] = data.map((acc) => ({
      ...acc,
      _sync_status: 'synced' as const,
      _sync_error: null,
      _local_updated_at: Date.now(),
    }))

    await db.accounts.bulkPut(localAccounts)
  }

  private async pullCategories(): Promise<void> {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', this.userId)

    if (!data) return

    const localCats: LocalCategory[] = data.map((cat) => ({
      ...cat,
      _sync_status: 'synced' as const,
      _sync_error: null,
      _local_updated_at: Date.now(),
    }))

    await db.categories.bulkPut(localCats)
  }

  private async pullTransactions(): Promise<void> {
    // Завантажуємо сторінками щоб не перевантажити пам'ять
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (!data || data.length === 0) {
        hasMore = false
        break
      }

      const localTxs: LocalTransaction[] = data.map((tx) => ({
        ...tx,
        _sync_status: 'synced' as const,
        _sync_error: null,
        _local_updated_at: Date.now(),
      }))

      await db.transactions.bulkPut(localTxs)

      hasMore = data.length === PAGE_SIZE
      offset += PAGE_SIZE
    }
  }

  private async pullInvestments(): Promise<void> {
    const { data } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', this.userId)

    if (!data) return

    const localInvestments: LocalInvestment[] = data.map((inv) => ({
      ...inv,
      _sync_status: 'synced' as const,
      _sync_error: null,
      _local_updated_at: Date.now(),
    }))

    await db.investments.bulkPut(localInvestments)
  }

  // ── Realtime Subscription ─────────────────────────────────
  //
  // Supabase надсилає події при будь-якій зміні в БД (INSERT/UPDATE/DELETE).
  // Це дозволяє синхронізувати зміни з іншого пристрою без polling.

  private startRealtime(): void {
    this.realtimeChannel = supabase
      .channel(`user-${this.userId}`)
      // Підписуємось на всі зміни в транзакціях цього юзера
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => void this.handleTransactionChange(payload)
      )
      // Підписуємось на зміни категорій (рідкісні, але потрібні)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => void this.handleCategoryChange(payload)
      )
      // Підписуємось на зміни інвестицій (напр. оновлення ціни з іншого пристрою)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'investments',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => void this.handleInvestmentChange(payload)
      )
      .subscribe()
  }

  // Обробляємо realtime подію для транзакції
  private async handleTransactionChange(
    payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }
  ): Promise<void> {
    const { eventType, new: newRecord } = payload

    if (eventType === 'DELETE') {
      // На видалення — суто локальний soft delete вже є, нічого не робимо
      return
    }

    const remoteData = newRecord as unknown as LocalTransaction

    // Перевіряємо конфлікт: чи є у нас локальна pending версія?
    const localRecord = await db.transactions.get(remoteData.id)

    if (localRecord && localRecord._sync_status === 'pending') {
      const winner = resolveConflict(localRecord, remoteData)
      if (winner === 'local') {
        // Наша версія новіша — залишаємо pending, вона відправиться при sync
        return
      }
    }

    // Зберігаємо серверну версію в Dexie
    await db.transactions.put({
      ...remoteData,
      _sync_status: 'synced',
      _sync_error: null,
      _local_updated_at: Date.now(),
    })

    this.invalidateQueries()
  }

  private async handleCategoryChange(
    payload: { eventType: string; new: Record<string, unknown> }
  ): Promise<void> {
    const remoteData = payload.new as unknown as LocalCategory

    await db.categories.put({
      ...remoteData,
      _sync_status: 'synced',
      _sync_error: null,
      _local_updated_at: Date.now(),
    })

    this.invalidateQueries()
  }

  private async handleInvestmentChange(
    payload: { eventType: string; new: Record<string, unknown> }
  ): Promise<void> {
    const { eventType, new: newRecord } = payload
    if (eventType === 'DELETE') return

    const remoteData = newRecord as unknown as LocalInvestment
    const localRecord = await db.investments.get(remoteData.id)

    if (localRecord && localRecord._sync_status === 'pending') {
      const winner = resolveConflict(localRecord, remoteData)
      if (winner === 'local') return
    }

    await db.investments.put({
      ...remoteData,
      _sync_status: 'synced',
      _sync_error: null,
      _local_updated_at: Date.now(),
    })

    this.invalidateQueries()
  }

  // Інвалідуємо TanStack Query кеш → компоненти перечитують з Dexie
  private invalidateQueries(): void {
    void this.queryClient.invalidateQueries({ queryKey: ['transactions'] })
    void this.queryClient.invalidateQueries({ queryKey: ['categories'] })
    void this.queryClient.invalidateQueries({ queryKey: ['account'] })
    void this.queryClient.invalidateQueries({ queryKey: ['investments'] })
  }
}
