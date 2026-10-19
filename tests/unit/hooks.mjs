// Lets Node run src/ TypeScript directly in unit tests: resolves the
// extensionless imports Vite allows, and swaps the real Supabase client for
// an in-memory fake so nothing touches the network.
import { registerHooks } from "node:module";

const FAKE_CLIENT = new URL("./fakeSupabaseClient.ts", import.meta.url).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith("/supabaseClient")) return { url: FAKE_CLIENT, shortCircuit: true };
    if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL?.includes("/src/")) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});
