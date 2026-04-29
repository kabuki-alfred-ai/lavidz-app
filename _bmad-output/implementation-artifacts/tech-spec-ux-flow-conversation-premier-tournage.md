---
title: 'Flow UX — Conversation d ouverture → Premier tournage (LinkedIn)'
slug: 'ux-flow-conversation-premier-tournage'
created: '2026-04-28'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Next.js 15 App Router (apps/web)'
  - 'NestJS (apps/api)'
  - 'Prisma + PostgreSQL (packages/database)'
  - 'React client components, hooks only'
  - '@ai-sdk/react useChat (DefaultChatTransport)'
  - 'Vercel AI SDK generateObject — wrappé dans apps/api/src/modules/ai/providers/ai-sdk.ts (normalise quotes Gemini)'
  - 'google gemini-3.1-flash-lite-preview via @ai-sdk/google'
  - 'Radix UI + Tailwind (components/ui)'
files_to_modify:
  - 'packages/database/prisma/schema.prisma'
  - 'apps/web/src/app/(onboarding)/bienvenue/OnboardingView.tsx'
  - 'apps/web/src/app/api/onboarding/complete/route.ts'
  - 'apps/web/src/app/api/chat/route.ts'
  - 'apps/web/src/app/(client)/home/page.tsx'
  - 'apps/web/src/app/(client)/home/HomeBrief.tsx'
  - 'apps/web/src/components/session/NarrativeAnchorSticky.tsx'
  - 'apps/web/src/components/session/RecordingSession.tsx'
  - 'apps/web/src/app/(client)/home/HomeKabouEntry.tsx (NEW)'
  - 'apps/web/src/components/chat/LinkedinProposalCard.tsx (NEW)'
code_patterns:
  - 'JSON fields pour données flexibles sur Topic (hooks, sources, recordingGuide, narrativeAnchor)'
  - 'useChat + DefaultChatTransport avec body() injectant topicId/threadId'
  - 'Tool calls Kabou : create_topic, update_narrative_anchor, mark_topic_ready, create_recording_session'
  - 'System prompt modulaire en ~10 sections dans /api/chat/route.ts'
  - 'generateObject wrappé — toujours utiliser le wrapper, jamais ai.generateObject() direct'
  - 'NarrativeAnchorSticky : overlay bottom-left z-30, max 3 bullets, déjà collapsible'
test_patterns:
  - 'Tests manuels — pas de test unitaire automatisé requis pour ce scope'
---

# Tech-Spec: Flow UX — Conversation d'ouverture → Premier tournage (LinkedIn)

**Created:** 2026-04-28

## Overview

### Problem Statement

L'entrepreneur cible a le syndrome de la feuille blanche. Le flow actuel lui demande de créer manuellement un "Sujet" — c'est une feuille blanche supplémentaire. La home page affiche `HomeBrief` sans guider vers le tournage. Il n'existe pas de logique de coaching pré-tournage ni de sélection de mode d'enregistrement. L'expérience ne correspond pas aux principes établis de création de contenu LinkedIn (hook, opinion tranchée, story, expertise).

### Solution

Kabou remplace la home par une **conversation d'ouverture** (1 question ouverte) qui :
1. Détecte le mood de l'entrepreneur (Challenger / Authentique / Expert)
2. Génère automatiquement un Sujet formulé
3. Propose un Format LinkedIn adapté (parmi 4)
4. Propose un mode de tournage (Libre coaché / Script de poche)
5. Donne 1 instruction de coaching + exemple sur-mesure avant de filmer
6. Affiche un overlay "Script de poche" (3 bullets) pendant la session si ce mode est choisi

### Scope

**In Scope :**
- Onboarding `/bienvenue` : remplacer Q3 (différenciateur → objectif contenu)
- Home `/` : `HomeKabouEntry` remplace `HomeBrief` pour les nouveaux users (0 sujets) ; CTA "Nouvelle vidéo" pour returning users
- Kabou : system prompt + tool `propose_linkedin_video` (mood detection + sujet + format)
- Kabou : chemin "Autre chose" → question fermée 2 choix précis
- Post-Kabou : sélection mode de tournage dans `LinkedinProposalCard`
- Session : coaching pré-tournage (1 instruction + exemple sur-mesure)
- Session : overlay Script de poche via `NarrativeAnchorSticky` existant
- Création automatique du Topic en DB après validation
- Champ `linkedinContext Json?` sur Topic

**Out of Scope :**
- Montage automatique
- Modes Questions guidées / Storytelling
- Publication LinkedIn directe
- Profiling progressif des piliers (V1.1)
- Returning user memory / question d'ouverture variée (V1.1)
- Post-recording analysis redesign (existe déjà)

---

## Context for Development

### Codebase Patterns

**Onboarding**
- 3 questions voice+text dans `OnboardingView.tsx` — clés : `activity`, `audience`, `differentiator`
- Sauvegarde via `POST /api/onboarding/complete` → `entrepreneurProfile.businessContext.onboarding`
- Q3 clé actuelle : `differentiator` → à remplacer par `objective`

**Kabou Chat**
- `useChat` (@ai-sdk/react) + `DefaultChatTransport` — endpoint `POST /api/chat`
- `body()` injecte `{ threadId, topicId }` — ajouter `context: 'opening'` pour la conversation d'ouverture
- Tool calls existants : `create_topic`, `update_topic_brief`, `mark_topic_ready`, `update_narrative_anchor`, `create_recording_session`, `commit_editorial_plan`
- System prompt modulaire en ~10 sections dans `apps/web/src/app/api/chat/route.ts`
- Voix Kabou : `KABOU_SYSTEM_PREAMBLE` dans `apps/web/src/lib/kabou-voice.ts`
- Modèle : `google('gemini-3.1-flash-lite-preview')`

**generateObject**
- Toujours utiliser le wrapper custom dans `apps/api/src/modules/ai/providers/ai-sdk.ts` — normalise les quotes Gemini

**Session Recording**
- Composant : `apps/web/src/components/session/RecordingSession.tsx`
- Phases : intro → check → reading → countdown → recording → review → uploading → done
- `NarrativeAnchorSticky` : overlay bottom-left z-30, max 3 bullets collapsible — réutilisable pour Script de poche sans nouveau composant

**Topic Model**
- Champs JSON flexibles existants : `hooks`, `sources`, `recordingGuide` (legacy), `narrativeAnchor` (source of truth)
- Nouveau champ à ajouter : `linkedinContext Json?`
- Création topic : `POST /api/topics` → `{ name, brief, pillar, sourceThreadId, calendarEntryId }`

**HomeBrief**
- Data : `GET /api/home/state` → `{ totalActiveSubjects, nextStep, ... }`
- `totalActiveSubjects === 0` → affiche `FIRST_SUBJECT_PROMPTS` hardcodés → à remplacer par `HomeKabouEntry`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `apps/web/src/app/(onboarding)/bienvenue/OnboardingView.tsx` | Modifier Q3 : differentiator → objective |
| `apps/web/src/app/api/onboarding/complete/route.ts` | Adapter validation + storage pour objective |
| `apps/web/src/app/(client)/home/page.tsx` | Afficher HomeKabouEntry selon totalActiveSubjects |
| `apps/web/src/app/(client)/home/HomeBrief.tsx` | Ajouter bouton "Nouvelle vidéo" → showKabouEntry |
| `apps/web/src/app/api/chat/route.ts` | Ajouter tool propose_linkedin_video + section opening |
| `apps/web/src/components/session/NarrativeAnchorSticky.tsx` | Ajouter prop pocketScriptBullets |
| `apps/web/src/components/session/RecordingSession.tsx` | Coaching tip + wire Script de poche |
| `packages/database/prisma/schema.prisma` | Ajouter linkedinContext Json? sur Topic |
| `apps/web/src/app/(client)/home/HomeKabouEntry.tsx` | NEW — conversation d'ouverture |
| `apps/web/src/components/chat/LinkedinProposalCard.tsx` | NEW — rendu tool propose_linkedin_video |

### Technical Decisions

- **Conversation d'ouverture** : `HomeKabouEntry` est un composant client qui utilise `useChat` avec `body: () => ({ context: 'opening' })`. La question d'ouverture est affichée statiquement (pas de round-trip IA). Kabou répond à la première réponse de l'user et appelle `propose_linkedin_video`.

- **propose_linkedin_video tool** : Nouveau tool Kabou dans `/api/chat/route.ts`. Retourne `{ mood, moodLabel, sujet, format, formatLabel, formatDuration, coachingTip, coachingExample, pocketScriptBullets }`. Rendu par `LinkedinProposalCard` avec boutons "Oui, on y va" / "Autre chose".

- **linkedinContext JSON sur Topic** :
  ```json
  {
    "mood": "challenger | authentique | expert",
    "moodLabel": "🔥 Challenger | ❤️ Authentique | 🎯 Expert",
    "format": "opinion_courte | story | expertise | thought_leadership",
    "formatLabel": "string",
    "formatDuration": "string",
    "recordingMode": "coached | pocket_script",
    "coachingTip": "string",
    "coachingExample": "string",
    "pocketScriptBullets": ["string", "string", "string"]
  }
  ```

- **Script de poche** : `NarrativeAnchorSticky` reçoit `pocketScriptBullets?: string[]`. Si défini, utilise ces bullets à la place de `narrativeAnchor.bullets`. Aucun nouveau composant.

- **Onboarding Q3** : Clé `differentiator` → `objective`. Prompt : *"Avec ton contenu, tu veux principalement attirer de nouveaux clients, construire une audience, ou partager ta vision ?"* Stocké dans `businessContext.onboarding.objective`.

- **Coaching tip dans session** : Affiché en phase `intro` si `topic.linkedinContext?.coachingTip` existe. Bloc simple : texte tip + exemple en italique. Pas d'interaction.

---

## Implementation Plan

### Tasks

- [x] **Task 1 : Schema — Ajouter linkedinContext sur Topic**
  - File : `packages/database/prisma/schema.prisma`
  - Action : Ajouter `linkedinContext Json?` au modèle `Topic` (après `narrativeAnchor`)
  - Ensuite : `npx prisma migrate dev --name add-topic-linkedin-context`

- [x] **Task 2 : Onboarding — Modifier Q3 (frontend)**
  - File : `apps/web/src/app/(onboarding)/bienvenue/OnboardingView.tsx`
  - Action : Dans le tableau `QUESTIONS`, remplacer l'entrée index 2 :
    - `key: 'differentiator'` → `key: 'objective'`
    - `prompt: "Et ce qui te distingue des 10 autres qui font pareil ?"` → `prompt: "Avec ton contenu, tu veux principalement attirer de nouveaux clients, construire une audience, ou partager ta vision ?"`
  - Action : Mettre à jour le type `answers` : remplacer `differentiator: string` par `objective: string`
  - Note : conserver le même mode voice/text, aucun autre changement UX

- [x] **Task 3 : Onboarding — Modifier Q3 (API)**
  - File : `apps/web/src/app/api/onboarding/complete/route.ts`
  - Action : Remplacer la clé `differentiator` par `objective` dans la validation du body et dans le storage `businessContext.onboarding`
  - Note : `objective` est nullable (comme `differentiator` l'était), validation inchangée

- [x] **Task 4 : Kabou — Nouveau tool `propose_linkedin_video`**
  - File : `apps/web/src/app/api/chat/route.ts`
  - Action : Ajouter le tool dans la map `tools` :
    ```ts
    propose_linkedin_video: tool({
      description: 'Propose une vidéo LinkedIn après avoir détecté le mood depuis la conversation d\'ouverture. Appeler dès qu\'on a assez de contexte (1-2 échanges max).',
      parameters: z.object({
        mood: z.enum(['challenger', 'authentique', 'expert']),
        moodLabel: z.string().describe('ex: "🔥 Challenger"'),
        sujet: z.string().describe('Le sujet formulé comme titre de vidéo LinkedIn accrocheur'),
        format: z.enum(['opinion_courte', 'story', 'expertise', 'thought_leadership']),
        formatLabel: z.string().describe('ex: "Opinion courte"'),
        formatDuration: z.string().describe('ex: "45 secondes"'),
        coachingTip: z.string().describe('1 instruction coaching pré-tournage'),
        coachingExample: z.string().describe('Exemple concret généré depuis le sujet réel'),
        pocketScriptBullets: z.array(z.string()).length(3).describe('3 bullets pour le Script de poche'),
      }),
      execute: async (args) => ({ ...args, status: 'pending_validation' }),
    })
    ```
  - Action : Ajouter `'propose_linkedin_video'` dans le map `KABOU_TOOL_EVENT` avec event approprié

- [x] **Task 5 : Kabou — Section "opening" dans le system prompt**
  - File : `apps/web/src/app/api/chat/route.ts`
  - Action : Détecter `context === 'opening'` dans les paramètres du body (à extraire du request)
  - Action : Si `context === 'opening'`, injecter cette section dans le system prompt (après `KABOU_SYSTEM_PREAMBLE`) :
    ```
    ## Mode : Conversation d'ouverture LinkedIn

    Tu es en mode "ouverture créative". L'user vient de répondre à la question d'ouverture.
    
    Ton objectif : analyser sa réponse pour détecter son mood (challenger/authentique/expert),
    formuler un sujet LinkedIn accrocheur, et appeler immédiatement `propose_linkedin_video`.
    
    Règles :
    - Ne pose PAS de question supplémentaire avant d'appeler le tool (max 1 relance si réponse < 5 mots)
    - Le sujet formulé doit sonner comme un titre LinkedIn — pas une description neutre
    - Si l'user dit "autre chose" après la proposition : demande UNIQUEMENT "Tu veux parler d'un autre sujet, ou le même dans un style différent ?"
    - Mood challenger : mots forts, opinion, frustration → format opinion_courte
    - Mood authentique : histoire personnelle, "j'ai réalisé", "un client" → format story
    - Mood expert : explication, framework, "voilà comment" → format expertise ou thought_leadership
    
    Coaching par format :
    - opinion_courte : "Commence directement par ton opinion. La première phrase doit être la chose la plus forte."
    - story : "Commence au milieu de l'histoire — pas depuis le début."
    - expertise/thought_leadership : "Commence par le résultat, pas par l'explication."
    ```

- [x] **Task 6 : Nouveau composant `LinkedinProposalCard`**
  - File : `apps/web/src/components/chat/LinkedinProposalCard.tsx` (NEW)
  - Action : Composant client qui reçoit le résultat du tool `propose_linkedin_video` et rend :
    - Badge mood (ex: "🔥 Challenger")
    - Sujet formulé en titre prominent
    - Badge format + durée (ex: "Opinion courte · 45s")
    - Toggle mode de tournage : "Libre coaché" (défaut) / "Script de poche"
    - Bouton primaire "Oui, on y va" → `onValidate(recordingMode)`
    - Bouton secondaire "Autre chose" → envoie le message "Autre chose" dans le chat
  - Note : suivre le pattern des autres `ToolResultCard` existants dans le chat

- [x] **Task 7 : Nouveau composant `HomeKabouEntry`**
  - File : `apps/web/src/app/(client)/home/HomeKabouEntry.tsx` (NEW)
  - Action : Composant client avec `useChat` :
    ```ts
    const { messages, input, handleInputChange, handleSubmit } = useChat({
      transport: new DefaultChatTransport({
        url: '/api/chat',
        body: () => ({ context: 'opening' }),
      }),
    })
    ```
  - Action : Afficher en haut, statiquement, la question d'ouverture :
    > *"Qu'est-ce qui t'a le plus animé cette semaine — une conversation, une frustration, une victoire ?"*
  - Action : Input text + bouton send en dessous
  - Action : Afficher les messages Kabou + `LinkedinProposalCard` quand le tool `propose_linkedin_video` est appelé
  - Action : Quand `onValidate(recordingMode)` est appelé depuis `LinkedinProposalCard` :
    1. Appel `POST /api/topics` avec `{ name: sujet, brief: moodLabel + ' · ' + formatLabel }`
    2. Appel `PATCH /api/topics/:id` pour sauvegarder `linkedinContext` complet
    3. Router push vers `/sujets/:id` (la session sera créée depuis la page sujet comme d'habitude)
  - Note : utiliser le pattern visuel de `SubjectKabouPanel` pour la cohérence

- [x] **Task 8 : Home page — Brancher HomeKabouEntry**
  - File : `apps/web/src/app/(client)/home/page.tsx`
  - Action : Passer `totalActiveSubjects` en prop à `HomeBrief` (déjà disponible depuis `/api/home/state`)
  - Action : Si `totalActiveSubjects === 0` → rendre `<HomeKabouEntry />` à la place de `<HomeBrief />`

- [x] **Task 9 : HomeBrief — Ajouter CTA "Nouvelle vidéo"**
  - File : `apps/web/src/app/(client)/home/HomeBrief.tsx`
  - Action : Convertir en composant client (`'use client'`)
  - Action : Ajouter state `const [showKabouEntry, setShowKabouEntry] = useState(false)`
  - Action : Si `showKabouEntry` → rendre `<HomeKabouEntry />` en overlay fullscreen (fond noir/opaque, z-50)
  - Action : Remplacer le lien discret "Nouveau sujet" par un bouton visible "Nouvelle vidéo" → `setShowKabouEntry(true)`
  - Note : `HomeKabouEntry` doit avoir un bouton "×" pour fermer l'overlay → prop `onClose`

- [x] **Task 10 : NarrativeAnchorSticky — Prop pocketScriptBullets**
  - File : `apps/web/src/components/session/NarrativeAnchorSticky.tsx`
  - Action : Ajouter prop optionnelle `pocketScriptBullets?: string[]`
  - Action : Si `pocketScriptBullets` est défini et non vide → utiliser ces bullets à la place de `narrativeAnchor?.bullets`
  - Action : Si `pocketScriptBullets` → changer le label du composant de "Ton angle narratif" en "Script de poche"
  - Note : aucun autre changement — la logique collapse/expand reste identique

- [x] **Task 11 : RecordingSession — Coaching tip en phase intro**
  - File : `apps/web/src/components/session/RecordingSession.tsx`
  - Action : Lire `topic.linkedinContext` (déjà disponible dans les props topic)
  - Action : En phase `intro`, si `linkedinContext?.coachingTip` existe, afficher un bloc coaching :
    ```
    [icône 🎯] [coachingTip]
    ex : "[coachingExample]"
    ```
  - Note : bloc simple, style card, placé avant le bouton "Je suis prêt" — pas d'interaction

- [x] **Task 12 : RecordingSession — Wire Script de poche**
  - File : `apps/web/src/components/session/RecordingSession.tsx`
  - Action : Lire `topic.linkedinContext.recordingMode` et `topic.linkedinContext.pocketScriptBullets`
  - Action : Passer `pocketScriptBullets` à `NarrativeAnchorSticky` si `recordingMode === 'pocket_script'`
    ```tsx
    <NarrativeAnchorSticky
      narrativeAnchor={topic.narrativeAnchor}
      pocketScriptBullets={
        topic.linkedinContext?.recordingMode === 'pocket_script'
          ? topic.linkedinContext.pocketScriptBullets
          : undefined
      }
    />
    ```

---

### Acceptance Criteria

- [x] **AC1 — Onboarding Q3 modifié :** Given un nouvel user complète l'onboarding, when il répond à Q3, then la réponse est stockée dans `businessContext.onboarding.objective` (pas `differentiator`) et le prompt affiché est la question sur l'objectif contenu.

- [x] **AC2 — HomeKabouEntry pour nouveau user :** Given un user avec 0 sujets arrive sur la home, when la page se charge, then `HomeKabouEntry` est affiché (pas `HomeBrief`) avec la question d'ouverture visible statiquement.

- [x] **AC3 — CTA returning user :** Given un user avec ≥1 sujet est sur la home, when il clique "Nouvelle vidéo", then `HomeKabouEntry` s'ouvre en overlay fullscreen avec un bouton "×" pour fermer.

- [x] **AC4 — Mood detection + proposition :** Given un user répond à la question d'ouverture, when Kabou traite la réponse (max 2 échanges), then il appelle `propose_linkedin_video` et `LinkedinProposalCard` s'affiche avec : mood label, sujet formulé, format + durée.

- [x] **AC5 — Mood exposé :** Given une proposition est affichée, when l'user lit la `LinkedinProposalCard`, then le mood détecté est visible (badge "🔥 Challenger" / "❤️ Authentique" / "🎯 Expert") — jamais caché.

- [x] **AC6 — Validation + création Topic :** Given `LinkedinProposalCard` est affichée, when l'user clique "Oui, on y va", then un Topic est créé en DB avec le sujet comme `name` et `linkedinContext` populé (mood, format, recordingMode, coachingTip, coachingExample, pocketScriptBullets).

- [x] **AC7 — Sélection mode de tournage :** Given la proposition est visible, when l'user toggle entre "Libre coaché" et "Script de poche" avant de valider, then `linkedinContext.recordingMode` reflète son choix après création du Topic.

- [x] **AC8 — Chemin "Autre chose" :** Given la proposition est affichée, when l'user clique "Autre chose", then Kabou envoie uniquement : *"Tu veux parler d'un autre sujet, ou le même dans un style différent ?"* — pas de question ouverte.

- [x] **AC9 — Coaching tip en session :** Given un Topic avec `linkedinContext.coachingTip`, when la session recording s'ouvre en phase intro, then le bloc coaching (tip + exemple sur-mesure) est visible avant le bouton "Je suis prêt".

- [x] **AC10 — Script de poche overlay :** Given une session avec `recordingMode = 'pocket_script'`, when l'enregistrement démarre, then `NarrativeAnchorSticky` affiche les 3 `pocketScriptBullets` avec le label "Script de poche" (pas "Ton angle narratif").

- [x] **AC11 — Mode coached sans disruption :** Given une session avec `recordingMode = 'coached'` ou sans `linkedinContext`, when l'enregistrement démarre, then `NarrativeAnchorSticky` se comporte exactement comme avant (narrativeAnchor.bullets si disponibles).

---

## Additional Context

### Dependencies

- Migration Prisma (Task 1) doit être appliquée avant toute lecture/écriture de `linkedinContext`
- Tasks 2-3 (onboarding) sont indépendantes — peuvent être faites en parallèle avec Tasks 4-9
- Task 6 (`LinkedinProposalCard`) doit être faite avant Task 7 (`HomeKabouEntry`)
- Tasks 10-12 (session) sont indépendantes des Tasks 4-9 une fois le champ `linkedinContext` disponible
- L'API `PATCH /api/topics/:id` doit accepter `linkedinContext` dans le payload (vérifier si c'est déjà le cas ou ajouter le champ dans le controller)

### Testing Strategy

**Tests manuels — scénarios à valider :**

1. **Nouveau user** : créer un compte → compléter onboarding (vérifier Q3 stocke `objective`) → arriver sur home → voir `HomeKabouEntry` → répondre à la question → vérifier que Kabou propose dans le bon mood → valider → vérifier Topic créé en DB avec `linkedinContext` complet → ouvrir session → vérifier coaching tip + Script de poche si mode choisi
2. **Returning user** : arriver sur home → voir `HomeBrief` → cliquer "Nouvelle vidéo" → vérifier overlay s'ouvre → fermer avec "×" → vérifier retour HomeBrief
3. **Chemin "Autre chose"** : arriver sur une proposition → cliquer "Autre chose" → vérifier la question fermée de Kabou → choisir "même style différent" → vérifier nouvelle proposition même sujet / autre format
4. **Session coached** : ouvrir session topic sans `pocket_script` → vérifier NarrativeAnchorSticky inchangé
5. **Session pocket_script** : ouvrir session topic avec `pocket_script` → vérifier bullets + label "Script de poche"

### Notes

**4 formats LinkedIn :**
| Format | Durée | Mood associé |
|---|---|---|
| `opinion_courte` | 30-60s | Challenger 🔥 |
| `story` | 60-90s | Authentique ❤️ |
| `expertise` | 90-180s | Expert 🎯 |
| `thought_leadership` | 3-5min | Expert 🎯 |

**Coaching pré-tournage par format :**
- 🔥 `opinion_courte` : *"Commence directement par ton opinion. La première phrase doit être la chose la plus forte que tu vas dire."*
- ❤️ `story` : *"Commence au milieu de l'histoire — pas depuis le début."*
- 🎯 `expertise` / `thought_leadership` : *"Commence par le résultat, pas par l'explication."*

**Wording question d'ouverture (statique dans HomeKabouEntry) :**
> *"Qu'est-ce qui t'a le plus animé cette semaine — une conversation, une frustration, une victoire ?"*

**Wording chemin "Autre chose" :**
> *"Tu veux parler d'un autre sujet, ou le même dans un style différent ?"*

**Risques :**
- Gemini peut générer un `sujet` trop générique si la réponse de l'user est vague — le coachingExample doit être généré depuis le sujet réel, pas un exemple hardcodé
- Le PATCH `/api/topics/:id` pour `linkedinContext` : vérifier que le controller NestJS accepte les champs JSON arbitraires ou ajouter `linkedinContext` explicitement
- `HomeBrief` est actuellement un Server Component — la Task 9 le convertit en client component pour le state `showKabouEntry` ; vérifier qu'il n'y a pas de fetch serveur à migrer côté client
