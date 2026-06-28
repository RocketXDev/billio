// Prerenders the public marketing/content pages to static HTML so crawlers
// that don't execute JavaScript (most AI bots — GPTBot, ClaudeBot, etc. —
// unlike Googlebot, which does render JS) see real content instead of the
// empty SPA shell.
//
// This intentionally does NOT touch "/" (the homepage) — Vite forbids an
// index.html inside public/ (it collides with the root index.html template
// it builds from), so the homepage needs a different mechanism. Every other
// public route maps cleanly to public/<route>/index.html, which Vite copies
// straight into dist/ on the next build, and Vercel serves static files
// ahead of the SPA rewrite automatically — no Vercel build/config changes,
// no headless browser ever runs in Vercel's own build container.
//
// Usage:
//   npm run build       # build once so there's a dist/ to preview
//   npm run prerender   # snapshot routes into public/<route>/index.html
//   git add public && git commit && git push
//
// Re-run `npm run prerender` (after a fresh `npm run build`) whenever the
// content on these pages changes — these are static snapshots, not
// generated automatically on every deploy.

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

const STATIC_ROUTES = [
  "/about",
  "/blog",
  "/support",
  "/privacy",
  "/terms",
  "/sms-opt-in",
];

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function discoverBlogSlugs(page) {
  await page.goto(`${BASE_URL}/blog`, { waitUntil: "networkidle" });
  const hrefs = await page.$$eval('a[href^="/blog/"]', (links) =>
    links.map((a) => a.getAttribute("href"))
  );
  const slugs = new Set();
  for (const href of hrefs) {
    const match = href && href.match(/^\/blog\/([^/?#]+)/);
    if (match) slugs.add(match[1]);
  }
  return [...slugs];
}

async function snapshotRoute(page, route) {
  const url = `${BASE_URL}${route}`;
  await page.goto(url, { waitUntil: "networkidle" });

  try {
    await page.waitForFunction(
      () => !!document.querySelector("h1")?.textContent?.trim(),
      { timeout: 5_000 }
    );
  } catch {
    console.warn(`  ! ${route}: no non-empty <h1> found within 5s — capturing anyway`);
  }

  const html = await page.content();
  const outDir = join(ROOT, "public", route.replace(/^\//, ""));
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "index.html"), html, "utf8");
  console.log(`  ✓ ${route} -> public/${route.replace(/^\//, "")}/index.html`);
}

async function main() {
  console.log(`Starting "vite preview" on port ${PORT}...`);
  const preview = spawn(
    "npx",
    ["vite", "preview", "--port", String(PORT), "--strictPort"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
  );

  let previewOutput = "";
  preview.stdout.on("data", (d) => (previewOutput += d.toString()));
  preview.stderr.on("data", (d) => (previewOutput += d.toString()));

  const cleanup = () => {
    preview.kill();
  };

  try {
    await waitForServer(BASE_URL);

    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log("Discovering blog post slugs from /blog...");
    const blogSlugs = await discoverBlogSlugs(page);
    const blogRoutes = blogSlugs.map((slug) => `/blog/${slug}`);
    const routes = [...STATIC_ROUTES, ...blogRoutes];

    console.log(`Prerendering ${routes.length} routes:`);
    const failures = [];
    for (const route of routes) {
      try {
        await snapshotRoute(page, route);
      } catch (err) {
        failures.push(route);
        console.error(`  ✗ ${route}: ${err.message}`);
      }
    }

    await browser.close();

    if (failures.length > 0) {
      console.error(`\n${failures.length} route(s) failed: ${failures.join(", ")}`);
      process.exitCode = 1;
    } else {
      console.log(`\nDone. Prerendered ${routes.length} routes into public/.`);
      console.log('Review the diff, then: git add public && git commit && git push');
    }
  } catch (err) {
    console.error("Prerender failed:", err);
    console.error("--- vite preview output ---");
    console.error(previewOutput);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

main();
