---
title: 'Workspace Sujet évolutif : atmosphère, transitions, narration progressive'
slug: 'progressive-workspace'
created: '2026-04-22'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Next.js 15 + React 19'
  - 'Tailwind 3 (+ tailwindcss-animate plugin déjà présent)'
  - 'shadcn/ui + Radix (design tokens existants)'
  - 'Inter font + HSL tokens primary/accent'
files_to_modify:
  - 'apps/web/src/components/subject/TopicAtmosphere.tsx'        # new
  - 'apps/web/src/components/subject/StateTransitionSplash.tsx'  # new
  - 'apps/web/src/components/subject/MatureMatterSummary.tsx'    # new
  - 'apps/web/src/lib/topic-transition-memory.ts'                # new — localStorage wrapper
  - 'apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx' # orchestration
  - 'apps/web/tailwind.config.ts'                                 # +1 keyframe "atmosphere-pulse"
code_patterns:
  - 'Radial gradient via pseudo-element + backdrop-blur — pattern existant dans SubjectKabouPanel'
  - 'Staggered reveal via `animation-delay` inline style (pas de lib externe)'
  - 'Tailwind tokens uniquement — aucune couleur hard-coded hors tokens primary/emerald/amber/muted'
  - 'tailwindcss-animate utilities (`animate-in`, `fade-in`, `slide-in-from-bottom-*`) déjà dispo'
origin: 'Party mode design session Sally 2026-04-22'
---

# Tech-Spec: Workspace Sujet évolutif

**Created:** 2026-04-22

## Overview

### Problem Statement

Le workspace `/sujets/[id]` est structurellement correct (archi 2 axes livrée
Phase 1-10 + format card drawer) mais **visuellement plat** : toutes les
sections apparaissent dès que leur condition s'évalue `true`, sans narration
de l'évolution du sujet. Pas de moment de bascule, pas d'atmosphère
différenciée par phase, pas d'accompagnement Kabou sur les transitions.

Antoine, testant son propre produit, ressent qu'il "manque un voyage".
L'architecture est là, le pouls manque.

### Solution

**Ne pas empiler les effets — orchestrer 5 couches subtiles qui travaillent
ensemble** :

1. **Atmosphère** — un gradient radial subtil derrière le contenu, dont la
   teinte dérive de la phase (ambre SEED, émeraude EXPLORING, émeraude
   profonde MATURE, muet ARCHIVED). Respire 8s.
2. **Transitions** — un splash overlay contemplatif (pas célébratoire)
   déclenché à la première bascule réelle d'état. Kabou témoigne du moment.
3. **Reveal progressif** — les sections qui s'ajoutent par bascule d'état
   apparaissent staggered uniquement lors de la transition, pas au reload.
4. **Matière condensée** — en MATURE, les 4 sections éditoriales se plient
   dans un bandeau synthétique qui affiche la densité de la matière sans
   l'étaler.
5. **Halo d'attention** — la carte format qui porte une session active
   (RECORDING / SUBMITTED / PROCESSING) reçoit un ring + pulse discrète.

### Principes non-négociables

- **Aucune couleur hors tokens** — tout via `primary`, `emerald-*`,
  `amber-*`, `muted-*`, `border/40`, `background/...`.
- **Aucune lib d'animation ajoutée** — Tailwind + `tailwindcss-animate` font
  tout. Pas de `framer-motion`, pas de `lottie`.
- **Tout splash est skippable** en 1 click (click anywhere, Escape, auto-timeout).
- **Pas de célébration fausse** — pas de confetti, pas d'emoji trophée. Le
  changement est **observé**, pas **félicité**. Kabou dit *"tu viens de
  franchir un cap"*, pas *"bravo tu as gagné un badge"*.
- **Respect du pivot entrepreneur** (2026-04-19) + **promesse produit**
  (qualité + IA-coach + processus créatif naturel — pas vitesse pure).

### Scope

**In scope (5 stories, ~4 pts) :**

- Story 1 : `TopicAtmosphere` — gradient radial par phase (0.5 pt)
- Story 2 : `StateTransitionSplash` + détection + mémoire localStorage (1.5 pt)
- Story 3 : `MatureMatterSummary` — bandeau plié + accordéon (1 pt)
- Story 4 : Reveal stagger sur 1re transition + halo session active (0.75 pt)
- Story 5 : Orchestration dans `SubjectWorkspace` + tests manuels (0.25 pt)

**Out of scope (V1.1+) :**

- Messages proactifs de Kabou au changement d'état (injectés dans le thread
  quand user atterrit) — nécessite un backend thread-ops, follow-up
  tech-spec isolé.
- Réordonnancement drag-and-drop des sections.
- Variations d'atmosphère cross-topic (ex: teinte par `pillar` éditorial).
- Sons. (Non, jamais. L'utilisateur peut être au bureau.)

## Context for Development

### Le modèle mental du voyage

Chaque sujet traverse **4 atmosphères** + **3 transitions** qui comptent :

| Phase | Atmosphère | Job dominant | Kabou dit |
|---|---|---|---|
| 🌱 SEED | Ambre doux | "On discute" | *"Parle-moi de ton sujet. Pas besoin d'être clair — on creuse ensemble."* |
| 🌿 EXPLORING | Vert frais | "On creuse et on structure" | *"Ton angle prend forme. Je peux chercher 3 sources pour le muscler si tu veux."* |
| 🌳 MATURE | Vert profond | "On choisit la forme" | *"Ton sujet est prêt. Sur quel format il vivra mieux ?"* |
| 📦 ARCHIVED | Gris muet | "On met de côté" | *"Ce sujet repose. Ressortir quand tu le sens."* |

Les transitions **SEED→EXPLORING** et **EXPLORING→MATURE** sont les 2
moments critiques. `ARCHIVED` est une mise en pause — pas célébrée. `LIVE`
(session) est géré dans la carte format + toast Kabou (hors scope workspace).

### Tokens design utilisés

- **Primary** : HSL(14 100% 55%) orange Lavidz — halos sessions actives,
  éléments d'attention.
- **Emerald-400/500/600** : phase EXPLORING et MATURE.
- **Amber-300/400** : phase SEED.
- **Muted** : ARCHIVED.
- **Border/40** + **background** : tokens existants.

### Tailwind extensions requises

Ajouter **1 keyframe** `atmosphere-pulse` dans `tailwind.config.ts` :

```ts
keyframes: {
  'atmosphere-pulse': {
    '0%, 100%': { transform: 'scale(1) translateY(0)', opacity: '0.12' },
    '50%': { transform: 'scale(1.04) translateY(-2%)', opacity: '0.18' },
  },
},
animation: {
  'atmosphere-pulse': 'atmosphere-pulse 9s ease-in-out infinite',
},
```

## Implementation Plan

### Story 1 — `TopicAtmosphere` (0.5 pt)

**Objective :** Background radial gradient dont la teinte suit la phase.
Respire lentement. Décoratif, pointer-events-none.

- [ ] **Task 1.1** : Créer `apps/web/src/components/subject/TopicAtmosphere.tsx`
  - Props : `{ state: CreativeState }`
  - Rend un `<div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">` qui contient un `<div>` gradient positionné en absolute top-center.
  - Classe conditionnelle par state :
    - SEED → `from-amber-400/10 via-amber-400/5 to-transparent`
    - EXPLORING → `from-emerald-400/10 via-emerald-400/5 to-transparent`
    - MATURE → `from-emerald-600/12 via-emerald-500/5 to-transparent`
    - ARCHIVED → `from-muted/40 via-muted/10 to-transparent`
  - Shape : `bg-gradient-radial` (Tailwind 3 n'a pas natif — utiliser `bg-[radial-gradient(...)]` inline OR `bg-gradient-to-br from-X` avec une forme elliptique large).
  - Animation : `animate-atmosphere-pulse` (nouveau keyframe Tailwind).
  - Dimensions : `h-[70vh] w-[120vw] -translate-x-[10vw] -translate-y-[20vh]` (flou large, sort du viewport pour un effet ambient sans bord dur).

- [ ] **Task 1.2** : Ajouter le keyframe `atmosphere-pulse` dans `tailwind.config.ts`.

**ACs :**

- [ ] AC 1.1 : Given un Topic SEED, when on visite `/sujets/[id]`, then le background derrière le workspace porte une teinte ambrée subtile qui pulse doucement (non-intrusif).
- [ ] AC 1.2 : Given bascule du state SEED → EXPLORING, when la page re-rend, then la teinte passe d'ambre à émeraude en cross-fade (2s via CSS `transition-colors`).
- [ ] AC 1.3 : Given `z-index`, when on inspecte, then l'atmosphere est sous tout le contenu (`-z-10`) et ne capture aucun event.

### Story 2 — `StateTransitionSplash` + mémoire (1.5 pt)

**Objective :** Moment de bascule observé, jamais célébré. Kabou témoigne.

- [ ] **Task 2.1** : Créer `apps/web/src/lib/topic-transition-memory.ts`
  ```ts
  export function hasSeenTransition(topicId: string, state: CreativeState): boolean
  export function markTransitionSeen(topicId: string, state: CreativeState): void
  export function clearTransition(topicId: string, state: CreativeState): void
  ```
  localStorage key : `lavidz:topic-transition:${topicId}:${state}`. Valeur = ISO timestamp de première vue. Si key absente → `hasSeenTransition` retourne `false`. Guard `typeof window !== 'undefined'` pour SSR safety.

- [ ] **Task 2.2** : Créer `apps/web/src/components/subject/StateTransitionSplash.tsx`
  - Props :
    ```ts
    interface StateTransitionSplashProps {
      open: boolean
      onClose: () => void
      fromState: CreativeState | null
      toState: CreativeState
      topicName: string
    }
    ```
  - Rend via `<div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl ...">`.
  - Content stack centered :
    - **Icon** — réutilise `SeedIcon`, `SproutIcon`, `TreeIcon` de `CreativeStageIcons.tsx`. Fade-in `animate-in fade-in zoom-in-95 duration-700`.
    - **Titre** — `<h2 className="text-2xl font-semibold tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-700 [animation-delay:200ms] fill-mode-both">`. Contenu selon transition :
      - `SEED → EXPLORING` : *"Ton sujet bourgeonne."*
      - `EXPLORING → MATURE` : *"Ton angle est solide."*
      - `MATURE → ARCHIVED` : *"Ce sujet repose."*
      - `ARCHIVED → *` : *"On le ressort."*
    - **Phrase Kabou** — `<p className="max-w-md text-center text-sm text-muted-foreground animate-in fade-in duration-700 [animation-delay:400ms] fill-mode-both">`. Selon transition :
      - `SEED → EXPLORING` : *"On peut commencer à le sculpter. Je t'ouvre tes outils."*
      - `EXPLORING → MATURE` : *"Il est temps de choisir ta première prise de parole."*
      - `MATURE → ARCHIVED` : *"Je le garde au chaud."*
      - `ARCHIVED → *` : *"Prêt à reprendre la matière là où tu l'avais laissée."*
    - **Horizon line** — `<div className="w-20 h-px bg-primary/40 animate-in fade-in duration-1000 [animation-delay:600ms]">`. Signal subtil.
  - Auto-dismiss : `useEffect` avec `setTimeout(onClose, 3500)`.
  - Escape handler : `useEffect` listener `keydown` Escape.
  - Click-anywhere : `onClick={onClose}` sur le wrapper.
  - Focus trap : pas nécessaire (non-bloquant, skippable trivialement).

- [ ] **Task 2.3** : Détection de transition côté `SubjectWorkspace`
  - Import `hasSeenTransition`, `markTransitionSeen`, `clearTransition`.
  - State local `<{ from: CreativeState | null; to: CreativeState } | null>` pour le splash actif.
  - `useEffect` qui compare `previousStateRef.current` (via `useRef`) au `creativeState` prop.
    - Si différents ET `creativeState` n'est pas `ARCHIVED` venant de nulle part (hydration initiale), ET `!hasSeenTransition(topicId, creativeState)` → déclenche splash.
    - À fermeture du splash : `markTransitionSeen(topicId, creativeState)`.
    - Si transition descendante (ex: MATURE → EXPLORING via "Remettre en exploration") : `clearTransition(topicId, MATURE)` pour permettre de rejouer le splash quand on remonte.
  - `previousStateRef.current = creativeState` après chaque effect (pas sur le premier mount pour éviter le splash à la première visite d'un topic déjà MATURE).

**ACs :**

- [ ] AC 2.1 : Given Topic MATURE première visite (pas de localStorage seen), when on arrive sur la page, then PAS de splash (on affiche la page direct — pas de splash sur mount initial).
- [ ] AC 2.2 : Given un Topic EXPLORING, when user clique "Marquer comme prêt", then le splash EXPLORING→MATURE se joue 3.5s, icône arbre, wording *"Ton angle est solide."*.
- [ ] AC 2.3 : Given le splash ouvert, when user clique n'importe où OR appuie Escape, then le splash se ferme instantanément.
- [ ] AC 2.4 : Given un splash fermé, when reload de la page, then le splash ne se rejoue PAS (localStorage seen).
- [ ] AC 2.5 : Given Topic MATURE, when user clique "Remettre en exploration" puis "Marquer comme prêt" à nouveau, then le splash se rejoue (clear on regression).

### Story 3 — `MatureMatterSummary` (1 pt)

**Objective :** En MATURE, plier les 4 sections éditoriales dans un bandeau
synthétique. Révéler leur densité sans les étaler.

- [ ] **Task 3.1** : Créer `apps/web/src/components/subject/MatureMatterSummary.tsx`
  - Props :
    ```ts
    interface MatureMatterSummaryProps {
      briefLength: number                  // chars du brief
      anchorBulletCount: number
      hookCount: number                    // topic.hooks ou session.hooks count
      sourcesCount: number
      hookDraftHasContent: boolean
      expanded: boolean
      onToggle: () => void
      children: ReactNode                  // les sections vraies, rendues quand expanded=true
    }
    ```
  - Quand `expanded === false` :
    - Rend un unique bloc `<section className="mb-6 rounded-2xl border border-border/40 bg-surface-raised/20 px-5 py-4">` :
    - Title : `✦ Mon sujet en matière` — `text-xs font-semibold uppercase tracking-widest text-muted-foreground`.
    - Ligne densité horizontale : `flex flex-wrap gap-x-4 gap-y-1 text-xs`. Chacun des 4 items condensé :
      - `Angle · {N} mots` (dérivé de `briefLength`, soit `N = Math.round(briefLength/5)` estimation mots)
      - `Anchor · {anchorBulletCount} bullets`
      - `{hookCount} accroches`
      - `{sourcesCount} sources`
      Chaque item pale (`text-muted-foreground`) séparé par une micro-dot centrée.
    - Bouton "Déplier" à droite, discreet, chevron down.
  - Quand `expanded === true` :
    - Rend les children (sections vraies) + bouton "Replier" en top-right de chaque section (ou un seul bouton global "Replier la matière" en haut).

- [ ] **Task 3.2** : Brancher dans `SubjectWorkspace`
  - Nouveau state `const [matterExpanded, setMatterExpanded] = useState(false)`.
  - Condition : `creativeState === 'MATURE'` → wrap les 4 sections (angle, anchor, hooks, sources) dans `<MatureMatterSummary expanded={matterExpanded} ...>`.
  - `creativeState === 'EXPLORING'` → rend les sections normales (pas de résumé).
  - `creativeState === 'SEED'` → uniquement le hero + chat.
  - `creativeState === 'ARCHIVED'` → sections toujours visibles mais avec opacity.

**ACs :**

- [ ] AC 3.1 : Given Topic MATURE avec brief 450 chars, 3 bullets anchor, 4 sources, when on visite, then bandeau résumé au top montre "Angle · 90 mots · Anchor · 3 bullets · 4 sources" + bouton "Déplier".
- [ ] AC 3.2 : Given bandeau plié, when click "Déplier", then les 4 sections éditoriales apparaissent slide-down (`animate-in slide-in-from-top-2 duration-300`).
- [ ] AC 3.3 : Given Topic EXPLORING, when on visite, then PAS de bandeau résumé — les sections sont en mode normal ouvert.

### Story 4 — Stagger reveal + halo session active (0.75 pt)

**Objective :** La première fois qu'on franchit une transition, les
nouvelles sections apparaissent cascade. Quand une session tourne, sa carte
format pulse discrètement.

- [ ] **Task 4.1** : Stagger reveal
  - Dans les sections qui apparaissent après la transition, appliquer inline :
    ```tsx
    <section
      className="... animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
      style={{ animationDelay: `${i * 80}ms` }}
    >
    ```
  - Condition : appliquer l'animation **uniquement si** le splash vient de se fermer (on track `justTransitioned` state, reset après 1s).
  - Sections ordonnées : Angle → Anchor → Hooks → Sources → Format cards / hero.

- [ ] **Task 4.2** : Halo carte format session active
  - Dans la boucle des cartes format de `SubjectWorkspace`, détecter :
    ```ts
    const isLive =
      canonical &&
      ['RECORDING', 'SUBMITTED', 'PROCESSING'].includes(canonical.status)
    ```
  - Si `isLive`, ajouter au wrapper `<article>` les classes :
    `ring-2 ring-primary/30 shadow-lg shadow-primary/10 animate-[atmosphere-pulse_6s_ease-in-out_infinite]`.
  - Sur le badge status (dot colorée), ajouter `animate-pulse`.

**ACs :**

- [ ] AC 4.1 : Given splash SEED→EXPLORING qui vient de se fermer, when la page re-rend, then les sections Angle / Anchor / Hooks / Sources apparaissent les unes après les autres (stagger 80ms, fade + slide 8px).
- [ ] AC 4.2 : Given reload de la page après transition déjà vue, when on arrive, then les sections apparaissent instantanément (pas de stagger — évite la re-animation agaçante).
- [ ] AC 4.3 : Given une session RECORDING active dans un format, when on visite le Topic, then la carte de ce format porte un ring primary + shadow subtile + dot de status qui pulse.

### Story 5 — Orchestration et vérification (0.25 pt)

**Objective :** Brancher le tout dans SubjectWorkspace sans casser l'existant.

- [ ] **Task 5.1** : Monter `<TopicAtmosphere state={creativeState} />` au top du return JSX (avant le conteneur principal).
- [ ] **Task 5.2** : Monter `<StateTransitionSplash />` conditionnellement via l'état `activeTransition`.
- [ ] **Task 5.3** : Vérifier que l'atmosphere + le splash ne capturent aucun event (aria-hidden + pointer-events-none pour l'atmosphere, z-50 + skip handler pour le splash).
- [ ] **Task 5.4** : Manual test scenarios :
  1. Topic SEED nouveau → atmosphere ambre, chat Kabou ouvert, pas de splash.
  2. User discute, brief atteint 420 chars → transition SEED→EXPLORING → splash joue, sections slide-in.
  3. Mark ready → transition EXPLORING→MATURE → splash joue, matière se plie dans le bandeau, hero format picker visible dessous.
  4. Reload MATURE → pas de splash, matière pliée, rien ne bouge (UX stable).
  5. Remettre en exploration + mark ready → splash MATURE rejoué.
  6. Launch recording sur carte storytelling → la carte prend le halo primary pulsant.

**ACs :**

- [ ] AC 5.1 : `pnpm --filter @lavidz/web typecheck` passe 0 erreur.
- [ ] AC 5.2 : Les 6 scénarios manuels passent sans régression des features existantes (format cards, drawer, publier, recovery banner).

## Additional Context

### Kabou proactive (OUT OF SCOPE V1)

Note pour le follow-up : à V1.1, injecter un **message initial Kabou** dans
le thread du topic quand user atterrit sur une phase pour la première fois
et que le thread est vide pour cette phase. Cela nécessite :

- Étendre `Topic.threadId` avec un tracking `lastOpenedInState: { SEED?: Date, EXPLORING?: Date, MATURE?: Date }`.
- Backend : endpoint qui, si nouveau state + thread "dormant" sur ce state, inject un chatMessage assistant avec le wording d'ouverture (`bmad-output/quick-specs/kabou-proactive-openers.md` à créer).
- Frontend : SubjectKabouPanel listen sur state change, fetch `/api/chat/history` refresh.

Ce travail consomme 1-2 pts et mérite un spec séparé. À discuter après
browser-test de progressive-workspace V1.

### Design tokens review

Pas de nouvelles couleurs. Seul ajout : 1 keyframe `atmosphere-pulse`. Le
design system ne bouge pas — on **compose** avec l'existant.

### Testing Strategy

Manual — pas de framework de test configuré. Test matrice dans Task 5.4.
Si E2E souhaité post-V1 : Playwright via `/bmad-testarch-framework`
(cible : détection transition + skip splash + stagger conditional).

---

## Équipe party mode ayant contribué

- 🎨 **Sally (UX Designer)** — vision complète, 4 principes non-négociables,
  5 couches orchestrées, tonalité contemplative.
- 🏗️ **Winston (Architect)** — validation no-new-dep + localStorage pattern
  + stagger via CSS inline.
- 📋 **John (PM)** — garde-fous "skippable partout" + "pas de célébration
  fausse" + "respect pivot entrepreneur".
- 📚 **Paige (Tech Writer)** — structuration + ACs.
