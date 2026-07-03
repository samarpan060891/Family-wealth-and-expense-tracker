# Mobile App Conversion Guide

How FamilyWealth is prepared for phones today, and what it takes to ship a native
app with **React Native + Expo** later.

---

## 1. PWA — installable today

The app is an installable Progressive Web App. On a phone, open it in the browser
and choose **"Add to Home Screen"** (iOS Safari) or **"Install app"** (Android
Chrome). It launches full-screen with its own icon.

What's wired up:

- **`public/manifest.json`** — name, standalone display, portrait orientation,
  theme/background colors, `scope`, `id`, app **shortcuts** (long-press the icon →
  Add expense / Dashboard / Reports) and **maskable** icons.
- **Icons** — real PNGs at 192/512 (`any` + `maskable`) plus a 180px
  `apple-touch-icon.png`, generated from the brand mark with `sharp`
  (regenerate via a short script using `sharp` if the logo changes).
- **`public/sw.js`** — a deliberately conservative service worker. It **never
  caches `/api/*` or authenticated navigations** (no stale balances, no
  cross-member data leaks); it precaches only static shell assets and serves
  `offline.html` when the network is down. Registered by
  `src/components/pwa-register.tsx` in production only.
- **`src/app/layout.tsx`** — manifest link, apple-web-app meta, icon metadata,
  `viewport-fit=cover` (for notch safe areas) and an aligned `theme_color`.

> A PWA gets you ~80% of a native feel with one codebase. Go native (below) when
> you need App/Play Store distribution, push notifications, biometric unlock, or
> deeper OS integration.

---

## 2. Responsive design

- Mobile-first Tailwind throughout; the shell is a bottom tab bar (4 primary tabs
  + a "More" sheet) on phones and a sidebar on `lg+`.
- Form controls render at **16px on ≤640px** so iOS Safari doesn't zoom on focus.
- **Safe-area insets** are respected on the mobile header (`env(safe-area-inset-top)`)
  and bottom nav (`env(safe-area-inset-bottom)`).
- Wide content (report tables) scrolls inside `overflow-x-auto` so the page body
  never scrolls sideways.

---

## 3. Deep linking

`src/lib/routes.ts` is the **single source of truth** for every navigable screen:
its path, a stable `screen` name for React Navigation, a label, and role/public
flags. It also exposes `webUrl()`, `deepLink()` and `DEEP_LINK_SCHEME`
(`familywealth://`). Because each screen already has a clean, stable URL under the
App Router, the same map drops straight into an Expo Router / React Navigation
`linking` config so `https://<host>/investments` and `familywealth://investments`
resolve to the same screen.

---

## 4. Code structure — how migration-ready it is

The codebase separates cleanly into **portable** and **web-specific** layers:

| Layer | Location | Reuse in RN? |
|---|---|---|
| Business/domain logic | `src/lib/*` (`insights`, `cashflow`, `amortization`, `projection`, `permissions`, `validation`, `categories`, `routes`) | ✅ **Copy as-is** — pure TypeScript, no DOM |
| Backend API | `src/app/api/**` | ✅ **Keep** — the RN app calls the same HTTP endpoints |
| Database / auth server | `src/db/*`, `src/lib/auth.ts` | ✅ Keep server-side |
| UI screens & components | `src/app/(app)/**`, `src/components/*` | ♻️ **Rebuild** — HTML/Tailwind/Recharts → RN primitives |

Keeping validation/analytics/route definitions framework-agnostic in `src/lib`
means the hard logic is already shareable; only the presentation layer is rebuilt.

---

## 5. React Native + Expo conversion checklist

### Project setup
- [ ] `npx create-expo-app` with **Expo Router** (file-based routing mirrors the
      current App Router structure).
- [ ] Add the shared code: copy `src/lib/{routes,validation,categories,insights,cashflow,amortization,projection,helplines,country-presets,extract-fields}.ts` into the Expo app (or extract to a shared workspace package).
- [ ] Configure `app.json`: `scheme: "familywealth"`, iOS/Android icons & splash,
      `orientation: "portrait"`.

### Navigation & deep linking
- [ ] Build the React Navigation `linking` config from `src/lib/routes.ts`
      (`prefixes: [Linking.createURL('/'), 'https://<host>']`).
- [ ] Recreate the tab bar (primary tabs) + stack for detail screens.

### Auth (biggest change)
- [ ] Web auth uses an **httpOnly cookie**; RN can't read those. Switch the API to
      also accept a **Bearer token**, or use `fetch` with `credentials` + a cookie
      manager. Store the token in **`expo-secure-store`**, not AsyncStorage.
- [ ] Add an API base URL (env) since RN has no same-origin — all `fetch("/api/...")`
      calls become `fetch(`${API_BASE}/api/...`)`. Centralize in one API client.
- [ ] Optional: biometric unlock via `expo-local-authentication`.

### Screen rebuild (UI layer)
- [ ] Replace HTML (`div`/`input`/`select`/`table`) with RN primitives
      (`View`/`TextInput`/`Picker`/`FlatList`).
- [ ] Port Tailwind classes to **NativeWind** (Tailwind for RN) to reuse the design tokens.
- [ ] Charts: **Recharts → Victory Native / react-native-gifted-charts** (net-worth
      area, category pie, monthly bars, cashflow line).
- [ ] Toasts: `src/components/toast.tsx` → `react-native-toast-message` or a RN reimpl.
- [ ] Modals/sheets → RN `Modal` / `@gorhom/bottom-sheet`.

### Native capabilities
- [ ] Document capture / attachments: `<input capture>` → **`expo-image-picker`** /
      **`expo-camera`**; upload via `FormData` to the existing attachments API.
- [ ] PDF report: `window.print()` → **`expo-print`** + `expo-sharing`
      (reuse the report data from `/api/dashboard`).
- [ ] Push notifications (renewals/expiries): **`expo-notifications`** + a server
      trigger (currently surfaced only in-app on the dashboard).

### Release
- [ ] Set up **EAS Build** & **EAS Submit** for App Store / Play Store.
- [ ] Add app privacy declarations (financial data), and an account-deletion flow
      if required by the stores.

---

## Current readiness

| Area | Status |
|---|---|
| Installable PWA (offline shell, icons, shortcuts) | ✅ Done |
| Mobile-first responsive UI + safe areas | ✅ Done |
| Stable deep-link route registry | ✅ Done |
| Portable business logic separated from UI | ✅ Done |
| API-first backend (reusable by native) | ✅ Done |
| Token/Bearer auth for native clients | ⏳ Needed for RN |
| Native UI screens (NativeWind + RN charts) | ⏳ Rebuild for RN |
| Native camera / print / push modules | ⏳ For RN |

**Overall: production-ready as an installable PWA today, and well-architected for
a React Native + Expo port.** The remaining native work is concentrated in two
areas — swapping cookie auth for token auth, and rebuilding the presentation layer
— while all domain logic, routes, and APIs carry over unchanged.
