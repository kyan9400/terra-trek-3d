// Static GitHub Pages build: sets GH_PAGES=1, runs `next build` (output: export) and adds .nojekyll.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const res = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: { ...process.env, GH_PAGES: "1" },
});
if (res.status !== 0) process.exit(res.status ?? 1);

// Without this, Jekyll would hide the _next/ folder
writeFileSync("out/.nojekyll", "");
// the gh-pages branch is a built static copy: tell Vercel's Git integration not to try to deploy it
writeFileSync("out/vercel.json", JSON.stringify({ git: { deploymentEnabled: false } }) + "
");
console.log("Pages build ready in out/");
