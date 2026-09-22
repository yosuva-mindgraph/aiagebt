/* ============================================================================
   THE OFF-BOOK QUESTIONS, IN ONE PLACE.

   Since the retrieval gate landed in src/ask.js, a question that the knowledge
   base answers NEVER reaches a model — `grounded` decides, before any network
   call. That is the property tests/proxy.test.mjs §2.3 and §2.4 exist to
   defend, and it is not negotiable.

   It also means every check that wants to exercise the MODEL path now needs a
   question the briefing does not cover. Three suites need one. This is the only
   copy, for the reason PR-DRAFT.md §12.3 gives: three gate failures in this
   repo have come from a fixture holding a private copy of a contract that then
   drifted, and "which questions are off-book" is exactly such a contract — it
   is a property of src/knowledge.js, which changes.

   ── WHY THE THRESHOLDS ARE NOT WRITTEN DOWN HERE ──────────────────────────
   The obvious implementation asserts `0.204 < score < 0.34`: under
   CONFIDENCE_FLOOR so the gate lets it through, over the `CONFIDENCE_FLOOR *
   0.6` filter in answer() so some grounding survives. Both numbers would be
   copied — the second is an inline expression in src/ask.js that is not
   exported at all — and a copied threshold is the §12.3 failure with extra
   steps: change the 0.6 and this file still asserts the old band, happily, for
   ever.

   So no threshold appears below. The expectation is derived by RUNNING the real
   Ask.answer() with its transport stubbed and reading which branch it took.
   That is the actual question every caller is asking ("does this reach the
   model, and with or without grounding?"), answered by the code that decides
   it. Change the floor, the filter, the keyword bags or the branch structure,
   and pin() fails BY NAME in every suite that imports this, instead of a probe
   silently starting to test the branch next door.

   ── WHY THE QUESTIONS THEMSELVES ARE LITERAL ──────────────────────────────
   They are the one thing here that could not be derived, and it is worth saying
   why rather than leaving it to look like laziness. tests/ask.test.mjs builds
   its probe corpus from every 1-, 2- and 3-word window over the entries' own
   keyword bags. Measured across all 39 entries, that corpus yields ZERO
   questions in the band this needs: a window drawn from an entry's keywords
   either scores well above the floor (it IS that entry's question) or matches
   nothing at all (it is "what" or "is the"). A partial match needs a real
   sentence about aviation that the briefing happens not to cover — which is
   precisely the tier-2 question the proxy was added to answer, and which no
   amount of recombining the keyword bags will produce.

   The literal is therefore the input; the ASSERTION about it is derived. That
   is the right split, and pin() is what enforces it.
   ========================================================================== */

import { search, CONFIDENCE_FLOOR } from '../../src/knowledge.js';
import { Ask } from '../../src/ask.js';

/* A real aviation question the briefing does not answer, which still sits near
   enough to two or three entries that some grounding survives the filter. This
   is the tier-2 case the proxy exists for: general industry context, flagged as
   such, rather than a claim about the product. */
export const SUB_FLOOR =
  'how should we phase the rollout across three terminals over two years';

/* A question with nothing whatsoever behind it — no entry scores at all, so the
   model is handed "(nothing relevant found)" and the answer sheet says so. */
export const UNBRIEFED = 'who won the world cup in 1998';

/* A question the briefing answers outright. Named here so a suite asserting
   "this must NOT reach the proxy" reads from the same place as its opposite. */
export const GROUNDED = 'what does the governance layer actually enforce';

/** What src/ask.js ACTUALLY does with a question, transport stubbed. */
export async function viaFor(question) {
  const ask = new Ask({ llm: { endpoint: 'http://127.0.0.1:1/never-called' } });
  const stubbed = Object.create(ask);
  stubbed._callLLM = async () => '<p>A stubbed model answer.</p>';
  return (await stubbed.answer(question)).via;
}

/** Scores, for evidence in the gate transcript — never for a decision. */
export function scoreOf(question) {
  const hits = search(question, 3);
  return {
    score: hits[0] ? Number(hits[0].score.toFixed(4)) : null,
    hits: hits.length,
    top: hits[0] ? hits[0].e.id : null,
  };
}

/**
 * Assert every probe still reaches the branch its callers depend on.
 *
 * Call this BEFORE using any probe. A suite that skips it and then finds
 * `via === 'local'` reports a confusing failure about deadlines or call counts;
 * this one reports that the probe drifted, which is the actual news.
 */
export async function pin(t, prefix = '§0.2') {
  const want = [
    [SUB_FLOOR, 'llm', 'reaches the model WITH partial grounding'],
    [UNBRIEFED, 'llm-unbriefed', 'reaches the model with nothing to draw on'],
    [GROUNDED, 'local', 'is answered by the briefing and never reaches the model'],
  ];
  let allOk = true;
  for (const [q, expect, why] of want) {
    const got = await viaFor(q);
    const s = scoreOf(q);
    const ok = got === expect;
    allOk = allOk && ok;
    t.ok(ok, `${prefix} probe ${why}`,
      ok ? `via=${got} · score ${s.score ?? 'none'}${s.top ? ` (${s.top})` : ''}`
        : `via=${got}, wanted ${expect} — ${JSON.stringify(q)} scored ${s.score ?? 'none'} ` +
          `against CONFIDENCE_FLOOR ${CONFIDENCE_FLOOR}. The probe has drifted across a ` +
          `threshold; pick a new question rather than relaxing the check that failed.`);
  }
  return allOk;
}
