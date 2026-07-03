// Single source of truth for the app's navigable screens.
//
// Today this backs web navigation and gives deep links a stable, documented
// surface. When the app is ported to React Native + Expo, this same map feeds a
// React Navigation `linking` config (see MOBILE_MIGRATION.md), so a URL like
// https://<host>/investments and a native deep link familywealth://investments
// resolve to the same screen. Keep paths here in sync with the App Router folders.

export type AppRoute = {
  /** URL path (web) / deep-link path (native). */
  path: string;
  /** Stable screen name for React Navigation. */
  screen: string;
  /** Human label used in navigation UIs. */
  label: string;
  /** Requires the admin (main account holder) role. */
  adminOnly?: boolean;
  /** Reachable without a session (login / invite acceptance). */
  public?: boolean;
};

export const ROUTES = {
  login: { path: "/login", screen: "Login", label: "Sign in", public: true },
  register: { path: "/register", screen: "Register", label: "Create household", public: true },
  acceptInvite: { path: "/accept-invite", screen: "AcceptInvite", label: "Accept invite", public: true },

  dashboard: { path: "/dashboard", screen: "Dashboard", label: "Overview" },
  expenses: { path: "/expenses", screen: "Expenses", label: "Expenses" },
  income: { path: "/income", screen: "Income", label: "Income" },
  investments: { path: "/investments", screen: "Investments", label: "Investments" },
  debts: { path: "/debts", screen: "Debts", label: "Debts" },
  assets: { path: "/assets", screen: "Assets", label: "Assets" },
  insurance: { path: "/insurance", screen: "Insurance", label: "Insurance" },
  goals: { path: "/goals", screen: "Goals", label: "Goals" },
  reports: { path: "/reports", screen: "Reports", label: "Reports" },
  account: { path: "/account", screen: "Account", label: "Settings" },

  planning: { path: "/planning", screen: "Planning", label: "Life Planning", adminOnly: true },
  family: { path: "/family", screen: "Family", label: "Family Sharing", adminOnly: true },
} satisfies Record<string, AppRoute>;

export type RouteKey = keyof typeof ROUTES;

/** Custom scheme for native deep links, e.g. familywealth://investments */
export const DEEP_LINK_SCHEME = "familywealth";

/** Build an absolute web URL for a route (optionally on a given origin). */
export function webUrl(key: RouteKey, origin = ""): string {
  return `${origin}${ROUTES[key].path}`;
}

/** Build a native deep link for a route, e.g. familywealth://investments */
export function deepLink(key: RouteKey): string {
  return `${DEEP_LINK_SCHEME}:/${ROUTES[key].path}`;
}
