import { Global, Module } from '@nestjs/common'
import { DRIZZLE_DB } from './constants'
import { DatabaseService } from './database.service'
import type { DrizzleDb } from './types'

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: DRIZZLE_DB,
      useFactory: (service: DatabaseService): DrizzleDb => service.db,
      inject: [DatabaseService],
    },
  ],
  exports: [DRIZZLE_DB, DatabaseService],
})
export class DbModule {}
