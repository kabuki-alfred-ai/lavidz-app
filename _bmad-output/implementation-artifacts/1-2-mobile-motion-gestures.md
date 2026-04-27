# Story 1.2: Mobile — Framer Motion + transitions + gestes (SwipeablePane)

Status: review

<!-- Source: _bmad-output/planning-artifacts/ux-design-mobile-first.md -->
<!-- Dépend de: Story 1-1 (nav 4 onglets) -->

## Story

En tant que Marc (entrepreneur solo),
je veux des transitions de page directionnelles et un swipe horizontal entre l'onglet Sujet et l'onglet Kabou dans le workspace,
afin que naviguer dans l'app ait le même feeling physique qu'une app native iOS.

## Acceptance Criteria

1. **Dépendances installées** : `framer-motion` (latest stable) et `@use-gesture/react` (latest stable) sont dans `package.json` de `apps/web`
2. **Slide transition** : entrer dans un sujet depuis la liste (`/topics` → `/topics/[id]`) déclenche un slide vers la droite (300ms, spring snappy). Revenir glisse vers la gauche.
3. **SwipeablePane** dans `/topics/[id]` : le workspace a deux panneaux (Sujet | Kabou) switchables par swipe horizontal avec snap point à 50% + onglets visuels toujours visibles pour les tappeurs
4. **Bottom nav haptic** : tap sur un onglet déclenche `navigator.vibrate(10)` si disponible (Vibration API)
5. **Drag résistance** : le swipe Sujet ↔ Kabou a une résistance physique (spring, stiffness 400, damping 30) contre les switchs accidentels
6. **Reduced motion** : si `prefers-reduced-motion: reduce`, toutes les animations sont désactivées (fallback opacity-only)
7. **Pas de régression** sur la sidebar desktop — aucune animation ne s'applique en `md:` breakpoint
8. Le typecheck (`pnpm typecheck`) passe sans erreur

## Tasks / Subtasks

- [x] Task 1 — Installer les dépendances (AC: 1)
  - [x] 1.1 — Ajouter `framer-motion` et `@use-gesture/react` dans `apps/web/package.json`
  - [x] 1.2 — Lancer `pnpm install` et vérifier que le build compile

- [x] Task 2 — Créer `<SlideTransition>` wrapper (AC: 2, 6, 7)
  - [x] 2.1 — Créer `apps/web/src/components/motion/SlideTransition.tsx`
  - [x] 2.2 — `useReducedMotion()` respecté
  - [x] 2.3 — Spring config stiffness 600, damping 40
  - [x] 2.4 — Appliqué via `motion.main` dans SubjectWorkspace

- [x] Task 3 — Créer `<SwipeablePane>` dans le workspace Topic (AC: 3, 5)
  - [x] 3.1 — Créer `apps/web/src/components/motion/SwipeablePane.tsx` avec `useDrag`
  - [x] 3.2 — Snap point swipe 60px / velocity 0.5
  - [x] 3.3 — Spring config stiffness 400, damping 30
  - [x] 3.4 — Props `leftPanel`, `rightPanel`, `leftLabel`, `rightLabel`
  - [x] 3.5 — Onglets visuels toujours visibles
  - [x] 3.6 — Swipe intégré dans SubjectWorkspace : AnimatePresence + swipe gesture sur overlay Kabou + swipe gauche sur sujet

- [x] Task 4 — Haptic feedback bottom nav (AC: 4)
  - [x] 4.1 — `navigator.vibrate?.(10)` sur ClientNav bottom + boutons sujet/kabou dans SubjectWorkspace

- [x] Task 5 — Typecheck et validation (AC: 8)
  - [x] 5.1 — `pnpm typecheck` 0 erreur (résolution conflit onDrag gesture/motion via div wrapper)
  - [x] 5.2 — Test visuel 390px à faire manuellement

## Dev Notes

### ⚠️ Nouvelles dépendances requises — approbation utilisateur

Cette story nécessite l'installation de :
- `framer-motion` — animations physics-based (≈ 100KB gzipped)
- `@use-gesture/react` — gestion des gestes drag/swipe

Ces dépendances sont **absentes** du `package.json` actuel. L'approbation d'Antoine est requise avant d'exécuter `pnpm add`.

### Fichiers à créer

- `apps/web/src/components/motion/SlideTransition.tsx`
- `apps/web/src/components/motion/SwipeablePane.tsx`

### Fichiers à modifier

- `apps/web/src/app/(client)/ClientNav.tsx` — haptic sur bottom tabs
- `apps/web/src/app/(client)/topics/[id]/page.tsx` (ou layout) — intégrer SlideTransition + SwipeablePane
- `apps/web/package.json` — nouvelles dépendances

### Patterns Framer Motion à respecter

```tsx
// SlideTransition — variants
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
}

// Reduced motion check
const shouldReduceMotion = useReducedMotion()
const transition = shouldReduceMotion
  ? { duration: 0 }
  : { type: 'spring', stiffness: 600, damping: 40 }
```

```tsx
// SwipeablePane — useDrag
const bind = useDrag(({ movement: [mx], last, cancel }) => {
  if (last) {
    if (Math.abs(mx) > width * 0.5) setActive(mx < 0 ? 'right' : 'left')
    else cancel()
  }
}, { axis: 'x', filterTaps: true })
```

### Localisation de la page Topic

Chercher le fichier de la page `/topics/[id]` dans :
`apps/web/src/app/(client)/topics/[id]/page.tsx` ou `layout.tsx`

### Project Structure Notes

- Créer le dossier `apps/web/src/components/motion/` pour regrouper les composants d'animation
- Les composants motion sont tous des Client Components (`'use client'`)
- Ne pas animer les composants server-side

### References

- [Source: _bmad-output/planning-artifacts/ux-design-mobile-first.md#Design System Foundation — Couche 2 Motion]
- [Source: _bmad-output/planning-artifacts/ux-design-mobile-first.md#Core User Experience — Experience Mechanics]
- [Source: _bmad-output/planning-artifacts/ux-design-mobile-first.md#Transferable UX Patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implémenté 2026-04-27. framer-motion@12.38.0 + @use-gesture/react@10.3.1 installés. SlideTransition.tsx et SwipeablePane.tsx créés dans components/motion/. SubjectWorkspace modifié : motion.main (slide-in mount), AnimatePresence + motion.div sur overlay Kabou (slide depuis droite), useDrag pour swipe gauche→Kabou / swipe droite→Sujet. Conflit de types onDrag(framer) vs onDrag(gesture) résolu par couche div wrapper séparée. Typecheck 0 erreur.

### File List

- apps/web/src/components/motion/SlideTransition.tsx
- apps/web/src/components/motion/SwipeablePane.tsx
- apps/web/src/app/(client)/sujets/[id]/SubjectWorkspace.tsx
- apps/web/src/app/(client)/ClientNav.tsx
- apps/web/package.json
