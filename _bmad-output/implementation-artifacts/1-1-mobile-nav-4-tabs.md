# Story 1.1: Mobile — Navigation 4 onglets + page Moi + safe areas

Status: review

<!-- Source: _bmad-output/planning-artifacts/ux-design-mobile-first.md -->

## Story

En tant que Marc (entrepreneur solo),
je veux une bottom nav mobile à 4 onglets clairs et une page "Moi" regroupant mon identité créative,
afin de naviguer sur l'app sans effort cognitif et de retrouver Brand Kit / Mon Univers / Compte en un seul endroit.

## Acceptance Criteria

1. La bottom nav mobile affiche exactement **4 onglets** : Accueil · Sujets · Projets · Moi (icônes : Home · FileText · FolderOpen · User)
2. Brand Kit (`/brand-kit`), Mon Univers (`/mon-univers`) et Compte (`/profile`) sont **supprimés** de la bottom nav et accessibles uniquement depuis `/moi`
3. La page `/moi` existe et contient trois liens visibles vers `/brand-kit`, `/mon-univers`, `/profile`
4. La hauteur de la bottom nav est fixée à **64px** via la variable CSS `--nav-height: 64px`
5. Le safe area iOS est appliqué au container de la bottom nav : `padding-bottom: env(safe-area-inset-bottom)`
6. Les pages scrollables dans `(client)` ont un `padding-bottom` qui tient compte de `--nav-height + env(safe-area-inset-bottom)` pour que le contenu ne soit pas masqué par la nav
7. L'onglet actif affiche l'icône en `text-primary` et le label en `font-medium` — les onglets inactifs sont `text-muted-foreground`
8. La sidebar desktop reste inchangée (6 items + sections admin)
9. Le `ThesisIndicatorDot` suit le lien `/mon-univers`, maintenant dans la page Moi (pas dans la nav)
10. Le typecheck Next.js (`pnpm typecheck`) passe sans erreur

## Tasks / Subtasks

- [x] Task 1 — Réduire BASE_ITEMS à 4 dans ClientNav.tsx (AC: 1, 2, 7)
  - [x] 1.1 — Modifier `BASE_ITEMS` : garder Accueil, Sujets, Projets ; remplacer Brand Kit + Mon Univers + Compte par un seul item `{ href: '/moi', label: 'Moi', icon: User }`
  - [x] 1.2 — Vérifier que la `variant="bottom"` rend exactement 4 onglets avec la bonne logique `isActive`
  - [x] 1.3 — Déplacer la logique `ThesisIndicatorDot` hors de la bottom nav (sera affichée dans la page Moi)

- [x] Task 2 — Créer la page `/moi` (AC: 3, 9)
  - [x] 2.1 — Créer `apps/web/src/app/(client)/moi/page.tsx` avec titre "Moi" et trois cards/liens : Brand Kit (`/brand-kit`), Mon Univers (`/mon-univers`), Profil (`/profile`)
  - [x] 2.2 — Afficher le `ThesisIndicatorDot` à côté du lien Mon Univers dans cette page
  - [x] 2.3 — La page doit être accessible sans auth supplémentaire (déjà protégée par le layout `(client)`)

- [x] Task 3 — Appliquer safe areas et variable CSS --nav-height (AC: 4, 5, 6)
  - [x] 3.1 — Ajouter `--nav-height: 64px` dans le CSS global (`apps/web/src/app/globals.css` ou équivalent)
  - [x] 3.2 — Appliquer sur le container bottom nav dans `(client)/layout.tsx` : `style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}` ou via classe Tailwind `pb-[env(safe-area-inset-bottom)]`
  - [x] 3.3 — Vérifier que `<main>` dans `(client)/layout.tsx` a `pb-[calc(var(--nav-height)+env(safe-area-inset-bottom))]` sur mobile (remplacer le `pb-20` actuel)
  - [x] 3.4 — Ajouter `viewport-fit=cover` dans le metadata Next.js si absent (vérifie `app/layout.tsx`)

- [x] Task 4 — Typecheck et validation (AC: 10)
  - [x] 4.1 — Lancer `pnpm typecheck` depuis la racine et corriger toute erreur introduite
  - [x] 4.2 — Vérifier visuellement sur un viewport 390px (iPhone 15) que les 4 onglets tiennent sans overflow

## Dev Notes

### Fichiers à modifier

- `apps/web/src/app/(client)/ClientNav.tsx` — reducer BASE_ITEMS, ajuster bottom variant
- `apps/web/src/app/(client)/layout.tsx` — safe area sur bottom nav container + pb du main
- `apps/web/src/app/layout.tsx` — ajouter `viewport-fit=cover` si absent
- `apps/web/src/app/globals.css` (ou équivalent) — ajouter `--nav-height: 64px`

### Fichiers à créer

- `apps/web/src/app/(client)/moi/page.tsx` — page Moi avec liens Brand Kit / Mon Univers / Profil

### Contraintes architecture

- **Ne pas toucher** à la sidebar desktop (`variant="sidebar"`) — elle garde ses 6 items
- **Ne pas modifier** la logique auth/redirect dans `(client)/layout.tsx`
- **Pas de nouvelle dépendance** dans cette story — Framer Motion et @use-gesture sont en Story 1-2
- La page `/moi` est un Server Component simple (pas besoin de 'use client')
- Le `ThesisIndicatorDot` est un Client Component — l'importer normalement dans la page Moi

### Patterns à respecter

```tsx
// Pattern bottom nav actif (existant, à conserver)
const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

// Pattern safe area (à appliquer)
// Dans layout.tsx sur le div bottom nav :
className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-lg z-40"
style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}

// Pattern pb main (remplacer pb-20 par) :
className="... pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0"
```

### Notes sur ThesisIndicatorDot

Actuellement dans `NavLink` la condition `showThesisDot = href === '/mon-univers'` est liée à la nav.
Après cette story, `/mon-univers` n'est plus dans la nav → ce code disparaît.
Dans la page Moi, importer `ThesisIndicatorDot` directement à côté du lien Mon Univers.

### Tests

Pas de test automatisé requis pour cette story (composants UI + routing Next.js).
Validation : typecheck + vérification visuelle 390px.

### Project Structure Notes

- App Router Next.js — les pages sont dans `apps/web/src/app/(client)/`
- Le layout `(client)` wraps toutes les pages utilisateur avec auth check
- Naming : `page.tsx` pour les pages, pas de barrel index

### References

- [Source: apps/web/src/app/(client)/ClientNav.tsx] — nav actuelle 6 items
- [Source: apps/web/src/app/(client)/layout.tsx] — layout avec sidebar + bottom nav
- [Source: _bmad-output/planning-artifacts/ux-design-mobile-first.md#Architecture de navigation — 4 onglets]
- [Source: _bmad-output/planning-artifacts/ux-design-mobile-first.md#Design System Foundation]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implémenté 2026-04-27. BASE_ITEMS réduit à 4 (Accueil/Sujets/Projets/Moi). ThesisIndicatorDot retiré de ClientNav, déplacé dans /moi/page.tsx. Safe areas appliquées via style inline + CSS var. viewport-fit=cover ajouté dans metadata. Typecheck 0 erreur.

### File List

- apps/web/src/app/(client)/ClientNav.tsx
- apps/web/src/app/(client)/layout.tsx
- apps/web/src/app/(client)/moi/page.tsx
- apps/web/src/app/layout.tsx
- apps/web/src/app/globals.css
