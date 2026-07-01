import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { sharePermissions } from "@/db/schema";
import type { SessionPayload } from "./auth";

export type ModuleType =
  | "expense"
  | "income"
  | "investment"
  | "debt"
  | "asset"
  | "insurance";

export type CategoryFilter = "all" | "none" | { categories: string[] };

/** Returns what a session's user may see for a given module. Admins always see everything. */
export async function getCategoryFilter(
  session: SessionPayload,
  module: ModuleType
): Promise<CategoryFilter> {
  if (session.role === "admin") return "all";

  const db = await getDb();
  const rows = await db
    .select()
    .from(sharePermissions)
    .where(
      and(
        eq(sharePermissions.memberId, session.userId),
        eq(sharePermissions.module, module)
      )
    );

  if (rows.length === 0) return "none";
  if (rows.some((r) => r.category === null)) return "all";
  return { categories: rows.map((r) => r.category as string) };
}

/** Which categories a session's user may add/edit entries for. Admins always get "all". */
export async function getEditableCategoryFilter(
  session: SessionPayload,
  module: ModuleType
): Promise<CategoryFilter> {
  if (session.role === "admin") return "all";

  const db = await getDb();
  const rows = await db
    .select()
    .from(sharePermissions)
    .where(
      and(
        eq(sharePermissions.memberId, session.userId),
        eq(sharePermissions.module, module),
        eq(sharePermissions.accessLevel, "edit")
      )
    );

  if (rows.length === 0) return "none";
  if (rows.some((r) => r.category === null)) return "all";
  return { categories: rows.map((r) => r.category as string) };
}

export async function canEdit(
  session: SessionPayload,
  module: ModuleType,
  category?: string | null
): Promise<boolean> {
  if (session.role === "admin") return true;
  const db = await getDb();
  const rows = await db
    .select()
    .from(sharePermissions)
    .where(
      and(
        eq(sharePermissions.memberId, session.userId),
        eq(sharePermissions.module, module)
      )
    );
  return rows.some(
    (r) =>
      r.accessLevel === "edit" &&
      (r.category === null || r.category === category)
  );
}
