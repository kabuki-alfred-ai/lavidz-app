---
title: 'Refacto architecture Sujet → Session → Recording → Project'
slug: 'subject-session-refactor'
created: '2026-04-21'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Next.js 15 (App Router, Turbopack)'
  - 'NestJS (apps/api)'
  - 'Prisma 6 + PostgreSQL 16 + pgvector (HNSW, 768 dims)'
  - 'Vercel AI SDK (useChat, generateObject, embed, embedMany)'
  - 'Gemini Flash (défaut via model.config.ts)'
  - 'React 19 + Tailwind 3'
  - 'Radix UI + Vaul (bottom sheet)'
  - 'pnpm workspaces monorepo'
files_to_modify:
  # Migration data — F1: split en 2 migrations pour éviter la collision ALTER TYPE + usage dans même tx
  - 'packages/database/prisma/schema.prisma'
  - 'packages/database/prisma/migrations/{ts1}_add_session_status_values/migration.sql'  # F1 — JUSTE les ALTER TYPE ADD VALUE
  - 'packages/database/prisma/migrations/{ts2}_subject_session_refactor/migration.sql'   # F1 — tout le reste (colonnes, backfills, indexes)
  # Frontend — Topic workspace
  - 'apps/web/src/app/(client)/sujets/[id]/page.tsx'
  - 'apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx'
  - 'apps/web/src/app/(client)/sujets/[id]/SubjectKabouPanel.tsx'
  - 'apps/web/src/lib/creative-state.ts'
  - 'apps/web/src/lib/recording-guide.ts'  # F3 — rename en recording-script.ts (format-specific), PAS split — les types polymorphes existants deviennent RecordingScript
  - 'apps/web/src/lib/narrative-anchor.ts'  # new — type DISTINCT: `{ kind: 'draft', bullets: string[], updatedAt: string }` uniquement (stratégique, pas polymorphe format)
  - 'apps/web/src/components/subject/CreativeStateTimeline.tsx'
  - 'apps/web/src/components/subject/SubjectRecordingGuide.tsx'  # rename → SubjectRecordingScript.tsx (format-specific renderer)
  - 'apps/web/src/components/subject/SubjectNarrativeAnchor.tsx'  # new (renderer draft bullets-only sur Topic)
  - 'apps/web/src/components/subject/SubjectHookSection.tsx'
  - 'apps/web/src/components/subject/SubjectSourcesSection.tsx'
  - 'apps/web/src/components/subject/NarrativeAnchorSticky.tsx'  # new (sidebar tournage — bullets compacts)
  - 'apps/web/src/components/subject/StaleAnchorBadge.tsx'  # new (F14 — détecte stale via narrativeAnchor.updatedAt field-level)
  # F7 — Fichiers qui référencent SCHEDULED/PRODUCING (retirés du CreativeState enum)
  - 'apps/web/src/app/(client)/topics/TopicsList.tsx'  # F7 — filtrage state, retirer refs SCHEDULED/PRODUCING
  - 'apps/web/src/components/subject/CreativeStageIcons.tsx'  # F7 — icônes par state
  - 'apps/web/src/app/api/home/state/route.ts'  # F7 — endpoint home state dépend du CreativeState
  - 'apps/web/src/app/(client)/home/HomeBrief.tsx'  # F7 — affichage state par sujet
  # Frontend — Session
  - 'apps/web/src/app/s/[sessionId]/page.tsx'
  - 'apps/web/src/components/session/RecordingSession.tsx'
  - 'apps/web/src/components/session/PostRecordingView.tsx'
  - 'apps/web/src/components/session/ResumeBanner.tsx'  # new (banner reprise Kabou 3 wordings)
  - 'apps/web/src/lib/recording-buffer.ts'  # new (IndexedDB wrapper avec quota + TTL 7j, F8)
  # Frontend — Project (montage + publier)
  - 'apps/web/src/app/(client)/projects/[id]/ProjectDetail.tsx'
  - 'apps/web/src/app/(client)/projects/[id]/publier/page.tsx'  # new (moved from sujets/[id]/publier)
  - 'apps/web/src/app/(client)/projects/[id]/publier/PublishView.tsx'  # new (moved + adapted)
  - 'apps/web/src/app/(client)/sujets/[id]/publier/page.tsx'  # → redirect server-side vers project
  - 'apps/web/src/components/publish/TakeSelector.tsx'  # new (groupement par question, badge ⭐)
  # Frontend — API routes
  - 'apps/web/src/app/api/chat/route.ts'  # F2 — TOOLS KABOU INLINE (L~424-497). Rename clés tools + alias + context injection currentSessionId/currentFormat + RAG topicId scope
  - 'apps/web/src/app/api/topics/[id]/hook-draft/route.ts'  # new — gestion hookDraft libre (remplace /hooks au niveau Topic)
  - 'apps/web/src/app/api/sessions/[id]/hooks/route.ts'  # new — Session.hooks format-specific
  - 'apps/web/src/app/api/sessions/[id]/reset/route.ts'  # new — soft-discard + status PENDING (Story 5)
  - 'apps/web/src/app/api/sessions/[id]/replace/route.ts'  # new — variante création (Story 5)
  - 'apps/web/src/app/api/sessions/[id]/recovery-resume/route.ts'  # new — Story 7 banner reprise
  - 'apps/web/src/app/api/projects/[id]/route.ts'  # adapt fetch pour multi-session rushes
  - 'apps/web/src/app/api/projects/[id]/rushes/route.ts'  # (if exists) inclure supersededAt + cross-session
  # Backend — API NestJS
  - 'apps/api/src/modules/ai/ai.controller.ts'
  - 'apps/api/src/modules/ai/ai.module.ts'
  - 'apps/api/src/modules/ai/services/subject-hook.service.ts'  # split Topic/Session + RAG
  - 'apps/api/src/modules/ai/services/session-hook.service.ts'  # new — hooks Session format-specific
  - 'apps/api/src/modules/ai/services/narrative-arc.service.ts'  # RAG enrichment
  - 'apps/api/src/modules/ai/services/memory.service.ts'  # + topicId filter
  - 'apps/api/src/modules/ai/services/preflight.service.ts'  # DELETE (F15 — vérifier colonnes DB preflight* avant delete)
  - 'apps/api/src/modules/ai/services/take-analysis.service.ts'  # new
  - 'apps/api/src/modules/sessions/sessions.service.ts'  # + endpoints reset/replace/canonical/recovery + transaction atomic supersededAt (F10)
  - 'apps/api/src/modules/sessions/sessions.controller.ts'
  - 'apps/api/src/modules/topics/topics.service.ts'  # narrativeAnchor endpoints
  - 'apps/api/src/modules/topics/topics.controller.ts'
  - 'apps/api/src/modules/projects/projects.service.ts'  # + auto-create sur submit mono-rush (idempotent via unique Project.sessionId, F5)
  - 'apps/api/src/modules/content-calendar/content-calendar.service.ts'  # publish flow avec sessionId fallback
  # Docs
  - 'docs/architecture/subject-session-split.md'  # new — diagrammes mermaid + rollout plan (F16)
# Note F2 : les tools `update_recording_guide_draft` et `reshape_recording_guide_to_format` sont définis INLINE
# dans apps/web/src/app/api/chat/route.ts:424-497 (pas des fichiers séparés NestJS). Le "rename" se fait en
# éditant ce fichier + en ajoutant les 2 anciennes clés comme alias 1 sprint. Aucun fichier .tool.ts à renommer.
code_patterns:
  - 'Polymorphic JSON discriminated by `kind` field (pattern existant dans recording-guide.ts)'
  - 'Vercel AI SDK generateObject avec zod schema (pattern existant dans subject-hook.service.ts, narrative-arc.service.ts)'
  - 'prisma.$executeRaw + $queryRaw pour pgvector (pattern existant dans memory.service.ts)'
  - 'Tools Kabou : 1 file par tool dans apps/api/src/modules/ai/tools/, exposés via ai.controller → passés au useChat'
  - 'React Server Components par défaut, client components marqués `use client` (App Router Next.js 15)'
  - 'Tailwind + shadcn/ui (Button, Drawer via Vaul). Classes wrap via cn() utility dans apps/web/src/lib/utils.ts'
  - 'Kabou voice : TOUJOURS passer wording UI par applyKabouVocabulary() + respecter les 10 règles dans KABOU_SYSTEM_PREAMBLE'
  - 'flashToast pattern : setState + setTimeout 2200ms auto-dismiss (pas de lib toast externe)'
  - 'useChat threadId-persisted, hydrated via /api/chat/history'
test_patterns:
  - 'Clean slate — aucun framework de test configuré (ni vitest, ni jest, ni playwright dans package.json web/api)'
  - 'Acceptance Criteria format Given/When/Then — manual test plan (pas d''E2E automatisé dans ce spec)'
  - 'Si automatisation souhaitée post-spec : invoker /bmad-testarch-framework séparément (Playwright recommandé)'
origin: 'Party mode BMAD 2026-04-21 — 8 décisions + 3 extensions actées avec Antoine'
adversarialReviewAt: '2026-04-22'
adversarialFindingsIntegrated: '20/20 (2 critical + 8 high dans tasks, 10 medium/low section mitigations)'
---

# Tech-Spec: Refacto architecture Sujet → Session → Recording → Project

**Created:** 2026-04-21

## Overview

### Problem Statement

Le modèle actuel confond stratégie et tactique :

- Les états `SCHEDULED` et `PRODUCING` polluent l'enum `CreativeState` du Topic alors qu'ils sont tactiques (appartiennent à une Session)
- `Topic.recordingGuide` est unique par Topic → impossible de supporter "1 Sujet = N Formats" proprement (chaque reshape écrase le précédent)
- `/sujets/[sessionId]/publier` rattache la publication à UNE Session, alors que les `Project` aggrègent des rushes multi-sessions (potentiellement multi-topics)
- Le preflight est un feature gadget non utilisé (même par le maker)
- Pas de recovery si crash browser pendant tournage → perte totale
- Pas de take selector dans le montage malgré l'infrastructure `ProjectClip` qui le supporte
- RAG pgvector est installé mais seulement 3 services l'utilisent (chat/calendar/questionnaire) — 7 services "générateurs" l'ignorent dont les services "voix" critiques

8 angles morts produit identifiés et tranchés lors de l'audit party mode 2026-04-21 (référence mémoire : `project_lavidz_subject_session_refactor_decisions.md`).

### Solution

Séparer en **deux axes orthogonaux** :

```
🌱 Axe Topic (maturité de la pensée)
SEED → EXPLORING → MATURE → ARCHIVED
Graine · Jeune pousse · Arbre · Archivé

🎬 Axe Session (cycle de vie d'un format)
PENDING → RECORDING → SUBMITTED → PROCESSING → DONE → LIVE
          + FAILED, REPLACED
```

**Déplacer les artefacts tactiques sur Session** (recordingScript, hooks, preflight → killed) et **garder les stratégiques sur Topic** (narrativeAnchor, sources, hookDraft).

**Migrer la publication** au niveau Project (pas Session) : `/projects/[id]/publier` avec auto-create Project pour session mono-rush.

**Enrichir RAG** dans les 3 services voix (hooks, narrative-arc, reshape_to_recording_script) + scoper par `topicId`.

**Take selector** dans `/projects/[id]` (enrichissement de la rush library existante).

### Scope

**In Scope (11 stories, 30.5 pts, ~8 jours dev solo) :**

Voir section "Implementation Plan / Tasks" plus bas.

**Out of Scope (V2+ features) :**

- Warm-up caméra avant recording (analyse ton en live)
- UI take selector avec Kabou "best-take auto" (V1.5 scope = recommandation affichée uniquement)
- Policy de cleanup automatique des recordings supersededAt > 90 jours
- Détection cross-topic auto dans un Project (user qui mixe rushes de 2 topics différents) — V1 = message informatif, pas logique dédiée
- Thread Kabou par Session (V1 garde thread partagé Topic)
- Propagation auto de narrativeAnchor vers les Sessions existantes
- Full scroll-through timeline editing dans Project (on garde le drag-and-drop simple actuel)
- Chunked upload live pendant recording (V1 = buffer IndexedDB + upload au take-complete)
- Automated E2E tests (aucun framework configuré actuellement)

## Context for Development

### Architectural Philosophy (établie en party mode)

**Topic = mémoire stratégique** — ce qui survit au temps long : intention, angle narratif (`narrativeAnchor`), sources, thread Kabou, idées libres d'accroches (`hookDraft`). Test : *"Je reviens dans 3 mois, je veux retrouver ça."*

**Session = performance tactique** — ce qui sert à 1 tournage précis : script format-specific (`recordingScript`), hooks engagés structurés (`hooks`), recovery state. Durée de vie : de l'idée au publish.

**Recording = trace physique** — le take lui-même (video, transcript). Éphémère sauf si publié.

**Project = assembly créatif** — le montage multi-sources. Peut aggréger rushes de 1-N sessions.

**Composition = rendu** — artefact vidéo final.

**Publier = rituel diffusion** — pas un artefact, une étape de cycle.

### Décisions clés (ne PAS re-débattre)

1. **Hooks B+** : `Topic.hookDraft` JSON libre (notes) + `Session.hooks: {native, marketing}` structuré par format. Pas de sync auto.
2. **Preflight K** : suppression totale. `NarrativeAnchorSticky` discret pendant recording à la place.
3. **Thread Kabou A** : 1 thread par Topic (partagé). Context injection `currentSessionId/currentFormat` dans body `/api/chat`.
4. **narrativeAnchor H** : snapshot au moment creation Session + `anchorSyncedAt` timestamp + stale badge si Topic.narrativeAnchor updated après.
5. **CalendarEntry B** : `sessionId` nullable (**déjà présent en base** via `ContentCalendar.sessionId` — cf. schema.prisma:408). On utilise juste.
6. **Timeline 2 axes** : Topic 4 états (SEED/EXPLORING/MATURE/ARCHIVED), Session 7 états (ajout LIVE sticky + REPLACED auto).
7. **Session.REPLACED** (pas ARCHIVED) pour éviter collision avec Topic.ARCHIVED.
8. **Recovery C+** : IndexedDB buffer + `Session.lastActivityAt` + banner Kabou 3 wordings (<1h / <1 semaine / >1 semaine).

### Codebase Patterns

- **Polymorphic JSON discriminated by `kind`** : pattern établi dans [`apps/web/src/lib/recording-guide.ts`](apps/web/src/lib/recording-guide.ts) (variantes draft/myth_vs_reality/qa/storytelling/hot_take/daily_tip/teleprompter). On réutilise pour `narrativeAnchor` + `recordingScript`.

- **Vercel AI SDK `generateObject` avec zod schema** : pattern dans [`subject-hook.service.ts:67`](apps/api/src/modules/ai/services/subject-hook.service.ts#L67), [`narrative-arc.service.ts`](apps/api/src/modules/ai/services/narrative-arc.service.ts). Même pattern pour `take-analysis.service.ts`.

- **pgvector via prisma.$executeRaw/$queryRaw** : pattern dans [`memory.service.ts`](apps/api/src/modules/ai/services/memory.service.ts) — Prisma ne supporte pas nativement le type `vector`, on passe par raw SQL avec `${vectorLiteral}::vector`.

- **Tools Kabou** : 1 fichier par tool dans `apps/api/src/modules/ai/tools/`, exposés via `ai.controller` → passés au `useChat` côté client. Le detection des tools completes se fait via `part.type.startsWith('tool-')` + `part.state === 'output-available'` dans [`SubjectKabouPanel.tsx:95-112`](apps/web/src/app/\(client\)/sujets/%5Bid%5D/SubjectKabouPanel.tsx#L95-L112).

- **Kabou voice strict** : TOUT wording UI + prompt LLM doit passer par [`apps/web/src/lib/kabou-voice.ts`](apps/web/src/lib/kabou-voice.ts) (10 règles + vocabulaire). Jamais "Topic" → "Sujet", "Brief" → "Angle", "Session" → "Tournage", etc.

- **flashToast pattern** : `setState(message) + setTimeout(2200)` dans SubjectWorkspace — pas de library toast (déjà discuté et gardé en D2.2).

- **React Server Components par défaut** : les pages fetch server-side (ex: [`sujets/[id]/page.tsx`](apps/web/src/app/\(client\)/sujets/%5Bid%5D/page.tsx)) puis hydrate des client components (`'use client'`). Pas d'exception à ce pattern.

- **useChat threadId-persisted** : le thread Kabou vit sur `Topic.threadId` (unique), l'historique est hydrated via `/api/chat/history?threadId=X`. Voir [`SubjectKabouPanel.tsx:62-85`](apps/web/src/app/\(client\)/sujets/%5Bid%5D/SubjectKabouPanel.tsx#L62-L85).

- **Format polymorphism** : `ContentFormat` enum dans `@lavidz/types` avec `FORMAT_CONFIGS` map (labels + icons). Toute nouvelle feature format-aware doit s'y référer.

### Files to Reference (already investigated in party mode)

| File | Purpose |
| ---- | ------- |
| [`packages/database/prisma/schema.prisma`](packages/database/prisma/schema.prisma) | Modèles Topic (L375), Session (L43), Recording (L98), ContentCalendar (L398), ConversationMemory (L255), Project (L429), ProjectClip (L445) |
| [`apps/web/src/lib/creative-state.ts`](apps/web/src/lib/creative-state.ts) | `deriveCreativeState` — simplifier à 4 états (retirer SCHEDULED/PRODUCING) |
| [`apps/web/src/lib/recording-guide.ts`](apps/web/src/lib/recording-guide.ts) | Types polymorphes discriminés. Split en narrative-anchor.ts + recording-script.ts |
| [`apps/web/src/lib/kabou-voice.ts`](apps/web/src/lib/kabou-voice.ts) | Source de vérité voix Kabou — 10 règles + vocabulaire. **NE PAS contredire.** |
| [`apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`](apps/web/src/app/\(client\)/sujets/%5Bid%5D/SubjectWorkspace.tsx) | Workspace principal, cartes format à construire, timeline 4 états |
| [`apps/web/src/app/(client)/sujets/[id]/SubjectKabouPanel.tsx`](apps/web/src/app/\(client\)/sujets/%5Bid%5D/SubjectKabouPanel.tsx) | Context injection `currentSessionId`/`currentFormat` dans body transport (L46-52) |
| [`apps/web/src/app/(client)/sujets/[id]/page.tsx`](apps/web/src/app/\(client\)/sujets/%5Bid%5D/page.tsx) | Fetch server-side — inclure narrativeAnchor + relations sessions full |
| [`apps/web/src/components/subject/SubjectHookSection.tsx`](apps/web/src/components/subject/SubjectHookSection.tsx) | Actuellement lit Topic.hooks → refacto pour Session.hooks ; split en SubjectHookDraftSection + SessionHookSection |
| [`apps/web/src/components/subject/SubjectPreflight.tsx`](apps/web/src/components/subject/SubjectPreflight.tsx) | À SUPPRIMER |
| [`apps/web/src/components/session/RecordingSession.tsx`](apps/web/src/components/session/RecordingSession.tsx) | Props inclut déjà `recordingGuide` (L38) → remplacer par `recordingScript`. Sidebar NarrativeAnchorSticky à injecter ici (phase 'recording'). |
| [`apps/web/src/app/s/[sessionId]/page.tsx`](apps/web/src/app/s/%5BsessionId%5D/page.tsx) | Route fetch session + recordingScript, banner reprise Kabou, IndexedDB check |
| [`apps/web/src/app/(client)/projects/[id]/ProjectDetail.tsx`](apps/web/src/app/\(client\)/projects/%5Bid%5D/ProjectDetail.tsx) | Rush library à enrichir (group by questionId + badge ⭐) |
| [`apps/web/src/app/(client)/sujets/[id]/publier/PublishView.tsx`](apps/web/src/app/\(client\)/sujets/%5Bid%5D/publier/PublishView.tsx) | À déplacer sous `/projects/[id]/publier/` |
| [`apps/api/src/modules/ai/services/memory.service.ts`](apps/api/src/modules/ai/services/memory.service.ts) | Ajouter `topicId` filter dans search(), save() |
| [`apps/api/src/modules/ai/services/subject-hook.service.ts`](apps/api/src/modules/ai/services/subject-hook.service.ts) | Split en topic-hook-draft.service (text libre) + session-hook.service (structuré) + RAG retrieval |
| [`apps/api/src/modules/ai/services/narrative-arc.service.ts`](apps/api/src/modules/ai/services/narrative-arc.service.ts) | Ajouter RAG retrieval dans generateObservations() |
| [`apps/api/src/modules/ai/services/preflight.service.ts`](apps/api/src/modules/ai/services/preflight.service.ts) | À SUPPRIMER |
| [`apps/web/src/app/api/chat/route.ts`](apps/web/src/app/api/chat/route.ts) | RAG déjà actif (L86-108, sim>0.65). Ajouter `currentSessionId`/`currentFormat` extraction depuis body + context injection dans systemPrompt ; scope RAG par topicId. |

### Technical Decisions (confirmed post-investigation)

- **`ContentCalendar.sessionId` existe déjà** en base (schema.prisma:408). Pas de migration pour Décision 5 — juste utilisation côté publish flow.
- **`Session.teleprompterScript` reste en place** — c'est une string legacy pour l'overlay teleprompter (pas notre nouveau `recordingScript` polymorphe). Coexistence.
- **`Topic.recordingGuide` JSON** → rename physique en migration vers `Topic.narrativeAnchor` (même shape polymorphe, discriminated by kind). Le backfill est trivial (même donnée, nom de colonne différent).
- **`Session.recordingScript`** new colonne JSON — cloné depuis `Topic.narrativeAnchor` au moment de la création Session + reshape vers le format choisi.
- **`Recording.supersededAt`** new — `NULL` par défaut, set quand un retake est fait sur le même `questionId`.
- **`Recording.kabouRecommendation`** new JSON — stocké par `take-analysis.service.ts` après session submit.
- **`Session.lastActivityAt`** new DateTime — updated à chaque take fini, utilisé par le banner reprise Kabou.
- **`ConversationMemory.topicId`** new String? nullable — permet filtres RAG topic-scoped sans casser l'existant global.
- **`Session.status` enum** : ajout `LIVE`, `REPLACED` (pas `ARCHIVED` côté session).
- **Kill Preflight** : suppression dure de `SubjectPreflight.tsx`, `preflight.service.ts`, endpoints, prompts. Pas d'archive, on tue.
- **IndexedDB** : wrapper custom `apps/web/src/lib/recording-buffer.ts`, pas de library externe (dexie etc.) — les besoins sont simples (save/list/clear par sessionId).
- **Pas de migration destructive** : tous les nouveaux champs sont nullable/optional → backward compat pendant rollout.

### Constraints & Considerations

- **Branche active** : `v2`
- **Package manager** : pnpm (monorepo workspaces)
- **Modèle LLM défaut** : Gemini Flash (Vercel AI SDK, `getDefaultModel()`)
- **Embeddings** : Google Gemini 768 dims, HNSW index, task-aware (RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY)
- **Compatibilité** : ne pas casser les calendarEntries/sessions existantes en base (prod testée par Antoine)
- **Budget** : +0.02€/génération LLM — acceptable pour 3× plus d'appels dans le flow (D4, RAG, take-analysis)
- **Performance** : retrieval RAG < 500ms pour 100+ memories (indexé HNSW, OK)
- **Tests** : Clean slate — aucun framework de test configuré. Acceptance Criteria en Given/When/Then pour test plan manuel.

## Implementation Plan

### Task Ordering Rules

- **Story 1 (migration Prisma) DOIT être mergée avant toute autre story** — sinon rien ne compile (references columns non-existantes).
- **Stories 2–6 et 9 dépendent toutes de 1**. Elles peuvent se faire en parallèle une fois 1 mergée.
- **Story 7 (recovery) et 11 (publier move) sont autonomes** — peuvent démarrer après 1.
- **Story 10 (take-analysis)** dépend de 1 (colonne `kabouRecommendation`) mais pas des autres.
- **Story 8 (docs + wordings)** se fait en parallèle, finalisée à la fin.

### Story 1 — Migration Prisma (3.5 pts)

**Objective:** Mettre en place tous les schémas de données nécessaires. Backward-compat garantie (champs nouveaux nullable, colonnes renommées avec migration data-preserving).

- [ ] **Task 1.1** : Créer DEUX migrations Prisma distinctes (⚠️ F1 critical)
  - File 1: `packages/database/prisma/migrations/{ts1}_add_session_status_values/migration.sql`
    - Contenu : UNIQUEMENT `ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'LIVE';` puis `ALTER TYPE ... ADD VALUE 'REPLACED';`
  - File 2: `packages/database/prisma/migrations/{ts2}_subject_session_refactor/migration.sql` (ts2 > ts1)
    - Contenu : toutes les ALTER TABLE / UPDATE / CREATE INDEX (voir Task 1.3)
  - Notes: **Postgres interdit `ALTER TYPE ADD VALUE` + usage de la valeur dans la même transaction**. Prisma wrap ses migrations en tx → si on les met ensemble, `prisma migrate deploy` crash. Split obligatoire. Les 2 migrations s'appliquent séquentiellement, l'enum est "visible" dans la 2e.

- [ ] **Task 1.2** : Mettre à jour `schema.prisma`
  - File: `packages/database/prisma/schema.prisma`
  - Action:
    ```prisma
    model Topic {
      // ... existant ...
      // F9: stratégie DUAL-WRITE pendant 1 sprint — les 2 cols coexistent et tout write va dans les deux
      // (plus un rollback safe qu'un fallback ambigu). Drop des legacy au sprint+1.
      recordingGuide  Json?  // LEGACY dual-write — drop sprint+1
      narrativeAnchor Json?  // NEW — { kind: 'draft', bullets: string[], updatedAt: string } STRICTEMENT (F3 + F14)
      hooks           Json?  // LEGACY dual-write — drop sprint+1
      hookDraft       Json?  // NEW — notes libres d'idées d'accroches (texte libre, pas structuré)
    }

    model Session {
      // ... existant ...
      recordingScript Json?         // NEW — script format-specific polymorphe (6 kinds hot_take/qa/etc.) + anchorSyncedAt
      hooks           Json?         // NEW — { native, marketing, chosen?, generatedAt } format-specific
      lastActivityAt  DateTime?     // NEW — updated à chaque take fini (pour banner reprise)
      // status enum ajoute LIVE + REPLACED (cf. SessionStatus enum)
    }

    model Recording {
      // ... existant ...
      supersededAt         DateTime?  // NEW — set quand un retake sur même questionId existe (atomic via transaction, F10)
      kabouRecommendation  Json?      // NEW — { score, reason, criteria: { tempo, clarity, energy, tone } }
    }

    model Project {
      // ... existant ...
      sessionId String?  @unique  // F5 — ajout @unique pour auto-create idempotent (1 Project max par session source)
      // le reste inchangé
    }

    enum SessionStatus {
      PENDING
      RECORDING
      SUBMITTED
      PROCESSING
      DONE
      LIVE       // NEW — sticky, quand publishedAt set
      REPLACED   // NEW — variante remplacée (auto-set quand "Tenter un autre angle")
      FAILED
    }

    model ConversationMemory {
      // ... existant ...
      topicId String?   // NEW — scope topic-level pour RAG
      topic   Topic?    @relation(fields: [topicId], references: [id], onDelete: SetNull)

      @@index([profileId, topicId])  // F6 — index pour query topic-scoped performant
    }
    ```
  - Notes: F5 — `Project.sessionId` devient @unique. Si des duplicates existent en prod (check via `SELECT "sessionId", count(*) FROM "Project" WHERE "sessionId" IS NOT NULL GROUP BY "sessionId" HAVING count(*) > 1`), dedupper avant la migration (garder le plus ancien, orphaner les clips des autres vers lui). Si 0 duplicate : migration safe.

- [ ] **Task 1.3** : SQL migrations (split en 2 fichiers — F1 critical)

  **File 1 — `{ts1}_add_session_status_values/migration.sql`** (doit être appliqué seul, AVANT le fichier 2) :
    ```sql
    ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'LIVE';
    ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'REPLACED';
    ```

  **File 2 — `{ts2}_subject_session_refactor/migration.sql`** (tout le reste) :
    ```sql
    -- Topic (dual-write strategy, F9)
    ALTER TABLE "Topic" ADD COLUMN "narrativeAnchor" JSONB;
    ALTER TABLE "Topic" ADD COLUMN "hookDraft" JSONB;
    -- Backfill narrativeAnchor depuis recordingGuide existant, en shape { kind: 'draft', bullets, updatedAt }
    -- Si legacy recordingGuide est déjà kind='draft', copier directement. Si kind=format-specific, extraire sourceDraft.bullets si présent sinon wrapper les fields les plus pertinents.
    UPDATE "Topic"
      SET "narrativeAnchor" = CASE
        WHEN "recordingGuide"->>'kind' = 'draft' THEN jsonb_build_object(
          'kind', 'draft',
          'bullets', "recordingGuide"->'bullets',
          'updatedAt', "updatedAt"::text
        )
        WHEN "recordingGuide"->'sourceDraft'->'bullets' IS NOT NULL THEN jsonb_build_object(
          'kind', 'draft',
          'bullets', "recordingGuide"->'sourceDraft'->'bullets',
          'updatedAt', "updatedAt"::text
        )
        ELSE NULL
      END
      WHERE "recordingGuide" IS NOT NULL;

    -- Session
    ALTER TABLE "Session" ADD COLUMN "recordingScript" JSONB;
    ALTER TABLE "Session" ADD COLUMN "hooks" JSONB;
    ALTER TABLE "Session" ADD COLUMN "lastActivityAt" TIMESTAMP(3);

    -- Recording
    ALTER TABLE "Recording" ADD COLUMN "supersededAt" TIMESTAMP(3);
    ALTER TABLE "Recording" ADD COLUMN "kabouRecommendation" JSONB;

    -- ConversationMemory : ajout topicId + index composite (F6)
    ALTER TABLE "ConversationMemory" ADD COLUMN "topicId" TEXT REFERENCES "Topic"(id) ON DELETE SET NULL;
    CREATE INDEX "ConversationMemory_profileId_topicId_idx" ON "ConversationMemory"("profileId", "topicId");

    -- F6 — BACKFILL ConversationMemory.topicId depuis Session.topicId (sinon RAG topic-scoped retournera 0 pour users existants)
    UPDATE "ConversationMemory" m
      SET "topicId" = s."topicId"
      FROM "Session" s
      WHERE m."sessionId" = s.id
        AND s."topicId" IS NOT NULL
        AND m."topicId" IS NULL;

    -- F5 — Project.sessionId devient UNIQUE (dedup pré-requis si duplicates en prod)
    -- Vérif AVANT ce ALTER : SELECT "sessionId", count(*) FROM "Project" WHERE "sessionId" IS NOT NULL GROUP BY "sessionId" HAVING count(*)>1;
    -- Si 0 ligne → safe d'appliquer. Sinon dédupper manuellement d'abord.
    ALTER TABLE "Project" ADD CONSTRAINT "Project_sessionId_key" UNIQUE ("sessionId");

    -- F4 — UNIQUE INDEX PARTIEL pour enforcer "1 canonical per (topicId, contentFormat)"
    -- Les sessions REPLACED/FAILED sont exclues (elles ne comptent pas comme canoniques).
    CREATE UNIQUE INDEX "Session_topicId_contentFormat_canonical_unique"
      ON "Session"("topicId", "contentFormat")
      WHERE "status" NOT IN ('REPLACED', 'FAILED') AND "topicId" IS NOT NULL AND "contentFormat" IS NOT NULL;

    -- F10 — UNIQUE INDEX PARTIEL defense-in-depth pour "1 canonical recording per (sessionId, questionId)"
    -- Si une race échappe à la transaction Prisma (Task 5.4), la DB refuse la 2e insertion.
    CREATE UNIQUE INDEX "Recording_sessionId_questionId_canonical_unique"
      ON "Recording"("sessionId", "questionId")
      WHERE "supersededAt" IS NULL;
    ```
  - Notes:
    - Le backfill topicId (F6) débloque le RAG enrichment immédiatement pour les memories historiques.
    - L'index unique partiel F4 peut échouer si deux sessions canoniques (topicId, contentFormat) existent déjà en prod. Pré-check : `SELECT "topicId", "contentFormat", count(*) FROM "Session" WHERE "status" NOT IN ('REPLACED','FAILED') AND "topicId" IS NOT NULL AND "contentFormat" IS NOT NULL GROUP BY "topicId","contentFormat" HAVING count(*)>1;`. Si doublons, marquer le plus ancien en REPLACED avant d'appliquer l'index.
    - Attention : `@@index([profileId, topicId])` en schema.prisma donne un nom différent (`ConversationMemory_profileId_topicId_idx`) — aligner avec le SQL.

- [ ] **Task 1.4** : Regenerer le client Prisma
  - Action: `pnpm --filter @lavidz/database prisma generate`
  - Notes: vérifier que `pnpm --filter @lavidz/web typecheck` passe (propagation des types dans tout le monorepo)

**ACs :**

- [ ] AC 1.1 : Given les 2 migrations appliquées en dev, when on inspecte la DB, then les 8 nouvelles colonnes existent, les colonnes legacy (Topic.recordingGuide, Topic.hooks) coexistent, et les 2 nouveaux index (Session canonical partial + ConversationMemory composite) existent.
- [ ] AC 1.2 : Given un Topic existant avec `recordingGuide` kind='draft' pré-migration, when la migration s'exécute, then `Topic.narrativeAnchor` contient `{ kind: 'draft', bullets: [...], updatedAt: <Topic.updatedAt> }`.
- [ ] AC 1.3 : Given un environnement post-migration, when `pnpm --filter @lavidz/web typecheck` et `pnpm --filter @lavidz/api typecheck` tournent, then les deux passent sans erreur.
- [ ] AC 1.4 : Given `SessionStatus`, when on crée une Session avec `status: 'LIVE'` ou `'REPLACED'`, then Prisma l'accepte (test après les 2 migrations appliquées).
- [ ] AC 1.5 : Given une `ConversationMemory` liée à une Session.topicId non-null pré-migration, when backfill exécuté, then son `topicId` est rempli correctement.
- [ ] AC 1.6 (F5) : Given le constraint `Project_sessionId_key`, when on tente de créer 2 Projects avec le même `sessionId`, then la 2e insertion échoue avec unique violation.
- [ ] AC 1.7 (F4) : Given l'index unique partiel, when on tente de créer une 2e Session canonique (status PENDING/DONE/LIVE…) pour le même `(topicId, contentFormat)` qu'une existante non-REPLACED, then l'insertion échoue.
- [ ] AC 1.8 (F1) : Given les 2 migrations générées, when on inspecte leurs fichiers, then la première contient UNIQUEMENT des `ALTER TYPE ADD VALUE` et la seconde ne les contient pas.

---

### Story 2 — Tools backend + RAG enrichment + topicId scope (5 pts)

**Objective:** Refactor les services/tools pour matcher la nouvelle architecture. Enrichir les 3 services "voix" avec RAG topic-scoped.

- [ ] **Task 2.1** : Split `subject-hook.service.ts`
  - File: `apps/api/src/modules/ai/services/subject-hook.service.ts`
  - Action: Split en 2 :
    - `topic-hook-draft.service.ts` — stocke/récupère `Topic.hookDraft` (JSON libre, pas structuré)
    - `session-hook.service.ts` — génère `Session.hooks` format-specific avec `Session.contentFormat` + `Topic.narrativeAnchor` + RAG retrieval des transcripts passés
  - Notes: ancien endpoint `/api/topics/[id]/hooks` → adapter pour `hookDraft`. Nouveau `/api/sessions/[id]/hooks` pour structuré.

- [ ] **Task 2.2** : Ajouter RAG retrieval dans `session-hook.service.ts`
  - File: `apps/api/src/modules/ai/services/session-hook.service.ts` (nouveau)
  - Action: Avant `generateObject()`, call `memoryService.search({ profileId, topicId, query: narrativeAnchor + format, k: 5 })`. Inclure les résultats dans le prompt sous `## Tes tournures passées sur ce sujet`.
  - Notes: fallback gracieux si 0 memories (profile nouveau).

- [ ] **Task 2.3** : Enrichir `narrative-arc.service.ts` avec RAG
  - File: `apps/api/src/modules/ai/services/narrative-arc.service.ts`
  - Action: Dans `generateObservations()`, ajouter retrieval cross-topic (pas filtre `topicId`) des transcripts récents pour enrichir les `recurringThemes` et `evolutionMarkers`.
  - Notes: k=10, fenêtre 90 jours.

- [ ] **Task 2.4** : Renommer les clés des tools Kabou **INLINE dans route.ts** (F2 critical)
  - File: `apps/web/src/app/api/chat/route.ts` (tools sont définis inline vers L~424-497, pas des fichiers NestJS séparés)
  - Action:
    - Ajouter les NOUVELLES clés dans l'objet `tools` passé à `streamText` (ou équivalent) :
      - `update_narrative_anchor` — qui écrit dans `Topic.narrativeAnchor` (au lieu de `Topic.recordingGuide`). Accepte un param `bullets: string[]` (shape `{ kind: 'draft', bullets, updatedAt: now() }` strictement).
      - `reshape_to_recording_script` — accepte param `sessionId: string` (pas `topicId`) + `format: ContentFormat`. Lit `Session.topicEntity.narrativeAnchor` puis `generateObject()` vers le format cible. Écrit dans `Session.recordingScript` (avec `anchorSyncedAt` dans le JSON).
    - **Garder les anciennes clés comme alias pendant 1 sprint** (dual-entry) : ajouter dans le même objet `tools` les entrées `update_recording_guide_draft` et `reshape_recording_guide_to_format` qui **appellent la même fonction interne** que leurs équivalents nouveaux mais dual-write dans l'ancienne ET la nouvelle colonne (F9 dual-write).
  - Notes: Grep cross-check : `grep -rn "update_recording_guide_draft\|reshape_recording_guide_to_format" apps/` doit retourner uniquement `apps/web/src/app/api/chat/route.ts` (définitions des alias). Si MUTATING_TOOLS set dans `SubjectKabouPanel.tsx:29` liste les vieux noms, AJOUTER aussi les nouveaux noms.

- [ ] **Task 2.5** : Enrichir RAG dans `reshape_to_recording_script`
  - File: `apps/web/src/app/api/chat/route.ts` (là où `reshape_to_recording_script` est défini, cf. Task 2.4)
  - Action: Avant l'appel `generateObject()` du tool, call `memoryService.search({ profileId, topicId: session.topicId, query: anchor.bullets.join(' ') + ' ' + format })` pour enrichir le prompt de cohérence voix (injecter les transcripts pertinents dans la section `## Tes tournures passées sur ce sujet`).
  - Notes:
    - Stocker `Session.recordingScript = { ...formatSpecific, anchorSyncedAt: new Date().toISOString() }`.
    - Fallback gracieux si RAG timeout (>800ms — F11) ou 0 memory : continuer sans enrichment.

- [ ] **Task 2.6** : Étendre `memory.service.ts` avec filtre topicId
  - File: `apps/api/src/modules/ai/services/memory.service.ts`
  - Action:
    - `saveMemory(params)` : ajouter `topicId?: string` optionnel. Inclure dans l'INSERT.
    - `search(params)` : ajouter `topicId?: string` optionnel. Si présent, `WHERE "profileId" = $1 AND "topicId" = $2` ELSE comportement actuel (profile-wide).
    - `saveManyDocs` et `saveMany` : propager topicId.
  - Notes: type `Unsupported("vector(768)")` oblige à garder raw SQL. L'index HNSW reste sur `embedding`, pas besoin de changement.

- [ ] **Task 2.7** : Supprimer `preflight.service.ts` et tout ce qui l'utilise
  - Files à supprimer :
    - `apps/api/src/modules/ai/services/preflight.service.ts`
    - Prompts associés dans `apps/api/src/modules/ai/prompts/` (preflight-*.prompt.ts)
    - `apps/web/src/app/api/topics/[id]/preflight/route.ts`
    - `apps/web/src/app/api/sessions/[id]/preflight/route.ts` (si créé)
  - File: `apps/api/src/modules/ai/ai.module.ts`
    - Action: retirer `PreflightService` de providers/imports
  - File: `apps/api/src/modules/ai/ai.controller.ts`
    - Action: retirer endpoints preflight
  - Notes: vérifier qu'aucun autre service n'injecte `PreflightService`.

**ACs :**

- [ ] AC 2.1 : Given un Topic avec `hookDraft` renseigné + `Session.contentFormat = 'HOT_TAKE'`, when appel `/api/sessions/:id/hooks`, then reçoit `Session.hooks = {native, marketing}` formatées hot-take et les transcripts RAG ont bien été injectés dans le prompt.
- [ ] AC 2.2 : Given un profile nouveau (0 memories), when génération de hooks Session, then pas d'erreur, le prompt fonctionne sans RAG enrichment.
- [ ] AC 2.3 : Given un thread Kabou avec des turns legacy référençant `update_recording_guide_draft`, when Kabou re-traite l'historique, then l'alias redirige vers `update_narrative_anchor` sans casser.
- [ ] AC 2.4 : Given appel `memoryService.search({ profileId, topicId: X, query: Y })`, when executed, then SQL filtre par `profileId AND topicId`. Given appel sans `topicId`, then fallback profile-wide.
- [ ] AC 2.5 : Given le preflight supprimé, when n'importe quel appel `/api/topics/:id/preflight`, then 404 (route n'existe plus).

---

### Story 3 — UX Sujet : cartes par format + timeline 4 états + hero card (5 pts)

**Objective:** Transformer le workspace Sujet pour refléter l'architecture 2 axes. Cartes par format (multi-session), timeline simplifiée, onboarding clarifié.

- [ ] **Task 3.1** : Simplifier `deriveCreativeState` à 4 états
  - File: `apps/web/src/lib/creative-state.ts`
  - Action:
    - `CreativeState` type = `'SEED' | 'EXPLORING' | 'MATURE' | 'ARCHIVED'`
    - Retirer `SCHEDULED` et `PRODUCING` (states tactiques, ils appartiennent à Session)
    - `deriveCreativeState()` : ignorer désormais `sessions.status` (plus de logique "hasProducingSession"), garder uniquement Topic.status + brief/narrativeAnchor substance
    - `CREATIVE_STATE_META` : retirer les 2 états, ajuster labels (Graine / Jeune pousse / Arbre / Archivé)
  - Notes: wording déjà validé en party mode.

- [ ] **Task 3.2** : Mettre à jour `CreativeStateTimeline.tsx`
  - File: `apps/web/src/components/subject/CreativeStateTimeline.tsx`
  - Action: 4 étapes au lieu de 6. Emojis et labels : 🌱 Graine → 🌿 Jeune pousse → 🌳 Arbre → (📦 Archivé masqué de la timeline, affiché seulement si archivé).

- [ ] **Task 3.3** : Refacto `SubjectWorkspace.tsx` — cartes par format
  - File: `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`
  - Action:
    - Remplacer la liste "Tournages" plate par des **cartes par format** (`contentFormat` groupé)
    - Chaque carte contient : header (format + icône), session canonique (max 1 par format, non-REPLACED), liste collapsible "Variantes précédentes" (sessions REPLACED)
    - Bouton "Nouveau tournage en {format}" désactivé si session canonique existe ET non FAILED ; sinon bouton "Tenter une variante"
    - Badge de status session (PENDING/RECORDING/SUBMITTED/PROCESSING/DONE/LIVE/FAILED/REPLACED) avec couleurs Sally (cf. party mode)
  - Notes: récupérer toutes les sessions du topic depuis `page.tsx` côté server (déjà fait), grouper côté client par `contentFormat`.

- [ ] **Task 3.4** : Renommer `SubjectRecordingGuide.tsx` → `SubjectNarrativeAnchor.tsx`
  - File: `apps/web/src/components/subject/SubjectRecordingGuide.tsx` → `SubjectNarrativeAnchor.tsx`
  - Action: Rename file + adapter props (`anchor: NarrativeAnchor`). Le rendu reste polymorphe par `kind`.
  - Notes: la logique de rendu (bullets, pairs, beats, etc.) est identique — juste la source de data change.

- [ ] **Task 3.5** : Split `recording-guide.ts` en 2 libs (F3 — types DISTINCTS, pas une union additive)
  - Files:
    - `apps/web/src/lib/narrative-anchor.ts` (new) — type **distinct et minimal** :
      ```ts
      export type NarrativeAnchor = {
        kind: 'draft'          // UNIQUEMENT 'draft', pas de format-specific variants
        bullets: string[]
        updatedAt: string      // F14 — field-level, source de vérité pour stale badge (pas Topic.updatedAt global)
      }
      export function isNarrativeAnchor(v: unknown): v is NarrativeAnchor
      export function narrativeAnchorHasSubstance(a: NarrativeAnchor | null): boolean
      ```
    - `apps/web/src/lib/recording-script.ts` (new) — type **distinct**, polymorphe par format :
      ```ts
      type RecordingScriptVariant =
        | RecordingScriptMythVsReality | RecordingScriptQA | RecordingScriptStorytelling
        | RecordingScriptHotTake | RecordingScriptDailyTip | RecordingScriptTeleprompter
      export type RecordingScript = RecordingScriptVariant & {
        anchorSyncedAt: string  // ISO — permet comparaison avec narrativeAnchor.updatedAt pour stale badge
        sourceAnchorBullets?: string[]  // traçabilité depuis le NarrativeAnchor d'origine
      }
      export function isRecordingScript(v: unknown): v is RecordingScript
      ```
      ⚠️ **Pas de `kind: 'draft'` dans RecordingScript** — si une session n'a pas encore été reshaped à son format, `recordingScript` reste `null` (lazy) et l'UI fallback sur `Topic.narrativeAnchor` en attendant.
    - `apps/web/src/lib/recording-guide.ts` : **deprecation** — transformer le fichier existant en re-export des nouveaux types pour les usages legacy, mais ne PAS faire un alias de type `RecordingGuide = NarrativeAnchor | RecordingScript` (ça recréerait la confusion). À supprimer sprint+1.
  - Notes:
    - Shape DRAFT (NarrativeAnchor) ≠ shape format-specific (RecordingScript). On ne clone pas — on **reshape** (transformation active via tool `reshape_to_recording_script`).
    - Le renderer UI `SubjectNarrativeAnchor` ne gère QUE `kind: 'draft'`. Le renderer `SubjectRecordingScript` gère les 6 formats. Deux composants distincts.

- [ ] **Task 3.6** : Hero card étendue pour nouveaux Topics
  - File: `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`
  - Action: étendre la condition `isEmptySeed` actuelle pour inclure *"MATURE mais sans aucune session"* → afficher une variante hero *"Ton sujet est prêt — choisis ton premier format"* avec format picker inline (6 cards).
  - Notes: la hero card existante (Fix 3.3) couvre déjà SEED ; on étend pour couvrir "MATURE sans session" = cas d'un sujet fraîchement validé.

- [ ] **Task 3.7** : Adapter fetch `page.tsx` pour `narrativeAnchor`
  - File: `apps/web/src/app/(client)/sujets/[id]/page.tsx`
  - Action: fetch Topic avec `narrativeAnchor` (fallback `recordingGuide` pendant 1 sprint). Passer à `SubjectWorkspace`.

**ACs :**

- [ ] AC 3.1 : Given un Topic avec 0 sessions + status DRAFT, when on visite `/sujets/[id]`, then timeline affiche 🌱 Graine et hero card "Commençons ensemble".
- [ ] AC 3.2 : Given un Topic avec 1 session HOT_TAKE DONE + 1 session STORYTELLING PENDING, when on visite le workspace, then 2 cartes format s'affichent (HOT_TAKE avec badge DONE, STORYTELLING avec badge PENDING).
- [ ] AC 3.3 : Given un Topic avec session HOT_TAKE DONE canonique + session HOT_TAKE REPLACED, when affichage, then la carte HOT_TAKE montre la DONE en haut + "Variantes précédentes (1)" collapsible.
- [ ] AC 3.4 : Given une session canonique active, when on clique "Nouveau tournage HOT_TAKE" sur un format déjà utilisé, then bouton désactivé (tooltip : "Un tournage est déjà en cours dans ce format").
- [ ] AC 3.5 : Given Topic MATURE sans session, when affichage, then hero card "Ton sujet est prêt — choisis ton premier format" avec 6 formats cards (HOT_TAKE, STORYTELLING, QUESTION_BOX, DAILY_TIP, MYTH_VS_REALITY, TELEPROMPTER).
- [ ] AC 3.6 : Given un Topic archivé, when visite, then timeline masque les 4 étapes et affiche un banner "📦 Archivé — [Ressortir ce sujet]".
- [ ] AC 3.7 (F7) : Given le retrait de SCHEDULED et PRODUCING du `CreativeState` enum, when `grep -rn "'SCHEDULED'\|'PRODUCING'" apps/web/src/` (hors commentaires, hors tests, hors migration), then 0 résultat (ou uniquement dans la définition de `ContentCalendarStatus` / `SessionStatus` DB enums qui portent heureusement le même littéral mais sont distincts du CreativeState).
- [ ] AC 3.8 (F7) : Given les 4 fichiers impactés (`TopicsList.tsx`, `CreativeStageIcons.tsx`, `api/home/state/route.ts`, `HomeBrief.tsx`), when `pnpm --filter @lavidz/web typecheck` tourne, then 0 erreur TS liée à un état supprimé.

---

### Story 4 — UI Session : sidebar narrativeAnchor + recordingScript (2 pts)

**Objective:** Pendant le tournage, l'entrepreneur a toujours le narrativeAnchor (anchor narratif topic-level) visible en sticky, et le recordingScript (format-specific) dans le panel principal.

- [ ] **Task 4.1** : Créer `NarrativeAnchorSticky.tsx`
  - File: `apps/web/src/components/session/NarrativeAnchorSticky.tsx` (new)
  - Action: composant sticky collapsible, rendu pendant `phase === 'recording'` dans `RecordingSession.tsx`. Props `anchor: NarrativeAnchor`. Rend max 3 bullets (le cœur du sujet).
  - Notes: Wording Sally : *"🧭 Ton angle"*. Toujours lisible, collapsible si gêne.

- [ ] **Task 4.2** : Intégrer `NarrativeAnchorSticky` dans `RecordingSession.tsx`
  - File: `apps/web/src/components/session/RecordingSession.tsx`
  - Action: props `narrativeAnchor: NarrativeAnchor | null` (optionnelle). Render `<NarrativeAnchorSticky anchor={narrativeAnchor} />` dans le layout bottom sticky pendant phase `recording`.
  - Notes: prop `recordingGuide` existante → renommer en `recordingScript`. Le `SubjectRecordingGuide` intérieur devient `SubjectRecordingScript` (même composant, juste renommé).

- [ ] **Task 4.3** : Adapter `/s/[sessionId]/page.tsx` pour fetch recordingScript
  - File: `apps/web/src/app/s/[sessionId]/page.tsx`
  - Action: adapter l'interface `SessionWithTheme` pour inclure `recordingScript` et `topicEntity.narrativeAnchor`. Passer les 2 à `RecordingSession`. Fallback : si `recordingScript === null`, utiliser `narrativeAnchor` (lazy-generated).
  - Notes: compat rétro — ancien champ `topicEntity.recordingGuide` reste lisible 1 sprint.

- [ ] **Task 4.4** : Stale badge si narrativeAnchor a évolué depuis snapshot
  - File: `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx` + composant carte format
  - Action: calculer `isStale = topic.narrativeAnchor.updatedAt > session.recordingScript.anchorSyncedAt`. Afficher badge ⚠️ *"Ton angle a évolué depuis ce script"* avec bouton "Re-synchroniser avec l'angle" qui appelle un endpoint qui re-trigger `reshape_to_recording_script`.
  - Notes: le bouton re-sync n'efface pas les recordings existants, juste le `recordingScript`.

**ACs :**

- [ ] AC 4.1 : Given une session PENDING avec `recordingScript` polymorphe format HOT_TAKE, when l'user lance le tournage et atteint phase `recording`, then `NarrativeAnchorSticky` s'affiche en bas avec les bullets de `Topic.narrativeAnchor`.
- [ ] AC 4.2 : Given le sticky est affiché, when l'user clique sur la flèche collapse, then le sticky se replie (garde juste le label).
- [ ] AC 4.3 : Given une session avec `recordingScript === null` (lazy case), when ouverture du panel tournage, then UI affiche le renderer `SubjectNarrativeAnchor` (bullets draft) avec une discreet CTA *"Kabou peut adapter cet angle au format {X} si tu veux"*. Pas d'erreur. Pas de tentative de rendre le format-specific avec une shape draft.
- [ ] AC 4.4 : Given `Topic.narrativeAnchor.updatedAt > Session.recordingScript.anchorSyncedAt`, when visite de la carte format, then badge ⚠️ stale affiché + bouton re-sync fonctionnel.
- [ ] AC 4.5 : Given l'user clique re-sync, when l'endpoint repond, then `recordingScript` est régénéré avec nouveau contenu + `anchorSyncedAt` = now. Les recordings existants ne sont pas touchés.

---

### Story 5 — Trio boutons reset/variante + soft-discard + wording Kabou (3 pts)

**Objective:** Écran post-tournage offre 3 actions graduées pour gérer l'insatisfaction. Data-level, tout est préservé (soft-discard).

- [ ] **Task 5.1** : Ajouter les 3 boutons dans `PostRecordingView.tsx`
  - File: `apps/web/src/components/session/PostRecordingView.tsx`
  - Action: dans la strate 5 "Next steps", remplacer les boutons actuels par :
    - `🎬 Reprendre une question` (si au moins 1 question dans `improvementPaths` avec `actionType='redo'`)
    - `🔄 On reprend à zéro` (ouvre modale confirmation)
    - `🎨 Tenter un autre angle` (ouvre modale confirmation)
    - `➡️ Passer au montage` (bouton primaire, inchangé)
  - Notes: wordings Sally déjà validés en party mode.

- [ ] **Task 5.2** : Endpoint session reset
  - File: `apps/api/src/modules/sessions/sessions.controller.ts` + `sessions.service.ts`
  - Action: `POST /api/sessions/:id/reset` → soft-discard tous les recordings (set `supersededAt = now` pour tous), set `Session.status = PENDING`, renvoie session updated. `RecordingAnalysis` conservé.
  - Notes: idempotent. Si déjà en PENDING, noop.

- [ ] **Task 5.3** : Endpoint session replace (variante)
  - File: `apps/api/src/modules/sessions/sessions.controller.ts` + `sessions.service.ts`
  - Action: `POST /api/sessions/:id/replace` → set current `Session.status = REPLACED`. Créer nouvelle Session avec même `topicId` + `contentFormat`. Cloner `recordingScript` (avec nouvelle `anchorSyncedAt`). Renvoie nouvelle sessionId.
  - Notes: le user est redirigé vers `/s/[newSessionId]` côté frontend.

- [ ] **Task 5.4** : Retake question + supersededAt atomique (F10)
  - File: `apps/web/src/components/session/RecordingSession.tsx` + `apps/api/src/modules/sessions/sessions.service.ts` (OU service Next.js route équivalent)
  - Action UI : "Reprendre question Q1" depuis PostRecordingView redirige vers `RecordingSession` avec `questionIndex = index de Q1`. Le nouvel enregistrement créera un nouveau `Recording` avec `questionId = Q1.id`.
  - **Action backend (F10 critical pour éviter race)** : la création d'un Recording doit se faire via `prisma.$transaction([updatePrevious, createNew])` atomiquement :
    ```ts
    await prisma.$transaction([
      prisma.recording.updateMany({
        where: { sessionId, questionId, supersededAt: null },
        data: { supersededAt: new Date() },
      }),
      prisma.recording.create({
        data: { sessionId, questionId, /* ... */, supersededAt: null },
      }),
    ])
    ```
  - **Defense-in-depth** : ajouter aussi un **unique index partiel** DB-level dans la migration Story 1 :
    ```sql
    CREATE UNIQUE INDEX "Recording_sessionId_questionId_canonical_unique"
      ON "Recording"("sessionId", "questionId")
      WHERE "supersededAt" IS NULL;
    ```
    Ça évite les doubles "canonical" même si une race échappe à la transaction.
  - Notes: sans cette atomicité, 2 clics rapides ou 2 retries réseau concurrents peuvent créer 2 canoniques → Story 9 badge ⭐ affiche le mauvais take. Avec l'index partiel, la 2e insertion échoue explicitement → le client peut retry proprement.

- [ ] **Task 5.5** : Modales de confirmation Kabou
  - File: `apps/web/src/components/session/PostRecordingView.tsx`
  - Action: 2 modales (Radix AlertDialog, déjà dispo via `@radix-ui/react-alert-dialog`) :
    - Reset : *"On reprend à zéro — garde le script, on recommence la prise. Tes anciennes prises restent consultables au montage."*
    - Variante : *"On tente un autre angle — je garde ta version précédente côté historique, et on repart avec un nouveau script pour ce format."*

**ACs :**

- [ ] AC 5.1 : Given une session DONE avec 3 recordings (Q1, Q2, Q3), when clic "On reprend à zéro" + confirm, then session status = PENDING, les 3 recordings ont `supersededAt` set, le recordingScript est conservé.
- [ ] AC 5.2 : Given une session DONE, when clic "Tenter un autre angle" + confirm, then current session status = REPLACED, nouvelle session créée même format, user redirigé vers `/s/[newId]`.
- [ ] AC 5.3 : Given une session RECORDING avec 1 recording sur Q1, when l'user re-record Q1 (nouveau Recording créé), then l'ancien Recording Q1 a `supersededAt` set (atomiquement — même en cas de 2 submits concurrents, jamais 2 canonicals simultanés).
- [ ] AC 5.3-bis (F10) : Given 2 requests concurrents de création de Recording sur même (sessionId, questionId), when DB index partiel actif, then la 2e requête échoue avec unique violation (caught par le service qui retry ou signale).
- [ ] AC 5.4 : Given les boutons trio, when affichés, then les wordings Kabou respectent la voix (cf. party mode wording validé).
- [ ] AC 5.5 : Given une session REPLACED, when fetch `session.recordings`, then toutes les recordings sont toujours là (pas deletées), accessibles via ProjectDetail.

---

### Story 6 — Kill preflight + intégration NarrativeAnchorSticky (1 pt)

**Objective:** Supprimer totalement le feature preflight inutilisé. NarrativeAnchorSticky (Story 4) sert de remplacement mental.

- [ ] **Task 6.1** : Supprimer `SubjectPreflight.tsx`
  - File: `apps/web/src/components/subject/SubjectPreflight.tsx`
  - Action: DELETE
  - Notes: vérifier qu'aucun autre composant ne l'importe.

- [ ] **Task 6.2** : Retirer condition rendu dans `SubjectWorkspace.tsx`
  - File: `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`
  - Action: supprimer le bloc `{!isArchived && (creativeState === 'MATURE' || creativeState === 'SCHEDULED') && <SubjectPreflight ... />}`.

- [ ] **Task 6.3** : Supprimer endpoints preflight
  - Files à supprimer : `apps/web/src/app/api/topics/[id]/preflight/route.ts`
  - Notes: la route `/api/topics/[id]/preflight` retournera 404 naturellement (folder supprimé).

- [ ] **Task 6.4** : Supprimer `preflight.service.ts` (cf. Task 2.7, already covered)
  - Notes: cross-reference Story 2, pas de duplication de travail.

**ACs :**

- [ ] AC 6.1 : Given n'importe quel Topic state, when on visite `/sujets/[id]`, then aucun bouton/section "Pré-tournage" n'apparaît.
- [ ] AC 6.2 : Given une requête POST à `/api/topics/[id]/preflight`, when executée, then 404.
- [ ] AC 6.3 : Given le code, when `grep -r 'SubjectPreflight\|preflight.service' apps/`, then 0 résultat.

---

### Story 7 — Recovery C+ : IndexedDB + server-side resumption + banner Kabou (3.5 pts)

**Objective:** Aucun crash/quit ne fait perdre de travail. Banner Kabou chaleureux à la reprise, adapté au temps écoulé.

- [ ] **Task 7.1** : Créer `recording-buffer.ts` (IndexedDB wrapper + quota + TTL) — F8
  - File: `apps/web/src/lib/recording-buffer.ts` (new)
  - Action: API :
    ```ts
    export async function isBufferAvailable(): Promise<{ available: boolean; reason?: 'no-indexeddb' | 'quota-low'; quotaBytes?: number }>
    export async function saveTake(sessionId: string, questionId: string, blob: Blob, meta: { duration: number; recordedAt: string }): Promise<{ takeId: string; saved: boolean; reason?: string }>
    export async function listBufferedTakes(sessionId: string): Promise<BufferedTake[]>
    export async function clearTake(takeId: string): Promise<void>
    export async function clearBuffer(sessionId: string): Promise<void>
    export async function listAllOrphanedSessions(): Promise<string[]>  // pour cross-device warning
    export async function purgeExpired(maxAgeMs?: number): Promise<number>  // F8 — TTL 7 jours par défaut
    ```
  - F8 — Quota detection : avant chaque `saveTake`, vérifier `navigator.storage.estimate()`. Si `quota - usage < blob.size × 1.5` (safety margin) → retourner `{ saved: false, reason: 'quota-low' }` et laisser RecordingSession basculer sur upload synchrone (fallback plus lent mais safe).
  - F8 — TTL 7 jours : à chaque mount de `RecordingSession`, call `purgeExpired(7 * 24 * 3600 * 1000)`. Purge tous les takes dont `meta.recordedAt < now - 7j`.
  - F8 — Privacy : ajouter une entrée dans [tooltip ou policy] signalant *"Tes prises sont temporairement stockées sur cet appareil pour éviter la perte — effacées automatiquement sous 7 jours ou dès que l'upload réussit"*. Tooltip sur le banner reprise (Task 7.4).
  - Notes: wrapper sur `window.indexedDB` direct (pas de lib externe). Schema : 1 object store `recordingBuffers`, clés composées `{sessionId, takeId}`, value = `{ blob, questionId, meta }`. Gérer absence IndexedDB (mode privé Safari ancien) → `isBufferAvailable` retourne `{ available: false, reason: 'no-indexeddb' }` et tout upload devient synchrone.

- [ ] **Task 7.2** : Intégrer buffer dans `RecordingSession.tsx`
  - File: `apps/web/src/components/session/RecordingSession.tsx`
  - Action:
    - Après chaque take fini (MediaRecorder stop + review OK) : `saveTake(sessionId, questionId, blob, meta)` AVANT upload
    - Upload → si succès : `clearTake(takeId)`. Si échec : retry au prochain load.
    - Au mount : `listBufferedTakes(sessionId)` → si non-vide : retry upload silencieux + banner "On a récupéré tes prises non envoyées".

- [ ] **Task 7.3** : Update `Session.lastActivityAt`
  - File: `apps/api/src/modules/sessions/sessions.service.ts`
  - Action: ajouter une méthode `touchActivity(sessionId)` appelée par :
    - Endpoint `/api/sessions/:id/take-uploaded` après chaque upload recording
    - Endpoint de submit final
  - Notes: update `Session.lastActivityAt = now`.

- [ ] **Task 7.4** : Banner reprise Kabou dans `/s/[sessionId]/page.tsx`
  - File: `apps/web/src/app/s/[sessionId]/page.tsx` + composant `ResumeBanner.tsx` (new)
  - Action: calculer elapsed = `now - session.lastActivityAt`. 3 wordings :
    - <1h : *"Tu avais fait {N} prises, on reprend à Q{X} ?"*
    - <1 semaine : *"Tu as tourné {N} prises [hier/il y a X jours], on continue ou tu veux tout refaire à tête reposée ?"*
    - >1 semaine : *"On se retrouve ! Ça fait {X} {semaines/mois}. Tu veux reprendre ou repartir de zéro ? Ton angle a peut-être évolué."*
  - Notes: si stale badge (cf. Story 4) détecté → signaler dans le banner long-terme.

- [ ] **Task 7.5** : Cross-device warning
  - File: `apps/web/src/components/session/ResumeBanner.tsx`
  - Action: au mount, `listAllOrphanedSessions()` → pour chaque orphan, fetch server-side : si server-state est DONE/LIVE/REPLACED → auto-clear buffer. Sinon → warning *"Tu avais des prises non synchronisées sur un autre appareil — elles sont perdues pour ce device"*.

**ACs :**

- [ ] AC 7.1 : Given user ferme l'onglet après Q1 take complet (uploadé), when il revient, then banner *"Tu avais fait 1 prise, on reprend à Q2 ?"* + session positionnée sur Q2.
- [ ] AC 7.2 : Given user ferme après Q1 take complet non-uploadé (crash mid-upload), when il revient, then retry upload automatique silencieux + banner identique.
- [ ] AC 7.3 : Given user revient 2 jours après, when load page, then wording `<1 semaine`.
- [ ] AC 7.4 : Given user revient 1 mois après + narrativeAnchor modifié, when load, then wording long-terme + mention *"Ton angle a peut-être évolué"* + stale badge cohérent.
- [ ] AC 7.5 : Given IndexedDB orphelins d'un sessionId qui est REPLACED côté server, when check, then buffer auto-cleared sans warning.
- [ ] AC 7.6 : Given user sur device B (pas d'IndexedDB local pour cette session), when reload, then pas de fausse alerte.

---

### Story 8 — Tests E2E + doc archi + stale badge (2.5 pts)

**Objective:** Documentation archi complète (Paige) + wordings Sally finalisés + checklist manual test plan.

- [ ] **Task 8.1** : Doc architecture
  - File: `docs/architecture/subject-session-split.md` (new)
  - Action: écrire :
    - Philosophie 2 axes (stratégique/tactique)
    - Diagramme entités Mermaid (Topic ↔ Session ↔ Recording ↔ Project ↔ Composition)
    - State machine Topic (4 états) + Session (7 états) — 2 diagrammes side-by-side
    - Matrix *"donnée vit à quel niveau"* (brief, hooks, sources, narrativeAnchor, recordingScript, preflight, analysis, publish)
    - Legacy tool aliases (phase-out plan)
    - Migration rollback procedure
  - Notes: suivre les conventions de voix/tone Lavidz.

- [ ] **Task 8.2** : Consolider wordings Sally dans `kabou-voice.ts`
  - File: `apps/web/src/lib/kabou-voice.ts`
  - Action: ajouter les nouveaux wordings validés en party mode :
    - `KABOU_MUTATION_TOAST` : existant, OK
    - `KABOU_RESUME_COPY` : new — 3 wordings (<1h/<1 semaine/>1 semaine)
    - `KABOU_RESET_COPY` + `KABOU_REPLACE_COPY` : wordings modales
    - `KABOU_TAKE_SELECTOR_COPY` : wordings recommandation ⭐
  - Notes: reste dans la philosophie existante du fichier (strictement français, voix Kabou).

- [ ] **Task 8.3** : Stale badge component
  - File: `apps/web/src/components/subject/StaleAnchorBadge.tsx` (new)
  - Action: petit composant réutilisable, props `isStale: boolean, onResync: () => void`. Utilisé dans Story 4 (cartes format).

- [ ] **Task 8.4** : Test plan consolidé
  - File: `docs/architecture/subject-session-split.md` (section Tests)
  - Action: copier tous les ACs des stories + 5-6 scénarios end-to-end manuels (full user journey : create topic → explore → choose format → record → retake → publish).

**ACs :**

- [ ] AC 8.1 : Given le doc archi, when consulté, then il contient au moins 2 diagrammes mermaid + matrix artefacts × niveau.
- [ ] AC 8.2 : Given les wordings Kabou, when `grep 'raté\|échec' apps/web/src/lib/kabou-voice.ts`, then "raté" domine (pas "échec") cohérent avec la règle vocabulaire.
- [ ] AC 8.3 : Given `StaleAnchorBadge.tsx`, when rendered avec `isStale=true`, then affiche badge + bouton re-sync cliquable.

---

### Story 9 — Take selector dans ProjectDetail (group + badge ⭐) (1.5 pts)

**Objective:** Dans la rush library du Project, grouper les rushes par questionId et mettre en avant la canonique avec badge Kabou recommandation.

- [ ] **Task 9.1** : Refacto library section dans `ProjectDetail.tsx`
  - File: `apps/web/src/app/(client)/projects/[id]/ProjectDetail.tsx`
  - Action:
    - Grouper `rushes` par `questionId`
    - Pour chaque question : afficher la "canonical" (most recent non-superseded) avec badge ⭐ si `kabouRecommendation` présent
    - Accordion collapsible "Prises précédentes ({N})" avec les superseded takes
    - Icone ⭐ tooltip = `kabouRecommendation.reason`

- [ ] **Task 9.2** : Fetch multi-session dans rush library
  - File: `apps/web/src/app/api/projects/[id]/rushes/route.ts` (OR le service NestJS équivalent)
  - Action: vérifier que la query inclut les rushes de **toutes les sessions du topic** si `Project.sessionId` est set (include `session.topic.sessions.recordings` via Prisma).
  - Notes: fallback "toutes les sessions de l'org" si pas de topic attaché (libre à l'user de mixer).

**ACs :**

- [ ] AC 9.1 : Given un Project avec rushes de 2 sessions (HOT_TAKE et STORYTELLING) du même topic, when library affichée, then les rushes sont groupés par questionId ET séparés par session/format.
- [ ] AC 9.2 : Given un Recording avec `kabouRecommendation = { score: 0.85, reason: '...' }`, when affichage, then badge ⭐ avec tooltip reason.
- [ ] AC 9.3 : Given 3 recordings même questionId, 1 canonical + 2 superseded, when affichage, then canonical au top + "Prises précédentes (2)" collapsible.
- [ ] AC 9.4 : Given l'user drag un superseded rush vers la timeline, when drop, then ça fonctionne (la timeline accepte tous les rushes, canonical ou non).

---

### Story 10 — Kabou take-analysis service + recommandation (1.5 pts)

**Objective:** Service backend qui compare les prises d'une même question et stocke une recommandation.

- [ ] **Task 10.1** : Créer `take-analysis.service.ts`
  - File: `apps/api/src/modules/ai/services/take-analysis.service.ts` (new)
  - Action: méthode `analyzeSessionTakes(sessionId)` :
    - Fetch tous les recordings de la session, group by questionId
    - Pour chaque group où `count > 1`, envoie les transcripts + durées à Gemini Flash via `generateObject()` schema :
      ```zod
      z.object({
        canonicalRecordingId: z.string(),
        reason: z.string(),  // "Ta prise 2 avait un ton plus posé et un meilleur tempo"
        criteria: z.object({
          tempo: z.number(),     // 0-1
          clarity: z.number(),
          energy: z.number(),
          tone: z.number(),
        }),
      })
      ```
    - Stocke le résultat dans `Recording.kabouRecommendation = { score, reason, criteria }` (pour le canonical)

- [ ] **Task 10.2** : Trigger automatique post-submit
  - File: `apps/api/src/modules/sessions/sessions.service.ts`
  - Action: dans le flow qui trigger `RecordingAnalysis` après submit, chaîner l'appel `takeAnalysisService.analyzeSessionTakes(sessionId)` pour les sessions avec retakes (>1 recording par question).
  - Notes: async, non-bloquant. Si échec → log warning + skip (pas de retry automatique).

- [ ] **Task 10.3** : Exposer via API
  - File: `apps/api/src/modules/sessions/sessions.controller.ts`
  - Action: endpoint `POST /api/sessions/:id/analyze-takes` pour trigger manuel (au cas où l'auto-trigger a raté).
  - Notes: admin-only ou public ? → public ok, idempotent.

**ACs :**

- [ ] AC 10.1 : Given une session avec 1 questionId ayant 3 recordings, when submit, then `kabouRecommendation` est stocké sur le Recording sélectionné comme canonical par Kabou.
- [ ] AC 10.2 : Given une session avec uniquement 1 recording par question (pas de retake), when analyze called, then no-op (pas d'écriture).
- [ ] AC 10.3 : Given un LLM error, when analyze called, then log warning, pas de crash, session flow non-bloqué.
- [ ] AC 10.4 : Given 2 recordings très différents en qualité, when compare, then la reason est spécifique et non-générique.

---

### Story 11 — Move /publier → /projects/[id]/publier + auto-create Project + LinkedIn multi-session (2 pts)

**Objective:** La publication est un attribut de Project (pas Session). Auto-create Project sur session mono-rush. LinkedIn prompt aggrège multi-sessions.

- [ ] **Task 11.1** : Déplacer la view publier
  - Files:
    - `apps/web/src/app/(client)/sujets/[id]/publier/page.tsx` → `apps/web/src/app/(client)/projects/[id]/publier/page.tsx`
    - `apps/web/src/app/(client)/sujets/[id]/publier/PublishView.tsx` → `apps/web/src/app/(client)/projects/[id]/publier/PublishView.tsx`
  - Action: adapter les props : `projectId` au lieu de `sessionId`. Fetch `Project` + `Composition` (pour finalVideoKey). Adapter les endpoints `/api/sessions/:id/publish` → `/api/projects/:id/publish` (ou garder session-level mais trigger via Project).
  - Notes: garder l'ancien path avec un redirect 301.

- [ ] **Task 11.2** : Auto-create Project au submit mono-rush
  - File: `apps/api/src/modules/sessions/sessions.service.ts` + `apps/api/src/modules/projects/projects.service.ts`
  - Action: dans le flow de submit session (status PENDING → SUBMITTED), si la session a exactement 1 recording avec 1 questionId OR si c'est un mono-format naturel, créer automatiquement un `Project { sessionId, title: Topic.name, clips: [thatRush] }`.
  - Notes: idempotent via `Project.sessionId` unique-ish check. Si projet existe déjà pour cette session, skip.

- [ ] **Task 11.3** : Redirect ancien path
  - File: `apps/web/src/app/(client)/sujets/[id]/publier/page.tsx`
  - Action: remplacer le contenu par un redirect server-side. Lookup le Project associé à la session via `Project.sessionId = [id]`. Si trouvé → `redirect('/projects/' + projectId + '/publier')`. Si pas trouvé → 404.
  - Notes: backward compat 1 sprint, puis suppression dure.

- [ ] **Task 11.4** : LinkedIn posts multi-session
  - File: `apps/web/src/components/social/LinkedInPostsSection.tsx` + service backend
  - Action: le prompt reçoit maintenant les transcripts de **toutes les ProjectClip.recording** (pas juste 1 session). Adapter le context window + la prompt voice.
  - Notes: si multi-topic détecté → message UI *"Ton contenu mixe 2 angles — choisis la caption qui fédère ou une par angle"*.

- [ ] **Task 11.5** : Bouton "Publier" dans SubjectWorkspace
  - File: `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`
  - Action: changer le lien du bouton "Publier" (session DONE) de `/sujets/[sessionId]/publier` vers `/projects/[projectId]/publier` en lookupant le Project associé via `Project.sessionId`.

**ACs :**

- [ ] AC 11.1 : Given une Session soumise avec 1 rush, when submit, then un Project auto-created (check DB : row dans `Project` avec `sessionId`).
- [ ] AC 11.2 : Given une session REPLACED (variant), when check, then l'ancien Project associé à la session source n'est PAS dupliqué (pas d'auto-create si déjà existant).
- [ ] AC 11.3 : Given une navigation vers `/sujets/[sessionId]/publier`, when sessionId a un Project associé, then redirect 301 vers `/projects/[projectId]/publier`.
- [ ] AC 11.4 : Given un Project avec rushes de 2 sessions du même topic, when visite `/projects/[id]/publier`, then LinkedIn section génère des captions aggregating les transcripts des 2 sessions.
- [ ] AC 11.5 : Given un Project cross-topic (rushes de 2 topics), when LinkedIn prompt appelé, then message UI propose 2 options (caption fédérative ou 2 captions distinctes).
- [ ] AC 11.6 : Given une session DONE dans SubjectWorkspace, when clic "Publier", then navigation vers `/projects/[projectId]/publier` (pas `/sujets/[sessionId]/publier`).

## Additional Context

### Dependencies

Nouvelles dépendances npm à installer :
- Aucune — tout est déjà dans l'écosystème (vaul déjà ajouté précédemment, reste à utiliser).

Schémas de données impactés :
- 8 colonnes ajoutées (nullable, backward-compat)
- 1 colonne renommée (`Topic.recordingGuide` → `Topic.narrativeAnchor`)
- 2 valeurs enum ajoutées (`Session.status` : LIVE, REPLACED)

### Testing Strategy

**Clean slate — pas de test framework**. Stratégie :

1. **Acceptance Criteria format Given/When/Then** dans chaque story (test plan manuel)
2. **Typecheck** obligatoire : `pnpm --filter @lavidz/web typecheck` + `pnpm --filter @lavidz/api typecheck` après chaque story
3. **Migration Prisma dry-run** avant apply en prod : `pnpm --filter @lavidz/database prisma migrate diff`
4. **Browser smoke test manuel** sur le sujet `cmo8oop5u001k42bsl5zngux4` + projet `cmo8nqprx000j42bsi9wusook` (cas réels Antoine)
5. **Si E2E automatisé souhaité post-spec** : invoker `/bmad-testarch-framework` séparément (Playwright recommandé)

### Notes

- Ordre de livraison critique : **Story 1 (migration) avant tout** — sinon rien ne compile
- Stories 2-11 peuvent se faire en parallèle partiel une fois la migration appliquée
- Kabou voice MUST reviser par Sally (bmad-ux-designer) si nouveaux wordings hors des patterns existants
- Ce spec consomme les décisions mémoire `project_lavidz_subject_session_refactor_decisions.md` — toute divergence doit mettre à jour AUSSI cette mémoire

### Adversarial Review — mitigations intégrées (2026-04-22)

Un reviewer adversarial indépendant a identifié 20 findings. Les 10 Critical+High sont intégrés dans les tâches ci-dessus. Les 10 Medium/Low sont tracés ici :

- **F11 (RAG feature flag + timeout)** — à ajouter dans Task 2.2/2.3/2.5 pendant implémentation :
  - Env var `RAG_ENRICH_ENABLED=true` (défaut true, passable à false pour cut d'urgence).
  - Timeout hard 800ms sur tout `memoryService.search` appelé par les services "voix" + fallback silencieux.
  - Log structuré `{ service, duration_ms, hits_count, cache_hit }` pour tracker coût/latence.

- **F12 (Thread Kabou multi-format hallucinations)** — à ajouter dans Task 2.4 (context injection) :
  - Préfixer chaque user-message envoyé au LLM par `[Context: session ${sessionId}, format ${format}]` dans le body system injection côté `/api/chat/route.ts`.
  - AC ajouté Story 2 : *"Given thread avec turns HOT_TAKE puis switch STORYTELLING, when Kabou répond sur la 2e session, then output ne mélange pas les formes des deux formats."*

- **F13 (Auto-create Project règle claire)** — à ajouter dans Task 11.2 :
  - Règle explicite : auto-create Project iff `no Project exists with Project.sessionId = this.sessionId`. Grâce à F5 (unique constraint), l'idempotence est garantie DB-level.
  - Pour les sessions variantes REPLACED : **ne PAS créer un nouveau Project pour la variante précédente**. Si la variante avait déjà un Project, garder le lien.

- **F14 (anchorSyncedAt field-level)** — déjà intégré dans Task 3.5 (type `NarrativeAnchor` inclut `updatedAt: string` field-level). Le tool `update_narrative_anchor` met à jour ce champ à chaque write. Le stale badge compare `narrativeAnchor.updatedAt > session.recordingScript.anchorSyncedAt` (pas `Topic.updatedAt`).

- **F15 (colonnes preflight DB à vérifier)** — ✅ **résolu** en review :
  - `grep -n "preflight" packages/database/prisma/schema.prisma` exécuté 2026-04-22 → **0 résultat**. Aucune colonne DB à dropper. Kill Story 6 peut se faire sans migration supplémentaire.

- **F16 (Rollout plan)** — à ajouter dans `docs/architecture/subject-session-split.md` (Story 8) :
  - Déployer migration en heure creuse (week-end / nuit).
  - Pre-deploy : `SELECT COUNT(*) FROM "Session" WHERE status IN ('RECORDING', 'PENDING') AND "updatedAt" > NOW() - INTERVAL '1 hour'` → si > 0 sessions actives, reporter.
  - Post-deploy : monitor les sessions "stuck" (RECORDING > 30min) via cron de santé.
  - Rollback procedure : revert 2e migration (colonnes + index), puis revert code. Les legacy columns (`recordingGuide`, `hooks`) préservent la data.

- **F17 (AC 8.2 plus testable)** — reformulé :
  - Given `apps/web/src/lib/kabou-voice.ts`, when `grep -rn '\"Échec\"\|\"échec\"' apps/web/src/lib/kabou-voice.ts` dans les exports `KABOU_*`, then 0 occurrence dans les messages user-facing (seule `KABOU_VOCABULARY` peut mentionner "Échec" → "Raté" comme règle de traduction).

- **F18 (narrative-arc RAG ordering)** — à appliquer dans Task 2.3 :
  - Au lieu de `memoryService.search(k=10)` pur, faire : `memoryService.search(k=30) → resort par createdAt DESC → slice(10)`. Combine pertinence sémantique + fraîcheur chronologique (important pour détecter l'évolution).

- **F19 (wording Task 5.5 variante)** — corrigé ci-dessous :
  - Remplacer le wording de modale variante par : *"On tente un autre angle — ta version précédente reste côté historique, et on repart avec un nouveau script pour ce format."* (retire "je garde" qui viole la règle Kabou 1 *"on/nous, pas je"*).

- **F20 (events tracking minimaux)** — à ajouter dans Stories 5, 7, 9 :
  - Pas d'outil analytics configuré actuellement → créer `apps/api/src/modules/analytics/user-event.service.ts` minimaliste qui log `prisma.userEvent.create({ userId, type, metadata })` (nouvelle table `UserEvent` simple).
  - Events à tracker : `session.reset_clicked`, `session.variant_created`, `recording.superseded_drag_to_montage`, `resume_banner.shown`, `resume_banner.accepted`, `kabou_take_recommendation.shown`.
  - Alternative ultra-lite : `console.info('[EVENT] type=X ...')` si la table UserEvent est jugée trop lourde pour ce spec → décider au moment de Story 5.

### Out of scope additions (from Adversarial Review)

- Table `UserEvent` pour analytics (F20) — peut être intégrée OR reportée à un tech-spec séparé selon décision.
- Automatic migration drop des legacy columns `Topic.recordingGuide` / `Topic.hooks` — à faire dans un tech-spec sprint+1 après validation 100% dual-write stable.
- Alertes monitoring automatique sur sessions "stuck" (F16) — infra à poser séparément.
