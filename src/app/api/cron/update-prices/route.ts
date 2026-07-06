import { NextRequest } from "next/server";
import { updateAllPrices } from "@/lib/price-update";
import { apiError, safeRoute } from "@/lib/api";

// Weekly price refresh for every household's auto-update holdings.
// Protected by CRON_SECRET (set it in Railway and in whatever scheduler calls this).
// Trigger with: POST/GET /api/cron/update-prices  with header  x-cron-secret: <secret>
//           or  ?secret=<secret> in the query string.
export const maxDuration = 300;

async function handle(req: NextRequest) {
  return safeRoute(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return apiError("CRON_SECRET is not configured on the server.", 503);

    const provided = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
    if (provided !== secret) return apiError("Unauthorized.", 401);

    const result = await updateAllPrices();
    return Response.json({
      ok: true,
      updated: result.updated,
      failed: result.failed,
      ranAt: new Date().toISOString(),
    });
  });
}

export const GET = handle;
export const POST = handle;
