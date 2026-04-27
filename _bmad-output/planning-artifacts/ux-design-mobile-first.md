---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-lavidz-v2.md
project_name: lavidz
user_name: Antoine
language: French
started_at: 2026-04-26
focus: mobile-first-excellence
---

# Spécification UX Mobile-First — lavidz

**Auteur :** Antoine
**Date :** 2026-04-26
**Focus :** Expérience mobile native-grade

---

## Executive Summary

### Project Vision

Lavidz est le compagnon créatif de l'entrepreneur solo qui veut créer du
contenu vidéo sans y passer sa vie. Le Sujet est l'atome central — tout
part d'un sujet, tout y revient. L'objectif de cette spécification est de
porter l'expérience mobile au niveau des meilleures apps natives : fluide,
physique, sans friction.

### Target Users

Marc, entrepreneur solo, 30–45 ans. Il pense à son contenu entre deux
rendez-vous. Il ouvre l'app sur son téléphone, pas sur son MacBook. Il n'a
pas le temps de chercher — il a besoin que l'interface lui dise quoi faire
maintenant.

### Architecture de navigation — 4 onglets

La bottom nav mobile passe de 6 items à 4 items. Règle : un onglet = une
intention distincte.

| Onglet | Icône | Intention |
|--------|-------|-----------|
| **Accueil** | Home | Que faire aujourd'hui ? |
| **Sujets** | FileText | Mes idées en cours de maturation |
| **Projets** | FolderOpen | Mes tournages et vidéos livrées |
| **Moi** | User | Mon identité créative (Brand Kit + Mon Univers + Profil) |

Brand Kit, Mon Univers et Compte sont consolidés dans **Moi** — même
espace mental : "tout ce qui me définit en tant que créateur".

### Key Design Challenges

1. **La nav actuelle à 6 items fragmente l'attention** — sur un pouce,
   6 cibles c'est trop petit et trop cognitif.
2. **Le switch Sujet/Kabou n'est pas gestuel** — sur native, on swipe,
   on ne tape pas sur un tab.
3. **Les transitions entre écrans sont web** — pas d'animation de slide,
   pas de feedback physique au tap.

### Design Opportunities

1. **"Moi" comme espace éditorial** — pas juste un profil, mais le miroir
   de l'identité créative de Marc : thèse, piliers, ton, brand. Un endroit
   qu'on prend plaisir à consulter.
2. **Accueil contextuel** — une home qui change selon le moment :
   "Tu as un sujet prêt à tourner" / "3 idées en germination" / "Bienvenue".
3. **Le sujet comme app dans l'app** — quand Marc entre dans un sujet,
   il entre dans une bulle. La nav globale disparaît. Seul Sujet | Kabou.

---

## Core User Experience

### Defining Experience

L'action centrale de Lavidz sur mobile est : **ouvrir un sujet et
avancer dessus**. Que ce soit pour enrichir le brief, discuter avec
Kabou, ou lancer le tournage — tout converge vers ce geste. La liste
des sujets est la vue de départ ; le sujet individuel est l'espace
de travail.

Le loop fondamental :
  Accueil → "Que faire ?" → Sujets → Sujet [id] → Kabou / Contenu
  → action (enrichir / marquer prêt / lancer tournage)

### Platform Strategy

- **Mobile-first, touch exclusif** : toutes les interactions primaires
  sont conçues pour le pouce. Le desktop est un bonus, pas la cible.
- **PWA-grade** : l'app doit *se sentir* installée — safe areas, pas
  de bounce de page, transitions qui occultent la nature web.
- **Pas d'offline** pour cette phase : connexion requise (IA, data),
  mais les états de chargement doivent être imperceptibles.
- **Gestes natifs** à introduire :
  - Swipe horizontal Sujet ↔ Kabou dans le workspace
  - Pull-to-refresh sur la liste des sujets
  - Swipe-to-dismiss sur les drawers (déjà Vaul — à affiner)

### Effortless Interactions

Ce qui doit demander zéro effort cognitif :

1. **Comprendre où en est un sujet en 1 seconde** — l'état créatif
   (SEED / EXPLORING / MATURE) doit être lisible sans lire.
2. **Basculer entre Sujet et Kabou** — un geste, pas un tap réfléchi.
   Sur native, on swipe latéralement comme entre deux apps.
3. **Créer un nouveau sujet** — une action, depuis n'importe où.
   Le FAB ou le bouton "+" ne doit jamais être à plus d'un tap.
4. **Savoir quoi faire sur la Home** — la home ne pose pas de
   question, elle donne une réponse : "Ton sujet X est prêt à tourner."

### Critical Success Moments

1. **L'entrée dans un sujet** — Marc tape sur une card. La transition
   doit être physique : slide vers la droite, comme ouvrir une porte.
   S'il voit un flash blanc ou un skeleton plein écran, c'est raté.
2. **Le premier message à Kabou** — il bascule sur l'onglet Kabou,
   il voit l'input, il parle. Si ça prend plus de 2 secondes à répondre
   sans feedback visuel, il perd confiance.
3. **"Marquer comme prêt"** — le moment où Marc valide son sujet doit
   avoir du poids. Ce n'est pas juste un bouton — c'est une célébration.
   Micro-animation, vibration légère, feedback émotionnel.
4. **La navigation entre onglets** — chaque tap sur la bottom nav doit
   répondre en < 16ms avec un feedback visuel immédiat (scale, color).
   Zéro latence perçue.

### Experience Principles

1. **Le pouce commande** — chaque action primaire est dans la zone
   basse de l'écran. Rien d'important ne vit dans le tiers supérieur.
2. **Physique avant visuel** — une interaction réussie se *sent* avant
   de se voir. Feedback haptique, rebond, inertie.
3. **L'app parle en premier** — Marc n'a pas à deviner. La Home, le
   sujet, Kabou : chacun propose une action avant qu'il demande.
4. **Transition = intent** — naviguer entre écrans n'est pas neutre.
   Chaque transition encode une direction (avancer = slide droite,
   revenir = slide gauche, surgir = bottom sheet).
5. **Zéro chrome inutile** — headers, breadcrumbs, labels redondants
   disparaissent. L'espace blanc est une fonctionnalité.

---

## Desired Emotional Response

### Primary Emotional Goals

**Émotion primaire : Confiance créative.**
Marc ouvre l'app et se sent capable — pas submergé, pas perdu.
Il a une idée floue dans la tête ; l'app lui donne le sentiment
qu'il va réussir à en faire quelque chose de concret. Pas d'ego
de l'interface, pas de surcharge — juste lui et son sujet.

**Émotion secondaire : Progression visible.**
À chaque interaction, Marc voit que son sujet *grandit*. L'état
créatif qui monte de SEED → EXPLORING → MATURE doit se ressentir
comme une progression réelle, pas comme un badge arbitraire.

**Émotion tertiaire : Complicité avec Kabou.**
Kabou n'est pas un outil, c'est un partenaire de pensée. Marc doit
ressentir qu'il est compris, pas juste traité. La tonalité, la
rapidité de réponse, les suggestions pertinentes — tout construit
ce lien.

### Emotional Journey Mapping

| Moment | Émotion cible | Émotion à éviter |
|--------|---------------|------------------|
| Ouverture de l'app | Clarté, orientation | Confusion, surcharge |
| Liste des sujets | Vue d'ensemble satisfaisante | Anxiété face au volume |
| Entrée dans un sujet | Concentration, bulle créative | Dispersion, distraction |
| Conversation avec Kabou | Complicité, surprise positive | Frustration, latence |
| "Marquer comme prêt" | Fierté, accomplissement | Indifférence, platitude |
| Retour dans l'app | Reprise fluide, continuité | Désorientation |
| Quand quelque chose rate | Réassurance, contrôle | Abandon, méfiance |

### Micro-Emotions

- **Confiance vs. Confusion** → priorité absolue : Marc ne se demande
  jamais "où suis-je ?" ni "qu'est-ce que je fais ici ?"
- **Excitation vs. Anxiété** → chaque suggestion de Kabou doit créer
  une petite étincelle ("ah oui, c'est ça !"), pas de la pression.
- **Accomplissement vs. Frustration** → les micro-victoires comptent :
  un sujet qui passe au stade suivant, un tournage lancé, un draft
  sauvé. Chacun mérite un moment de reconnaissance.
- **Appartenance vs. Isolement** → Marc crée seul, mais il ne doit
  jamais *se sentir* seul. Kabou est toujours à portée de swipe.

### Design Implications

- **Confiance créative** → états vides bienveillants (pas "No data"),
  CTA contextuel qui dit quoi faire maintenant, jamais de dead-end.
- **Progression visible** → le creativeState change visuellement de
  manière mémorable. Une animation, une couleur, un mot fort.
  "Ton sujet tient debout" — pas juste un badge vert.
- **Complicité Kabou** → streaming de réponse immédiat (première token
  < 400ms), indicator de "Kabou réfléchit" qui respire, pas qui charge.
- **Accomplissement** → au moment de "Marquer prêt" : micro-animation
  confetti ou pulse, haptic feedback sur iOS, toast avec une phrase
  qui reconnaît l'effort. Pas juste un état qui change.
- **Réassurance à l'erreur** → messages d'erreur en langage humain,
  jamais de stack trace, toujours une action proposée pour s'en sortir.

### Emotional Design Principles

1. **Reconnaître avant d'informer** — avant de donner de l'information,
   l'interface reconnaît l'état de Marc. "Tu as 3 sujets en germination"
   plutôt que "3 topics — SEED status".
2. **Célébrer les petites victoires** — chaque étape franchie mérite
   un signal émotionnel, pas seulement les grandes (tournage lancé).
3. **Kabou ne rate jamais une réponse** — même si l'IA est lente,
   l'interface ne laisse jamais Marc dans le silence. Feedback immédiat,
   toujours.
4. **L'app se souvient** — reprendre là où on s'était arrêté, sans
   avoir à chercher. La continuité *est* une émotion.

---

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

#### Things 3 — Le sujet comme objet mental propre
Things 3 est la référence absolue pour "task as first-class citizen"
sur iOS. Chaque tâche a sa propre page, son propre espace. La
navigation est spatiale : on *entre* dans une tâche, on *revient* à
la liste. Pas de drawer, pas de modal — un espace dédié.
→ **Pattern à adopter** : le Sujet Lavidz comme espace propre avec
entrée/sortie physique (slide transition, pas de fade).

#### Linear — Navigation ultra-rapide, zéro latence perçue
Linear a résolu le problème de la latence perçue : l'UI répond en
< 16ms avant même que le serveur confirme. Optimistic updates partout.
La bottom sheet de Linear mobile est un chef-d'œuvre : swipe, snap,
dismiss — tout est physique.
→ **Pattern à adopter** : optimistic updates sur toutes les actions
Kabou et patch de sujet. L'UI s'actualise avant la réponse serveur.

#### Duolingo — Célébration des micro-victoires
Duolingo a transformé "tu as fini une leçon" en moment émotionnel
fort. Pas juste un badge — une animation, un son (optionnel), un
compteur qui monte. Chaque progrès est un événement.
→ **Pattern à adopter** : quand un sujet passe SEED → EXPLORING →
MATURE, ce n'est pas juste une couleur qui change. C'est un moment.

#### Claude.ai mobile — Chat IA sur mobile fait bien
L'app Claude sur iOS a résolu le problème clé du chat IA mobile :
le clavier ne mange pas l'input, le streaming est fluide, l'input
reste ancré en bas. La liste des conversations est propre.
→ **Pattern à adopter** : Kabou Panel mobile doit avoir le même
niveau de polish — input sticky au-dessus du clavier, streaming
token par token visible, messages qui s'ancrent naturellement.

#### Instagram — Bottom nav parfaite
5 items max, icônes seules (pas de label sur les items inactifs),
tap avec haptic léger. Le tab actif a un state visuel immédiat.
La transition entre tabs est instantanée — pas de fade, pas de slide.
→ **Pattern à adopter** : bottom nav Lavidz à 4 items, icône+label
sur l'item actif seulement, transitions instantanées entre tabs.

### Transferable UX Patterns

**Navigation & Structure**
- *Spatial navigation* (Things 3) → entrer/sortir d'un sujet avec
  une slide transition directionnelle (droite pour entrer, gauche
  pour revenir)
- *Tab switch instantané* (Instagram) → zéro animation entre tabs
  de la bottom nav — juste un state swap immédiat
- *Swipe horizontal* (apps natives iOS) → Sujet ↔ Kabou en swipe
  latéral dans le workspace, avec momentum physique

**Performance & Feedback**
- *Optimistic UI* (Linear) → chaque action est confirmée visuellement
  avant la réponse serveur. En cas d'échec, rollback discret.
- *Streaming token* (Claude.ai) → première lettre de Kabou < 400ms,
  curseur clignotant pendant l'attente
- *Haptic feedback* (iOS native) → tap sur bottom nav = impact léger,
  "Marquer prêt" = notification medium, erreur = warning

**Progression & Célébration**
- *State transition event* (Duolingo) → passage de creativeState =
  animation dédiée + toast émotionnel + (option) vibration
- *Progress anchoring* (Headspace) → l'Accueil montre toujours
  "où tu en es" avant de montrer "quoi faire"

### Anti-Patterns à Éviter

1. **Modal plein écran pour une action simple** — utiliser des
   bottom sheets snappables (Vaul) à la place.
2. **Labels redondants dans la nav** — si l'icône est claire, le
   label permanent n'est pas nécessaire. Réduire le bruit visuel.
3. **Spinner bloquant** — jamais de spinner qui empêche l'interaction.
   Skeleton screens ou optimistic UI à la place.
4. **Pull-to-refresh absent** — sur mobile natif, l'utilisateur
   s'y attend. Son absence crée une confusion "est-ce à jour ?".
5. **Transitions de page en fade** — le fade est le fallback web.
   Sur native, chaque transition encode une direction spatiale.
6. **Input perdu sous le clavier** — l'input textarea doit toujours
   être visible quand le clavier est ouvert, ancré au-dessus de lui.

### Design Inspiration Strategy

**À adopter directement**
- Spatial navigation (entrée/sortie de sujet) — Things 3
- Optimistic updates — Linear
- Input ancré au-dessus du clavier dans Kabou — Claude.ai mobile
- Bottom nav 4 items, state swap instantané — Instagram

**À adapter**
- Célébration creativeState (Duolingo) → adapter à l'univers
  Lavidz : discret mais mémorable, pas cartoon
- Swipe Sujet ↔ Kabou → snap point net à 50% de swipe

**À éviter absolument**
- Modals plein écran → remplacer par bottom sheets Vaul
- Spinners bloquants → optimistic UI + skeleton
- Fade transitions → slides directionnelles

---

## Design System Foundation

### Design System Choice

**Système existant confirmé : shadcn/ui + Tailwind CSS**

La fondation est solide et reste inchangée. shadcn/ui fournit les
composants de base (Button, Badge, Dialog, Drawer via Vaul) avec un
niveau de customisation total. Tailwind assure la cohérence du token
system. Lucide pour les icônes.

Ce qui manque pour le niveau natif : la **couche motion & gesture**.
Les apps natives excellent par leurs animations physiques et leurs
interactions gestuelles — c'est précisément ce que shadcn/ui ne
fournit pas.

### Rationale for Selection

- **Pas de migration** : repartir de zéro serait une dette immense
  pour un gain marginal. L'existant est bon.
- **shadcn/ui = composants headless** : contrairement à MUI ou Ant
  Design, shadcn/ui ne résiste pas aux animations custom. Chaque
  composant est du markup nu — Framer Motion peut l'envelopper
  librement.
- **Tailwind motion utilities** : insuffisants pour du physics-based.
  Framer Motion prend le relais pour tout ce qui doit avoir de
  l'inertie, du rebond, du drag.

### Implementation Approach

**Couche 1 — Fondation (existante, inchangée)**
- shadcn/ui : Button, Badge, Dialog, Sheet (Vaul), Input, Textarea
- Tailwind CSS : tokens de couleur, spacing, typography
- Lucide : icônes

**Couche 2 — Motion (à introduire)**
- **Framer Motion** : animations de transition entre pages,
  micro-animations sur les états creativeState, célébrations
- **@use-gesture/react** : swipe horizontal Sujet ↔ Kabou,
  pull-to-refresh pattern, swipe-to-dismiss

**Couche 3 — Native Feel (à introduire)**
- **Vibration API** : haptic feedback sur les actions clés
- **viewport-fit=cover** : safe areas iOS (env(safe-area-inset-bottom))
- **overscroll-behavior: none** : supprime le bounce navigateur

### Customization Strategy

**Composants mobiles à créer**

| Composant | Usage | Librairie |
|-----------|-------|-----------|
| `<SwipeablePane>` | Wrapper Sujet ↔ Kabou avec drag | @use-gesture |
| `<NativeBottomNav>` | Bottom nav 4 tabs avec haptic | Framer Motion |
| `<SlideTransition>` | Wrap de page pour slide directionnel | Framer Motion |
| `<CelebrationBurst>` | Animation creativeState upgrade | Framer Motion |
| `<PullToRefresh>` | Pull-to-refresh sur listes | @use-gesture |
| `<StickyKeyboardInput>` | Input ancré au-dessus du clavier | CSS + JS |

**Design tokens à standardiser**
- `--nav-height: 64px` + `env(safe-area-inset-bottom)`
- `--spring-bounce: { type: spring, stiffness: 400, damping: 30 }`
- `--spring-snappy: { type: spring, stiffness: 600, damping: 40 }`

---

## Core User Experience — L'expérience définissante

### Defining Experience

**"Swipe vers Kabou, lui parler, voir son sujet se transformer."**

C'est ça, la phrase que Marc dira à un ami. Pas "j'ai une app de
contenu". Pas "j'ai un outil IA". Il dira : "Je parle à Kabou dans
mon sujet, et mon brief se met à jour en direct."

Le loop en 4 gestes :
1. Marc tape sur un sujet dans la liste (slide vers la droite)
2. Il voit l'état de son sujet d'un coup d'œil (signals, CTA)
3. Il swipe vers Kabou
4. Il parle — Kabou répond, le sujet change, Marc voit la diff

### User Mental Model

Marc amène un modèle mental de **notebook vivant** — un carnet qui
écoute, qui répond, qui s'enrichit. Pas un formulaire. Pas un
éditeur. Un espace de pensée.

**Ce qu'il attend sans le savoir :**
- Que son sujet soit exactement là où il l'a laissé
- Que Kabou se souvienne du contexte sans qu'il ré-explique
- Que ses modifications soient sauvées sans "Enregistrer"
- Que basculer entre Sujet et Kabou soit aussi naturel que tourner
  une page

**Où il risque de décrocher :**
- Si le switch Sujet ↔ Kabou nécessite une décision consciente
- Si la réponse de Kabou tarde sans feedback intermédiaire
- Si après la réponse de Kabou, il doit "recharger" pour voir les
  changements

### Success Criteria

1. **< 400ms** entre le dernier mot de Marc et le premier token
   de Kabou visible
2. **Zéro rechargement** — les mutations de Kabou apparaissent dans
   le panneau Sujet sans action de Marc
3. **Le swipe est irréversible** — une fois appris, on ne peut plus
   s'en passer
4. **Marc sait toujours où il en est** — creativeState lisible en
   < 1 seconde, CTA contextuel sans ambiguïté
5. **La slide transition** depuis la liste donne la sensation d'entrer
   dans une pièce, pas de charger une page

### Novel UX Patterns

**Adapté :** Swipe horizontal Sujet ↔ Kabou — métaphore Snapchat
(caméra ↔ stories). Ton contenu à gauche, ton assistant à droite.
Le geste est découvrable (hint ↔ au 1er passage) et non obligatoire
(tabs toujours visibles pour les tappeurs).

### Experience Mechanics

**1. Initiation — Entrer dans un sujet**
- Tap sur card → slide transition droite (300ms, spring snappy)
- Sujet affiché instantanément (SSR) — zéro skeleton plein écran
- CTA contextuel visible immédiatement dans la zone du pouce

**2. Interaction — Travailler**
- Vue Sujet : sections §01–§04 défilables verticalement
- Vue Kabou : chat full-height, input sticky au-dessus du clavier
- Switch : swipe horizontal snap 50% + tabs pour les tappeurs
- Drag avec résistance physique (spring) contre les switchs accidentels

**3. Feedback — Kabou répond**
- Streaming token-par-token < 400ms
- Mutations Kabou → mise à jour optimiste panneau Sujet sans quitter
  Kabou
- Toast "✨ Kabou a enrichi ton angle" — 2.2s
- Indicateur réflexion : 3 points pulsants, couleur primary

**4. Completion — Quitter**
- Swipe bord gauche (iOS back) ou bouton ‹
- Slide vers la gauche — retour liste
- Card liste reflète le nouvel état (optimistic)
- Zéro action "sauvegarder" — auto-persisté

---

## Visual Design Foundation

### Color System

**Fondation existante confirmée — pas de migration**

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | `hsl(14 100% 55%)` | idem | Orange Lavidz — CTA, actif |
| `background` | `hsl(0 0% 100%)` | `hsl(0 0% 4%)` | Fond global |
| `surface` | `hsl(0 0% 98%)` | `hsl(0 0% 6%)` | Cards, panneaux |
| `surface-raised` | `hsl(0 0% 96%)` | `hsl(0 0% 9%)` | Éléments surélevés |
| `muted-foreground` | `hsl(0 0% 25%)` | `hsl(0 0% 70%)` | Texte secondaire |

**Ajouts spécifiques mobile :**
- `--nav-height: 64px` — hauteur bottom nav standardisée
- `--nav-safe: calc(64px + env(safe-area-inset-bottom))` — avec safe area iPhone
- `--top-safe: env(safe-area-inset-top)` — pour les overlays plein écran

**Dark mode OLED :** `background: hsl(0 0% 4%)` quasi-noir — optimal
sur iPhone 13+ Pro, économise la batterie, contraste premium.

### Typography System

**Stack confirmée : Inter + DM Mono**

| Role | Desktop | Mobile | Style |
|------|---------|--------|-------|
| Titre sujet | `text-2xl` | `text-xl` | `font-bold` |
| Section label | `text-sm` | `text-xs` tracking | `font-semibold uppercase` |
| Corps | `text-sm` | `text-sm` | `leading-relaxed` |
| Micro-label | `text-xs` | `text-[11px]` | `text-muted-foreground` |

**Règles mobiles :** jamais < 12px, `line-height: 1.5` minimum,
`-webkit-text-size-adjust: 100%` pour éviter le zoom auto iOS.

### Spacing & Layout Foundation

**Unité de base : 4px. Touch targets : ≥ 44×44px (Apple HIG).**

Zones de l'écran mobile (iPhone 15) :
- 0–200px du haut → zone morte (jamais d'action primaire)
- 200–500px → contenu, actions secondaires
- 500px–bas → CTA, input, bottom nav

Standards appliqués :
- `px-4` (16px) padding horizontal mobile
- `max-w-2xl mx-auto` colonne centrée
- `pb-[calc(80px+env(safe-area-inset-bottom))]` sur pages scrollables
- `gap-3` entre cards, `gap-6` entre sections

### Accessibility Considerations

- **Contraste** `primary`/`background` → 4.8:1 ✓ (AA)
- **Dark mode** `foreground`/`background` → 19:1 ✓ (AAA)
- **Touch targets** 44px minimum sur bottom nav et CTA
- **Reduced motion** : Framer Motion respecte `prefers-reduced-motion`
  → fallback opacity-only sans slide
