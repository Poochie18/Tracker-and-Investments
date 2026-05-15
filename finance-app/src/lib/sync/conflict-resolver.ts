// ============================================================
// Conflict Resolver — Last-Write-Wins за полем updated_at.
//
// Коли один і той же запис змінено і локально (Dexie),
// і на сервері (Supabase) поки пристрій був офлайн,
// виникає конфлікт. Стратегія: перемагає той що новіший.
//
// Для MVP це достатньо. Справжній CRDT (Conflict-free Replicated
// Data Type) — значно складніший і не потрібен для одного юзера.
// ============================================================

interface Versioned {
  updated_at: string  // ISO 8601
  _local_updated_at?: number  // timestamp ms (тільки в локальних типах)
}

export type ConflictWinner = 'local' | 'remote'

// Визначає хто переміг у конфлікті між локальним і серверним записом
export function resolveConflict(local: Versioned, remote: Versioned): ConflictWinner {
  const localTime = local._local_updated_at ?? new Date(local.updated_at).getTime()
  const remoteTime = new Date(remote.updated_at).getTime()

  // При рівних значеннях — сервер вважається авторитетним
  return localTime > remoteTime ? 'local' : 'remote'
}
