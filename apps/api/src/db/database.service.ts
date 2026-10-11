import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { join } from 'node:path'
import postgres from 'postgres'
import { requiredEnv } from '../utils'
import { DB_POOL_SIZE, DbEnv, MIGRATIONS_FOLDER } from './constants'
import * as schema from './schema'
import type { DrizzleDb } from './types'

/**
 * The API's own database. On lime-fox-infra it is provisioned for this pod
 * (`persistenceKind: DATABASE`) and arrives as `DATABASE_URL`; migrations run
 * before the app serves, so a fresh database is usable immediately.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  readonly sql: ReturnType<typeof postgres>
  readonly db: DrizzleDb

  constructor() {
    this.sql = postgres(requiredEnv(DbEnv.Url), { max: DB_POOL_SIZE })
    this.db = drizzle(this.sql, { schema })
  }

  async onModuleInit(): Promise<void> {
    await migrate(this.db, {
      migrationsFolder:
        process.env[DbEnv.MigrationsDir] ?? join(__dirname, MIGRATIONS_FOLDER),
    })
    this.logger.log('Database migrations applied')
  }

  async onModuleDestroy(): Promise<void> {
    await this.sql.end()
  }
}
