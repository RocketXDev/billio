# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working directory

The actual app lives in this `billio/` folder (this is where `.git`, `package.json`, and `src/` are). The parent folder (`Billio/`) is just a loose container with a stray `package.json`/`node_modules` and an `ideas/` folder of design reference images — it is not part of the app and should be ignored.

## Commands

Run from this directory (`billio/`):

- `npm run dev` — start Vite dev server
- `npm run build` — type-check (`tsc -b`) and production build to `dist/`
- `npm run preview` — preview the production build locally

There is no test suite and no `lint` script configured in `package.json`, even though `eslint.config.js` exists — run `npx eslint .` directly if you need to lint. There's no CI config in the repo.

## Architecture

Billio is a mobile-first PWA for coaches/tutors to manage students, lessons, and invoicing. It's a single-page React app with **no backend code of its own** — Supabase is the entire backend (Postgres, Auth, Row Level Security, Storage), called directly from page components via `src/lib/supabaseClient.ts`. There is no API/service layer to look for; data access lives inline inside the component that needs it.

### Identity & plan model

- `useCoachIdentity` (`src/hooks/useCoachIdentity.ts`) is the root data hook: it resolves the Supabase auth session → `profiles` row → `coaches` row, and is cached via React Query under `["coach-identity"]`.
- `usePlan` and `useSettings` both derive from `useCoachIdentity`. `usePlan` exposes `isPro`/`isFree` (`coaches.plan`), used throughout the app to gate Pro-only features (e.g. SMS delivery options are disabled with a lock icon for free users — see the onboarding form in `Dashboard.tsx`).
- `useSettings` reads per-coach defaults (lesson duration, due-date days, invoice prefix, time format) with hardcoded fallbacks in `DEFAULTS`.
- RLS in Supabase is the actual security boundary — every query also filters by `coach_id`/`profile_id` in app code, but don't assume app-level filtering alone is what protects data.

### Routing & layout

- All routes are declared flat in `src/App.tsx` (`react-router-dom` v7, no nested route config). Public routes (landing, login, legal pages) render directly; authenticated routes are wrapped twice: `<ProtectedRoute><DesktopLayout><Page /></DesktopLayout></ProtectedRoute>`.
- `ProtectedRoute` (`src/pages/ProtectedRoute/ProtectedRoute.tsx`) just checks for a live Supabase session and redirects to `/login` otherwise.
- **Important**: this app is not split into separate mobile/desktop component trees. Most page components (e.g. `Dashboard.tsx`) render their own full mobile UI directly (mobile header, bottom nav, slide-out menu, bottom sheets) — `DesktopLayout` then wraps that same page with a desktop sidebar/topbar shell. Both markups exist in the DOM simultaneously and visibility is controlled by CSS breakpoints, not by separate components. When changing a page's layout, check the page's own CSS file for the responsive rules rather than expecting a separate desktop component.
- Page-level state in larger pages (e.g. `Dashboard.tsx`) tends to be a large flat set of `useState` calls rather than reducers/forms libraries — follow the existing pattern rather than introducing a new state management approach mid-file.

### Data fetching

- `@tanstack/react-query` is used for all server state. `queryClient` defaults (`src/lib/queryClient.ts`): 5 min `staleTime`, 10 min `gcTime`, no refetch-on-window-focus.
- Query keys follow `["<resource>", coachId]` (e.g. `["lessons", coachId]`, `["invoices", coachId]`), gated with `enabled: !!coachId` until identity resolves. Mutations call Supabase directly (not via `useMutation`) and then manually `queryClient.invalidateQueries({ queryKey: [...] })` — follow this pattern for new mutations rather than introducing `useMutation`.

### Notifications

The in-app notification bell (`notifications` table) doubles as the mechanism for onboarding nudges, PWA install prompts, and tutorial resets — these are synthetic notification rows upserted by app code (see `createInstallNotification` in `src/lib/installNotification.ts` and the onboarding/tutorial-reset notification logic in `Dashboard.tsx`), not just user-facing messages. `notification.type` (`onboarding`, `install_prompt`, `tutorial_reset`, ...) drives special click behavior in `markNotificationAsRead`/`markRead` handlers in both `Dashboard.tsx` and `DesktopLayout.tsx` — these two files duplicate the notification dropdown logic for mobile vs. desktop, so changes there usually need to be made in both places.

### PWA install flow

`useInstallPrompt` (platform detection, `beforeinstallprompt` capture, snooze state in `localStorage`) + `InstallGuide`/`InstallBanner` components (`src/components/InstallGuide/`) implement the "Add to Home Screen" flow for iOS/Android. Icons/manifests live under `public/android`, `public/ios`, `public/web`, `public/manifest.json`.

### PDF invoices

`src/pages/PdfInvoice/PdfInvoice.tsx` uses `jspdf` directly to generate branded invoice PDFs (line items, mileage at a hardcoded national IRS rate, custom branding colors) — there's no shared PDF template module, it's built inline in that page.

### Onboarding & tutorials

First-time UX (coach setup form, per-page tutorial walkthroughs for Dashboard/Lessons/Students/Invoices/More) is tracked entirely via `localStorage` flags (e.g. `billio_dashboard_tutorial_seen`) rather than a `profiles`/`coaches` column. `resetAllTutorials()` in `Dashboard.tsx` clears all of these at once.

### Environment

Supabase config is read from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored, not committed). Deployment is Vercel; `vercel.json` rewrites all paths to `/` for client-side routing.

## Landing page redesign — design system
- Direction: bold "dark hero" landing page. Rhythm = dark hero → light body → dark CTA.
- Brand purple #3b33d9; accent gradient linear-gradient(135deg,#4338FF,#3b33d9).
- Dark anchor tones: #1e1b4b (deepest), #312E81 (indigo).
- Light body surface #f6f7fb; cards #ffffff with real shadows (not 0.06 alpha).
- Keep React + react-router + react-icons. Don't change routing or auth.
- Mobile-first. Test at 375px, 768px, 1024px, 1440px.
- Edit existing files in place; don't create a parallel set.
