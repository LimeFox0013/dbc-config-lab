import { afterEach, describe, expect, it, vi } from 'vitest'
import { DbEnv } from './constants'
import { DatabaseService } from './database.service'

describe('DatabaseService', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('refuses to start without a connection string', () => {
    vi.stubEnv(DbEnv.Url, '')
    expect(() => new DatabaseService()).toThrow(DbEnv.Url)
  })
})
