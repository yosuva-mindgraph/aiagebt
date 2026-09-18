/* ============================================================================
   The palette contract between src/styles.css and the canvas avatar.

   ── the failure this exists to stop ───────────────────────────────────────
   src/avatar.js reads its colours out of the live CSS custom properties, every
   animation frame, with a hard-coded 2024 hex as the fallback:

       const SKY = css.getPropertyValue('--sky').trim() || '#a1e6ff';

   getPropertyValue() answers '' for a property that is not defined — it does
   not throw and there is no warning. So a rebrand that renames or drops a token
   does not break the avatar: it makes the avatar keep painting the OLD brand,
   forever, while every other surface on the page rebrands around it. Nothing
   else in this repo inspects canvas pixels, so no existing check can see it.
   The bust is drawn on a <canvas>; it has no computed style to assert on and no
   DOM node to query. This file is the only thing standing between a token
   rename and a two-brand avatar on a panel in front of a client.

   ── and the second half, which is subtler ─────────────────────────────────
   Avatar._alpha() (src/avatar.js) parses `#rgb` and `#rrggbb` ONLY. Handed
   anything else — color-mix(), oklch(), light-dark(), a named colour — it
   returns the string UNCHANGED, which means the alpha it was asked for is
   silently dropped. It is called at roughly forty sites for every layer of the
   bust that is meant to be translucent: the ground glow, the shoulders, the
   contour lines, the eye highlights. Feed it one color-mix() token and the
   portrait renders as flat opaque slabs, with no error anywhere.

   Building the NEUTRALS out of color-mix() is fine and the rest of the
   stylesheet does it freely. The four ACCENT tokens the avatar reads are the
   exception, and this file is where that exception is written down: they must
   stay literal hex.

   ── why the token list is derived and never typed ─────────────────────────
   The list below is parsed out of src/avatar.js's SOURCE. A hard-coded list is
   a lie waiting to happen: the bust is scheduled to be replaced by a
   non-figurative aperture, the set of tokens it reads changes with it, and a
   typed list would then guard four tokens that nothing reads while the four new
   ones go unguarded — still green, still useless. Derive it, and the guard
   tracks that rewrite with no edit at all.

   The derivation itself is therefore load-bearing, so it is asserted first: a
   derivation that yields an empty list is a suite that cannot fail, which is
   worse than no suite.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/harness.mjs';

const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* A literal hex colour, which is the only thing Avatar._alpha() can take apart.
   3–8 digits: #rgb, #rgba, #rrggbb, #rrggbbaa are all hex, all parseable. */
const HEX = /^#[0-9a-f]{3,8}$/i;

/** Every `getPropertyValue('--x')` the avatar actually performs. */
function tokensReadBy(src) {
  return [...new Set(
    [...src.matchAll(/getPropertyValue\(\s*['"](--[\w-]+)['"]\s*\)/g)].map(m => m[1]),
  )];
}

/**
 * The declarations inside a CSS rule, found by its selector and read with a
 * brace counter rather than a regex.
 *
 * The counter is what lets one function serve the @media block too: `@media
 * (prefers-color-scheme: light) { :root:not(...) { ... } }` is two levels deep,
 * and `\{([^}]*)\}` stops at the first `}` it meets. Collecting declarations at
 * ANY depth inside the balanced block is correct for both shapes and survives
 * the inner selector being rewritten.
 */
function declarations(css, selectorRe) {
  const m = selectorRe.exec(css);
  if (!m) return null;
  const open = css.indexOf('{', m.index);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) {
      const body = css.slice(open + 1, i);
      const out = new Map();
      for (const d of body.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) out.set(d[1], d[2].trim());
      return out;
    }
  }
  return null;
}

/* The three places a theme is declared. Miss one and you get the bug this file
   was written on top of: --royal defined in :root only, so the LIGHT theme fell
   through to the avatar's dark-theme fallback and the bust painted light mode
   in dark-mode Royal.

   `:root\s*\{` cannot match `:root[data-theme="light"] {` or
   `:root:not([data-theme="dark"]) {` — in both of those a character other than
   whitespace follows `:root` — so the first pattern really is the base block. */
const BLOCKS = [
  [':root', /:root\s*\{/],
  ['[data-theme="light"]', /\[data-theme=["']light["']\]\s*\{/],
  ['@media (prefers-color-scheme: light)', /@media[^{]*prefers-color-scheme\s*:\s*light[^{]*\{/],
];

export async function run(t) {
  const avatarSrc = rd('src/avatar.js');
  const css = rd('src/styles.css');

  /* ── 1. the derivation ──────────────────────────────────────────────── */
  const tokens = tokensReadBy(avatarSrc);
  t.ok(tokens.length > 0,
    'src/avatar.js reads its palette from CSS custom properties (derived, never typed here)',
    tokens.length ? `${tokens.length}: ${tokens.join(' ')}` : 'NONE FOUND — the parse is broken, or the avatar no longer reads CSS');
  if (!tokens.length) return;

  /* ── 2. every block exists and is readable ──────────────────────────── */
  const found = [];
  for (const [label, re] of BLOCKS) {
    const decls = declarations(css, re);
    t.ok(decls && decls.size > 0, `src/styles.css declares a ${label} block`,
      decls ? `${decls.size} custom propert${decls.size === 1 ? 'y' : 'ies'}` : 'NOT FOUND — pattern moved, or the block was removed');
    if (decls && decls.size) found.push([label, decls]);
  }

  /* ── 3. the contract itself ─────────────────────────────────────────── */
  for (const [label, decls] of found) {
    for (const tok of tokens) {
      const value = decls.get(tok);
      t.ok(value !== undefined,
        `${label} defines ${tok}`,
        value !== undefined ? value
          : `MISSING — the avatar falls back to its hard-coded default and keeps painting the old brand in this theme`);
      if (value === undefined) continue;
      t.ok(HEX.test(value),
        `${label} ${tok} is literal hex (Avatar._alpha() parses nothing else)`,
        HEX.test(value) ? value
          : `${value} — _alpha() returns this unchanged, so every translucent layer of the bust becomes opaque`);
    }
  }

  /* ── 4. the visual gate's own selectors ─────────────────────────────────
     shoot.js is NOT run by tests/run.mjs — it is the separate visual gate — so
     a regression in it is invisible to this suite's count. These two checks are
     the cheapest way to keep the fix from being quietly refactored away: the
     scene-count assertion is what stops a renamed strip class turning the whole
     visual gate into a no-op that exits 0, and the clean is what stops the
     tally being met by the previous run's PNGs. If shoot.js is restructured,
     keep both behaviours and update the names here. */
  const shoot = rd('shoot.js');
  t.ok(/EXPECTED_SCENES/.test(shoot) && /the scene strip is unreadable/.test(shoot),
    'shoot.js still asserts it could read the scene strip (an empty strip must not exit 0)',
    `${(shoot.match(/EXPECTED_SCENES/g) || []).length} references`);
  t.ok(/rmSync\(path\.join\(OUT/.test(shoot),
    'shoot.js still clears its own shots before a run (so the tally cannot be met by stale PNGs)');
}
