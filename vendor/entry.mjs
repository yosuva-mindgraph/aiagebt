/* ============================================================================
   The only entry point into the vendored bundle.

   Two names go out onto the page and nothing else — that is seam S1, and the
   rest of the repo depends on it holding. Everything downstream (src/avatar.js
   and friends) reads `window.TalkingHead` / `window.LipsyncEn` off the global
   and must never `import` from 'three' or '@met4citizen/talkinghead'. That is
   what keeps build.js's small module inliner sufficient: it flattens ES modules
   into one classic <script>, so a real bare-specifier import in src/ would
   silently vanish and take the avatar with it. No importmap, no module graph at
   runtime, no network.

   `window` rather than `globalThis` on purpose: this bundle is browser-only by
   construction (it touches document, WebGL and AudioContext at construction
   time), and `window` is the name the seam contract is written in.

   Lipsync is imported STATICALLY here even though TalkingHead can load it
   lazily. Its lazy path is a computed dynamic import() of './lipsync-en.mjs'
   relative to the module — which resolves to nothing once bundled, and would
   need the network even if it did. Pulling it in at build time and handing the
   instance over (see docs/TALKINGHEAD.md) is what makes lipsync work air-gapped.
   ========================================================================== */

import { TalkingHead } from '@met4citizen/talkinghead';
import { LipsyncEn } from '@met4citizen/talkinghead/modules/lipsync-en.mjs';

window.TalkingHead = TalkingHead;
window.LipsyncEn = LipsyncEn;
