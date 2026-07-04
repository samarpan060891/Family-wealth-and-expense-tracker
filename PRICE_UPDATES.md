# Automatic investment price updates

Market-linked holdings (stocks, ETFs, mutual funds, gold/metals) can refresh their
value automatically each week, instead of being edited by hand.

## How it works

- On a holding, tick **"Auto-update value from market price"** and enter a
  **symbol** and **quantity/units**. `currentValue = quantity × latest price`.
- **Mutual funds (India):** use the numeric **AMFI scheme code** (e.g. `120503`).
  NAV comes from AMFI's free daily file — no API key.
- **Stocks / ETFs / metals:** use a **Yahoo Finance ticker**. Examples:
  - US: `AAPL`, `VOO`
  - NSE/BSE: append `.NS` / `.BO` — e.g. `RELIANCE.NS`, `INFY.NS`
  - Gold/Silver in ₹: gold/silver ETFs like `GOLDBEES.NS`, `SILVERBEES.NS`
    (priced in ₹ per unit). International metal futures like `GC=F` (gold, USD/oz)
    also work and are converted to ₹.
- **Currency:** any non-₹ price is converted to ₹ automatically using the live FX
  rate, so everything stays consistent with your net worth.

Sources are free and keyless (AMFI + Yahoo Finance). No `ANTHROPIC_API_KEY` needed.

## Manual refresh

Admins see a **"↻ Prices"** button on the Investments page that refreshes the
household's auto-holdings on demand — handy for testing without waiting a week.

## Weekly schedule (once, to save API calls)

1. **Set a shared secret.** In Railway → Variables, add:
   - `CRON_SECRET` = any long random string.
2. **Pick a scheduler** that calls the endpoint weekly with that secret:

   **Option A — GitHub Actions (included).** `.github/workflows/weekly-prices.yml`
   runs every Monday. Add two repository secrets (Settings → Secrets → Actions):
   - `APP_URL` = your app URL (e.g. `https://…up.railway.app`)
   - `CRON_SECRET` = the same value as in Railway

   **Option B — any cron service** (Railway cron, cron-job.org, etc.):
   ```
   POST https://<your-app>/api/cron/update-prices
   Header: x-cron-secret: <CRON_SECRET>
   ```

The endpoint updates every household's auto-holdings and returns
`{ updated, failed }`. Weekly cadence keeps external calls minimal.

## Notes

- Auto-update is set when **creating** a holding. To turn it on for an existing
  holding, re-create it with the symbol/quantity filled in.
- If a symbol can't be priced (bad ticker, source down), that holding is left
  unchanged and counted under `failed` — nothing is overwritten with a bad value.
