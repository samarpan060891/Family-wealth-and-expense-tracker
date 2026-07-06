import { getRate } from "@/lib/fx";

// Cash-account balances, computed from linked transactions:
//   balance = opening + income into the account − expenses out of it.
// Credit-card *purchases* (paymentMethod "credit_card") don't touch cash — they
// raise the card's outstanding instead. Card bill payments are regular expenses
// (a transfer out of the paying account) and DO reduce the balance.

export type TxForBalance = {
  accountId: string | null;
  type: "income" | "expense";
  amount: string;
  currency: string;
  paymentMethod: string;
};
export type AccountForBalance = { id: string; currency: string; openingBalance: string };

export async function computeBalances(
  accounts: AccountForBalance[],
  txs: TxForBalance[]
): Promise<Map<string, number>> {
  const rateCache = new Map<string, number>();
  const rate = async (from: string, to: string) => {
    if (from === to) return 1;
    const key = `${from}>${to}`;
    if (!rateCache.has(key)) rateCache.set(key, await getRate(from, to));
    return rateCache.get(key)!;
  };

  const byAccount = new Map<string, TxForBalance[]>();
  for (const t of txs) {
    if (!t.accountId) continue;
    (byAccount.get(t.accountId) ?? byAccount.set(t.accountId, []).get(t.accountId)!).push(t);
  }

  const out = new Map<string, number>();
  for (const a of accounts) {
    let bal = Number(a.openingBalance);
    for (const t of byAccount.get(a.id) ?? []) {
      const amt = Number(t.amount) * (await rate(t.currency, a.currency));
      if (t.type === "income") bal += amt;
      else if (t.paymentMethod !== "credit_card") bal -= amt; // card purchases don't touch cash
    }
    out.set(a.id, Math.round(bal * 100) / 100);
  }
  return out;
}
