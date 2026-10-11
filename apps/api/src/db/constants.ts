export const DRIZZLE_DB = Symbol('DRIZZLE_DB')

/** Connections this service keeps to its database; well under the platform's per-role cap of 10. */
export const DB_POOL_SIZE = 5

/** Configuration the database connection reads from its environment. */
export enum DbEnv {
  /** The connection string; required. */
  Url = 'DATABASE_URL',
  /** Where the migrations are; defaults to `MIGRATIONS_FOLDER` next to the bundle. */
  MigrationsDir = 'MIGRATIONS_DIR',
}

/** The migrations folder the build copies next to `main.js`. */
export const MIGRATIONS_FOLDER = 'drizzle'
