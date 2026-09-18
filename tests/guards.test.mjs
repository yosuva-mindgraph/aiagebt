/* ============================================================================
   THE SEAMS THAT FAIL OPEN.

   Two contracts live here. Neither is visible to any other suite, and both fail
   SILENTLY — no throw, no warning, nothing red — which is why they are pinned in
   a file of their own rather than left to be noticed.

     §1-4  the palette contract between src/styles.css and the canvas avatar.
     §5-6  the scene-id contract between src/knowledge.js and src/scenes.js.

   ════════════════════════════════════════════════════════════════════════════
   PART ONE — the palette contract.

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

   ════════════════════════════════════════════════════════════════════════════
   PART TWO — the scene-id contract (§5-6).

   An answer may name a scene to offer as a jump. src/knowledge.js holds 38 of
   those ids BY HAND against the twelve in src/scenes.js, and nothing but this
   file compares the two lists.

   ── the failure this exists to stop ───────────────────────────────────────
   sceneIndex() answers -1 for an id that no longer exists. SCENES[-1] is
   undefined, and src/app.js used to read `.title` straight off it:

       `<button class="jump" data-jump="${scene}">Take me to
        “${SCENES[sceneIndex(scene)].title}” →</button>`

   That TypeError is thrown inside handleAsk(), which is an async method NOBODY
   AWAITS — it is called from a submit handler and from the recogniser callback.
   So it does not surface as a broken page: the rejection is unhandled, the two
   lines that write the answer into the sheet never run, and the answer sheet
   sits on “Looking that up…” with the real answer already in hand, for the rest
   of the meeting. One stale id in a content edit, and the deck's single
   interactive feature is dead in front of a client.

   handleAsk() (src/app.js:350) now resolves the id to an OBJECT first and
   offers no button when it cannot, so a stale id costs a button and nothing
   else. That guard was proved in a browser at the time and then had no
   permanent test. These are it.

   ── why BOTH halves are asserted, and in two different ways ───────────────
   §5 is the structural invariant — every `scene:` in knowledge.js resolves in
   scenes.js — read straight out of the two modules with no browser. It is the
   check that would have caught the class of bug outright, it costs
   milliseconds, and it names the offending entry rather than a symptom.

   §6 is the BEHAVIOUR, in a browser, on the built file: a real id still offers
   a working jump, and an unknown id yields no button, no page error, and an
   answer that still renders. §5 alone would pass a refactor that re-broke the
   guard; §6 alone would pass a stale id that no test happens to ask about — and
   only 2 of the 11 ids knowledge.js names are reachable from any other suite's
   questions ('agents' via degrade + cancel, 'governance' via offline).

   ── and it was checked against the bug, not just against the fix ──────────
   §6 was run once with that line put back to the unguarded expression above.
   Three of its checks go red and the failure is the original one,
   verbatim: the sheet still reads “Looking that up…” after a 15-second wait,
   nothing is logged, and the page error is `Cannot read properties of undefined
   (reading 'title')`. The other eight stay green — a guard that only broke the
   unknown-id path is what was wanted. A regression test nobody has seen fail is
   a regression test nobody should believe.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, launch, openPage, ready, BUDGET } from './lib/harness.mjs';
import { SCENES, sceneIndex } from '../src/scenes.js';
import { KB } from '../src/knowledge.js';

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

/* ── the answer-sheet probe (§6) ───────────────────────────────────────────
   Two functions, in the page, because both halves have to go through the REAL
   handler: the bug lived in handleAsk()'s own async, and a test that called
   anything else would be testing a different function.

   pin() is the only stub in this file. It replaces RETRIEVAL — not the guard,
   not the renderer, not the handler — so the scene id is the single variable
   between the two halves. That is what makes them a control pair: the same
   question, the same code path, one id that exists and one that does not.
   (SCENES and sceneIndex are free variables here: build.js flattens every
   module into one classic script scope, so the page has both by name.) */
const ASK_PROBE = `
window.__qaAsk = {
  async ask(question) {
    const body = document.querySelector('#ansBody');
    window.app.handleAsk(question);   // NOT awaited — exactly as the page calls it
    const t0 = performance.now();
    while (performance.now() - t0 < 15000) {
      await new Promise(r => setTimeout(r, 50));
      if (body.innerHTML && !/Looking that up/.test(body.innerHTML)) break;
    }
    const btn = body.querySelector('[data-jump]');
    return {
      open: document.querySelector('#answer').classList.contains('open'),
      stuck: /Looking that up/.test(body.innerHTML),
      text: body.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80),
      jump: btn ? btn.dataset.jump : null,
      label: btn ? btn.textContent.replace(/\\s+/g, ' ').trim() : null,
      resolves: btn ? sceneIndex(btn.dataset.jump) : null,
      at: SCENES[window.app.i].id,
      waitedMs: Math.round(performance.now() - t0),
    };
  },

  pin(scene) {
    window.app.ask.answer = async () => ({
      html: '<p>Pinned answer body.</p>', scene: scene, grounded: true, via: 'local',
    });
  },
};
`;

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

  /* ── 5. THE SCENE-ID CONTRACT, with no browser at all ───────────────────
     Both sides are read from the modules themselves — the same import the deck
     performs — so this cannot drift from what ships and cannot be satisfied by
     a list typed here. It is the cheapest check in the gate and the one that
     catches the class of bug outright: a `scene:` that names nothing. */
  const ids = new Set(SCENES.map(s => s.id));
  const refs = KB.filter(e => e.scene);
  const byScene = refs.reduce((m, e) => m.set(e.scene, (m.get(e.scene) || 0) + 1), new Map());
  const distinct = [...byScene.keys()].sort();

  t.ok(SCENES.length > 0 && refs.length > 0,
    'both sides of the scene-id contract are read from source, never typed here',
    refs.length
      ? `${refs.length} of ${KB.length} knowledge entries name a scene · ${distinct.length} distinct ids against ${SCENES.length} scenes`
      : 'NO scene references found — the import is broken, or knowledge.js stopped naming scenes');

  const dangling = refs.filter(e => !ids.has(e.scene)).map(e => `${e.id} → "${e.scene}"`).sort();
  t.eq(dangling, [],
    'every scene: in src/knowledge.js resolves to a real id in src/scenes.js — a stale one is the TypeError that hung the answer sheet');

  const unresolved = distinct.filter(id => sceneIndex(id) < 0);
  t.eq(unresolved, [],
    'and sceneIndex() — the function src/app.js actually calls — resolves every one of them');

  t.ok(sceneIndex('no-such-scene') === -1 && SCENES[sceneIndex('no-such-scene')] === undefined,
    'sceneIndex() answers -1 for an id that is not there, and SCENES[-1] is undefined — the precondition §6 guards',
    `sceneIndex('no-such-scene') = ${sceneIndex('no-such-scene')}`);

  const unreferenced = SCENES.map(s => s.id).filter(id => !byScene.has(id));
  t.note(`scene ids by weight: ${[...byScene].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id}×${n}`).join(' ')}` +
    (unreferenced.length ? ` · no entry points at: ${unreferenced.join(', ')}` : ''));

  /* ── 6. AND THE GUARD ITSELF, in a browser, on the built file ───────────
     §5 passes the day someone rewrites handleAsk() and drops the guard. This is
     the half that does not: the real handler, the real DOM, one id that exists
     and one that does not. */
  const BAD_ID = 'goverance';    // one letter from a real id — what a content edit actually produces

  const browser = await launch();
  try {
    const { page, errors, warnings } = await openPage(browser, 'canvas', { budget: BUDGET.canvas });
    await ready(page, BUDGET.canvas);
    await page.evaluate(ASK_PROBE);

    /* Off the cold open WITHOUT starting narration: the answer sheet is what is
       under test, and a deck talking underneath it is only timing noise. */
    await page.click('#skipIntroBtn');

    /* The known-good id is the one the knowledge base leans on hardest, minus
       the scene we happen to be standing on — an answer pointing at the CURRENT
       scene offers no button by design (case (d)), and picking it here would
       read as the guard failing. Derived, so a content rewrite cannot leave this
       naming a scene that no longer matters. */
    const standingOn = await page.evaluate(() => SCENES[window.app.i].id);
    const GOOD_ID = [...byScene].sort((a, b) => b[1] - a[1]).map(([id]) => id).find(id => id !== standingOn);
    const GOOD_TITLE = SCENES.find(s => s.id === GOOD_ID).title;

    const shipped = await page.evaluate(() => {
      const r = KB.filter(e => e.scene);
      return { refs: r.length, scenes: SCENES.length, bad: r.filter(e => sceneIndex(e.scene) < 0).map(e => e.id + '→' + e.scene) };
    });
    t.eq(shipped.bad, [],
      'the SHIPPED file carries the same contract — flatten() rewrote both modules on the way into dist/');
    t.note(`dist/index.html: ${shipped.refs} scene references across ${shipped.scenes} scenes, 0 unresolved`);

    /* (a) the real retrieval path, end to end — nothing stubbed */
    const real = await page.evaluate(() =>
      window.__qaAsk.ask('How do you stop an AI agent seeing data it should not see?'));
    t.ok(real.open && !real.stuck && real.text.length > 20,
      'a real question renders a real answer into the sheet', `${real.waitedMs} ms · ${JSON.stringify(real.text)}`);
    t.ok(Boolean(real.jump) && real.resolves >= 0,
      'and the jump it offers names a scene that EXISTS — data-jump is read off the RESOLVED scene, so it cannot be a dead id',
      real.jump ? `data-jump="${real.jump}" → SCENES[${real.resolves}] · ${real.label}` : 'no jump button was offered at all');

    /* (b) a KNOWN-GOOD id, pinned, and the button has to actually work */
    const good = await page.evaluate(id => {
      window.__qaAsk.pin(id);
      return window.__qaAsk.ask('pinned: a scene id that exists');
    }, GOOD_ID);
    t.ok(good.jump === GOOD_ID && !good.stuck && good.resolves >= 0,
      `a known-good scene id still produces a jump button (pinned "${GOOD_ID}", from ${good.at})`,
      `data-jump="${good.jump}" → SCENES[${good.resolves}] · ${good.label}`);
    t.ok(Boolean(good.label && good.label.includes(GOOD_TITLE)),
      'and the button names the scene it will take you to, off the resolved object',
      `${JSON.stringify(good.label)} vs title ${JSON.stringify(GOOD_TITLE)}`);

    const jumped = await page.evaluate(async () => {
      const btn = document.querySelector('#ansBody [data-jump]');
      const want = btn.dataset.jump;
      btn.click();
      const t0 = performance.now();
      while (performance.now() - t0 < 5000 && SCENES[window.app.i].id !== want) {
        await new Promise(r => setTimeout(r, 50));
      }
      const at = SCENES[window.app.i].id;
      window.app.pause();      // stop narrating; the sheet is what is under test
      return { at, want, open: document.querySelector('#answer').classList.contains('open') };
    });
    t.ok(jumped.at === jumped.want && !jumped.open,
      'and pressing it actually moves the deck there, closing the sheet behind it',
      `${JSON.stringify(jumped)}`);

    /* (c) THE REGRESSION: an id that no longer exists.
       No button is the acceptable loss. The answer is not. */
    const bad = await page.evaluate(id => {
      window.__qaAsk.pin(id);
      return window.__qaAsk.ask('pinned: a scene id that does not exist');
    }, BAD_ID);
    t.ok(bad.jump === null,
      `an UNKNOWN scene id ("${BAD_ID}") yields no jump button — a missing button loses nothing`,
      bad.jump === null ? 'no [data-jump] in the sheet' : `OFFERED data-jump="${bad.jump}", which goes nowhere`);
    t.ok(!bad.stuck && /Pinned answer body/.test(bad.text),
      '…and the ANSWER STILL RENDERS — the sheet does not sit on “Looking that up…”, which is the hang this guard exists for',
      `${bad.waitedMs} ms · ${JSON.stringify(bad.text)}`);
    const warned = warnings.filter(w => /unknown scene id/.test(w) && w.includes(BAD_ID));
    t.ok(warned.length === 1,
      '…and it says so ONCE, as a warning naming the id, so a content edit is traceable rather than silent',
      warned.length ? warned[0].slice(0, 130) : `${warned.length} warnings mentioning it — nothing was logged`);

    /* (d) the other half of the same expression: the scene you are already on */
    const same = await page.evaluate(() => {
      const id = SCENES[window.app.i].id;
      window.__qaAsk.pin(id);
      return window.__qaAsk.ask('pinned: the scene we are already on');
    });
    t.ok(same.jump === null && !same.stuck,
      'an answer pointing at the CURRENT scene offers no jump either — there is nowhere to go, and the answer still lands',
      `at ${same.at}, jump=${JSON.stringify(same.jump)}`);

    t.eq(errors, [], 'no page errors across the whole answer-sheet run — the unguarded version threw inside an async nobody awaits');
    await page.context().close();
  } finally {
    await browser.close();
  }
}
