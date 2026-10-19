import { lazy, type ComponentType } from "react";

const RELOAD_FLAG = "billio_chunk_reload";

// Route-level code splitting: each page's code downloads only when that page
// is first opened, so landing-page visitors don't download the whole app.
//
// After a deploy, a tab that was opened on the previous build asks for
// page files that no longer exist. Reload once to pick up the new build
// instead of crashing; the flag stops a reload loop if the failure is real
// (e.g. offline), in which case the error reaches the ErrorBoundary.
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().then(
      (module) => {
        sessionStorage.removeItem(RELOAD_FLAG);
        return module;
      },
      (error) => {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, "1");
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw error;
      }
    )
  );
}
