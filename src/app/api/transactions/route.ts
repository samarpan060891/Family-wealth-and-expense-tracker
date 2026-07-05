import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { transactions, categories } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getCategoryFilter, canEdit } from "@/lib/permissions";
import { displayWithRates, getDisplayCurrency } from "@/lib/display";
import { isSupportedCurrency } from "@/lib/currency";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type") as "expense" | "income" | null;
  const db = await getDb();

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      isTransfer: transactions.isTransfer,
      date: transactions.date,
      paymentMethod: transactions.paymentMethod,
      note: transactions.note,
      isRecurring: transactions.isRecurring,
      recurrenceFrequency: transactions.recurrenceFrequency,
      createdById: transactions.createdById,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      type
        ? and(eq(transactions.householdId, session.householdId), eq(transactions.type, type))
        : eq(transactions.householdId, session.householdId)
    )
    .orderBy(desc(transactions.date));

  let visible = rows;
  if (session.role !== "admin") {
    const expenseFilter = await getCategoryFilter(session, "expense");
    const incomeFilter = await getCategoryFilter(session, "income");
    visible = rows.filter((r) => {
      const filter = r.type === "expense" ? expenseFilter : incomeFilter;
      if (filter === "none") return false;
      if (filter === "all") return true;
      return r.categoryName ? filter.categories.includes(r.categoryName) : false;
    });
  }

  const { displayCurrency, rates } = await displayWithRates(session, visible.map((r) => r.currency));
  return NextResponse.json({ transactions: visible, displayCurrency, rates });
}

const schema = z.object({
  type: z.enum(["expense", "income"]),
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  date: z.string(),
  paymentMethod: z.enum([
    "cash",
    "debit_card",
    "credit_card",
    "upi",
    "bank_transfer",
    "auto_debit",
    "cheque",
    "dividend",
    "other",
  ]),
  note: z.string().optional(),
  currency: z.string().length(3).optional(),
  isTransfer: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  recurrenceFrequency: z
    .enum(["one_time", "monthly", "quarterly", "half_yearly", "yearly"])
    .default("one_time"),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const db = await getDb();
  const [category] = await db.select().from(categories).where(eq(categories.id, parsed.data.categoryId));
  if (!category || category.householdId !== session.householdId)
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const allowed = session.role === "admin" || (await canEdit(session, parsed.data.type, category.name));
  if (!allowed) return NextResponse.json({ error: "You do not have permission to add this entry" }, { status: 403 });

  const { base } = await getDisplayCurrency(session);
  const currency =
    parsed.data.currency && isSupportedCurrency(parsed.data.currency) ? parsed.data.currency : base;

  const [row] = await db
    .insert(transactions)
    .values({
      householdId: session.householdId,
      createdById: session.userId,
      type: parsed.data.type,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount.toString(),
      currency,
      isTransfer: parsed.data.isTransfer,
      date: parsed.data.date,
      paymentMethod: parsed.data.paymentMethod,
      note: parsed.data.note,
      isRecurring: parsed.data.isRecurring,
      recurrenceFrequency: parsed.data.recurrenceFrequency,
    })
    .returning();

  return NextResponse.json({ transaction: row });
}
