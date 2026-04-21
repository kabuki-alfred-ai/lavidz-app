---
title: 'Pipeline créatif — Sujet prêt → tourner ou planifier'
slug: 'pipeline-sujet-pret'
created: '2026-04-21'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Next.js 15 App Router (apps/web)'
  - 'NestJS (apps/api)'
  - 'Prisma + PostgreSQL (packages/database)'
  - 'React (client components, hooks-only, no Redux/Zustand)'
  - '@ai-sdk/react (useChat for Kabou)'
  - 'Radix UI + Tailwind (components/ui)'
  - 'Vercel AI SDK (generateObject, Gemini Flash default)'
files_to_modify:
  # Prisma
  - 'packages/database/prisma/schema.prisma'
  # Backend — readiness + pipeline
  - 'apps/api/src/modules/ai/ai.controller.ts'
  - 'apps/api/src/modules/ai/services/topic-readiness.service.ts' # new
  - 'apps/api/src/modules/ai/ai.module.ts'
  - 'apps/api/src/modules/pipeline/pipeline.controller.ts' # new
  - 'apps/api/src/modules/pipeline/pipeline.service.ts' # new
  - 'apps/api/src/modules/pipeline/pipeline.module.ts' # new
  - 'apps/api/src/app.module.ts'
  # Backend — calendar extension
  - 'apps/api/src/modules/content-calendar/content-calendar.service.ts'
  - 'apps/api/src/modules/content-calendar/dto/create-content-calendar.dto.ts'
  - 'apps/api/src/modules/content-calendar/dto/update-content-calendar.dto.ts'
  # Web — proxies
  - 'apps/web/src/app/api/admin/pipeline/route.ts' # new
  - 'apps/web/src/app/api/admin/content-calendar/route.ts'
  - 'apps/web/src/app/api/topics/[id]/readiness/route.ts' # new
  - 'apps/web/src/app/api/topics/[id]/status/route.ts' # new
  - 'apps/web/src/app/api/topics/[id]/record-now/route.ts' # new
  - 'apps/web/src/app/api/topics/[id]/schedule-publish/route.ts' # new
  # Web — UI
  - 'apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx'
  - 'apps/web/src/app/(client)/sujets/[id]/page.tsx'
  - 'apps/web/src/app/admin/pipeline/page.tsx' # new
  - 'apps/web/src/app/admin/pipeline/PipelineClient.tsx' # new
  - 'apps/web/src/components/subject/ReadyActions.tsx' # new
  - 'apps/web/src/components/subject/SchedulePublishModal.tsx' # new
  - 'apps/web/src/components/pipeline/PipelineColumn.tsx' # new
  - 'apps/web/src/components/pipeline/PipelineCard.tsx' # new
  - 'apps/web/src/components/pipeline/RegularityBanner.tsx' # new
  - 'apps/web/src/components/ui/date-picker.tsx' # new (minimal)
  - 'apps/web/src/lib/pipeline-stage.ts' # new (shared stage-derivation util)
code_patterns:
  - 'Server components: direct Prisma (no HTTP) — see apps/web/src/app/(client)/sujets/[id]/page.tsx'
  - 'Client components: fetch with credentials: "include" — see CalendarClient.tsx:70-82'
  - 'Toast pattern: useState<string|null> + setTimeout — see SubjectWorkspace.tsx:128-131'
  - 'useTransition + optimistic setState on mutation — see SubjectWorkspace.tsx:133-157'
  - 'NestJS module pattern: controller + service + DTOs + module — see apps/api/src/modules/content-calendar/'
  - 'AdminGuard + x-organization-id header — see content-calendar.controller.ts'
  - 'Next.js proxy routes resolve auth via getAuthHeaders() — see apps/web/src/app/api/admin/content-calendar/route.ts'
  - 'Kabou-triggered session creation: apps/web/src/app/api/chat/route.ts:570-652 (create_recording_session tool)'
  - 'Radix AlertDialog for modals — see components/ui/alert-dialog.tsx'
  - 'Badge with CVA variants for status chips — see components/ui/badge.tsx'
test_patterns:
  - 'Jest + ts-jest for API (apps/api/test/*.spec.ts) — check existing spec structure'
  - 'No E2E harness yet in apps/web — component-level tests minimal, MVP test: smoke via `pnpm -w typecheck` + manual flow verification'
---

# Tech-Spec: Pipeline créatif — Sujet prêt → tourner ou planifier

**Created:** 2026-04-21

## Overview

### Problem Statement

Aujourd'hui, le calendrier Lavidz (`/admin/calendar` grille hebdo) ne sert pas le flux mental du créateur de contenu. L'user ne peut pas articuler son utilité dans le processus de création. Trois symptômes :

1. **Pas de point de décision clair** quand un sujet devient prêt : l'user ne sait pas s'il doit tourner, planifier, ou juste attendre.
2. **Confusion sémantique** : `ContentCalendar.scheduledDate` mélange date de tournage (qui n'existe pas en réalité — on tourne quand on a le temps) et date de publication (optionnelle, ancrage éditorial stratégique).
3. **Pas de visibilité pipeline** : on ne voit pas où sont les contenus entre "idée brute" et "publié", donc on ne détecte pas les trous qui cassent la régularité.

La promesse produit étant **"créer du contenu avec constance — de l'idée au contenu"**, le calendrier doit devenir un **cockpit de pipeline** qui garantit qu'aucune étape ne se vide.

### Solution

Transformer le calendrier en **pipeline créatif** à 3 briques :

1. **Fiche Sujet enrichie** (quand `Topic.status = READY`) : deux actions disponibles — **"🎬 Tourner maintenant"** (95% des cas, batching/hot-take) et **"📅 Planifier la publication"** (ancrage éditorial optionnel).
2. **Vue Kanban pipeline** (nouvelle route `/admin/pipeline`, coexiste avec la grille hebdo actuelle) : 5 colonnes — `À travailler` / `Prêt` / `Tourné` / `Montage` / `Publié` — alimentées par l'état joint Topic + Session + Project + ContentCalendar.
3. **Alerte régularité** : le produit détecte les trous de pipeline (aucun Topic `READY` dans les 7 prochains jours) et invite l'user à travailler ses sujets avant de tomber à court.

Data model : ajout d'un champ `ContentCalendar.publishAt DateTime?` (nullable, date cible de *publication* — distincte de `scheduledDate` legacy). Readiness % du Topic calculée par un service déterministe (hook + recordingGuide + brief + sources remplis) et affichée sur chaque carte.

### Scope

**In Scope:**

- **Prisma**: ajout `ContentCalendar.publishAt DateTime?` nullable (migration non-destructive).
- **Readiness API**: endpoint qui calcule le readiness % d'un Topic (à partir de hook, recordingGuide, brief, sources). Déclenche suggestion de passage à `READY` quand seuil ≥ 80%.
- **Topic status transition**: UI pour flip `DRAFT → READY` (bouton "Marquer comme prêt" dans `SubjectWorkspace`, débloqué dès que AI suggère).
- **Fiche Sujet `READY`**: deux CTA — "Tourner maintenant" (primary) / "Planifier publication" (secondary).
  - "Tourner maintenant" crée `Session` + `ContentCalendar` (status=RECORDED, scheduledDate=now, publishAt=null) et redirige vers la session.
  - "Planifier publication" ouvre modal avec date picker + raccourcis (lundi prochain / dans 1 sem / dans 2 sem), crée `ContentCalendar` (status=PLANNED, publishAt=date-choisie).
- **Vue Kanban pipeline** (nouvelle route `/admin/pipeline`) : 5 colonnes affichant l'état joint.
- **Alerte régularité**: banner in-app quand aucun Topic `READY` + aucune ContentCalendar `PLANNED` avec `publishAt` dans les 7 prochains jours.
- **Vue calendrier conservée**: `/admin/calendar` garde la grille hebdo telle quelle (pas touché en MVP).

**Out of Scope (MVP):**

- Batch recording UX (tourner N sujets en une session).
- Publication auto-posting (les contenus ne s'envoient pas automatiquement sur les plateformes).
- Cadence de régularité configurable (seuil fixé à 7j pour MVP).
- Dépréciation complète de `ContentCalendar.scheduledDate` (kept legacy, progressive migration en V2).
- ClientCalendar (`apps/web/src/app/(client)/calendar/ClientCalendar.tsx`) — seules les vues admin/créateur sont touchées.
- Recording guide / hook / brief generation (existe déjà, on se contente de les consommer pour le readiness score).
- Hot-take mode dédié (couvert par le bouton "Tourner maintenant").
- Notifications push/email de l'alerte régularité (affichage in-app uniquement).
- Drag-and-drop entre colonnes Kanban (MVP = lecture + actions par carte). Transitions statut via boutons d'action contextuels.
- Refonte Admin calendar existant en vue pipeline (MVP = nouvelle route `/admin/pipeline`, coexistence).

## Context for Development

### Codebase Patterns

**Monorepo structure (pnpm workspaces)**
- `apps/web` = Next.js 15 App Router (UI + proxy API routes)
- `apps/api` = NestJS (business logic + Prisma access)
- `packages/database` = Prisma schema + generated client

**Data access**
- **Server components (Next.js)** font du Prisma direct (ex: `apps/web/src/app/(client)/sujets/[id]/page.tsx`). Pas d'appel HTTP pour le premier render.
- **Client components** appellent des routes Next.js `/api/...` qui proxifient vers NestJS via `getAuthHeaders()`. Header clé : `x-organization-id`.
- **NestJS controllers** exigent `AdminGuard` + `x-organization-id` pour les endpoints admin.

**State management (web)**
- Pas de Redux/Zustand. Hooks uniquement (`useState`, `useTransition`, `useCallback`).
- Pas de React Query/SWR. Chaque écran a son propre `fetchX()` dans `useEffect` + refetch sur mutation.
- Pattern optimiste : `setState` local puis appel API, rollback si erreur.
- Toast = `useState<string|null>` + `setTimeout` (ex: `SubjectWorkspace.tsx:128-131`).

**Topic = l'atome**
- Chaque `ContentCalendar` exige un `topicId` (FK required). `Session.topicId` est optionnel mais toujours renseigné via Kabou.
- `Topic.status` enum : `DRAFT | READY | ARCHIVED`. **Existe déjà** — on l'utilise tel quel.
- `ContentCalendarStatus` enum : `PLANNED | RECORDED | EDITING | DELIVERED | PUBLISHED | SKIPPED`. Existe déjà.

**Kabou AI coach**
- Panel inline (`SubjectKabouPanel.tsx`) utilise `useChat()` de `@ai-sdk/react`.
- `apps/web/src/app/api/chat/route.ts` est le host des tools. L'outil `create_recording_session` (lines 570-652) fait déjà création de Theme + Session + liaison ContentCalendar optionnelle (via `calendarEntryId` param).
- Les mutations Kabou déclenchent `handleTopicMutated()` → `router.refresh()` dans le parent.

**Session creation (référence, existant)**
- Flow actuel : Kabou → `create_recording_session` tool → Prisma.theme.create + Prisma.session.create → redirection vers `/s/{sessionId}`.
- `sessions.service.ts:24-34` : `create(themeId, recipientEmail?, recipientName?)` — signature basique.
- Submission (`sessions.service.ts:51-99`) déclenche auto-création de `Project` avec clips.

**UI kit (`apps/web/src/components/ui/`)**
- Radix-based : `AlertDialog`, `Badge` (CVA), `Button`, `Card`, `Input`, `Label`, `Textarea`.
- **Pas de date picker** — à construire minimal (browser `<input type="date">` + raccourcis).
- **Pas de drag-drop** — MVP sans DnD.
- **Pas de banner** — `<div>` Tailwind stylé custom suffit.

**AI services pattern**
- Chaque service dans `apps/api/src/modules/ai/services/` suit le pattern : constructor DI, méthode async publique, utilisation de `generateObject()` avec schéma Zod, logger.
- Exemples : `calendar.service.ts`, `narrative-arc.service.ts`, `thesis.service.ts`.
- Readiness n'est **pas** un appel AI (calcul déterministe sur champs remplis) → on crée un service simple `TopicReadinessService` non-AI, placé dans `ai/services/` par cohérence ou dans un nouveau module `topics/`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/database/prisma/schema.prisma:360-417` | Enums `ContentCalendarStatus`, `TopicStatus`, models `Topic`, `ContentCalendar` |
| `packages/database/prisma/schema.prisma:419-441` | Model `Project` (states DRAFT/EDITING/RENDERING/DONE/FAILED) |
| `packages/database/prisma/schema.prisma:40-65` (approx) | Model `Session` + relation to Topic (topicId nullable, onDelete SetNull) |
| `apps/api/src/modules/content-calendar/content-calendar.service.ts` | CRUD existant. `create(orgId, dto)` lines 48-60 résout topicId via find-or-create ; `update`, `updateStatus` déjà là. À étendre pour accepter `publishAt`. |
| `apps/api/src/modules/content-calendar/content-calendar.controller.ts` | Routes REST : GET, GET/:id, POST, PUT/:id, PATCH/:id/status, DELETE. `AdminGuard` + `x-organization-id`. |
| `apps/api/src/modules/content-calendar/dto/create-content-calendar.dto.ts` | DTO à étendre : ajouter `publishAt?: string` (ISO). |
| `apps/api/src/modules/ai/services/calendar.service.ts` | Generation AI (non touchée MVP — out of scope). |
| `apps/api/src/modules/ai/ai.controller.ts:546-558` | `GET /ai/topics` existant (retourne topics avec calendarEntries + sessions). Peut être réutilisé ou doublonné par le nouveau endpoint pipeline. |
| `apps/api/src/modules/sessions/sessions.service.ts:24-34` | `create()` — à utiliser depuis nouvel endpoint `record-now` pour créer Session. |
| `apps/web/src/app/api/chat/route.ts:570-652` | `create_recording_session` tool — référence pour le pattern de création Theme+Session+ContentCalendar en une transaction. |
| `apps/web/src/app/(client)/sujets/[id]/page.tsx` | Server component qui load Topic + sessions + calendarEntries + recordingGuide via Prisma, dérive `creativeState`. À enrichir pour passer `readinessScore` et actions. |
| `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx` | Client component principal. Layout 2-panes desktop / tabs mobile. Intégrer `<ReadyActions>` quand `topic.status === 'READY'`. |
| `apps/web/src/app/(client)/sujets/[id]/SubjectKabouPanel.tsx` | Ne pas toucher — le CTA `READY` se fait hors chat (dans le workspace principal). |
| `apps/web/src/lib/creative-state.ts` | Logic existante de dérivation (SEED/EXPLORING/MATURE/SCHEDULED/PRODUCING/ARCHIVED). **Ne pas confondre** avec nos 5 stages Kanban ; les deux coexistent. Utilisé dans UI narrative, pas dans pipeline. |
| `apps/web/src/app/admin/calendar/CalendarClient.tsx` | Grille hebdo actuelle — **non touchée** MVP. Sert de référence pour le pattern status-badge. |
| `apps/web/src/app/api/admin/content-calendar/route.ts` | Next.js proxy existant. Pattern `getAuthHeaders()` à réutiliser pour nouveau proxy pipeline. |
| `apps/web/src/components/ui/badge.tsx` | Badge CVA — utiliser pour status chips Kanban. |
| `apps/web/src/components/ui/alert-dialog.tsx` | Base modal Radix — utiliser pour `SchedulePublishModal`. |
| `apps/web/src/components/ui/button.tsx` | Buttons CTA — `variant="default"` pour primary, `variant="outline"` pour secondary. |

### Technical Decisions

**D1. `publishAt` = nouveau champ nullable, pas de rename de `scheduledDate`**

- Raison : sémantique DB ambigüe aujourd'hui. `publishAt` = clair (date de publi cible, optionnelle). `scheduledDate` legacy kept pour backward compat. CalendarClient existant continue de fonctionner.
- Migration Prisma additive (pas de breaking change).
- **Contrainte DTO (important)** : `ContentCalendarCreateDto.scheduledDate` reste **required** (non-optional). Les nouveaux flows doivent **toujours** fournir `scheduledDate` explicitement. Règle d'assignation côté appelant :
  - Pour `schedule-publish` (T09) : `scheduledDate = publishAt` (les deux sont la date de publi cible).
  - Pour `record-now` (T08) : `scheduledDate = now()` (moment du tournage), `publishAt = null`.
- **Ne pas** prévoir de fallback serveur "`scheduledDate = publishAt ?? now()`" — le DTO le rejetterait avant le service. Chaque endpoint fixe explicitement les deux champs.

**D2. Readiness % = service calculé, pas champ persisté**

- Raison : le score dépend de la complétude de plusieurs champs Topic (hook, recordingGuide, brief, sources). Recalculer à chaque read évite la désynchronisation. MVP = recompute à chaque GET topic (négligeable en coût).
- Formule déterministe : chaque critère vaut un poids ; somme = score / 100.
  - `brief` non-null et >= 50 chars : 25 pts
  - `hooks` présent avec au moins une variante remplie : 25 pts
  - `recordingGuide` non-null : 25 pts
  - `sources` non-null avec au moins 1 entrée OU `pillar` non-null : 15 pts
  - `session.theme.questions` préparées (si format ≠ HOT_TAKE) OU format = HOT_TAKE : 10 pts
- Rule de passage à `READY` : manuel (bouton user), pas automatique. UI affiche hint ("Ton sujet semble prêt ✨") dès que score ≥ 80%. Le bouton "Marquer comme prêt" est toujours disponible (force override).

**D3. Tourner maintenant = crée Session + ContentCalendar**

- Raison : cohérence pipeline. Un Topic tourné *sans* ContentCalendar serait invisible dans le Kanban (colonne "Tourné" alimentée par `ContentCalendar.status = RECORDED`).
- `scheduledDate = now()` (acceptable car champ required legacy), `publishAt = null` (non planifié).
- Réutilise le pattern existant de `apps/web/src/app/api/chat/route.ts:570-652` mais simplifié : pas de theme custom (réutilise ou crée un theme minimal), pas de questions (MVP = format = HOT_TAKE ou format choisi par l'user au moment du clic).
- **Nuance** : l'user doit choisir un format avant de tourner. MVP = si `Topic.recordingGuide` existe avec format, utilise-le ; sinon fallback HOT_TAKE.

**D4. Kanban pipeline = vue computed, pas nouveau modèle**

- Raison : les 5 colonnes dérivent de l'état joint Topic.status + Session + Project.status + ContentCalendar.status. Aucune donnée nouvelle à persister.
- Util partagé `apps/web/src/lib/pipeline-stage.ts` export `derivePipelineStage(topic, calendarEntries, sessions, projects): PipelineStage`. Utilisé côté server (pour le endpoint) et côté client (pour display).
- Mapping final :
  - `À travailler` = `topic.status === 'DRAFT'` (quelle que soit la présence de sessions/calendar)
  - `Prêt` = `topic.status === 'READY'` ET aucune session avec status = `SUBMITTED` ou plus avancé
  - `Tourné` = au moins une Session submitted OU une ContentCalendar `status=RECORDED`, mais pas de Project.status `DONE`
  - `Montage` = au moins un Project avec status `EDITING` ou `RENDERING`, ou ContentCalendar.status `EDITING`/`DELIVERED`
  - `Publié` = ContentCalendar.status `PUBLISHED` OU Session `publishedAt` non-null
  - Priorité : un Topic peut avoir plusieurs entries/sessions ; on prend le **stage le plus avancé** pour la carte principale, mais on peut afficher un compteur (ex: "3 contenus").

**D5. Alerte régularité = indicateur in-app MVP**

- Raison : signal actionnable simple. Calculé côté endpoint pipeline : `readyCount = Topics READY + ContentCalendar PLANNED avec publishAt ≤ +7j`. Si `readyCount === 0`, le flag `regularityAlert: true` est renvoyé.
- Affiché en banner en haut de `/admin/pipeline`. Composant `<RegularityBanner show={regularityAlert} />`.
- Seuil fixe 7 jours MVP, configurable V2.

**D6. Nouvelle route `/admin/pipeline` (coexistence avec `/admin/calendar`)**

- Raison : non-destructif. L'existant (`CalendarClient.tsx` grille hebdo, génération IA) continue de fonctionner. Le pipeline est **la nouvelle vue par défaut** mais on garde le calendrier comme vue secondaire (utile pour voir les `publishAt` dans le temps).
- Navigation : ajouter un lien "Pipeline" dans le nav admin (à identifier lors de l'implé).
- V2 : décider si la grille hebdo reste ou si on fusionne.

**D7. Pas de drag-and-drop MVP**

- Raison : chaque transition de stage est conséquence d'un événement métier (submit session, render project, update calendar status), pas d'un drag manuel. MVP = actions contextuelles par carte (boutons "Voir session", "Valider montage", "Publier").
- Drag pour *réordonner* ou *skip* peut venir en V2.

**D8. Date picker minimal (browser-native + raccourcis)**

- Raison : pas de lib installée, pas de besoin complexe MVP. `<input type="date">` + 3 boutons raccourcis (Lundi prochain / Dans 1 semaine / Dans 2 semaines) couvrent 80% des cas.
- V2 : si besoin, installer `react-day-picker` (léger, Radix-friendly).

## Implementation Plan

### Tasks

**Phase 1 — Data model (Prisma)**

- [ ] **T01** : Ajouter `publishAt DateTime?` sur `ContentCalendar`
  - File : `packages/database/prisma/schema.prisma`
  - Action : dans `model ContentCalendar`, insérer après `scheduledDate DateTime` la ligne `publishAt DateTime?`. Ajouter un index `@@index([publishAt])`.
  - Commande : `pnpm --filter @lavidz/database prisma migrate dev --name add_publishat_to_content_calendar` puis `pnpm --filter @lavidz/database prisma generate`.
  - Notes : migration additive, non-destructive. Aucun backfill requis (null = non planifié).

**Phase 2 — Shared util**

- [ ] **T02** : Créer util partagé `pipeline-stage`
  - File : `apps/web/src/lib/pipeline-stage.ts`
  - Action : exporter l'enum `PipelineStage = 'TO_WORK' | 'READY' | 'SHOT' | 'EDITING' | 'PUBLISHED'` et la fonction `derivePipelineStage(input): PipelineStage` avec signature :
    ```ts
    type DeriveInput = {
      topicStatus: 'DRAFT' | 'READY' | 'ARCHIVED';
      sessions: Array<{ status: string; publishedAt: string | null }>;
      projects: Array<{ status: 'DRAFT' | 'EDITING' | 'RENDERING' | 'DONE' | 'FAILED' }>;
      calendarEntries: Array<{ status: 'PLANNED' | 'RECORDED' | 'EDITING' | 'DELIVERED' | 'PUBLISHED' | 'SKIPPED' }>;
    };
    ```
  - Algorithme (priorité décroissante) :
    1. Si `calendarEntries` contient `PUBLISHED` OU `sessions` contient `publishedAt != null` → `PUBLISHED`
    2. Sinon si `projects` contient `EDITING` ou `RENDERING` OU `calendarEntries` contient `EDITING`/`DELIVERED` → `EDITING`
    3. Sinon si `sessions` contient statut `SUBMITTED` ou supérieur OU `calendarEntries` contient `RECORDED` → `SHOT`
    4. Sinon si `topicStatus === 'READY'` → `READY`
    5. Sinon → `TO_WORK` (inclut DRAFT et ARCHIVED — ARCHIVED filtré côté endpoint)
  - Notes : util pur, sans dépendance. Utilisé côté backend (Nest) via recopie dans `apps/api/src/modules/pipeline/pipeline-stage.util.ts` OU via import cross-package si lib partagée existe. MVP = **duplication** assumée dans les deux packages (4 lignes d'enum + fonction simple).

- [ ] **T03** : Dupliquer l'util côté API
  - File : `apps/api/src/modules/pipeline/pipeline-stage.util.ts` (nouveau)
  - Action : même enum + fonction que T02. Exporter depuis `pipeline.module.ts`.

**Phase 3 — Backend services (NestJS)**

- [ ] **T04** : Service `TopicReadinessService`
  - File : `apps/api/src/modules/ai/services/topic-readiness.service.ts` (nouveau)
  - Action : service `@Injectable()` avec méthode `computeScore(topic: Topic): { score: number; breakdown: Record<string, number> }`.
  - Formule déterministe (total 100) :
    - `brief` non-null et length ≥ 50 → 25 pts
    - `hooks` JSON non-null avec au moins `native` ou `marketing` non-empty → 25 pts
    - `recordingGuide` JSON non-null → 25 pts
    - `sources` JSON avec `.length ≥ 1` OU `pillar` non-null → 15 pts
    - `theme.questions.length ≥ 1` OU `hooks.chosen` défini → 10 pts (marque de maturité éditoriale)
  - Retourne `{ score, breakdown }` pour transparence UI.
  - Notes : pas d'appel AI. Service pur synchrone.

- [ ] **T05** : Enregistrer `TopicReadinessService` dans `AiModule`
  - File : `apps/api/src/modules/ai/ai.module.ts`
  - Action : ajouter aux `providers` + `exports`.

- [ ] **T05b** : Helper d'enforcement de l'ownership Topic↔Organization ⚠️ **FIX F1**
  - File : `apps/api/src/modules/ai/services/topic-ownership.util.ts` (nouveau)
  - Action : fonction utilitaire `assertTopicInOrg(prisma, topicId, orgId): Promise<Topic>` qui fait `prisma.topic.findFirst({ where: { id: topicId, organizationId: orgId } })` et **throw `NotFoundException`** (404) si null. Pas `ForbiddenException` (évite l'énumération d'IDs).
  - Notes : **à appeler systématiquement en tête de TOUT endpoint prenant un `:id` de Topic** (T06, T07, T08, T09). Ne pas faire confiance au header `x-organization-id` sans ce check. `AdminGuard` seul ne garantit PAS le scoping org.
  - Background : `AdminGuard` actuel est un shared-secret check (`process.env.ADMIN_SECRET`), il n'exprime aucune propriété tenant. Le header `x-organization-id` est client-settable. Sans recheck DB-level, n'importe quel admin peut adresser les Topics d'une autre org.

- [ ] **T06** : Endpoint readiness
  - File : `apps/api/src/modules/ai/ai.controller.ts`
  - Action : ajouter `GET /ai/topics/:id/readiness` (guard `AdminGuard`, header `x-organization-id`).
  - Logic :
    1. ⚠️ **Appeler `assertTopicInOrg(prisma, id, orgId)`** (T05b) — récupère le Topic ou throw 404.
    2. Appeler `TopicReadinessService.computeScore(topic)`.
    3. Retourner `{ score, breakdown }`.
  - **Note ajustement formule T04** : en relisant le schéma, les questions sont attachées à `Theme` (via Session), pas à Topic. Donc critère 5 se réduit à : si `hooks.chosen` défini → 10 pts, sinon 0.

- [ ] **T07** : Endpoint transition statut Topic
  - File : `apps/api/src/modules/ai/ai.controller.ts`
  - Action : ajouter `PATCH /ai/topics/:id/status` avec body `{ status: 'DRAFT' | 'READY' | 'ARCHIVED' }`.
  - Logic :
    1. ⚠️ **Appeler `assertTopicInOrg(prisma, id, orgId)`** (T05b).
    2. Update via Prisma `prisma.topic.update({ where: { id }, data: { status } })`.
    3. Retourner le Topic mis à jour.

- [ ] **T08** : Endpoint `record-now`
  - File : `apps/api/src/modules/ai/ai.controller.ts`
  - Action : ajouter `POST /ai/topics/:id/record-now` avec body `{ format?: ContentFormat }` (par défaut `HOT_TAKE`, ou inférer depuis `topic.recordingGuide.format` si présent).
  - Logic (dans une transaction Prisma) :
    1. ⚠️ **Appeler `assertTopicInOrg(prisma, id, orgId)`** (T05b) — fournit le Topic déjà validé (avec `recordingGuide`).
    2. Créer un `Theme` minimal : `name = topic.name`, `slug = topic.slug + '-' + Date.now()`, sans questions par défaut (format HOT_TAKE n'en nécessite pas), `organizationId = orgId`.
    3. Créer un `Session` : `themeId = theme.id`, `topicId = topic.id`, `contentFormat = format`, `targetPlatforms = []` (l'user choisira au moment de la publi).
    4. Créer un `ContentCalendar` avec **les deux champs explicites** : `topicId = topic.id`, `scheduledDate = now()`, `publishAt = null`, `format`, `platforms = []`, `status = RECORDED`, `sessionId = session.id`, `description = null`, `aiSuggestions = null`, `organizationId = orgId`.
    5. Retourner `{ sessionId, shareLink: '/s/' + session.id }`.
  - Pattern référence : `apps/web/src/app/api/chat/route.ts:570-652` (simplifié).

- [ ] **T09** : Endpoint `schedule-publish`
  - File : `apps/api/src/modules/ai/ai.controller.ts`
  - Action : ajouter `POST /ai/topics/:id/schedule-publish` avec body `{ publishAt: string (ISO); format: ContentFormat; platforms: string[] }`.
  - Logic :
    1. ⚠️ **Appeler `assertTopicInOrg(prisma, id, orgId)`** (T05b).
    2. Valider que `publishAt` est dans le futur (≥ aujourd'hui, comparaison date-level).
    3. Créer un `ContentCalendar` avec **les deux champs explicites** (pas de fallback serveur — cf. D1) : `topicId`, `scheduledDate = publishAt` (legacy dupliqué), `publishAt = publishAt`, `format`, `platforms`, `status = PLANNED`, `sessionId = null`, `organizationId = orgId`.
    4. Retourner le ContentCalendar créé.

- [ ] **T10** : DTO — étendre `CreateContentCalendarDto` et `UpdateContentCalendarDto`
  - Files : `apps/api/src/modules/content-calendar/dto/create-content-calendar.dto.ts`, `apps/api/src/modules/content-calendar/dto/update-content-calendar.dto.ts`
  - Action : ajouter `publishAt?: string` (ISO). Décoration class-validator `@IsOptional() @IsDateString()`.
  - ⚠️ **Ne PAS rendre `scheduledDate` optional** — rester fidèle au contrat existant. Les nouveaux flows (T08/T09) fournissent toujours les deux champs explicitement.

- [ ] **T11** : `ContentCalendarService.create/update` — persister `publishAt` ⚠️ **FIX F2**
  - File : `apps/api/src/modules/content-calendar/content-calendar.service.ts`
  - Action : dans `create()` et `update()`, relayer `publishAt` au Prisma call (conversion string → Date si fourni, sinon `undefined` pour ne rien écrire en update).
  - ⚠️ **Pas de fallback serveur `scheduledDate = publishAt ?? now()`** : le DTO exige `scheduledDate` ; le service le prend tel quel. Si un appelant omet `scheduledDate`, la validation class-validator rejette avec 400 avant d'atteindre le service. Documenter ce contrat en JSDoc du service.

- [ ] **T12** : Module Pipeline
  - Files : `apps/api/src/modules/pipeline/pipeline.module.ts` (nouveau), `apps/api/src/modules/pipeline/pipeline.controller.ts` (nouveau), `apps/api/src/modules/pipeline/pipeline.service.ts` (nouveau)
  - Action : créer le module NestJS standard (imports: `PrismaModule`).
  - `PipelineController` : `GET /pipeline` (guard `AdminGuard`, header `x-organization-id`).
  - `PipelineService.getPipeline(orgId)` :
    1. Fetch tous les Topics (status ≠ ARCHIVED) de l'org avec `include: { sessions: true, calendarEntries: true }`.
    2. Pour chaque topic, fetch les `Project` associés (via `sessions[].id` → `Project.sessionId`). Pas de relation directe Topic→Project, donc query séparée ou include via session.
    3. Pour chaque topic, appeler `derivePipelineStage(...)` (T03).
    4. Retourner `{ topics: [{ id, name, slug, status, stage, calendarEntries: [...], sessions: [...], projects: [...], readinessScore }], regularityAlert: boolean }`.
    5. `regularityAlert` = `true` si aucune combinaison (Topic `READY`) OU (ContentCalendar `PLANNED` avec `publishAt` ≤ +7j depuis now).
  - Enregistrer `PipelineModule` dans `apps/api/src/app.module.ts`.

**Phase 4 — Next.js API proxies**

- [ ] **T13** : Proxy `/api/topics/[id]/readiness`
  - File : `apps/web/src/app/api/topics/[id]/readiness/route.ts` (nouveau)
  - Action : GET handler qui proxy vers `${API_URL}/ai/topics/${id}/readiness` avec `getAuthHeaders()`. Pattern identique à `apps/web/src/app/api/admin/content-calendar/route.ts`.

- [ ] **T14** : Proxy `/api/topics/[id]/status`
  - File : `apps/web/src/app/api/topics/[id]/status/route.ts` (nouveau)
  - Action : PATCH handler proxy vers `${API_URL}/ai/topics/${id}/status`.

- [ ] **T15** : Proxy `/api/topics/[id]/record-now`
  - File : `apps/web/src/app/api/topics/[id]/record-now/route.ts` (nouveau)
  - Action : POST handler proxy.

- [ ] **T16** : Proxy `/api/topics/[id]/schedule-publish`
  - File : `apps/web/src/app/api/topics/[id]/schedule-publish/route.ts` (nouveau)
  - Action : POST handler proxy.

- [ ] **T17** : Proxy `/api/admin/pipeline`
  - File : `apps/web/src/app/api/admin/pipeline/route.ts` (nouveau)
  - Action : GET handler proxy vers `${API_URL}/pipeline`.

**Phase 5 — UI components (atoms)**

- [ ] **T18** : Composant `<DatePickerMinimal>`
  - File : `apps/web/src/components/ui/date-picker.tsx` (nouveau)
  - Action : wrapper React autour de `<input type="date">` stylé Tailwind, props `{ value: string; onChange: (v: string) => void; min?: string }`. Valeur ISO `YYYY-MM-DD`.

- [ ] **T19** : Composant `<SchedulePublishModal>`
  - File : `apps/web/src/components/subject/SchedulePublishModal.tsx` (nouveau)
  - Action : basé sur `AlertDialog` (Radix). Props `{ open, onClose, topicId, defaultFormat?, defaultPlatforms? }`.
  - UI : titre "Quand veux-tu PUBLIER ce contenu ?", DatePicker, 3 boutons raccourcis (Lundi prochain / Dans 1 sem / Dans 2 sem), micro-copy "Le tournage se fera quand tu as le temps. Ça juste pose une deadline de publi.", boutons Annuler + Planifier.
  - On submit : POST `/api/topics/${topicId}/schedule-publish` avec `{ publishAt, format, platforms }`, sur succès → close + callback refresh.

- [ ] **T20** : Composant `<ReadyActions>`
  - File : `apps/web/src/components/subject/ReadyActions.tsx` (nouveau)
  - Action : bloc à deux CTA, visible uniquement si `topic.status === 'READY'`.
  - Props `{ topic, onRefresh }`.
  - Bouton 1 (primary) : "🎬 Tourner maintenant" → POST `/api/topics/${topic.id}/record-now`, sur succès → `router.push(shareLink)`.
  - Bouton 2 (secondary) : "📅 Planifier la publication" → ouvre `<SchedulePublishModal>`.
  - Micro-copy en dessous : "💡 95% des créateurs tournent quand ils ont le temps. Pas besoin de date."

- [ ] **T21** : Composant `<ReadinessHint>` + bouton "Marquer comme prêt"
  - File : intégré dans `SubjectWorkspace.tsx` (T25) — pas de composant séparé pour MVP.
  - Action : si `topic.status === 'DRAFT'`, fetch readiness via `/api/topics/${id}/readiness` (client-side, `useEffect` + `useState`). Afficher progress bar ou pourcentage. Si score ≥ 80, afficher hint "✨ Ton sujet semble prêt" + bouton "Marquer comme prêt" (toujours disponible même en-dessous, label "Forcer ready"). Bouton → PATCH `/api/topics/${id}/status` body `{ status: 'READY' }` → `router.refresh()`.

- [ ] **T22** : Composant `<PipelineCard>`
  - File : `apps/web/src/components/pipeline/PipelineCard.tsx` (nouveau)
  - Action : carte compacte pour une colonne Kanban. Props `{ topic, stage }`.
  - Contenu : titre Topic, badge statut, action contextuelle par stage :
    - `TO_WORK` → lien "Travailler" → `/sujets/${slug}`
    - `READY` → 2 micro-boutons "Tourner" (inline POST) + "Planifier" (ouvre modal)
    - `SHOT` → lien "Voir session" → `/s/${sessionId}`
    - `EDITING` → lien "Voir montage" → `/sujets/${slug}/apres-tournage?sessionId=${id}` (ou route existante du Project)
    - `PUBLISHED` → badge 🌍 + date publi
  - Footer : date `publishAt` si présente (format court FR).

- [ ] **T23** : Composant `<PipelineColumn>`
  - File : `apps/web/src/components/pipeline/PipelineColumn.tsx` (nouveau)
  - Action : colonne Kanban. Props `{ title, icon, topics, stage }`. Header avec count. Scroll vertical sur la colonne. Rend la liste de `<PipelineCard>`.

- [ ] **T24** : Composant `<RegularityBanner>`
  - File : `apps/web/src/components/pipeline/RegularityBanner.tsx` (nouveau)
  - Action : banner conditionnel. Props `{ show: boolean; onDismiss?: () => void }`.
  - UI : `<div>` Tailwind jaune/warning, texte "⚠️ Alerte régularité : aucun sujet prêt dans les 7 prochains jours. Travaille tes sujets pour ne pas casser le rythme.", CTA "Voir les sujets à travailler" → scroll vers colonne `TO_WORK`.

**Phase 6 — Wire up UI**

- [ ] **T25** : Intégrer `<ReadyActions>` et readiness dans `SubjectWorkspace`
  - File : `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`
  - Action :
    1. Importer `<ReadyActions>`.
    2. Si `topic.status === 'READY'`, render `<ReadyActions topic={topic} onRefresh={refetchTopic} />` dans la colonne principale, au-dessus de la liste sessions.
    3. Si `topic.status === 'DRAFT'`, ajouter fetch readiness + UI progress + bouton "Marquer comme prêt" (T21). Placer dans la sidebar brief ou en tête workspace selon layout actuel.

- [ ] **T26** : Passer readiness server-side dans `page.tsx`
  - File : `apps/web/src/app/(client)/sujets/[id]/page.tsx`
  - Action : optionnel — pour éviter un fetch client supplémentaire, calculer `readiness` directement via import de `TopicReadinessService` (côté server component). **Alternative** : garder fetch client pour MVP, ne pas toucher `page.tsx`. MVP = fetch client (T21).

- [ ] **T27** : Route Admin Pipeline
  - Files : `apps/web/src/app/admin/pipeline/page.tsx` (nouveau), `apps/web/src/app/admin/pipeline/PipelineClient.tsx` (nouveau)
  - Action :
    - `page.tsx` : server component, auth check admin, délègue à `<PipelineClient />`.
    - `PipelineClient.tsx` : client component. `useEffect` fetch `/api/admin/pipeline`. State : `{ topics, regularityAlert, loading }`. Layout : `<RegularityBanner>` + grid 5 colonnes `<PipelineColumn>` (TO_WORK, READY, SHOT, EDITING, PUBLISHED), chaque colonne filtre `topics` par `stage`.

- [ ] **T28** : Ajouter lien nav admin "Pipeline"
  - File : composant de navigation admin (à identifier dans `apps/web/src/app/admin/layout.tsx` ou équivalent — à chercher au moment de l'impl).
  - Action : ajouter un lien `/admin/pipeline` intitulé "Pipeline" avec icône (lucide-react). Marquer comme actif quand path match.

**Phase 7 — Verification**

- [ ] **T29** : Regenerate Prisma client + typecheck
  - Commandes : `pnpm --filter @lavidz/database prisma generate`, `pnpm -w typecheck`.
  - Action : corriger les erreurs TS éventuelles (DTOs, typings des nouveaux endpoints).

- [ ] **T30** : Smoke flow manuel
  - Action : valider manuellement (voir Testing Strategy) avant de marquer spec comme done.

### Acceptance Criteria

**AC — Readiness & Topic status**

- [ ] **AC01** : Given un Topic avec `brief` > 50 chars, `hooks` avec variante native, `recordingGuide` non-null, `pillar` défini, `hooks.chosen` défini, when GET `/api/topics/:id/readiness`, then retourne `{ score: 100, breakdown: {...} }`.
- [ ] **AC02** : Given un Topic sans brief ni hooks ni recordingGuide, when GET readiness, then retourne `score: 0`.
- [ ] **AC03** : Given un Topic `status=DRAFT` avec score ≥ 80, when la fiche sujet est affichée, then un hint "✨ Ton sujet semble prêt" est visible + bouton "Marquer comme prêt" actif.
- [ ] **AC04** : Given un Topic `status=DRAFT`, when user clique "Marquer comme prêt" (PATCH `/api/topics/:id/status { status: 'READY' }`), then le Topic passe à `READY` et les 2 CTA `<ReadyActions>` apparaissent après `router.refresh()`.
- [ ] **AC05** : Given un Topic appartenant à une autre organisation, when GET `/api/topics/:id/readiness`, then réponse **404 Not Found** (évite l'énumération d'IDs — pas 403).
- [ ] **AC05b** ⚠️ **FIX F1** : Given un header `x-organization-id` forgé qui ne correspond pas à l'org réelle du Topic, when PATCH `/api/topics/:id/status` body `{ status: 'ARCHIVED' }`, then réponse **404** et le Topic reste inchangé en DB.
- [ ] **AC05c** ⚠️ **FIX F1** : Given un header `x-organization-id` forgé, when POST `/api/topics/:id/record-now`, then réponse **404** et **aucune** Theme/Session/ContentCalendar n'est créée (vérifié via compteurs DB avant/après).
- [ ] **AC05d** ⚠️ **FIX F1** : Given un header `x-organization-id` forgé, when POST `/api/topics/:id/schedule-publish`, then réponse **404** et aucune ContentCalendar n'est créée.

**AC — Tourner maintenant**

- [ ] **AC06** : Given un Topic `status=READY`, when user clique "🎬 Tourner maintenant" et le POST `/api/topics/:id/record-now` réussit, then une nouvelle Session est créée (liée à topicId), une nouvelle ContentCalendar entry est créée avec `status=RECORDED`, `scheduledDate=now`, `publishAt=null`, `sessionId` renseigné, et user redirigé vers `/s/{sessionId}`.
- [ ] **AC07** : Given un Topic avec `recordingGuide.format` défini, when "Tourner maintenant" sans format explicite, then le `contentFormat` de la Session hérite du format du recordingGuide.
- [ ] **AC08** : Given un Topic sans recordingGuide, when "Tourner maintenant" sans format, then le `contentFormat` est `HOT_TAKE` par défaut.
- [ ] **AC09** : Given une erreur Prisma pendant la création, when POST record-now, then la transaction est rollbackée (aucune Theme/Session/ContentCalendar partielle persistée) et user voit un toast d'erreur.

**AC — Planifier la publication**

- [ ] **AC10** : Given un Topic `status=READY`, when user clique "📅 Planifier la publication", then le `<SchedulePublishModal>` s'ouvre avec date picker.
- [ ] **AC11** : Given la modal ouverte, when user clique "Lundi prochain", then le date picker affiche la date du prochain lundi au format `YYYY-MM-DD`.
- [ ] **AC12** : Given une date future sélectionnée et format choisi, when user clique "Planifier", then POST `/api/topics/:id/schedule-publish` crée une ContentCalendar avec `status=PLANNED`, `publishAt=date-choisie`, `scheduledDate=date-choisie`, `sessionId=null`.
- [ ] **AC13** : Given une date passée sélectionnée, when submit, then l'endpoint retourne 400 et la modal affiche message d'erreur "La date doit être dans le futur."

**AC — Pipeline Kanban**

- [ ] **AC14** : Given un user admin avec Topics en différents états, when GET `/api/admin/pipeline`, then la réponse contient `topics[]` chacun avec `stage` calculé parmi [TO_WORK, READY, SHOT, EDITING, PUBLISHED] + `regularityAlert: boolean`.
- [ ] **AC15** : Given un Topic avec Session `status=SUBMITTED` mais aucun Project rendu, when dérivation, then `stage === 'SHOT'`.
- [ ] **AC16** : Given un Topic avec Project `status=RENDERING`, when dérivation, then `stage === 'EDITING'`.
- [ ] **AC17** : Given un Topic avec ContentCalendar `status=PUBLISHED` OU Session `publishedAt != null`, when dérivation, then `stage === 'PUBLISHED'` (stage "le plus avancé" prime).
- [ ] **AC18** : Given un Topic `status=ARCHIVED`, when GET pipeline, then il est filtré (pas présent dans la réponse).
- [ ] **AC19** : Given `/admin/pipeline` chargé, when rendu, then 5 colonnes sont visibles (À travailler / Prêt / Tourné / Montage / Publié) avec count par colonne.

**AC — Alerte régularité**

- [ ] **AC20** : Given aucun Topic `READY` ET aucune ContentCalendar `PLANNED` avec `publishAt` ≤ now+7j, when GET pipeline, then `regularityAlert === true`.
- [ ] **AC21** : Given au moins un Topic `READY`, when GET pipeline, then `regularityAlert === false`.
- [ ] **AC22** : Given au moins une ContentCalendar `PLANNED` avec `publishAt` dans 5 jours, when GET pipeline, then `regularityAlert === false`.
- [ ] **AC23** : Given `regularityAlert === true`, when `/admin/pipeline` rendu, then `<RegularityBanner>` est affiché en haut de page.

**AC — Data model & compat**

- [ ] **AC24** : Given la migration Prisma appliquée, when `ContentCalendar` existants sont lus, then `publishAt` vaut `null` et `scheduledDate` est inchangé (non-destructif).
- [ ] **AC25** : Given un call existant à `CalendarClient.tsx` (grille hebdo admin), when chargé post-migration, then le comportement est identique (entries affichées selon `scheduledDate`, pas de régression).

## Additional Context

### Dependencies

- **Prisma** : migration additive pour ajouter `publishAt` nullable. Commande `pnpm --filter @lavidz/database prisma migrate dev --name add_publishat_to_content_calendar` + `prisma generate`.
- **AI services existants** (hook/recordingGuide/brief/sources) — consommés en lecture seule pour le calcul readiness.
- **Fetch-based REST** (pas de React Query) — nouveaux endpoints proxifiés via Next.js API routes.
- **Pas de nouvelle lib npm requise MVP** (pas de date picker externe, pas de DnD).
- **Modules NestJS à enregistrer** : `PipelineModule` dans `AppModule`. `TopicReadinessService` comme provider de `AiModule`.

### Testing Strategy

**Unit tests (API) — Jest**

- `TopicReadinessService.computeScore` : 6 cas (tous critères remplis / aucun / seul brief / seul hooks / breakdown correct / Topic vide).
  - File : `apps/api/src/modules/ai/services/topic-readiness.service.spec.ts` (nouveau).
- `derivePipelineStage` : 8 cas couvrant les 5 stages + priorité (PUBLISHED > EDITING > SHOT > READY > TO_WORK) + ARCHIVED non-exposé.
  - File : `apps/api/src/modules/pipeline/pipeline-stage.util.spec.ts` (nouveau).
- `PipelineService.getPipeline` : mock Prisma, vérifie `regularityAlert` (3 scénarios : aucun ready / 1 ready / planned dans 5j).
  - File : `apps/api/src/modules/pipeline/pipeline.service.spec.ts` (nouveau).

**Integration tests (API)** — facultatif MVP si tests d'intégration absents du repo. Si framework en place : tester les endpoints avec une DB Prisma test (organisation isolée).

**Smoke flow manuel (web)** — à dérouler avant merge :

1. Créer/ouvrir un Topic `DRAFT`. Remplir brief, hook, recordingGuide via Kabou. Vérifier que le score readiness monte à ≥ 80. Vérifier hint "✨ Ton sujet semble prêt".
2. Cliquer "Marquer comme prêt". Vérifier passage à `READY` et apparition des 2 CTA.
3. **Path A** : Cliquer "🎬 Tourner maintenant" → être redirigé vers `/s/{sessionId}`. Enregistrer un clip court, soumettre. Vérifier que le Topic apparaît en colonne `SHOT` dans `/admin/pipeline`.
4. **Path B** : Cliquer "📅 Planifier la publication", choisir "Dans 1 semaine", valider. Vérifier que le Topic apparaît en colonne `READY` (car pas de session) avec date publishAt visible, et qu'il y a une ContentCalendar `PLANNED` en DB.
5. Aller dans `/admin/pipeline`. Vérifier les 5 colonnes + counts. Vérifier le banner régularité selon l'état de l'org (forcer état vide en archivant tous les Topics `READY` pour tester).
6. Aller dans `/admin/calendar` (legacy). Vérifier que la grille hebdo affiche toujours les entries existantes (pas de régression).

**Typecheck + lint**

- `pnpm -w typecheck` doit passer sans erreur.
- `pnpm -w lint` doit passer (selon conventions du repo).

### Notes

**Risques identifiés (pre-mortem)**

- **R1 — Confusion `scheduledDate` vs `publishAt`** ✅ **FIX F2 appliqué** : `scheduledDate` reste `required` dans le DTO (contrat existant préservé). Les nouveaux flows (T08/T09) fixent **explicitement les deux champs** à l'appel — pas de fallback serveur magique. `ContentCalendarService` prend les valeurs telles quelles. Ajouter un commentaire clair sur le champ Prisma (`// legacy — pref publishAt for new flows`). Tout appelant oubliant `scheduledDate` se prend un 400 `class-validator`, ce qui rend l'erreur visible tôt.
- **R2 — Formule readiness trop simpliste** : score déterministe peut donner ≥ 80 sur des Topics en réalité vides sémantiquement (ex: brief = "lorem ipsum" > 50 chars passe le check). **Mitigation MVP** : acceptée, car le bouton "Marquer comme prêt" reste manuel et l'user garde la décision. V2 : ajouter un signal AI (cohérence sémantique du brief) en entrée du score.
- **R3 — Performance pipeline endpoint** : fetch N topics × M sessions × K calendar entries peut devenir cher. **Mitigation** : MVP = dataset petit (< 100 topics par org). Si besoin, ajouter pagination ou filtre `stage=` côté endpoint en V2. Index Prisma existant sur `organizationId` et `topicId`.
- **R4 — Stage derivation divergente server/client** : on duplique l'util. **Mitigation** : tests unitaires identiques des deux côtés (T04 spec + côté web si tests ajoutés). V2 : extraire en `packages/shared-utils`.
- **R5 — `recordingGuide.format` optionnel** : si format absent et user clique "Tourner maintenant", fallback HOT_TAKE peut surprendre. **Mitigation UX** : afficher une confirmation "Format HOT_TAKE par défaut — continuer ?" si format non défini. MVP peut skip et ajouter V2.
- **R6 — Authentication `organizationId` cross-tenant** ✅ **FIX F1 appliqué** : `AdminGuard` seul est un shared-secret check (`process.env.ADMIN_SECRET`) — il n'exprime pas la propriété tenant. Le header `x-organization-id` est client-settable, donc sans recheck DB tout admin pourrait adresser les Topics d'une autre org. **Mitigation** : nouveau helper `assertTopicInOrg(prisma, topicId, orgId)` (T05b) appelé systématiquement en tête de T06/T07/T08/T09. Retourne `NotFoundException` (404) — pas 403 — pour éviter l'énumération d'IDs. ACs AC05/AC05b/AC05c/AC05d couvrent les 4 endpoints avec un header forgé.
- **R7 — `SubjectWorkspace.tsx` déjà dense** : ajouter readiness + ReadyActions peut surcharger le layout. **Mitigation** : placer `<ReadyActions>` au-dessus de la liste sessions (emplacement naturel du "call to action"). Pour le readiness DRAFT, placer dans le header Brief (visible dès l'ouverture).

**Limitations connues (acceptées MVP)**

- Pas de drag-and-drop entre colonnes Kanban.
- Pas de cadence configurable (seuil 7j hard-codé).
- Pas de notification push/email sur alerte régularité.
- Pas de refonte du calendrier hebdo admin existant (coexistence assumée).
- Formule readiness basique (améliorable avec signaux AI en V2).

**Future considerations (out of scope explicite)**

- Drag-and-drop avec `@dnd-kit` pour transitions manuelles (skip / reorder).
- Batch recording UX (tourner N sujets en une session).
- Auto-posting aux plateformes (LinkedIn, TikTok, Instagram, YouTube).
- Cadence configurable par organisation (ex: 3 publi / semaine).
- Dépréciation complète `scheduledDate` et migration finale en V2.
- Notifications push/email pour alertes.
- Client-facing calendar (`(client)/calendar/ClientCalendar.tsx`) — décider si on le garde ou le remplace par la vue pipeline client.

### Notes

- Le contexte product/UX complet provient d'une session BMAD Party Mode du 2026-04-21 avec Mary (Analyst), John (PM), Sally (UX), Winston (Architect), Bob (SM), Barry (QuickFlow Dev). Sketches UX : 3 écrans (Fiche Sujet READY, Modal Planifier publication, Vue Kanban pipeline).
- Promesse produit ancrée : régularité = moteur central, créateur self-service entrepreneur (voir memory `project_lavidz_pivot_entrepreneur.md` et `project_lavidz_subject_atom_plan.md`).
- `creative-state.ts` (SEED/EXPLORING/MATURE/SCHEDULED/PRODUCING/ARCHIVED) est **distinct** des 5 stages Kanban. Garder les deux ; la narrative UX (creativeState) reste utile pour la fiche sujet, le pipeline stage est purement opérationnel.
- La route existante `GET /ai/topics` (ai.controller.ts:546) retourne déjà topics + calendarEntries + sessions. Décision en Step 3 : étendre cette route avec Projects et derivation, ou créer un nouveau module `pipeline/` clean. **Recommandation** : nouveau module `pipeline/` pour isoler la logique métier et ne pas alourdir `AiController` déjà gros.
