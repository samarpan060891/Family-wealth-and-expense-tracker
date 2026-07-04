import { updateHouseholdPrices } from "@/lib/price-update";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, UNAUTHORIZED } from "@/lib/api";

// On-demand price refresh for the signed-in user's household (admin only).
// Lets you update now instead of waiting for the weekly cron.
export const maxDuration = 120;

export async function POST() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    if (session.role !== "admin")
      return apiError("Only the main account holder can refresh prices.", 403);

    const result = await updateHouseholdPrices(session.householdId);
    return Response.json({
      ok: true,
      updated: result.updated,
      failed: result.failed,
      details: result.details,
    });
  });
}
