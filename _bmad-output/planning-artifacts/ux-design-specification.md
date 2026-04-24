---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
lastStep: 14
completedAt: 2026-04-23
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-lavidz-v2.md
  - _bmad-output/quick-specs/subject-session-refactor.md
  - _bmad-output/quick-specs/progressive-workspace.md
  - _bmad-output/quick-specs/format-card-drawer.md
  - docs/architecture/subject-session-split.md
project_name: lavidz
user_name: Antoine
language: French
started_at: 2026-04-23
---

# Spécification UX — lavidz

**Auteur :** Antoine
**Date :** 2026-04-23

---

## Executive Summary

### Project Vision

Lavidz est une app web qui aide des entrepreneurs solo à créer du contenu
vidéo via un dialogue avec un compagnon créatif IA (Kabou). La promesse
produit est **qualité + IA-coach + processus créatif naturel** — pas la
vitesse. Pivot 2026-04-19 : persona principal = entrepreneur self-service
(plus l'agence B2B).

L'architecture produit repose sur **2 axes orthogonaux** actés en avril 2026 :

- **Topic** (stratégique, long-terme) : angle, ancre narrative, sources,
  notes d'accroches, thread Kabou. Test : *"Je reviens dans 3 mois, je
  veux retrouver ça."*
- **Session** (tactique, format-specific) : script format-adapté, hooks
  native/marketing, recovery state. Durée de vie : de l'idée au publish.

Kabou n'est **pas** un productivity assistant — c'est un compagnon
créatif. Pas de jargon, pas de scores, pas de gamification (anti-Linear,
anti-Trello).

### Target Users

**Persona principal — "Marc" (entrepreneur solo)** :

- 30-45 ans : fondateur, indie dev, consultant expert
- Expertise claire mais difficulté à structurer son message à l'oral
- Utilise du contenu vidéo pour asseoir son expertise, pas créateur de métier
- Tech-confiant mais pas designer
- Cherche un outil qui **l'accompagne sans le remplacer**
- Desktop principal (bureau), mobile occasionnel pour consulter ses projets
- Aversion claire pour : jargon IA, scores/gamification/progress bars,
  nag UI qui culpabilise, interface qui le traite comme un employé

### Key Design Challenges

**Scope : page `/sujets/[id]` — le workspace d'un sujet dans sa phase
stratégique et tactique.**

1. **CTA primary sémantiquement invalide au niveau Topic** (issue
   structurelle, pas cosmétique). Un Topic peut porter plusieurs sessions
   dans des formats différents (Storytelling PENDING + Hot Take DONE +
   Interview REPLACED). Le bouton primary *"Lancer le tournage"* au
   niveau Topic pointe vers **quoi** ? Le 1er PENDING trouvé ?
   L'arbitrage est indécidable. On pose un CTA tactique (Session-level)
   sur un objet stratégique (Topic-level) — c'est une confusion des 2
   axes.

2. **Redondance visible des chemins** : 3 "Lancer le tournage" sur la
   page (primary top + carte format + historique chat Kabou). L'user ne
   sait pas où est la "vérité".

3. **Rupture de contexte sur les formats alternatifs** : les 5 chips
   *"Tenter un autre format"* redirigent vers `/chat` alors que Kabou est
   déjà dans un panel sur la même page. Perte du sujet courant, rebascule
   vers une page générique — le contexte s'évapore.

4. **Signalétique imprécise** : status PENDING affiche simultanément
   "Tournage actif" (header carte) et "À enregistrer" (body) — deux
   signaux qui se contredisent.

5. **Primary CTA "hors contexte"** : gros bouton orange qui surgit entre
   le header et le bandeau matière, sans que la page l'ait annoncé ou
   motivé. Pas de *"pourquoi il est là maintenant"*.

### Design Opportunities

1. **Loi de l'axe** : les CTAs d'action tactique (*Lancer le tournage*,
   *Planifier*, *Reshape*) vivent **exclusivement** dans les cartes
   format. Au niveau Topic, seuls les CTAs stratégiques (marquer prêt,
   archiver, remettre en exploration) ont leur place. Fin de la confusion.

2. **Kabou proactive in-place** : les chips "Tenter un autre format"
   n'ouvrent plus une autre page. Elles **injectent un prompt** dans le
   panel Kabou à droite (*"Je voudrais tenter un format Interview sur ce
   sujet"*) ou déclenchent une création directe de session + scroll vers
   la carte correspondante — sans jamais quitter la page.

3. **Signalétique rigoureuse des status** :
   - `PENDING` → "À enregistrer"
   - `RECORDING`/`SUBMITTED`/`PROCESSING` → "Tournage en cours"
   - `DONE` → "Terminée"
   - `LIVE` → "En ligne"
   - `REPLACED` → "Variante remplacée"

4. **Zone haute = strictement stratégique** : timeline 4 états + titre +
   matière. Aucun bouton d'action tactique. Le focus de l'œil en haut de
   page = *"où en est ce sujet ?"*, pas *"qu'est-ce que je fais
   maintenant ?"*.

5. **Zone basse = tactique par format** : format cards portent toute la
   charge d'action. Chaque carte = 1 format = 1 CTA par contexte (Lancer
   si PENDING, Publier si DONE, Nouveau tournage si vide…).

## Core User Experience

### Defining Experience

Sur la page `/sujets/[id]`, l'acte central est :

> *"Marc arrive sur son sujet, il veut décider quel format tourner et
>  passer à l'action — sans quitter le dialogue qu'il a avec Kabou."*

Toute la page doit SUPPORTER cet acte. La matière éditoriale, les sources,
les hooks ne doivent jamais lui faire concurrence. Le choix du format
est le pivot : c'est le moment où le Topic (stratégique) se traduit en
Session (tactique).

### Platform Strategy

- **Desktop principal** (≥ 1024px) : layout 2 colonnes Topic + Kabou aside.
  80% du temps usage. Dense mais équilibré.
- **Mobile supporté** (drawer Vaul bottom sheet pour Kabou). Pas cas
  d'usage premium mais pas cassé.
- **Pas d'offline** sur la page elle-même. IndexedDB buffer uniquement
  pour les recordings (Phase 7 Recovery).
- **Pas de touch complexe** : drag-and-drop vit dans /projects, pas ici.
- **Pas d'usage shared/lien public** : `/sujets/[id]` est auth-only, `/s/[id]`
  porte le flow shared.

### Effortless Interactions

1. **Passer de "je discute" à "je lance"** : zéro navigation entre le
   panel Kabou, la carte format, et le tournage.
2. **Revenir après 3 jours** : le banner reprise ramène exactement où
   l'user était (Phase 7 livrée).
3. **Voir le contenu d'un format** : clic sur une carte → drawer in-place
   avec script + accroches + re-sync. Jamais de page switch.
4. **Changer de format en cours de réflexion** : les chips "Tenter un
   autre format" injectent un prompt dans Kabou OU créent directement
   une nouvelle session. Jamais de navigation vers `/chat`.

### Critical Success Moments

1. **MATURE vierge** (0 session) — hero "Choisis ton premier format"
   avec 6 cartes format cliquables. Moment d'engagement. Doit être
   visuellement limpide, sans bruit.
2. **Session PENDING qui existe** — la carte format concernée porte
   l'accent visuel unique (halo primary + CTA Lancer). Rien d'autre
   sur la page ne rivalise.
3. **Session DONE** — la carte porte le CTA "Publier ce contenu" qui
   renvoie vers `/projects/[id]/publier`. Un seul CTA, sur la bonne
   carte.
4. **Retour MATURE avec N sessions** — 3 formats actifs dans des états
   différents → 3 cartes, chacune avec son état et son CTA propre. Pas
   de CTA primary au niveau Topic qui prétend arbitrer entre eux.

### Experience Principles — Les 5 lois du workspace Sujet

1. **Un axe, un rôle** — Topic porte la stratégie (angle, ancre, sources,
   thèse). Session/format porte la tactique (script, hooks, tournage,
   publish). **Jamais de CTA d'action tactique au niveau Topic.**

2. **Le format est l'unité tactique** — toute action de tournage (Lancer,
   Publier, Re-sync, Planifier, Tenter une variante) appartient à UNE
   carte format précise. Sans format référé, l'action n'existe pas à ce
   niveau.

3. **Kabou est un voisin, pas une destination** — le panel à droite EST
   Kabou. Toute interaction avec lui se fait depuis ce panel. Aucun CTA
   de la page Sujet ne doit ouvrir `/chat` — ça casse le contexte sujet.

4. **Jamais de navigation inutile depuis un sujet ouvert** — si l'user
   est sur `/sujets/[id]`, tout ce qui le concerne sur ce sujet reste
   sur la page (drawer, modal, Kabou prompt). Les seules sorties
   légitimes sont `/s/[sessionId]` (tournage fullscreen) et
   `/projects/[id]/publier` (publication).

5. **La page reflète l'état, pas la promesse** — les wordings décrivent
   ce qui EST (*"À enregistrer"*, *"En cours"*, *"Terminée"*), pas ce
   qui pourrait être. Le subtitle du stage Arbre dans la timeline change
   selon l'état ("Prêt à tourner" → "Un tournage t'attend" si PENDING).

## Desired Emotional Response

### Primary Emotional Goals

**Sur `/sujets/[id]`, l'utilisateur doit ressentir :**

> *"Je suis en conversation avec un complice qui comprend mon angle.
>  Le sujet m'appartient, je décide à quel moment il prend forme."*

C'est un état de **concentration posée** — ni adrénaline, ni gamification,
ni urgence. L'acte de créer une vidéo est déjà intimidant ; la page doit
faire baisser la résistance mentale, pas la stimuler.

### Secondary Feelings à cultiver

- **Ancré** : voir sa matière regroupée d'un coup d'œil, pas fragmentée
- **Compris** : Kabou reprend ses mots, pas les siens, pas de jargon
- **Capable** : l'action évidente est toujours à portée d'un click
- **Posé** : atmosphère qui respire (gradient subtil, transitions
  contemplatives) — pas de notif rouge, pas de clignotement
- **Propriétaire** : c'est SON sujet. Kabou assiste, ne pilote pas.

### Emotions à ÉVITER absolument

- **Culpabilité** — nag UI "tu n'as pas encore fait X", banners de manques
- **Stupidité** — interface qui sur-explique ce qui devrait être évident
- **Précipitation** — countdowns, "plus que X", barres de progression
- **Jugement** — scores, pourcentages de maturité, leaderboards
- **Égarement** — multiples chemins visibles pour la même action

### Emotional Journey Mapping

| Moment | État voulu | Véhicule UX |
|---|---|---|
| Arrivée MATURE fresh | Anticipation curieuse | Hero 6 formats sans oppression |
| Clic sur carte format | Mise au point confiante | Drawer in-place, pas de navigation |
| Lancement tournage | Engagement net | CTA unique non ambigu |
| Retour après 3 jours | Retrouvailles (pas "rappel") | Banner Kabou chaleureux |
| Publication | Fierté sobre | Carte DONE → LIVE, wording "En ligne" |
| Quelque chose casse | Déculpabilisation | Kabou dit "on réessaye ?" |

### Micro-Emotions prioritaires (par ordre d'importance)

1. **Confiance** (vs confusion) — sans confiance, rien ne marche
2. **Trust en Kabou** (vs skepticism) — compagnon, pas système, jamais juge
3. **Ownership** (vs feeling like an employee) — le sujet est MIEN
4. **Calme** (vs anxiety) — havre pour un acte déjà angoissant
5. **Accomplissement discret** (vs frustration) — plaisir sobre à chaque
   étape clôturée, jamais de célébration artificielle

### Design Implications

| Émotion visée | UX qui la produit | UX qui la trahit |
|---|---|---|
| Confiance | 1 CTA par action | Doublons visibles (pain point actuel) |
| Trust Kabou | Kabou témoigne, ne félicite pas | Confetti, scores, "Bravo" |
| Ownership | Vocabulaire appropriant ("mon sujet") | "Tu dois", "Complete ton onboarding" |
| Calme | Atmosphère gradient, splashs contemplatifs | Pulsations rouges, badges "Nouveau !" |
| Déculpabilisation | "On réessaye ?", "Pas de pression" | "Échec", retry rouge vif |

### Emotional Design Principles

1. **Le calme est la norme, l'action est l'exception** — la page est
   respirante par défaut ; les transitions (splash) sont des moments
   marqués, pas une ambiance constante.

2. **Kabou témoigne, il ne note pas** — jamais de score, jamais de
   félicitation gratuite. Il observe, reformule, invite. *"Ton angle est
   solide"* > *"Bravo tu as complété 80% !"*

3. **Les manques ne s'imposent pas** — une thèse non définie = un dot
   discret sur nav, pas un banner. Une accroche non générée = une ligne
   dans le bandeau matière, pas une alerte.

4. **Les erreurs sont des moments, pas des échecs** — "On réessaye ?"
   plutôt que "Erreur". Ton qui reste chaleureux même quand l'API 500.

5. **L'ownership passe par le vocabulaire** — "ton sujet", "ta matière",
   "ton angle". Jamais de "Topic", "Brief", "Session". Le vocabulaire
   Kabou est une signature émotionnelle.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**1. Arc Browser / Dia — Panel latéral comme workspace**
- Sidebar "espaces" contenant l'action quotidienne, barre centrale
  dégagée.
- AI-as-neighbor : pas une modale, un compagnon qui habite une colonne.
- Transférable à lavidz : le SubjectKabouPanel aside s'en inspire déjà ;
  la discipline à tenir = Kabou reste le canal principal, aucune
  navigation vers /chat depuis un sujet ouvert.

**2. Linear — Discipline du chrome minimal**
- 1 CTA par écran, jamais 3 en concurrence.
- Statuses expressifs (pastilles colorées) qui font l'info sans texte.
- Zéro illustration gratuite, zéro célébration artificielle.
- Transférable : ordre visuel sur cartes format (une par état, un CTA
  par carte). À NE PAS copier : cycles/velocity/scores = anti-Kabou.

**3. Claude (app native) — Conversation + artefacts inline**
- L'assistant vit dans le flow, pas dans un onglet séparé.
- Tool calls produisent des cartes riches inline (pas popups).
- Thinking visible : transparent, posé.
- Transférable : quand Kabou crée une session, injecter une mini-carte
  inline dans le thread pointant vers la carte format — plus immersif
  qu'un "lien bleu" anonyme.

**4. Readwise / Matter — Bibliothèque qui prend vie**
- Mémoire longue, chaleureuse. Pas de deadlines, pas de "X highlights
  non lus !".
- Couleurs terreuses, typo sereine, rythme contemplatif.
- Transférable : pousser l'atmosphère gradient (livrée Phase 10) vers
  des tons plus chauds (beige/off-white) pour un ressenti moins techie.

### Transferable UX Patterns

**Navigation / hiérarchie**
- Linear single-CTA → appliquer immédiatement : un seul "Lancer le
  tournage" par carte, jamais au niveau Topic.
- Arc spaces → conforter notre archi 2 axes (pas de sous-pages).

**Interactions**
- Claude inline artifacts → quand Kabou crée une session, injecter une
  mini-carte dans le thread (preview + lien carte).
- Linear status pills → pastilles colorées cohérentes pour
  PENDING/RECORDING/DONE/LIVE/REPLACED/FAILED, pas juste du texte.

**Visuel**
- Readwise warmth → palette plus chaude (warm beige plutôt que cool
  grey) pour les surfaces raised.
- Linear typography → hiérarchie typo claire (H1 gras, H2 sobre semibold,
  body regular). Aujourd'hui la page Sujet a parfois 4 niveaux de gris
  qui se confondent.

### Anti-Patterns to Avoid

| Anti-pattern | Pourquoi refusé |
|---|---|
| Gamification (cycles, scores, badges) | Tue promesse compagnon, crée culpabilité |
| Nag UI banners (thesis ✅ retiré) | Anxiété, trahit ownership |
| Wizards d'onboarding plein écran | Kabou est déjà l'onboarding conversationnel |
| Sidebars de filtres complexes | Pas une app de production technique |
| Notifications badges multiples | Attention fragmentée, anti-calme |
| Modales de confirmation pour tout | Trahit trust, ralentit flow |
| Empty states prêcheurs | L'absence est valide, pas un problème |
| Navigation forcée (chips → /chat actuel) | Casse contexte sujet ouvert |

### Design Inspiration Strategy

**À ADOPTER :**
- Linear discipline : 1 CTA par carte format, statuses expressifs, chrome
  minimal
- Arc neighboring panel : Kabou reste à droite (desktop) / bottom sheet
  (mobile), jamais de /chat séparé depuis un sujet
- Claude inline artifacts : mini-cartes inline dans le thread Kabou pour
  les actions majeures (création session, reshape script)

**À ADAPTER :**
- Readwise warmth : shift progressif du design system vers tons plus chauds
  (hors scope immédiat, à garder en tête)
- Notion spatial hierarchy : le bandeau "Mon sujet en matière"
  plié/déplié s'en inspire mais reste plat (pas de nested toggles)

**À ÉVITER ABSOLUMENT :**
- Gamification (progression %, scores, badges)
- Nag UI banners
- Navigation forcée qui casse le contexte
- Empty states qui culpabilisent

## Design System Foundation

### Choix du design system

**Stack en place (pas de pivot) :**

- **Tailwind CSS 3** — utility-first
- **shadcn/ui** — composants Radix primitives copiés dans le codebase
- **Radix UI** — primitives accessibles
- **Vaul** — bottom sheet / drawer
- **lucide-react** — icônes
- **Inter** (UI) + **DM Mono** (monospace)

**Tokens exposés** via CSS variables :
- `--primary : HSL(14 100% 55%)` orange Lavidz
- Semantiques : background, foreground, card, surface/surface-raised,
  muted, accent, destructive, border, ring
- Radius système (base + sm/md/lg/xl/2xl)

**Keyframes custom (Phase 10) :**
- `atmosphere-pulse` (9s — gradient topic qui respire)
- `horizon-grow` (1s — ligne splash transition)
- `splash-emerge` (0.7s — apparition icône)
- `fade-in`, `rec-pulse`, `slide-in`, `float`

### Rationale for Selection

| Critère | Bénéfice concret |
|---|---|
| Vitesse de dev | Composants pré-fabriqués owned in-codebase |
| Consistance | Tokens HSL = thème unifié partout |
| Unicité | Personnalité via primary orange + atmosphere + Inter |
| Accessibilité | Radix gère WAI-ARIA nativement |
| AI-friendly | Patterns lisibles par LLM |
| Maintenabilité | Zéro dep UI externe lock-in |

### Implementation Approach

**Principes non-négociables :**

1. **Tokens only** — aucune couleur hard-codée (pas de `bg-[#FF6B2E]`).
   Exception tolérée : gradients des atmospheres.
2. **Composition Radix + cn()** — Slot (asChild) quand possible, Radix
   primitives pour toute interaction complexe, `cn()` utility avec
   tailwind-merge collision-aware.
3. **Variantes via cva** — Button, Badge déjà. Étendre à 3+ variantes.
4. **Keyframes custom limitées** — d'abord chercher dans Tailwind natif,
   keyframe custom uniquement si distinctif.

### Customization Strategy

**Court terme (portée actuelle UX fix) :**
- Aucune évolution du design system — on FIX les pain points d'abord
- Nouveaux composants restent dans les tokens actuels

**Moyen terme (V1.1) :**
- Shift warmth : surfaces vers beiges plus chauds (inspiration Readwise)
- Tokens pastilles statuses session (6 statuses cohérents)
- Typography scale plus nette (4 tailles canoniques)

**Long terme (V2) :**
- Extraire en package @lavidz/ui si app grandit
- Documenter en Storybook

### Risques à surveiller

| Risque | Signal | Mitigation |
|---|---|---|
| Drift token | classes bg-[...] hard-codées | Grep + lint rule |
| Divergence typo | Mélange text-xs/[10px]/[11px] | Scale typo canonique |
| Classes monstres | className > 200 chars | Extraire cva |
| Lib mismatch | Upgrade Radix casse shadcn | Lock versions + test |

## Defining Experience

### Core Interaction

**L'interaction unique qui, si on la clique bien, fait tomber tout le reste :**

> *"Choisir un format pour ce sujet et lancer le tournage — sans jamais
>  quitter le contexte (ni le dialogue avec Kabou)."*

Un simple click sur une carte format. Derrière ce simple click, tout
doit s'aligner : atmosphère posée, matière scannable, Kabou en voisin.
Si cet acte est limpide, l'app tient sa promesse. S'il est brouillé
(comme aujourd'hui avec 3 CTAs concurrents), l'app trahit sa promesse.

### User Mental Model

**3 scénarios d'arrivée sur `/sujets/[id]` :**

1. **Sujet déjà sculpté, session PENDING** (< 5s) : Scan → click carte
   orange → fin.
2. **Sujet fresh MATURE, 0 session** (< 30s) : Hero 6 formats → click
   format → carte apparaît → click Lancer.
3. **Sujet exploré, indécis** (2-5 min) : Panel Kabou à droite → dialogue
   → Kabou crée session → carte apparaît → click Lancer.

**Ce que Marc ne doit JAMAIS faire :**
- Ouvrir `/chat` séparément après avoir ouvert son sujet
- Chercher "où est mon script ?"
- Se demander "pourquoi 3 boutons Lancer ?"
- Voir un pourcentage de maturité

### Success Criteria

| Critère | Métrique |
|---|---|
| Zéro navigation loin depuis un sujet ouvert | 0 clic vers /chat |
| CTA unique par carte par état | 1 CTA visible / carte |
| Kabou accessible à tout moment | Panel toujours visible desktop |
| Time-to-camera session PENDING | < 5s page-land → click Lancer |
| Time-to-camera MATURE fresh | < 30s format choisi + lancé |
| Wording signale l'état réel | 0 ambiguïté PENDING vs "actif" |
| Mental model parlable | Décrit en 1 phrase à un pote |

### Novel vs. Established Patterns

**Établis (adopter sans friction) :**
- Carte cliquable → drawer in-place (Linear, Notion, Arc)
- Sidebar AI panel (Arc, Cursor, Copilot)
- Hero empty state (Linear, Figma)
- Timeline visuelle d'états (Jira, GitHub)

**Novel à lavidz (nécessite soin particulier) :**
- Séparation stratégique/tactique stricte — doit rester INVISIBLE côté
  user (il pense "mon sujet a plusieurs formats", pas "Topic vs Session")
- Kabou qui crée des artefacts réels inline (sessions, scripts)
- Atmosphère émotionnelle par phase (ambre → émeraude)

**Twist unique :** le FORMAT est l'unité atomique de l'action tactique.
Chaque format a sa carte, son CTA, son drawer. Pas une tab, pas un
filtre — une instance concrète.

### Experience Mechanics

**1. Initiation** — atterrissage sur `/sujets/[id]`
- Depuis /topics, Kabou, notification (futur), lien shareable (futur)

**2. Scan initial (0-3s)** — ce que l'œil absorbe
- Timeline 4 états, titre + pillar, atmosphère teinte, présence du hero,
  bandeau matière plié, cartes format

**3. Decision trigger** — selon l'état
- 0 sessions → hero format picker capte l'attention
- 1+ PENDING → carte concernée a le halo primary (visual weight unique)
- 1+ DONE → carte DONE propose "Publier ce contenu"
- Tout REPLACED/FAILED → hero "Tenter un autre format" + chips

**4. Action unique par carte** (règle absolue) :

| Status session | CTA principal | Destination |
|---|---|---|
| PENDING | ▶ Lancer le tournage | `/s/[sessionId]` |
| RECORDING/SUBMITTED/PROCESSING | Reprendre (halo pulse) | `/s/[sessionId]` |
| DONE | ✨ Publier ce contenu | `/projects/[projectId]/publier` |
| LIVE | En ligne (ghost) + Tenter variante | Pas de navigation / variante create |
| REPLACED/FAILED | Accessibles dans accordion variantes | — |

**5. Feedback** — comment Marc sait que ça marche
- Click → active:scale-[0.98] + loading async
- Navigation → transition propre (pas de flash blanc)
- Retour → carte reflète nouvel état
- Kabou mentionne le changement dans le panel

**6. Completion** — le cycle se referme
- Retour sur /sujets/[id] → carte mise à jour → toast Kabou
- L'user peut publier, discuter, ou tenter un autre format
- La page reste le point de retour

## Visual Design Foundation

### Color System

**Tokens actuels (locked) :**

| Token | HSL | Usage |
|---|---|---|
| --primary | 14 100% 55% | CTAs, halos actifs, accents |
| --foreground | 0 0% 9% | Texte principal |
| --muted-foreground | 0 0% 45% | Texte secondaire |
| --surface / --surface-raised | gris froid | Panels, bandeaux |
| --destructive | rouge modéré | Erreurs / delete |

**Couleurs semantiques Session status (à systématiser) :**

| Status | Token | Usage |
|---|---|---|
| PENDING | amber-600 | Attente, chaleur |
| RECORDING/SUBMITTED/PROCESSING | primary | Action en cours, halo pulse |
| DONE | emerald-600 | Accompli, net |
| LIVE | emerald-700 | Publié, sticky |
| REPLACED | muted-foreground | Archivé neutre |
| FAILED | destructive | "Raté" (wording Kabou) |

**Atmosphères par phase Topic (livré Phase 10) :**

| Phase | Teinte | Sensation |
|---|---|---|
| SEED | ambre 12% opacity | Chaleur naissante |
| EXPLORING | émeraude frais 14% | Jeune vigueur |
| MATURE | émeraude profond 16% | Stabilité |
| ARCHIVED | slate 18% | Repos |

**Shift V1.1 (hors scope immédiat) :** basculer surface cool grey →
warm beige très léger pour un ressenti moins SaaS / plus carnet de bord.

### Typography System

**Fonts :** Inter (UI) + DM Mono (code ponctuel).

**Scale canonique proposée (4 tailles, règle stricte) :**

| Usage | Classe | Line-height |
|---|---|---|
| Hero / page title | text-2xl sm:text-3xl font-bold tracking-tight | 1.2 |
| Section title | text-xs font-semibold uppercase tracking-widest | 1.4 |
| Body | text-sm leading-relaxed | 1.625 |
| Meta | text-xs text-muted-foreground | 1.5 |

**Règle :** `text-xs` est le plus petit acceptable. `text-[10px]` et
`text-[11px]` hard-codés à bannir (sauf via composant Badge).

**Weight :** font-bold (H1 only) / font-semibold (H2) / font-medium
(emphase) / regular (body).

### Spacing & Layout Foundation

- Base unit 4px (Tailwind default)
- Padding cartes : p-4 / p-5
- Gap vertical sections : mb-6
- Max-width workspace : 1500px
- Grid workspace : `lg:grid-cols-[1fr_560px]` (contenu + Kabou 560px)
- Densité variable : zone stratégique aérée (py-4/6), zone tactique
  plus dense (py-3/4)

### Accessibility Considerations

**En place :**
- Radix primitives → WAI-ARIA, focus trap, keyboard navigation
- sr-only pour titres invisibles (Drawer.Title/Description)
- aria-hidden sur icônes décoratives
- aria-label sur boutons icon-only
- Focus visible via focus-visible:ring

**Manques à corriger :**
- Audit des boutons icon-only sans aria-label (grep systématique)
- Hiérarchie h1/h2/h3 parfois imbriquée incorrectement
- Primary sur background light = ratio 3.87:1 → interdit en body text

**Keyboard shortcuts :**
- Escape → ferme drawer / splash (en place)
- Cmd+Enter dans brief editor → save (à ajouter)
- Cmd+K → quick switcher topics (V2+)

## Design Direction Decision

### Design Directions Explored

**3 directions de layout ont été évaluées pour résoudre les pain points
de `/sujets/[id]` (CTAs dupliqués, chips vers /chat, wording ambigu,
flow cassé) :**

**Direction A — Format-centric (recommandée)** : retire tout CTA au
niveau Topic, cartes format portent la charge tactique, chips créent
directement une session + scroll. Minimum shift, maximum gain.

**Direction B — Conversational canvas** : workspace devient un fil de
discussion scrollable avec format cards inline quand invoquées.
Disruptif, réservé à V2 "creative journal".

**Direction C — Split 3 colonnes** : matière / formats / Kabou en
parallèle constant. Rejetée : trop chargé sous 1440px, tue la sérénité,
Kabou panel étroit.

### Chosen Direction

**Direction A — Format-centric.**

### Design Rationale

1. Respecte l'architecture 2 axes livrée (phases 1-10 refactor
   subject-session-refactor.md) — zéro refonte structurelle
2. Résout les 4 pain points identifiés (CTA ambigu, chips vers /chat,
   wording confus, doublons de "Lancer le tournage")
3. Conforme aux 5 Experience Principles (loi de l'axe, format = unité
   tactique, Kabou voisin, pas de navigation inutile, état ≠ promesse)
4. Implémentable en 1 sprint (~3 pts) — pas de refonte lourde

### Implementation Approach

**Côté données / logique :**
- `primaryCta` retourne null dès qu'une carte format porte un CTA actif
  (PENDING, RECORDING, SUBMITTED, PROCESSING, DONE)
- Chips "Tenter un autre format" → `POST /api/topics/:id/record-now`
  body `{ format }` → scroll vers `#format-${format}` + highlight 600ms
  (fini le `<Link href="/chat">`)

**Côté visuel :**
- Mapping wording status centralisé dans `kabou-voice.ts` :
  PENDING="À enregistrer" / RECORDING="En cours" / SUBMITTED="Soumise" /
  PROCESSING="En traitement" / DONE="Terminée" / LIVE="En ligne" /
  REPLACED="Variante remplacée" / FAILED="Raté"
- Halo ring-primary/25 sur carte avec session en cours réelle (RECORDING/
  SUBMITTED/PROCESSING), PAS sur PENDING (c'est à l'user de lancer)
- Carte PENDING : dot amber pulse subtile sur status

**Côté navigation :**
- Badge "N tournages" header = scroll-to `#tournages-par-format` (fait)
- Chips n'ouvrent plus /chat — création directe
- Bouton "Voir le script complet" dans carte = drawer in-place (fait)
- Kabou reste toujours à droite — aucune sortie de la page sujet

### Changements concrets par rapport à l'état actuel

| Avant | Après |
|---|---|
| 3× "Lancer le tournage" sur la page | 1 CTA dans la carte format concernée |
| Chips → /chat (perte contexte) | Chips → création session + scroll |
| "Tournage actif" en header PENDING | "À enregistrer" (wording aligné status) |
| `primaryCta` gros bouton orange top | Retiré quand une carte a le CTA |
| Halo sur toute carte avec session | Halo uniquement sur RECORDING/SUBMITTED/PROCESSING |

## User Journey Flows

### Journey 1 — Fresh MATURE → Premier tournage

Marc vient de marquer son sujet "prêt", il arrive sur la page. Aucune
session n'existe encore. Il choisit un format et lance.

```mermaid
flowchart TD
  A[Arrivée /sujets/:id] --> B{Creative state}
  B -->|MATURE + 0 session| C[Hero Choisis ton premier format]
  C --> D[6 cartes format cliquables]
  D --> E{Format choisi}
  E -->|Click chip| F[POST /record-now with format]
  F --> G[Session PENDING créée]
  G --> H[Scroll vers carte créée]
  H --> I[Carte affiche format À enregistrer]
  I --> J[Click Lancer le tournage]
  J --> K[/s/:sessionId recording flow]
  E -->|Hésite, discute| L[Panel Kabou à droite]
  L --> M[Conversation Kabou]
  M --> N[Kabou appelle create_recording_session]
  N --> G
```

**Temps cible** : 30s path direct / 2-5 min via Kabou.

### Journey 2 — Retour session PENDING

```mermaid
flowchart TD
  A[Arrivée /sujets/:id] --> B[Carte format À enregistrer]
  B --> C[Preview 2 bullets script]
  C --> D{Action user}
  D -->|Click Lancer| E[/s/:sessionId]
  D -->|Voir script complet| F[Drawer in-place]
  F --> G[Bouton Lancer dans footer drawer]
  G --> E
  E --> H{ResumeBanner}
  H -->|Prises existantes| I[Banner Kabou contextualisé]
  H -->|Première fois| J[Phase intro normale]
```

**Temps cible** : < 5s page-land → click Lancer.

### Journey 3 — Session DONE → Publication

```mermaid
flowchart TD
  A[Arrivée /sujets/:id] --> B[Carte format DONE]
  B --> C{Action}
  C -->|Click Publier ce contenu| D[/projects/:projectId/publier]
  C -->|Voir script| E[Drawer avec CTA Publier footer]
  E --> D
  D --> F[PublishView vidéo + LinkedIn posts]
  F --> G[Click C'est en ligne]
  G --> H[Session DONE → LIVE]
  H --> I[Retour carte badge En ligne]
```

### Journey 4 — Tenter un autre format

```mermaid
flowchart TD
  A[/sujets/:id avec 1 DONE] --> B[Section Tenter un autre format]
  B --> C[Chips formats non explorés]
  C --> D{Format choisi}
  D -->|Click chip| E[POST /record-now format=X]
  E --> F[Nouvelle session PENDING]
  F --> G[Scroll + highlight carte]
  G --> H[Click Lancer nouvelle carte]
  D -->|Hésite| I[Panel Kabou conversation]
  I --> J[Kabou create_recording_session]
  J --> G
```

### Journey 5 — Retake / Session REPLACED

```mermaid
flowchart TD
  A[Post-recording view] --> B{Satisfaction}
  B -->|Refaire 1 question| C[Reprendre une question]
  C --> D[/s/:sessionId questionIndex]
  D --> E[supersededAt atomique F10]
  B -->|Tout refaire| F[On reprend à zéro]
  F --> G[Modal confirm Kabou]
  G --> H[POST /reset — status PENDING]
  H --> I[Retour /sujets/:id]
  B -->|Autre angle| J[Tenter un autre angle]
  J --> K[Modal confirm]
  K --> L[POST /replace — nouvelle session]
  L --> M[Redirect /s/:newId]
```

### Journey Patterns (réutilisables)

1. **One card, one CTA** — toute carte format porte UN CTA lié à son
   status. Actions secondaires vivent dans le drawer.
2. **Chip = action directe, pas navigation** — les chips créent la
   ressource (POST + scroll), jamais de navigation vers /chat.
3. **Kabou parle, Kabou agit** — tools invoqués depuis la conversation
   déclenchent un refetch workspace (MUTATING_TOOLS).
4. **Drawer = détail, jamais navigation** — Voir script = drawer.
   Publier = navigation (flow complet). Tourner = navigation (caméra
   fullscreen).
5. **Retour = état reflété** — après toute action qui change l'état,
   le retour sur /sujets/:id affiche le nouvel état instantanément.

### Flow Optimization Principles

1. Minimize clicks to value — session PENDING = 1 click → recording
2. Zero context loss — aucune navigation vers /chat depuis un sujet
3. Predictable feedback — active scale, loading spinner, success toast
4. Graceful recovery — modales de confirmation avec wording Kabou pour
   actions destructives (reset, replace)
5. Progressive disclosure — drawer révèle, Kabou dialogue, page scanne

## Component Strategy

### Composants existants (design system + custom)

**UI primitives (shadcn/ui) :**
Button, Badge, Card, Input, Label, Textarea, Progress, Separator,
DatePicker, AlertDialog

**Custom Subject (livrés phases 1-10) :**
CreativeStateTimeline, CreativeStageIcons, SubjectRecordingGuide,
SubjectNarrativeAnchor, StaleAnchorBadge, TopicAtmosphere,
StateTransitionSplash, MatureMatterSummary, FormatCardPreview,
FormatCardDrawer, SubjectSourcesSection, ThesisBanner,
ThesisIndicatorDot, SchedulePublishModal

**Custom Session :**
RecordingSession, NarrativeAnchorSticky, PostRecordingView,
ResumeBanner, TeleprompterOverlay, FreeformGuide, PreRecordingCheck

**Kabou :** SubjectKabouPanel, ChatLink, ChatParagraph

### Composants à créer (Direction A)

#### 1. FormatCard (extraction)

Composant dédié qui concentre la règle "one card, one CTA". Anatomie :
- Header : emoji + label + action contextuelle (Nouveau tournage / Tenter variante)
- Body : SessionStatusBadge + titre + preview 2 lignes
- Footer : bouton "Voir le script complet" (ouvre drawer)

CTA primary selon status (mapping complet) :

| Status | CTA | Halo |
|---|---|---|
| null | Nouveau tournage | — |
| PENDING | ▶ Lancer le tournage | ❌ |
| RECORDING | Reprendre | ✅ pulse |
| SUBMITTED/PROCESSING | Revoir | ✅ pulse |
| DONE | ✨ Publier ce contenu | ❌ |
| LIVE | En ligne (ghost) | ❌ |

Variants : compact / full. Accessibility : heading h3, aria-label,
article role.

#### 2. FormatChipButton

Remplace les `<Link href="/chat?action=record">` par un vrai bouton qui
crée la session sans quitter la page :

1. Click → POST /api/topics/:id/record-now body `{ format }`
2. Response → { sessionId }
3. router.refresh()
4. Scroll vers #format-${format}
5. Highlight ring-primary/40 animate-pulse 600ms

#### 3. SessionStatusBadge

Pastille status cohérente (utilisée par FormatCard, Drawer, SessionRow).
Mapping tokens couleur + wording centralisé :
PENDING (amber) / RECORDING-SUBMITTED-PROCESSING (primary pulse) /
DONE (emerald-500) / LIVE (emerald-600) / REPLACED (muted) /
FAILED (destructive "Raté").

Variants size : sm / md.

#### 4. useHighlightFlag hook

Hook utility `useHighlightFlag(flag: string | null, ms = 600)` qui
toggle un état boolean pendant ms. Utilisé par FormatChipButton pour
faire pulser la carte fraîchement créée après scroll.

#### 5. SESSION_STATUS_COPY mapping

Dans kabou-voice.ts — mapping centralisé PENDING/RECORDING/SUBMITTED/
PROCESSING/DONE/LIVE/REPLACED/FAILED → wording Kabou. Consommé par
SessionStatusBadge et FormatCard.

### Composants à retirer

- **SubjectHookSection** — legacy, hooks migrés vers FormatCardDrawer
  (scope déjà livré mais composant toujours en codebase → cleanup)

### Component Implementation Strategy

**Principe général :**
- Tokens only (pas de couleur hard-codée)
- Radix primitives pour toute interaction complexe
- cn() utility pour composition classNames
- cva pour variantes 3+
- Accessibility via aria-label systématique

**Pattern "composed card" :**
- FormatCard devient un composant de présentation pure
- La logique métier (fetch, handlers) reste dans SubjectWorkspace
- Les actions sont passées via props (onLaunch, onSchedule, onResync)

### Implementation Roadmap (Direction A)

| Phase | Scope | Pts |
|---|---|---|
| 1 | Extract FormatCard + SessionStatusBadge + centraliser wordings + retirer SubjectHookSection legacy | 0.5 |
| 2 | FormatChipButton + POST record-now + scroll + highlight | 0.75 |
| 3 | primaryCta null quand carte porte CTA actif | 0.5 |
| 4 | Halo conditionnel (RECORDING/SUBMITTED/PROCESSING uniquement) | 0.25 |
| 5 (V1.1) | Typo scale canonique + audit accessibility | 1.0 |

**Total Direction A (phases 1-4) :** ~2 pts pour le fix complet.

## UX Consistency Patterns

### Button Hierarchy

**3 niveaux stricts** :

| Niveau | Usage | shadcn |
|---|---|---|
| Primary | Action principale de la vue | Button default, size lg |
| Outline | Secondaire important | Button variant outline |
| Ghost | Tertiaire subtil | Button variant ghost |

**Règles :**
- Jamais 2 primary visibles sur un même écran (pain point actuel)
- size="lg" pour CTA critique, "sm" pour actions dans cartes
- Destructive uniquement pour Archiver/Supprimer, pas Annuler
- Ghost ≥ h-8 (lisibilité)

### Feedback Patterns

**Toast (ephemeral)** via flashToast existant :
- Success : "✨ Script re-synchronisé" (2.2s)
- Error : "Oups — on réessaye ?" (KABOU_TOASTS.oops, 2.2s)
- Info Kabou : "Ta prise est prête, on la regarde ?" (3.5s)

**Loading :**
- Inline : Loader2 spinner animate-spin
- Full section : skeletons h-X bg-muted/20 animate-pulse
- Jamais spinner full-page central

**Success moments :**
- Splash transitions pour bascules d'état Topic (Phase 10)
- Toast court pour actions individuelles
- JAMAIS confetti, JAMAIS "Bravo !" — Kabou observe, ne félicite pas

**Error recovery :**
- Wording Kabou ("Oups — on réessaye ?"), pas "Erreur 500"
- Bouton "Réessayer" plutôt que "OK"

### Form Patterns

**Inline edit** (pattern dominant lavidz) — Brief, Pillar, HookDraft,
Sources manuelles. Save=primary, Cancel=ghost.

**Règles :**
- Textarea rows=1 auto-grow pour 1-ligne, rows=6 pour paragraphe
- Placeholder ≠ Label (accessibility) — Label visible ou sr-only
- Enter commit sur 1-ligne, Cmd+Enter sur paragraphe
- Validation inline rouge sous le champ, pas en toast

**Wording validation :**
- "Titre requis" > "Champ obligatoire"
- "Ton angle est un peu court" > "Brief invalid (length < 40)"

### Navigation Patterns

| Niveau | Pattern | Usage |
|---|---|---|
| Global nav | ClientNav sidebar + bottom bar | 9 items stables |
| Contextual back | "← Tous mes sujets" | Retour parent logique |
| In-page scroll | Anchor #section | Intra-page sans perdre contexte |
| Modal/Drawer | Vaul, AlertDialog | Détail in-place, jamais nouvelle page |

**Règles strictes :**
- JAMAIS de sortie vers /chat depuis un sujet ouvert (Direction A)
- Sorties légitimes de /sujets/[id] : /topics (back), /s/[id] (tournage),
  /projects/[id]/publier, /mon-univers/*
- Liens externes : target="_blank" + rel="noopener"

### Modal / Drawer Patterns

| Pattern | Quand |
|---|---|
| AlertDialog | Confirmation destructive (delete, reset, replace) |
| Drawer (Vaul) | Détail in-place sans perdre contexte |
| Inline collapse | Info secondaire optionnelle |
| Splash fullscreen | Moment de bascule contemplatif (rare) |
| Toast | Feedback ephemeral |

**Drawer Vaul :** mobile direction=bottom + snapPoints, desktop direction=right
480px. Toujours Drawer.Title + Description (sr-only OK).

**AlertDialog :** titre = question ("On reprend à zéro ?"), body rassurant,
Cancel à gauche / Action à droite. Wording Kabou sur primary.

### Empty States

**Philosophie :** l'absence est un état valide, pas un problème.

**Règle wording :**
- ❌ "Tu n'as encore rien fait !"
- ✅ "Ton sujet vient de germer. On peut commencer à le sculpter."

**Visuel :**
- Icône discrète (emoji OK, pas de grosse illustration)
- Texte court (1-2 phrases)
- CTA contextuel, jamais "Commencer" générique
- JAMAIS de todo-list vides (anti-gamification)

### Loading States

**3 niveaux :**
1. **Skeleton** — placeholders qui matchent la forme finale
2. **Inline spinner** — Loader2 dans bouton en cours
3. **Silent optimistic** — changement appliqué immédiatement, rollback silencieux si échec

**Anti-patterns :** spinner full-page, progress bar factice, "Loading 1/12".

### Search / Filtering

**Pas de filtres complexes** (anti-pattern identifié).

**Pattern établi :**
- Chips cliquables pour catégories (<5 options) — TopicsList
- Textarea libre pour queries spécifiques (LLM-powered) — SubjectSourcesSection search
- Pas de multi-select, pas de date range pickers complexes

## Responsive Design & Accessibility

### Responsive Strategy

**Desktop-first, mobile proper support** — Marc utilise lavidz
principalement au bureau, mais doit pouvoir consulter sur le train.

**Desktop (≥ 1024px) :**
- Layout 2 colonnes : main + Kabou aside 560px fixe
- Max-width 1500px centré
- Grille format cards 1 col, atmosphère gradient visible

**Tablet (768-1023px) :**
- Stack vertical : main full-width puis Kabou collapsible
- Kabou devient FAB + Vaul bottom sheet (même pattern que mobile)
- Hero format picker : 2 cols

**Mobile (< 768px) :**
- Single column
- ClientNav bottom bar (5 items)
- Kabou FAB bottom-right + drawer Vaul bottom snapPoints [0.6, 0.92]
- CTAs plein largeur (`w-full sm:w-auto`)
- Drawer format direction=bottom

### Breakpoint Strategy

Tailwind defaults, mobile-first :

| Breakpoint | Range | Trigger |
|---|---|---|
| sm: | ≥ 640px | Grid 2 cols, hero format |
| md: | ≥ 768px | Tablet aéré |
| lg: | ≥ 1024px | **Split Kabou aside** (layout pivot) |
| xl: | ≥ 1280px | Ajustements mineurs |

**Règle critique :** Kabou aside n'apparaît qu'à partir de lg: (1024px).
En dessous, Kabou est en drawer. Pas de 3 cols jamais.

### Accessibility Strategy

**Target : WCAG 2.1 AA** (standard productivity).

**Couverture actuelle :**

| Critère | Statut |
|---|---|
| Focus visible | ✅ OK (focus-visible:ring, Radix) |
| Keyboard navigation | ✅ OK (Radix complet) |
| ARIA roles | ✅ Largement (Radix) |
| sr-only titles | ✅ Drawer.Title/Description |
| aria-label icon buttons | ⚠️ Partiel, audit nécessaire |
| Contraste foreground/background | ✅ AAA |
| Contraste muted-foreground | ✅ AA |
| Contraste primary sur blanc | ⚠️ 3.87:1 OK large, NOK body |
| Touch targets 44x44 | ⚠️ h-8 = 32px insuffisant pour CTA critique mobile |
| Skip links | ❌ Absent |
| Heading hierarchy | ⚠️ À auditer |
| Reduced motion | ❌ Absent (atmosphere, splash) |

**Manques à fixer :**

1. **Skip link** — lien invisible focus-visible en haut layout pour
   "Passer au contenu principal"
2. **Reduced motion** — `motion-reduce:animation-none` sur animations
   atmosphere-pulse / splash-emerge
3. **aria-label audit** — grep systématique boutons sans label
4. **Contraste primary** — règle : CTA et icônes décoratives uniquement,
   jamais body text
5. **Heading hierarchy** — 1 h1 par page, h2 sections, h3 sous-sections

### Testing Strategy

**Responsive :**
- Chrome DevTools : 375px, 414px, 768px, 1024px, 1440px, 1920px
- Test réel iPhone + iPad
- Network throttling "Slow 4G" pour connexion faible

**Accessibility :**
- Lighthouse a11y ≥ 95
- axe-core browser extension (0 erreur sur /sujets/[id])
- Keyboard-only : Tab/Shift-Tab traverse, Escape ferme, Enter submit
- VoiceOver macOS sur flows critiques
- Color blindness via DevTools Rendering deuteranopia
- Dark mode : tokens fonctionnent (darkMode: 'class' déjà)

### Implementation Guidelines

**Responsive dev :**
- Mobile-first : classes base mobile, sm:/md:/lg: augmentent
- Relative units (rem via Tailwind)
- Next.js Image avec sizes pour responsive
- Drawer Vaul : right desktop / bottom mobile via useMediaQuery
- Touch targets : minimum h-10 (40px) pour CTAs critiques mobile

**Accessibility dev :**
- Semantic HTML : main, article, section, nav, header — pas que div
- ARIA uniquement si nécessaire (Radix couvre beaucoup)
- Focus management : laisser Radix gérer
- Color jamais seule pour signifier un état (icône + couleur)
- motion-reduce:animation-none sur animations décoratives

**Bonnes pratiques lavidz :**
- Bottom nav mobile : max 5 items (usabilité pouce)
- Drawer Vaul : snapPoints pour ajuster hauteur
- Toasts : bottom-center mobile, bottom-right desktop
- Confirmations destructives : AlertDialog, jamais confirm browser natif
