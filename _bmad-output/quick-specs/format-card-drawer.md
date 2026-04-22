---
title: 'Format Card : preview dans la carte + drawer in-place pour le script complet'
slug: 'format-card-drawer'
created: '2026-04-22'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Next.js 15 (App Router, Turbopack)'
  - 'React 19'
  - 'Vaul 1.x (bottom sheet / drawer — déjà utilisé pour Kabou mobile)'
  - 'Tailwind 3 + shadcn/ui'
files_to_modify:
  - 'apps/web/src/components/subject/FormatCardDrawer.tsx'  # new
  - 'apps/web/src/components/subject/FormatCardPreview.tsx' # new — helper preview polymorphe par kind
  - 'apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx'  # wire drawer, retire SubjectRecordingGuide middle
code_patterns:
  - 'Vaul Drawer.Root avec direction="bottom" (mobile) ou "right" (desktop) via media query'
  - 'Polymorphic renderer discriminé par `kind` (pattern existant dans recording-guide.ts / recording-script.ts)'
  - 'Boutons asChild avec <Link> pour la navigation session'
  - 'useMediaQuery pattern du SubjectWorkspace (matchMedia 1024px)'
test_patterns:
  - 'Clean slate — pas de framework de test configuré'
  - 'Acceptance Criteria Given/When/Then pour manual test'
origin: 'Party mode 2026-04-22 — retour UX après browser test Phase 4b'
---

# Tech-Spec: Format Card preview + drawer

**Created:** 2026-04-22

## Overview

### Problem Statement

Après le browser-test de la Phase 4b (cartes par format dans SubjectWorkspace), Antoine a identifié deux bugs UX :

1. **La section "Storytelling" (legacy `SubjectRecordingGuide`) flotte au milieu de la page Sujet**, déconnectée visuellement de la carte "📖 Histoire" qui apparaît plus bas. L'utilisateur ne fait pas le lien entre les deux.
2. **Les cartes format sont muettes** : elles affichent "À enregistrer + titre de session" mais rien du contenu (beats storytelling, pairs myth_vs_reality, arguments hot_take, etc.) qui les caractérise. L'utilisateur ne sait pas ce que chaque carte porte sans cliquer vers une autre page.

### Solution

**A2+ Drawer in-place** : chaque carte format porte un **preview polymorphe** (2 éléments tronqués selon le `kind`) et un CTA "Voir le script complet" qui ouvre un **drawer Vaul sans quitter la page**. Le drawer expose le script format-specific en détail + actions (re-sync, lancer le tournage).

Retirer simultanément le `SubjectRecordingGuide` rendu au milieu de la page — son contenu est désormais matérialisé DANS la carte correspondante, au bon endroit mental.

### Scope

**In scope (3 stories, ~2.5 pts) :**
- Story 1 : composant `FormatCardDrawer` + helper `FormatCardPreview` polymorphes.
- Story 2 : câblage dans les cartes format de `SubjectWorkspace`.
- Story 3 : retrait du rendu legacy middle-page de `SubjectRecordingGuide`.

**Out of scope (V1.1+) :**
- Édition inline des beats/bullets/pairs depuis le drawer (V1 = read-only + actions).
- Drawer pour afficher les hooks Session format-specific (ils vivent déjà dans la section Hooks en haut de page — pas de besoin immédiat).
- Animation fine du drawer open/close (celle par défaut de Vaul suffit).
- Comparaison côte-à-côte des variantes REPLACED dans le drawer (l'accordion existant suffit).

## Context for Development

### Données consommées par la carte

Chaque carte format reçoit (via la prop `group` dans SubjectWorkspace) :

```ts
{
  format: ContentFormat | 'OTHER'
  canonical: SubjectSessionRef | null  // session non-REPLACED
  variants: SubjectSessionRef[]        // sessions REPLACED
}
```

Elle doit aussi accéder au **script format-specific** de la `canonical` (si elle existe). Actuellement, `SubjectSessionRef` expose seulement `id, status, contentFormat, themeName, questionsCount, projectId`. Il faut y **ajouter** :

```ts
type SubjectSessionRef = {
  // ...existant...
  recordingScript: RecordingScript | null  // lu depuis Session.recordingScript côté server
}
```

Et le fetch server-side dans `apps/web/src/app/(client)/sujets/[id]/page.tsx` doit inclure `recordingScript` dans le select `sessions`.

### Fallback quand pas encore de script

Si `canonical === null` OU `canonical.recordingScript === null`, la carte affiche le preview issu de `Topic.narrativeAnchor.bullets` (via la prop déjà disponible `topic.narrativeAnchor`) avec le wording :

> "Pas encore de script adapté à ce format. Kabou peut l'adapter depuis ton angle."

Avec un CTA secondaire vers `/chat?topicId=X&action=record&format=Y` (fait déjà pointer vers le chat Kabou avec le format pré-sélectionné — Task 3.6 implémentée).

### Preview polymorphe — règles par `kind`

| kind | Preview (2 éléments, max 60 chars chacun) |
| --- | --- |
| `storytelling` | Les 2 premiers `beats` : `▸ {label} : "{text[0..60]}…"` |
| `myth_vs_reality` | La 1ère `pair` : `▸ Mythe : "{myth}"` + `▸ Réalité : "{reality}"` |
| `qa` | La 1ère `item` : `▸ Q : "{question}"` + `▸ 1er point : "{keyPoints[0]}"` |
| `hot_take` | `▸ Thèse : "{thesis}"` + `▸ 1er arg : "{arguments[0]}"` |
| `daily_tip` | `▸ Problème : "{problem}"` + `▸ Conseil : "{tip}"` |
| `teleprompter` | Les 2 premières lignes non-vides du `script` tronquées |

Le suffixe `"…"` apparaît si tronqué. Si le kind n'a qu'1 élément substantiel (ex: hot_take sans arguments), n'afficher que 1 ligne.

Fallback `narrativeAnchor` : 2 premiers `bullets[]` tronqués 60 chars.

### Drawer anatomy

**Mobile (< 1024px)** : `Drawer.Root direction="bottom"` (Vaul) avec snap points `[0.5, 0.92]`. Comme le Kabou drawer existant.

**Desktop (≥ 1024px)** : `Drawer.Root direction="right"` avec largeur fixe 480px. Pas de snap, plein-hauteur.

**Contenu du drawer** :

```
┌─────────────────────────────────────────┐
│ 📖 Histoire                         [×] │
│ La méthode des fruits mûrs              │
│ ● À enregistrer                          │
├─────────────────────────────────────────┤
│  [StaleAnchorBadge si applicable]       │
│                                         │
│  ▸ Mise en place                        │
│    Tu penses que l'IA exige 6 mois…    │
│                                         │
│  ▸ Tension                              │
│    Cette vision te paralyse. Pourtant…  │
│                                         │
│  ▸ Bascule                              │
│    Applique la méthode des fruits…     │
│                                         │
│  ▸ Résolution                           │
│    Ne cherche plus la complexité…       │
│                                         │
│  ──── Source ────                       │
│  🧭 Ancre narrative :                    │
│  • bullet 1 de narrativeAnchor          │
│  • bullet 2 de narrativeAnchor          │
│                                         │
├─────────────────────────────────────────┤
│  [🎬 Lancer le tournage]                │
│  [🔄 Re-synchroniser avec l'angle]      │
└─────────────────────────────────────────┘
```

Le bouton "Re-synchroniser" n'apparaît que si `isStale` (condition F14) OU si le user veut forcer un reshape. V1 : bouton visible toujours, handler appelle `POST /api/sessions/[id]/recording-script/reshape` (endpoint créé en Phase 3b).

### Files à toucher

- **apps/web/src/components/subject/FormatCardPreview.tsx** (new) — composant pur qui prend `{ script: RecordingScript | null; anchor: NarrativeAnchor | null }` et rend les 2 lignes de preview polymorphes. Utilisé INSIDE la carte format (pas dans le drawer, qui rend le script complet).
- **apps/web/src/components/subject/FormatCardDrawer.tsx** (new) — wrapper Vaul. Props : `{ open, onOpenChange, format, canonical, anchor, stale, onResync }`. Gère mobile/desktop via `useMediaQuery`.
- **apps/web/src/app/(client)/sujets/[id]/page.tsx** — ajouter `recordingScript` au select sessions + passer au Workspace.
- **apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx** :
  - Retirer l'import `SubjectRecordingGuide` et le bloc `{!isArchived && topic.recordingGuide && ...}` (L567-571).
  - Étendre `SubjectSessionRef` avec `recordingScript: RecordingScript | null`.
  - Dans le render des cartes format (Task 3.3), remplacer la `SessionRow` interne par `<FormatCardPreview>` + bouton "Voir le script complet" qui ouvre le drawer.
  - État : `const [openDrawerFormat, setOpenDrawerFormat] = useState<string | null>(null)`.

## Implementation Plan

### Task Ordering Rules

Les 3 stories sont séquentielles : 1 (building block) → 2 (integration) → 3 (cleanup). Il est OK de commit 1+2 ensemble puis 3 séparément pour traçabilité.

### Story 1 — `FormatCardPreview` + `FormatCardDrawer` (1.5 pt)

**Objective :** Deux composants purs qui rendent le preview et le drawer selon le `kind` du script.

- [ ] **Task 1.1** : Créer `FormatCardPreview.tsx`
  - File: `apps/web/src/components/subject/FormatCardPreview.tsx`
  - Props : `{ script: RecordingScript | null; anchor: NarrativeAnchor | null; compact?: boolean }`
  - Rend 2 lignes max selon kind (voir table "Preview polymorphe"). Si `script === null && anchor`, rend 2 bullets de l'anchor préfixés `▸`. Si les deux null, rend italique "Pas encore de script adapté à ce format."
  - Utils internes : `truncate(text, max)` retourne `text.slice(0, max) + (text.length > max ? '…' : '')`.

- [ ] **Task 1.2** : Créer `FormatCardDrawer.tsx`
  - File: `apps/web/src/components/subject/FormatCardDrawer.tsx`
  - Props :
    ```ts
    interface FormatCardDrawerProps {
      open: boolean
      onOpenChange: (v: boolean) => void
      format: string          // 'STORYTELLING', etc.
      formatLabel: string
      formatEmoji: string
      canonical: SubjectSessionRef | null
      anchor: NarrativeAnchor | null
      isStale: boolean
      onResync: () => Promise<void> | void
    }
    ```
  - Header : emoji + formatLabel + titre session (si canonical) + statut badge + bouton close.
  - Body : renderer polymorphe du script complet (réutilise le shape connu — pattern similaire à `SubjectRecordingGuide` legacy mais en lisant `canonical.recordingScript`). Fallback : si pas de script, affiche l'anchor bullets + message "Kabou peut adapter ton angle à ce format depuis le chat".
  - Footer : bouton primary `[🎬 Lancer le tournage]` → `<Link href={`/s/${canonical.id}`}>` (si canonical.status === 'PENDING'/'RECORDING'), sinon variante adaptée au statut (cf. SessionRow existante). Bouton secondary `[🔄 Re-synchroniser]` → `onResync()`.
  - Utilise `@/components/subject/StaleAnchorBadge` en haut du body si `isStale`.
  - Media query : `useEffect` pour sync `isDesktop` (reuse pattern du SubjectWorkspace). Si desktop, `direction="right"`, sinon `direction="bottom"` avec `snapPoints={[0.6, 0.92]}`.

**ACs :**

- [ ] AC 1.1 : Given un `RecordingScript` kind='storytelling' avec 4 beats, when `<FormatCardPreview script={...} />` est rendu, then 2 lignes tronquées apparaissent avec `▸ {label}` et texte ≤ 60 chars + ellipsis si coupé.
- [ ] AC 1.2 : Given `script === null && anchor.bullets.length = 3`, when rendu, then les 2 premiers bullets de l'anchor sont affichés préfixés `▸`.
- [ ] AC 1.3 : Given `script === null && anchor === null`, when rendu, then texte italique muted "Pas encore de script adapté à ce format."
- [ ] AC 1.4 : Given `FormatCardDrawer` avec `isStale=true`, when ouvert, then `StaleAnchorBadge` rendu en haut du body + bouton re-sync fonctionnel.
- [ ] AC 1.5 : Given viewport ≥ 1024px, when drawer ouvert, then Vaul direction='right' + largeur ≈ 480px. Given viewport < 1024px, then direction='bottom' + snapPoints.

### Story 2 — Wire into `SubjectWorkspace` (0.75 pt)

**Objective :** Câbler le preview + drawer dans les cartes format existantes.

- [ ] **Task 2.1** : Étendre `SubjectSessionRef` (type + fetch)
  - File : `apps/web/src/app/(client)/sujets/[id]/page.tsx`
  - Dans l'include sessions, ajouter `recordingScript` au select (Prisma scalar). Passer la value au mapping `sessions={topic.sessions.map(s => ({...s, recordingScript: isRecordingScript(s.recordingScript) ? s.recordingScript : null}))}`.
  - File : `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`
  - Étendre `type SubjectSessionRef` avec `recordingScript: RecordingScript | null`.

- [ ] **Task 2.2** : Render preview + ouvrir drawer
  - File : `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`
  - Imports :
    ```ts
    import { FormatCardPreview } from '@/components/subject/FormatCardPreview'
    import { FormatCardDrawer } from '@/components/subject/FormatCardDrawer'
    import { Eye } from 'lucide-react'  // ou Maximize2, ChevronsUpDown
    ```
  - État : `const [openDrawerFormat, setOpenDrawerFormat] = useState<string | null>(null)`.
  - Dans la carte format (block Task 3.3), remplacer `{canonical && <SessionRow session={canonical} />}` par :
    ```tsx
    {canonical ? (
      <div className="px-4 py-3 space-y-2">
        <SessionRow session={canonical} />
        <FormatCardPreview
          script={canonical.recordingScript}
          anchor={topic.narrativeAnchor}
          compact
        />
        <button
          type="button"
          onClick={() => setOpenDrawerFormat(group.format)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Eye className="h-3 w-3" />
          Voir le script complet
        </button>
      </div>
    ) : (
      <div className="px-4 py-3">
        <FormatCardPreview script={null} anchor={topic.narrativeAnchor} compact />
      </div>
    )}
    ```
  - Après le `</article>` de chaque carte, monter le drawer (un seul actif à la fois grâce à l'état `openDrawerFormat`) :
    ```tsx
    <FormatCardDrawer
      open={openDrawerFormat === group.format}
      onOpenChange={(v) => setOpenDrawerFormat(v ? group.format : null)}
      format={group.format}
      formatLabel={formatLabel}
      formatEmoji={formatEmoji}
      canonical={canonical}
      anchor={topic.narrativeAnchor}
      isStale={computeStale(topic.narrativeAnchor, canonical?.recordingScript)}
      onResync={async () => { /* POST /api/sessions/:id/recording-script/reshape */ }}
    />
    ```
  - Helper local `computeStale(anchor, script)` : `anchor && script ? Date.parse(anchor.updatedAt) > Date.parse(script.anchorSyncedAt) : false`.

- [ ] **Task 2.3** : Handler onResync
  - Dans SubjectWorkspace, ajouter la fonction qui appelle `/api/sessions/${sessionId}/recording-script/reshape` avec body `{ format: group.format }`. À succès : `flashToast('✨ Script re-synchronisé')` + `router.refresh()`. Erreur : `flashToast(KABOU_TOASTS.oops)`.
  - Proxy route Next.js nécessaire si pas déjà en place : `apps/web/src/app/api/sessions/[sessionId]/recording-script/reshape/route.ts` — proxy vers NestJS (mimic pattern `reset/route.ts`).

**ACs :**

- [ ] AC 2.1 : Given un Topic avec une session canonique storytelling ayant `recordingScript.kind = 'storytelling'`, when on visite `/sujets/[id]`, then la carte "📖 Histoire" affiche les 2 premiers beats en preview, et le bouton "Voir le script complet" est visible.
- [ ] AC 2.2 : Given la carte "📖 Histoire", when on clique "Voir le script complet", then le drawer Vaul s'ouvre (bottom sur mobile, right desktop) avec les 4 beats + CTA "Lancer le tournage".
- [ ] AC 2.3 : Given le drawer ouvert, when on clique "Re-synchroniser", then `POST /api/sessions/:id/recording-script/reshape` est appelé, toast succès, et après `router.refresh()` le preview reflète le nouveau script.
- [ ] AC 2.4 : Given un Topic MATURE sans session canonique dans un format (ex: Hot Take), when la carte s'affiche, then le preview montre les 2 bullets `narrativeAnchor` + texte "Pas encore de script adapté à ce format." Le CTA dans la carte reste "Nouveau tournage" (existant).
- [ ] AC 2.5 (bug fixé) : Given Antoine ouvre un Sujet qui contient l'ancien `Topic.recordingGuide` kind='storytelling' + une session storytelling canonique, when la page rend, then il n'y a QU'UN seul endroit où il voit les beats (dans la carte Histoire), la section middle-page "Storytelling" n'existe plus (cf. Story 3).

### Story 3 — Retirer le rendu legacy `SubjectRecordingGuide` middle-page (0.25 pt)

**Objective :** Supprimer la source de confusion visuelle — le script format-specific ne doit vivre QUE dans la carte correspondante.

- [ ] **Task 3.1** : Retirer le bloc middle-page
  - File : `apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`
  - Supprimer les lignes :
    ```tsx
    {!isArchived && topic.recordingGuide && (
      <div className="mb-6">
        <SubjectRecordingGuide guide={topic.recordingGuide} />
      </div>
    )}
    ```
  - Retirer l'import `SubjectRecordingGuide` si plus utilisé (le drawer utilise son propre renderer polymorphe, pas ce composant — à confirmer selon implémentation Story 1.2).

- [ ] **Task 3.2** : Vérifier qu'aucun autre consumer ne casse
  - Grep `SubjectRecordingGuide` dans `apps/web/src/` : seule occurrence restante attendue = `RecordingSession.tsx` (drawer pendant tournage), conservée intacte (ce n'est pas le scope).

**ACs :**

- [ ] AC 3.1 : Given un Sujet avec `Topic.recordingGuide` existant (dual-write legacy), when on visite la page, then le workspace N'AFFICHE PLUS la section flottante "Storytelling avec beats" au milieu — le contenu n'est accessible que via la carte format correspondante.
- [ ] AC 3.2 : Given `grep -n "SubjectRecordingGuide" apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx`, when exécuté, then 0 résultat.

## Additional Context

### Dependencies

- **Vaul** : déjà présent (`apps/web/package.json`) — utilisé pour Kabou mobile drawer et ResumeBanner potentiellement.
- **lucide-react** : déjà présent — on ajoute juste `Eye` ou équivalent pour le bouton "Voir le script complet".
- Pas de nouvelle dépendance.

### Design tokens

- Drawer background : `bg-card` avec ring border-border/50 (consistance Kabou panel).
- Preview : texte `text-xs text-muted-foreground leading-relaxed`, `▸` en `text-primary` ou `text-muted-foreground/80`.
- Bouton "Voir le script complet" : underline on hover, `text-xs text-muted-foreground hover:text-foreground`.

### Testing Strategy

Manual acceptance via navigateur sur le topic `cmo8oop5u001k42bsl5zngux4` (celui d'Antoine avec storytelling rempli). Cas à vérifier :
1. Ouverture du drawer depuis la carte "📖 Histoire" → 4 beats affichés correctement.
2. Resize du viewport pendant que le drawer est ouvert → switch bottom↔right propre.
3. Topic sans session (MATURE fresh) → preview montre narrativeAnchor bullets + CTA chat.
4. Section "Storytelling" middle-page ABSENTE après reload.

### Notes

- Ce spec est **dépendant de la refonte subject-session** (quick-spec `subject-session-refactor.md`, phases 1-10 livrées 2026-04-22).
- L'édition inline du script (modifier un beat, reformuler un bullet) est **volontairement out-of-scope** pour V1 — l'utilisateur passe par Kabou pour reformuler (`update_narrative_anchor` + `reshape_to_recording_script`). L'édition inline arrivera en V1.1 si demande utilisateur confirmée.
- Le drawer NE mute PAS la base (except re-sync) — c'est un viewer. Toute action éditoriale passe par des endpoints existants (reshape, chat tools).

---

## Équipe party mode ayant contribué

- 🎨 **Sally (UX)** — architecture du pattern A2+ drawer + preview polymorphe.
- 🏗️ **Winston (Architect)** — validation du no-new-entity + réutilisation Vaul.
- 📋 **John (PM)** — validation du JTBD "glance on Topic, act on Session".
- 📚 **Paige (Tech Writer)** — structuration de la spec.
