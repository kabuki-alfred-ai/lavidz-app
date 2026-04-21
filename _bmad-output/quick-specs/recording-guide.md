# Quick Spec — Fil conducteur d'enregistrement (recordingGuide)

**Date :** 2026-04-21
**Sujet page concernée :** `/sujets/[id]` (SubjectWorkspace)
**Issue :** Pendant le tournage, le créateur n'a ni script ni key points issus du travail fait avec Kabou. Le raccord entre "construire le sujet" et "enregistrer" est cassé.

## Objectif produit

Ajouter un **fil conducteur** qui :
1. Démarre en ébauche (3-5 bullets génériques) pendant la phase SEED/EXPLORING.
2. Est enrichi au fur et à mesure par Kabou via les conversations du SubjectKabouPanel.
3. Une fois un `contentFormat` choisi sur la session, se **reformate automatiquement** vers une structure adaptée au format (mythe/réalité, Q/R, storytelling, hot take, daily tip, téléprompteur).
4. Reste visible côté tournage (sidebar sur `RecordingSession`) pour servir d'ancre mentale.

## Modèle de données

```prisma
model Topic {
  // ... existant
  recordingGuide Json?
}
```

Discriminant côté TS :
```ts
type RecordingGuide =
  | { kind: 'draft';           bullets: string[] /* 3-5 */ }
  | { kind: 'myth_vs_reality'; pairs: Array<{ myth: string; reality: string }> }
  | { kind: 'qa';              items: Array<{ question: string; keyPoints: string[] }> }
  | { kind: 'storytelling';    beats: Array<{ label: 'setup'|'tension'|'climax'|'resolution'; text: string }> }
  | { kind: 'hot_take';        thesis: string; arguments: string[]; punchline: string }
  | { kind: 'daily_tip';       problem: string; tip: string; application: string }
  | { kind: 'teleprompter';    script: string }  // réutilise teleprompterScript existant
  // Traçabilité : conserver le draft d'origine pour permettre revert
  sourceDraft?: { bullets: string[] }
```

## Tools Kabou à ajouter (apps/web/src/app/api/chat/route.ts)

1. **`update_recording_guide_draft`** — disponible en état SEED/EXPLORING. Input: `{ bullets: string[] }`. Kabou met à jour au fil des échanges quand un point ressort.
2. **`reshape_recording_guide_to_format`** — disponible quand `topic.contentFormat` est set. Input: `{ format: ContentFormat }`. Prompt côté backend qui convertit le draft.bullets → variant matchant. Conserve `sourceDraft`.

Les deux tools passent par `/api/ai/topics/:id` PUT sur le backend NestJS (nouvelle endpoint).

## UI

- **Nouveau composant** : `apps/web/src/components/subject/SubjectRecordingGuide.tsx`. Switch sur `kind`, 6 renderers minimaux (cartes/listes/timeline).
- **Intégration** : dans `SubjectWorkspace.tsx`, entre `SubjectHookSection` et `SubjectPreflight`, uniquement si `creativeState` ∈ {EXPLORING, MATURE, SCHEDULED}.
- **Sidebar tournage** : version compacte du même composant rendue dans `RecordingSession.tsx`, passée via prop `recordingGuide` depuis la session.

## Déclenchement du reshape

Quand l'utilisateur (ou Kabou via tool `create_recording_session`) définit le `contentFormat` d'une session attachée au topic, on **propose** (pas automatique) à l'utilisateur : "Adapter ton fil conducteur au format X ?" avec un bouton. Évite la surprise de voir le draft remplacé.

## Integration mémoire Kabou

Le `briefLooksRefined` actuel dans [creative-state.ts](apps/web/src/lib/creative-state.ts) peut aussi considérer la présence d'un `recordingGuide.draft` avec ≥ 3 bullets comme signal EXPLORING → penser à étendre.

## Hors scope (v1)

- Ne pas coupler avec le `teleprompterScript` existant (laisser les deux systèmes cohabiter — le format TELEPROMPTER réutilisera `script` du guide mais on garde `teleprompterScript` comme fallback).
- Pas de versioning / historique.
- Pas d'édition manuelle ultra-riche (juste bullets simples en v1, édition fine plus tard).

## Checklist implémentation

- [x] Migration Prisma : ajouter `recordingGuide Json?` sur `Topic`.
- [x] Types TS dans un fichier partagé `apps/web/src/lib/recording-guide.ts`.
- [x] Tool `update_recording_guide_draft` dans `chat/route.ts`.
- [x] Tool `reshape_recording_guide_to_format` dans `chat/route.ts`.
- [x] Endpoint NestJS `PUT /api/ai/topics/:id` qui accepte `recordingGuide`.
- [x] Prompt backend pour reshape (conversion draft→variant).
- [x] Composant `SubjectRecordingGuide.tsx` avec 6 renderers.
- [x] Intégration dans `SubjectWorkspace.tsx`.
- [x] Sidebar compacte dans `RecordingSession.tsx`.
- [x] Étendre `briefLooksRefined` pour considérer `recordingGuide`.
- [x] Ajouter tools mutateurs à la liste `MUTATING_TOOLS` dans `SubjectKabouPanel.tsx` pour le refresh auto.

Estimation : 5-6h de dev incluant tests smoke.

## Statut : Implementation Complete (2026-04-21)

Build :
- Migration `20260421000001_add_topic_recording_guide` appliquée (prisma migrate deploy)
- `prisma generate` ok
- `tsc --noEmit` ok côté API et Web
