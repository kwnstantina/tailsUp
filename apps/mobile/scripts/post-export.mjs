// Post-processes the Expo Router static web export for static hosting
// (Cloudflare Pages). Runs after `expo export -p web` via `npm run build:web`.
//
// Three jobs, all fixing artifacts of `web.output: "static"`:
//
//   1. EMIT /app-shell.html — the bracket-free copy of the (app) client shell
//      that public/_redirects rewrites the dynamic routes to. See _redirects for
//      why a bracket-free destination is used.
//
//   2. EMIT /404.html — Expo names its not-found route "+not-found.html", but
//      Cloudflare's `not_found_handling: "404-page"` (wrangler.jsonc) looks for
//      the conventional "404.html". Without the copy, unmatched URLs fall back
//      to a bare Cloudflare error page instead of the site's own.
//
//   3. DROP the literal "(group)" directories — Expo emits each route TWICE:
//      once at its real URL (/about) and once under its route-group directory
//      (/(site)/about). The group form is an internal routing concept that was
//      never meant to be a URL; left in place it is a second, crawlable copy of
//      every page (duplicate content) and a second copy of the app shell.
//
// Fails loudly on anything unexpected: a silent no-op here becomes a 404 in
// production, which is exactly the failure this script exists to prevent.

import { existsSync } from 'node:fs';
import { copyFile, readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const distDir = resolve(process.argv[2] ?? 'dist');

// Any (app) route serves — they are byte-identical. /client.html is a plain
// static route with no dynamic segment, so it is the stable pick.
const SHELL_SOURCE = 'client.html';
const SHELL_TARGET = 'app-shell.html';

// Expo's not-found route -> the filename Cloudflare's "404-page" mode expects.
const NOT_FOUND_SOURCE = '+not-found.html';
const NOT_FOUND_TARGET = '404.html';

function fail(message) {
  console.error(`\n[post-export] FAILED: ${message}\n`);
  process.exit(1);
}

if (!existsSync(distDir)) {
  fail(`export directory not found: ${distDir}\nRun \`expo export -p web\` first.`);
}

// ── 1. app shell ──────────────────────────────────────────────────────────────
const shellSource = join(distDir, SHELL_SOURCE);
if (!existsSync(shellSource)) {
  fail(
    `expected the app shell at ${SHELL_SOURCE}, but it is not in the export.\n` +
      `public/_redirects rewrites every dynamic route to /${SHELL_TARGET}, which is ` +
      `a copy of it — without it those routes 404.\n` +
      `If the /client route was renamed or removed, point SHELL_SOURCE at another ` +
      `(app) route and update this message.`,
  );
}
await copyFile(shellSource, join(distDir, SHELL_TARGET));
const shellBytes = (await stat(shellSource)).size;
console.log(`[post-export] ${SHELL_TARGET} <- ${SHELL_SOURCE} (${shellBytes} bytes)`);

// ── 2. 404 page ───────────────────────────────────────────────────────────────
const notFoundSource = join(distDir, NOT_FOUND_SOURCE);
if (!existsSync(notFoundSource)) {
  fail(
    `expected Expo's not-found route at ${NOT_FOUND_SOURCE}, but it is not in the export.\n` +
      `wrangler.jsonc sets not_found_handling: "404-page", which serves /${NOT_FOUND_TARGET}; ` +
      `without it unmatched URLs get a bare Cloudflare error page.`,
  );
}
await copyFile(notFoundSource, join(distDir, NOT_FOUND_TARGET));
console.log(`[post-export] ${NOT_FOUND_TARGET} <- ${NOT_FOUND_SOURCE}`);

// ── 3. route-group directories ────────────────────────────────────────────────
const entries = await readdir(distDir, { withFileTypes: true });
const groupDirs = entries
  .filter((e) => e.isDirectory() && e.name.startsWith('(') && e.name.endsWith(')'))
  .map((e) => e.name);

for (const dir of groupDirs) {
  await rm(join(distDir, dir), { recursive: true, force: true });
  console.log(`[post-export] removed duplicate route-group directory: ${dir}/`);
}

if (groupDirs.length === 0) {
  console.log('[post-export] no route-group directories found (nothing to prune)');
}

// ── sanity check ──────────────────────────────────────────────────────────────
// The marketing pages are the whole point of static rendering; if pruning ever
// takes one out, that must not reach production silently.
const REQUIRED = ['index.html', 'about.html', 'services.html', 'results.html', 'contact.html', 'booking.html', 'login.html', SHELL_TARGET, NOT_FOUND_TARGET];
const missing = REQUIRED.filter((f) => !existsSync(join(distDir, f)));
if (missing.length > 0) {
  fail(`these files are missing from the export: ${missing.join(', ')}`);
}

console.log(`[post-export] OK — ${REQUIRED.length} required files present in ${distDir}`);
