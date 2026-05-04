# TODOS

## PR 2d — Vitest + Test Suite

**What:** Set up Vitest in `apps/web` and write tests for the 3-Question Launcher.

**Why:** Zero test coverage on `generate-script` route (LLM API with fallback logic, auth, 6 schemas), ScreenLauncher state machine, and `handleLauncherFilmer`. Any regression in these will be silent.

**Pros:** Catches format mismatch bugs, fallback edge cases, cache invalidation, abort races before they reach Philippe.

**Cons:** ~2-3h to set up Vitest config + write meaningful tests. Deferred to validate with Philippe first.

**Context:** `apps/web/vitest.config.ts` does not exist yet. Tests needed:
- `generate-script/route.test.ts`: auth 401, missing answers 400, missing beats 400, LLM success per format, fallback per format, format fallback when unknown format passed
- `ScreenLauncher.test.tsx`: phase transitions, cache clear on back-to-question, abort on format switch, substance check before film button enabled
- `handleLauncherFilmer` integration: duplicate topic prevention via savedTopicIdRef, format passthrough

**Blocked by:** Philippe validation first. Start PR 2d after confirming the product flow works.

---

## Idempotency for handleAccept and handleLater

**What:** Apply the same `savedTopicIdRef` retry guard to `handleAccept` and `handleLater` in HomeKabouEntry.tsx.

**Why:** If session POST fails and the user retries, `createTopicOnly` runs again and creates a duplicate topic. Fixed for the Launcher path in this PR; `handleAccept` and `handleLater` have the same bug.

**Pros:** Prevents orphaned topics in the DB on save-flow retries.

**Cons:** Minor refactor — each handler needs its own ref, or `createTopicOnly` itself needs to deduplicate. ~30 min.

**Context:** `handleLauncherFilmer` now uses `savedTopicIdRef`. The same pattern should be applied to `handleAccept` (sets `savedTopicIdRef` for the "on tourne maintenant" flow) and `handleLater` (sets it for "plus tard"). Consider extracting to a shared `useTopicCreation` hook.

**Depends on:** None.
