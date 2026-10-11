import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { AccountsService, KeysService, PaymentsService } from './accounts'
import { AppModule } from './app.module'
import { DatabaseService, DbEnv } from './db'
import { CALLER_HASH_KEY_ENV, UsageService } from './usage'
import { WebhooksService } from './webhooks'

/** Wiring only: modules are compiled, never initialised, so no database is reached. */
describe('AppModule', () => {
  beforeAll(() => {
    vi.stubEnv(DbEnv.Url, 'postgres://lab@127.0.0.1:1/never-connected')
    vi.stubEnv(CALLER_HASH_KEY_ENV, 'test-key')
  })
  afterAll(() => vi.unstubAllEnvs())

  it('resolves every provider the features depend on', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    for (const provider of [
      DatabaseService,
      UsageService,
      AccountsService,
      KeysService,
      PaymentsService,
      WebhooksService,
    ])
      expect(moduleRef.get(provider)).toBeInstanceOf(provider)
    await moduleRef.get(DatabaseService).sql.end()
  })
})
