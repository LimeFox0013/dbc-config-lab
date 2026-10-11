import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from './schema'

export type DrizzleDb = PostgresJsDatabase<typeof schema>

/** A transaction opened on `DrizzleDb`; services take either where a write must join a caller's transaction. */
export type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0]
