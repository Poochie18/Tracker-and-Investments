import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalCategory, TransactionType } from '@/lib/db/schema'

// Репозиторій для роботи з категоріями через Dexie (IndexedDB).
// Компоненти звертаються тільки сюди — не до db напряму.

export const categoriesRepo = {
  // Всі активні категорії користувача
  async getAll(userId: string): Promise<LocalCategory[]> {
    return db.categories
      .where('user_id')
      .equals(userId)
      .filter((c) => !c.is_archived)
      .sortBy('sort_order')
  },

  // Категорії певного типу (expense або income)
  async getByType(userId: string, type: TransactionType): Promise<LocalCategory[]> {
    return db.categories
      .where('[user_id+type]')
      .equals([userId, type])
      .filter((c) => !c.is_archived)
      .sortBy('sort_order')
  },

  async getById(id: string): Promise<LocalCategory | undefined> {
    return db.categories.get(id)
  },

  // Створити нову категорію (локально, pending sync)
  async create(
    userId: string,
    data: Pick<LocalCategory, 'name' | 'type' | 'icon_name' | 'color_hex'>
  ): Promise<LocalCategory> {
    const now = new Date().toISOString()
    const maxOrder = await db.categories
      .where('user_id')
      .equals(userId)
      .count()

    const category: LocalCategory = {
      id: uuidv4(),
      user_id: userId,
      name: data.name,
      type: data.type,
      icon_name: data.icon_name,
      color_hex: data.color_hex,
      sort_order: maxOrder,
      is_archived: false,
      is_system: false,
      created_at: now,
      updated_at: now,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }

    await db.categories.add(category)
    return category
  },

  async update(
    id: string,
    data: Partial<Pick<LocalCategory, 'name' | 'icon_name' | 'color_hex' | 'sort_order'>>
  ): Promise<void> {
    await db.categories.update(id, {
      ...data,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Не видаляємо системні категорії
  async archive(id: string): Promise<void> {
    const cat = await db.categories.get(id)
    if (cat?.is_system) throw new Error('Системну категорію не можна архівувати')

    await db.categories.update(id, {
      is_archived: true,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Масове збереження (використовується при синхронізації)
  async upsertMany(categories: LocalCategory[]): Promise<void> {
    await db.categories.bulkPut(categories)
  },
}
