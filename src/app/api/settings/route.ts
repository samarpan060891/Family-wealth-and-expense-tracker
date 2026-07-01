import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { financialSettings } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getCountryPreset } from "@/lib/country-presets";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const [row] = await db
    .select()
    .from(financialSettings)
    .where(eq(financialSettings.householdId, session.householdId));

  if (row) return NextResponse.json({ settings: row });

  const preset = getCountryPreset("India");
  return NextResponse.json({
    settings: {
      householdId: session.householdId,
      country: preset.country,
      currency: preset.currency,
      generalInflationRate: preset.generalInflation.toString(),
      lifestyleUpgradeRate: preset.lifestyleUpgrade.toString(),
      educationInflationRate: preset.educationInflation.toString(),
    },
  });
}

const schema = z.object({
  country: z.string().min(1),
  currency: z.string().min(1),
  generalInflationRate: z.coerce.number().min(0).max(50),
  lifestyleUpgradeRate: z.coerce.number().min(0).max(50),
  educationInflationRate: z.coerce.number().min(0).max(50),
});

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Only the main account holder can update settings" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const db = await getDb();
  const values = {
    householdId: session.householdId,
    country: parsed.data.country,
    currency: parsed.data.currency,
    generalInflationRate: parsed.data.generalInflationRate.toString(),
    lifestyleUpgradeRate: parsed.data.lifestyleUpgradeRate.toString(),
    educationInflationRate: parsed.data.educationInflationRate.toString(),
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(financialSettings)
    .values(values)
    .onConflictDoUpdate({ target: financialSettings.householdId, set: values })
    .returning();

  return NextResponse.json({ settings: row });
}
