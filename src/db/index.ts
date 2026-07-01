import * as schema from "./schema";

const usePglite = !process.env.DATABASE_URL || process.env.DATABASE_URL === "pglite";

// Module-level singleton so hot-reload in dev doesn't spawn multiple connections.
declare global {
  var __db: unknown;
}

async function createDb() {
  if (usePglite) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite("./.pglite-data");
    return drizzle(client, { schema });
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzle(pool, { schema });
}

let dbPromise: ReturnType<typeof createDb> | undefined = global.__db as
  | ReturnType<typeof createDb>
  | undefined;

if (!dbPromise) {
  dbPromise = createDb();
  global.__db = dbPromise;
}

export async function getDb() {
  return dbPromise!;
}
