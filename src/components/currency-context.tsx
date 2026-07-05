"use client";
import { createContext, useContext } from "react";

type CurrencyCtx = { displayCurrency: string; defaultCurrency: string; isAdmin: boolean };
const Ctx = createContext<CurrencyCtx>({ displayCurrency: "INR", defaultCurrency: "INR", isAdmin: false });

export function CurrencyProvider({
  displayCurrency,
  defaultCurrency,
  isAdmin,
  children,
}: CurrencyCtx & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ displayCurrency, defaultCurrency, isAdmin }}>{children}</Ctx.Provider>;
}

/** The viewer's preferred display currency + the household's default currency. */
export function useCurrencyCtx() {
  return useContext(Ctx);
}
