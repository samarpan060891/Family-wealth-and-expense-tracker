import { getDb } from "./index";

const usePglite = !process.env.DATABASE_URL || process.env.DATABASE_URL === "pglite";

async function main() {
  const db = await getDb();
  if (usePglite) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder: "./drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder: "./drizzle" });
  }
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
