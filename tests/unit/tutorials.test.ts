import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ALL_TUTORIALS, formatLength, tutorialFile } from "../../src/content/tutorials.ts";

test("every tutorial has its video and thumbnail in public/", () => {
  for (const { slug } of ALL_TUTORIALS) {
    for (const ext of ["mp4", "jpg"] as const) {
      const path = tutorialFile(slug, ext).split("?")[0];
      assert.ok(existsSync(new URL(`../../public${path}`, import.meta.url)), `${path} is missing`);
    }
  }
});

test("tutorial slugs are unique and lengths read as m:ss", () => {
  const slugs = ALL_TUTORIALS.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(formatLength(46), "0:46");
  assert.equal(formatLength(9), "0:09");
  assert.equal(formatLength(75), "1:15");
});
