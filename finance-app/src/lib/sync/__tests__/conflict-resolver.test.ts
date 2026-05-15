import { describe, it, expect } from 'vitest'
import { resolveConflict } from '../conflict-resolver'

describe('resolveConflict (Last-Write-Wins)', () => {
  it('повертає remote якщо серверний запис новіший', () => {
    const local = {
      updated_at: '2026-05-15T10:00:00Z',
      _local_updated_at: new Date('2026-05-15T10:00:00Z').getTime(),
    }
    const remote = { updated_at: '2026-05-15T11:00:00Z' }

    expect(resolveConflict(local, remote)).toBe('remote')
  })

  it('повертає local якщо локальний запис новіший', () => {
    const local = {
      updated_at: '2026-05-15T10:00:00Z',
      _local_updated_at: new Date('2026-05-15T12:00:00Z').getTime(),
    }
    const remote = { updated_at: '2026-05-15T11:00:00Z' }

    expect(resolveConflict(local, remote)).toBe('local')
  })

  it('при рівних часових мітках — перемагає remote (сервер авторитетніший)', () => {
    const ts = '2026-05-15T10:00:00Z'
    const local = {
      updated_at: ts,
      _local_updated_at: new Date(ts).getTime(),
    }
    const remote = { updated_at: ts }

    expect(resolveConflict(local, remote)).toBe('remote')
  })

  it('fallback на updated_at якщо _local_updated_at відсутній', () => {
    const local = { updated_at: '2026-05-15T09:00:00Z' }
    const remote = { updated_at: '2026-05-15T10:00:00Z' }

    expect(resolveConflict(local, remote)).toBe('remote')
  })
})
