import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../db/schema'
import type { DrizzleDb } from '../db'

/**
 * Test support: a typed database with no connection, for specs whose path
 * under test never reaches it. Any query it is asked to run fails.
 */
export const mockDb = (): DrizzleDb => drizzle.mock({ schema })
