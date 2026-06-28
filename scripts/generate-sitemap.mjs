// Regenerates public/sitemap.xml from the static marketing pages below plus
// every post in src/content/blogPosts.tsx, so adding a blog post can never
// leave the sitemap out of sync again (which is exactly what happened with
// the third post before this script existed).
//
// Usage:
//   npm run sitemap
//   git add public/sitemap.xml && git commit
//
// Re-run whenever a blog post is added, removed, or its publishedAt changes.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE_URL = "https://www.mybillioapp.com";
const TODAY = new Date().toISOString().slice(0, 10);

const STATIC_PAGES = [
  { path: "/", lastmod: TODAY, changefreq: "monthly", priority: "1.0" },
  { path: "/login", lastmod: TODAY, changefreq: "yearly", priority: "0.7" },
  { path: "/signup", lastmod: TODAY, changefreq: "yearly", priority: "0.8" },
  { path: "/about", lastmod: TODAY, changefreq: "monthly", priority: "0.6" },
  { path: "/support", lastmod: TODAY, changefreq: "monthly", priority: "0.6" },
  { path: "/blog", lastmod: TODAY, changefreq: "weekly", priority: "0.7" },
  { path: "/privacy", lastmod: TODAY, changefreq: "yearly", priority: "0.4" },
  { path: "/terms", lastmod: TODAY, changefreq: "yearly", priority: "0.4" },
];

function urlEntry({ path, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// blogPosts.tsx contains JSX, which plain Node can't import directly, so the
// post list is read as text instead of executing the module — slug and
// publishedAt are the only fields the sitemap needs.
async function readBlogPosts() {
  const source = await readFile(join(ROOT, "src/content/blogPosts.tsx"), "utf8");
  const posts = [];
  const postBlockRe = /slug:\s*"([^"]+)"[\s\S]*?publishedAt:\s*"([^"]+)"/g;
  let match;
  while ((match = postBlockRe.exec(source))) {
    posts.push({ slug: match[1], publishedAt: match[2] });
  }
  return posts;
}

async function main() {
  const posts = await readBlogPosts();

  const blogEntries = posts.map(({ slug, publishedAt }) =>
    urlEntry({
      path: `/blog/${slug}`,
      lastmod: publishedAt,
      changefreq: "monthly",
      priority: "0.6",
    })
  );

  const entries = [...STATIC_PAGES.map(urlEntry), ...blogEntries];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${entries.join("\n\n")}

</urlset>
`;

  const outPath = join(ROOT, "public", "sitemap.xml");
  await writeFile(outPath, xml, "utf8");
  console.log(`Wrote ${entries.length} URLs to public/sitemap.xml`);
}

main();
