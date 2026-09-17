#!/usr/bin/env node
/* ============================================================================
   Prove the vendored bundle works before anything is built on top of it.

       LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu \
         node vendor/smoke.cjs

   (The LD_LIBRARY_PATH is this box's shared-library shim for headless Chrome —
   the same one shoot.js needs. Without it Chromium will not start.)

   Opens vendor/smoke.html from a real file:// URL, because that is the condition
   that matters: dist/index.html gets double-clicked on a booth machine with no
   server and no network, and half the ways of loading a 3D model quietly stop
   working under that origin. A test served over http:// would pass and tell you
   nothing.

   It asserts five things and exits non-zero on any of them, plus on any page
   error or console.error at all:

     ctor            TalkingHead constructed from the bundle — i.e. the bundle
                     did not die on load. This is the import.meta.url trap: an
                     undefined URL base throws at module scope, before the class
                     is ever assigned, and the only symptom is that
                     window.TalkingHead is undefined.
     armature        the GLB actually loaded and rigged, via a Blob object URL.
     visemeMorphs    15 viseme_* morph targets — the mouth can be driven. A GLB
                     exported without the Oculus viseme set loads perfectly
                     happily and then never moves its lips, so count them.
     marker          speakMarker fires at the end of normal speech.
     markerAfterStop and is SILENTLY DROPPED by stopSpeaking(). Asserted false on
                     purpose: it is a real constraint, not a bug to fix here.
                     Anything downstream that sequences scenes off speakMarker
                     will stall the first time a viewer interrupts Iris.

   It also diffs window before and after the bundle loads, so seam S1 — the two
   API globals and nothing else — is enforced rather than asserted in a doc. The
   set is pinned exactly, including three.js's `__THREE__` (see EXPECT below);
   anything new appearing there is a regression to look at, not to wave through.
   ========================================================================== */

const path = require('path');
const fs = require('fs');

/* Same resolution as shoot.js — playwright lives in a sibling project on this
   box rather than in this repo's devDependencies, deliberately: it is a
   50 MB browser download and nothing shipped needs it. */
const PW = process.env.AIB_PLAYWRIGHT
  || '/home/mindgraph1/projects/dxcaib/aibgames-gen/node_modules/playwright';
const { chromium } = require(PW);

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(__dirname, 'smoke.html');
const GLB = path.join(ROOT, 'assets', 'avatar.glb');

/* Sorted, so the global set compares as a string rather than as a set.

   `__THREE__` is not an API and not a leak we should patch out: three.js sets it
   to its own revision ("180") purely so a SECOND copy of three loading on the
   page logs "Multiple instances of Three.js being imported". Deleting it in
   vendor/entry.mjs would make the seam read more cleanly and would throw away a
   real duplicate-load warning, so it stays — pinned here so it is a known member
   of the set rather than something that crept in. Consumers still touch only
   TalkingHead and LipsyncEn; there is deliberately no `THREE` global to reach for. */
const EXPECT = {
  visemes: 'SS,aa,RR,SS,I,SS',
  globals: 'LipsyncEn,TalkingHead,__THREE__',   // JS default sort: '_' (0x5F) lands after the capitals
  /* Not a magic number: it is the length of the list showAvatar() derives from
     posePropNames on this pinned version (plus opt.modelRoot, asserted
     separately). The page reads that list off the live instance rather than
     transcribing it, so this count is the tripwire for the list itself changing
     under a version bump. */
  bones: 52,
  /* The only viseme an avatar is allowed to omit. See the note in smoke.html:
     'sil' is silence, which is also what every other viseme at 0 renders, and
     the morph apply path skips absent keys. Anything else missing is a broken
     export that would mouth some phonemes and not others. */
  visemesMayOmit: ['sil'],
};

(async () => {
  for (const f of [path.join(__dirname, 'talkinghead.bundle.js'), path.join(__dirname, 'smoke.html'), GLB]) {
    if (!fs.existsSync(f)) {
      console.error(`✗ missing ${path.relative(ROOT, f)} — run: node vendor/build-vendor.mjs`);
      process.exit(1);
    }
  }
  const glbB64 = fs.readFileSync(GLB).toString('base64');

  const browser = await chromium.launch({
    /* Headless Chrome otherwise refuses to start an AudioContext without a user
       gesture, and the two marker assertions depend on audio actually playing. */
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const problems = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });

  /* The page cannot read its own sibling file — fetch() across file:// is
     CORS-blocked — so the bytes come over the binding instead. Registered
     before goto so it exists by the time the page's script runs. */
  await page.exposeFunction('__readAvatarGlb', () => glbB64);

  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__r && window.__r.done, null, { timeout: 90000 })
    .catch(() => problems.push('timed out waiting for the page to finish'));

  const r = await page.evaluate(() => window.__r);
  await browser.close();

  if (r && r.err) problems.push('threw: ' + r.err);

  const marker = r && r.marker === 'fired' ? 'fired' : 'NOT-FIRED';
  const missingVisemes = (r && r.visemesMissing ? r.visemesMissing.split(',') : []);
  const fatalVisemes = missingVisemes.filter(v => !EXPECT.visemesMayOmit.includes(v));
  console.log(
    `ctor=${(r && r.ctor) || 'FAILED'} armature=${!!(r && r.armature)} ` +
    `visemeMorphs=${r ? r.visemeMorphs : '?'} marker=${marker} markerAfterStop=${!!(r && r.markerAfterStop)}`,
  );
  console.log(`  avatar loaded in ${r && r.showMs}ms · ${r && r.morphs} morph targets · queue drained to ${r && r.queueLen}`);
  console.log(`  rig: root "${r && r.armatureName}" · ${r && r.bonesChecked} required bones present · eyes [${r && r.eyeBones}]`);
  console.log(`  visemes: ${r && r.visemeMorphs}/15 present${missingVisemes.length ? ` (missing: ${missingVisemes.join(',')})` : ''}`);
  console.log(`  offline lipsync 'sources' → [${r && r.visemes}]`);
  console.log(`  globals added by the bundle: ${r && r.globalsAdded}`);

  if (!r || r.ctor !== 'ok') problems.push('TalkingHead did not construct');
  if (!r || !r.armature) problems.push('no armature — the GLB did not load or did not rig');
  if (!r || fatalVisemes.length) problems.push(`avatar is missing articulating viseme morphs: ${fatalVisemes.join(',')} — those phonemes would have no mouth shape`);
  /* Total morph count is deliberately NOT asserted. The 5 "extras" (mouthOpen,
     mouthSmile, eyesClosed, eyesLookUp, eyesLookDown) are optional — TalkingHead
     synthesises them from ARKit shapes via mtExtras, and the CC0 avatar ships
     none of them and works fine. The real requirement is 52 ARKit + 15 visemes. */
  if (!r || r.bonesMissing !== '') problems.push(`rig is missing required bones: ${r && r.bonesMissing}`);
  if (!r || r.bonesChecked !== EXPECT.bones) problems.push(`the required-bone list itself changed: expected ${EXPECT.bones} names, the library now asks for ${r && r.bonesChecked}`);
  if (!r || r.armatureName !== 'Armature') problems.push(`root object is "${r && r.armatureName}", must be exactly "Armature" — npm 1.7.0 does not strip a mixamorig prefix`);
  if (!r || r.eyeBones !== 'LeftEye,RightEye') problems.push(`missing eye bones [have: ${r && r.eyeBones}] — showAvatar() reads them unguarded and would have died on getWorldPosition of undefined`);
  if (!r || r.visemes !== EXPECT.visemes) problems.push(`offline lipsync drifted: expected [${EXPECT.visemes}], got [${r && r.visemes}]`);
  if (marker !== 'fired') problems.push('speakMarker never fired after normal speech');
  if (!r || r.markerAfterStop !== false) problems.push('stopSpeaking() now DOES run a pending marker — the documented constraint changed');
  if (!r || r.globalsAdded !== EXPECT.globals) problems.push(`seam S1 drifted — expected [${EXPECT.globals}], bundle added: [${r && r.globalsAdded}]`);

  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    problems.forEach(p => console.log('  ✗ ' + p));
    process.exit(1);
  }
  console.log('\nbundle runs offline from file://, no page errors.');
})();
