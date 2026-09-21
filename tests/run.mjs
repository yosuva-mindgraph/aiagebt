#!/usr/bin/env node
/* ============================================================================
   THE GATE.

       LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu \
         node tests/run.mjs                 everything
       node tests/run.mjs --only cancel     one suite
       node tests/run.mjs --list            what there is

   Exits non-zero if any check fails. Every suite prints its evidence — the
   number it measured, not just a tick — because a gate you cannot read is a
   gate nobody believes on the morning it goes red.

   ── it builds first, on purpose ───────────────────────────────────────────
   Step 0 is `node build.js --3d --artifact`. The three targets ARE the thing
   under test, and a suite that tests yesterday's dist/ while today's src/ is
   broken is worse than no suite. Building here also makes the build's own
   output part of the gate's transcript.

   ── what each suite is for ────────────────────────────────────────────────
   build        the three targets as FILES: what is in them, what is not in
                them, how big they are, and whether the size guard still bites.
   guards       the seams that used to fail OPEN — chiefly the palette contract
                between src/styles.css and the canvas avatar, which no browser
                check can see because the bust is pixels on a canvas.
   units        the character-seconds → word-integer-milliseconds conversion,
                tested against src/ AND against the code actually inlined into
                dist/index.html.
   voice        the PRE-RENDERED speech: which targets carry it, that a build
                without it is byte-identical to the build before it existed,
                that the generator and the runtime agree on where a clip lives,
                and that a clip decodes to actual sound and reaches the
                speakers. Degrades to one check on a clone with no clips.
   autoadvance  the deck narrating itself from scene 1 to scene 12 with nobody
                touching it. This is the regression that shipped.
   cancel       presenter.say() settling on presenter.cancel(), on BOTH
                backends, including the TalkingHead path where the pending
                speakMarker is thrown away.
   offline      all three targets from file:// with every outbound request
                intercepted and asserted to be zero.
   degrade      no key, no WebGL: the canvas bust, all twelve scenes, answers.
   avatar       the GLB's morph deltas are real geometry and the influences
                actually move — a clean load is not proof.
   integration  the checks that only exist once every branch is in one tree:
                build CONSERVATION (every inlined line survives verbatim — the
                generic form of the five "correct in source, broken in the
                artifact" failures), first paint on all three targets, the
                aperture's translucency contract in BOTH themes, a real question
                answered in both, the theme toggle surviving a reload, both
                backends narrating twelve scenes, and zero emoji anywhere.

   shoot.js is the separate visual gate (`node shoot.js`, `node shoot.js --3d`)
   and vendor/smoke.cjs the bundle's own. Both are run by the same CI line; they
   are not duplicated here.
   ========================================================================== */

import { execFileSync } from 'node:child_process';
import { T, ROOT } from './lib/harness.mjs';

const SUITES = [
  ['build', () => import('./build.test.mjs')],
  ['guards', () => import('./guards.test.mjs')],
  ['units', () => import('./units.test.mjs')],
  ['voice', () => import('./voice.test.mjs')],
  ['autoadvance', () => import('./autoadvance.test.mjs')],
  ['cancel', () => import('./cancel.test.mjs')],
  ['offline', () => import('./offline.test.mjs')],
  ['degrade', () => import('./degrade.test.mjs')],
  ['avatar', () => import('./avatar.test.mjs')],
  ['integration', () => import('./integration.test.mjs')],
];

const argOf = flag => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
};
const only = argOf('--only');

if (process.argv.includes('--list')) {
  SUITES.forEach(([n]) => console.log(n));
  process.exit(0);
}

const picked = SUITES.filter(([n]) => !only || n.includes(only));
if (!picked.length) {
  console.error(`no suite matches --only ${only}`);
  process.exit(1);
}

const t0 = Date.now();

if (!process.argv.includes('--no-build')) {
  console.log('── building the three targets ─────────────────────────────────');
  /* A build that exits non-zero has to END the gate, not be swallowed and not
     be reported as a stack trace from this file. build.js is fail-loud on every
     seam in index.html, and its own stderr — which names the literal that moved
     — is inherited straight to the terminal above this line. Everything below
     would only be testing yesterday's dist/. */
  let out;
  try {
    out = execFileSync(process.execPath, ['build.js', '--3d', '--artifact'],
      { cwd: ROOT, encoding: 'utf8' });
  } catch (err) {
    if (err.stdout) process.stdout.write(String(err.stdout).replace(/^/gm, '  '));
    console.log('');
    console.log('the build FAILED — see build.js\'s message above. Nothing was tested:');
    console.log('  the gate builds the three targets first, on purpose, so it can never');
    console.log('  pass against a dist/ that is older than src/.');
    process.exit(1);
  }
  process.stdout.write(out.replace(/^/gm, '  '));
  console.log('');
}

const all = [];
for (const [name, load] of picked) {
  console.log(`── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))}`);
  const t = new T(name);
  const started = Date.now();
  try {
    const mod = await load();
    await mod.run(t);
  } catch (err) {
    t.ok(false, `${name} suite threw`, (err?.stack || String(err)).slice(0, 900));
  }
  console.log(`   (${((Date.now() - started) / 1000).toFixed(1)}s)\n`);
  all.push([name, t]);
}

const failed = all.flatMap(([n, t]) => t.failed.map(f => ({ suite: n, ...f })));
const total = all.reduce((n, [, t]) => n + t.results.length, 0);

console.log('═══════════════════════════════════════════════════════════════');
console.log(`${total - failed.length}/${total} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed.length) {
  console.log(`\n${failed.length} FAILED:`);
  for (const f of failed) console.log(`  ✗ [${f.suite}] ${f.name}${f.detail ? `\n      ${f.detail}` : ''}`);
  process.exit(1);
}
console.log('gate is green.');
