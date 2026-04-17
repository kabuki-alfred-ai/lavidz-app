---
stepsCompleted: [party-mode-discovery, party-mode-ux-refactor]
inputDocuments: [product-brief-lavidz-v1.md]
date: 2026-04-15
author: Antoine
---

# Product Brief: Lavidz V2 — UX Simplifiee & Separation des Roles

## 1. Contexte

Le V1 avait trop de features melangees dans une seule interface. L'experience utilisateur etait confuse — 13 items dans la sidebar, pas de distinction entre le createur (USER) et l'equipe de montage (ADMIN). Ce brief redefinit l'architecture UX autour de 3 panels distincts par role, avec le chat IA comme interface principale du USER.

**Principe fondamental : le USER ne voit JAMAIS le back-office.** Il a sa propre app, simplifiee. Son vocabulaire c'est "mon contenu", "mes videos", "s'enregistrer", "mon calendrier" — jamais "admin", "theme", "session", "montage".

---

## 2. Les 3 Panels

### 2.1 Panel USER (le createur — Marc)

**Objectif :** Definir sa ligne editoriale avec l'IA, voir son calendrier, s'enregistrer, recevoir ses videos.

**Layout :** Pas de sidebar. Nav horizontale avec 4 onglets. Colonne centree, epuree.

```
┌──────────────────────────────────────────┐
│  💬 IA   📅 Calendrier   🎬 Videos   👤  │
└──────────────────────────────────────────┘
```

| Onglet | Route | Description |
|---|---|---|
| **💬 IA** | `/chat` | Page chat plein ecran. Onboarding conversationnel + conversations libres. C'est l'interface PRINCIPALE. |
| **📅 Calendrier** | `/calendar` | Vue semaine des contenus planifies, detail par item, bouton s'enregistrer |
| **🎬 Videos** | `/videos` | Liste des videos en montage / livrees / a telecharger |
| **👤 Profil** | `/profile` | Profil IA + Brand Kit basique + ligne editoriale en lecture |

**Premier onglet actif selon le contexte :**
- Premiere connexion → 💬 IA (onboarding)
- Ligne editoriale definie, pas de calendrier → 💬 IA (proposition de generer)
- Calendrier existe → 📅 Calendrier
- Contenu a enregistrer aujourd'hui → 📅 Calendrier avec bandeau

**Route de base :** `/(client)/`
**Redirection au login :** USER → `/(client)/chat`

### 2.2 Panel ADMIN (monteur, equipe de l'org)

**Objectif :** Gerer les sessions clients, monter les videos, piloter le contenu de l'org.

**Layout :** Sidebar legere, organisee par workflow.

```
Sidebar ADMIN :
├── 📋 Sessions (enregistrements a monter)
├── 🎬 Montage (editeur video Studio semi-auto)
├── 📅 Calendrier (planification contenu, vue multi-clients)
├── 🎞️ B-Rolls (bibliotheque)
├── 🎨 Brand Kit (identite visuelle org)
├── 📊 Stats (analytics)
└── 👥 Equipe (gestion membres)
```

**Route de base :** `/admin/`
**Redirection au login :** ADMIN → `/admin/sessions`

### 2.3 Panel SUPERADMIN (administrateur plateforme)

**Objectif :** Tout le panel ADMIN + gestion multi-orgs.

**Layout :** Sidebar complete = sidebar ADMIN + sections supplementaires.

```
Sidebar SUPERADMIN :
├── 🏠 Vue d'ensemble
├── 🏢 Organisations (CRUD, switch)
├── 👥 Utilisateurs (tous)
├── ── Org active ──
├── 📋 Sessions
├── 🎬 Montage
├── 📅 Calendrier
├── 🎞️ B-Rolls
├── 🎨 Brand Kit
├── 📊 Stats
├── 🧠 Profil IA
├── 🔊 Sons / Voix
└── 👥 Equipe org
```

**Route de base :** `/admin/`
**Redirection au login :** SUPERADMIN → `/admin`

---

## 3. Le Chat IA — Interface principale du USER

### 3.1 Pourquoi une page dediee (pas un drawer)

Le chat IA est le coeur du produit pour le USER. C'est par la qu'il :
- Definit sa ligne editoriale (onboarding)
- Genere son calendrier
- Modifie ses sujets
- Prepare ses enregistrements
- Pose des questions sur sa strategie

Un drawer de 350px ne rend pas honneur a cette experience. Le chat merite un plein ecran avec un layout confortable (colonne centree max-width 700px).

### 3.2 Onboarding conversationnel

A sa premiere connexion, Marc arrive sur le chat. L'IA le guide en 5 etapes pour definir sa ligne editoriale :

```
STEP 1: Decouverte
  Collecter : metier, expertise, audience cible
  → Sauvegarde dans EntrepreneurProfile.businessContext

STEP 2: Plateformes & Rythme
  Collecter : plateformes cibles, frequence souhaitee
  → Sauvegarde dans targetPlatforms + targetFrequency

STEP 3: Ton & Style
  Collecter : ton prefere, references, ce qu'il aime/n'aime pas
  → Sauvegarde dans editorialTone + communicationStyle

STEP 4: Piliers editoriaux
  L'IA PROPOSE 3-5 piliers bases sur les reponses precedentes
  L'user valide, ajuste ou demande autre chose
  → Sauvegarde dans editorialPillars

STEP 5: Recapitulatif & Validation
  Afficher la ligne editoriale complete
  [ Valider ] → generer calendrier automatiquement
  [ Ajuster ] → revenir sur un point specifique
```

**Regles de conversation :**
- UNE question a la fois, jamais 3 d'un coup
- Accuser reception + enrichir + avancer a chaque message
- Quand l'IA propose (piliers, recap), utiliser des cartes interactives avec boutons
- Indicateur de progression discret (pas un formulaire)
- Si l'utilisateur est vague, donner un exemple concret pour l'aider

### 3.3 Mode libre post-onboarding

Une fois le calendrier genere, le chat passe en mode libre. L'IA peut :
- Modifier un item du calendrier
- Regenerer le calendrier entier (supprime les PLANNED, garde les RECORDED+)
- Modifier la ligne editoriale
- Conseiller sur un sujet specifique
- Aider a preparer un enregistrement

**Quick actions contextuelles** affichees comme boutons :
- "Modifier un sujet"
- "Regenerer le calendrier"
- "Changer ma ligne editoriale"
- "Mon calendrier"

### 3.4 Cartes interactives dans le chat

Quand l'IA propose ou modifie quelque chose, elle affiche des **cartes riches** dans le flux de conversation :

**Carte "Ligne editoriale" :**
- Piliers editables (edit/supprimer par pilier)
- Ton, plateformes, rythme
- Boutons [Valider] [Modifier]

**Carte "Calendrier genere" :**
- Resume des X contenus sur Y semaines
- Apercu par semaine (sujet + format + icone)
- Bouton [Voir le calendrier]

**Carte "Item modifie" :**
- Avant / Apres
- Nouveau hook suggere
- Date et format

### 3.5 Architecture technique du Chat IA

**Stack :** Vercel AI SDK — `useChat()` cote client, `streamText()` avec `tools` cote API.

**System prompt dynamique :**
```
Le system prompt est reconstruit a chaque message avec :
├── Identite de l'agent (ton, regles de conversation)
├── Profil createur actuel (ce qu'on sait deja)
├── Ligne editoriale actuelle (si elle existe)
├── Calendrier actuel (prochains contenus)
├── Mission en cours (onboarding step X / mode libre)
├── Knowledge Base resumee (codes viralite, interview)
└── Instructions specifiques au step en cours
```

**Tool calls de l'agent :**

| Fonction | Declencheur | Effet |
|---|---|---|
| `update_profile` | L'user donne une info sur lui | Sauvegarde dans EntrepreneurProfile |
| `set_editorial_line` | L'user valide piliers/ton/rythme | Sauvegarde la ligne editoriale |
| `generate_calendar` | L'user valide la ligne editoriale | Genere le calendrier IA + sauvegarde |
| `regenerate_calendar` | L'user demande a regenerer | Supprime PLANNED + regenere |
| `update_calendar_entry` | L'user veut changer un item | Met a jour le topic/format/date |
| `delete_calendar_entry` | L'user supprime un item | Supprime l'entree |

L'IA decide QUAND appeler ces fonctions. Marc dit "change le sujet de mercredi" → l'IA appelle `update_calendar_entry` → le calendrier est mis a jour en temps reel → la carte de confirmation s'affiche dans le chat.

**Persistence :** Les messages sont sauvegardes pour que Marc retrouve son historique.

---

## 4. Calendrier USER

### 4.1 Vue semaine

```
◀  Semaine du 21 avril  ▶    [Aujourd'hui]

MAR 22          MER 23          JEU 24
┌──────────┐   ┌──────────┐   ┌──────────┐
│ 🔥 Take   │   │ 📖 Story  │   │ 💡 Tip    │
│ chaud     │   │ telling   │   │ du jour   │
│           │   │           │   │           │
│ "3 erreurs│   │ "Mon pire │   │ "Arrete   │
│ recrutmt" │   │ recrutmt" │   │ les CV"   │
│           │   │           │   │           │
│ [Voir]    │   │ [Voir]    │   │ [Voir]    │
└──────────┘   └──────────┘   └──────────┘
```

### 4.2 Detail d'un item (au clic)

Modal avec :
- Sujet, description, hook suggere
- Format (icone + label + infos)
- Plateformes cibles
- Statut (badge colore)
- **Actions :**
  - [S'enregistrer] → ouvre la page d'enregistrement (si date arrivee)
  - [Modifier] → renvoie vers le chat IA avec le contexte de cet item
  - [Supprimer] → confirmation + suppression

### 4.3 Regeneration

Bouton "Regenerer" sur la page calendrier :
1. Dialog de confirmation : "Cela va supprimer X evenements planifies. Les enregistrements deja faits sont conserves."
2. Supprime tous les ContentCalendar avec status = PLANNED pour l'org
3. Redirige vers le chat IA pour ajuster/valider la ligne editoriale
4. L'IA genere le nouveau calendrier

---

## 5. Videos USER

Liste simple des videos par statut :

| Statut | Affichage |
|---|---|
| **Planifiee** | 📅 Sujet + date + format — pas encore enregistree |
| **Enregistree** | 🎤 Sujet + date — en attente de montage |
| **En montage** | ⏳ Sujet + date — l'equipe Lavidz travaille dessus |
| **Livree** | ✅ Sujet + date — [Telecharger] [Voir] |

Pas d'editeur. Pas de timeline. Juste une liste avec le statut et les actions.

---

## 6. Profil USER

Page simple avec :
- **Infos profil** : nom, secteur, expertise, audience cible (editable)
- **Ligne editoriale** : piliers, ton, rythme, plateformes (lecture — editable via le chat)
- **Brand Kit basique** : couleurs, logo (editable)
- **Style IA** : ton de voix prefere

---

## 7. Modele de donnees — Nouveaux champs

### EntrepreneurProfile (extension)

```prisma
model EntrepreneurProfile {
  // ... champs existants ...

  // Ligne editoriale
  editorialPillars     String[]   @default([])
  editorialTone        String?
  targetFrequency      Int?       // videos par semaine
  targetPlatforms      String[]   @default([])
  editorialValidated   Boolean    @default(false)
}
```

### ChatMessage (nouveau — persistance du chat)

```prisma
model ChatMessage {
  id             String   @id @default(cuid())
  organizationId String
  role           String   // 'user' | 'assistant' | 'system' | 'tool'
  content        String
  toolCalls      Json?    // si role=assistant et tool calls
  toolResults    Json?    // si role=tool
  createdAt      DateTime @default(now())

  @@index([organizationId, createdAt])
}
```

---

## 8. Architecture technique

### Structure des routes

```
app/
├── (client)/                    ← Layout USER (nav 4 onglets, pas de sidebar)
│   ├── layout.tsx
│   ├── chat/
│   │   └── page.tsx             ← Chat IA plein ecran
│   ├── calendar/
│   │   └── page.tsx             ← Calendrier USER
│   ├── videos/
│   │   └── page.tsx             ← Mes videos
│   └── profile/
│       └── page.tsx             ← Profil + Brand Kit
│
├── admin/                       ← Layout ADMIN/SUPERADMIN (sidebar)
│   ├── layout.tsx
│   ├── sessions/
│   ├── montage/
│   ├── calendar/
│   ├── broll/
│   ├── brand-kit/
│   ├── analytics/
│   ├── team/
│   └── organizations/           ← SUPERADMIN only
│
├── s/[sessionId]/               ← Enregistrement (public, pas de layout)
│   └── page.tsx
│
└── auth/                        ← Login / Register
    └── login/page.tsx
```

### Middleware routing

```typescript
// Apres login :
if (user.role === 'USER') → redirect('/(client)/chat')
if (user.role === 'ADMIN') → redirect('/admin/sessions')
if (user.role === 'SUPERADMIN') → redirect('/admin')

// Acces :
USER ne peut PAS acceder a /admin/*
ADMIN ne peut PAS acceder a /admin/organizations
SUPERADMIN peut tout acceder
```

### API Chat avec tools

```
POST /api/chat

Request : { messages: Message[] }
Response : streaming text + tool calls

Tools disponibles :
├── update_profile(data)           → PUT /api/ai/profile
├── set_editorial_line(pillars, tone, freq, platforms)
├── generate_calendar(weeks, videosPerWeek)
├── regenerate_calendar()          → DELETE planned + generate
├── update_calendar_entry(id, data)
└── delete_calendar_entry(id)
```

---

## 9. Priorites d'implementation

### Phase 1 — Layout & Routing (prerequis)

1. Creer le layout `/(client)/` avec nav 4 onglets
2. Mettre a jour le middleware pour le routing par role
3. Reorganiser la sidebar admin (ADMIN vs SUPERADMIN)
4. Pages placeholder pour les 4 onglets client

### Phase 2 — Chat IA (coeur du produit)

1. Ajouter les champs ligne editoriale au schema Prisma
2. Ajouter le modele ChatMessage
3. Creer l'endpoint `/api/chat` avec tools (Vercel AI SDK)
4. Builder le system prompt dynamique (onboarding + libre)
5. Creer la page chat avec `useChat()` + cartes interactives
6. Implementer les tool calls (update_profile, generate_calendar, etc.)

### Phase 3 — Pages client

1. Page calendrier USER (simplifie par rapport a la version admin)
2. Page videos (liste par statut)
3. Page profil (lecture/edition)

### Phase 4 — Polish

1. Quick actions contextuelles dans le chat
2. Bandeau "contenu a enregistrer aujourd'hui"
3. Indicateur de progression onboarding
4. Persistence des messages chat

---

## 10. Ce qui change par rapport au V1

| Aspect | V1 | V2 |
|---|---|---|
| **Interface USER** | Meme interface que l'admin, confuse | App dediee, 4 onglets, ultra-simple |
| **Chat IA** | Drawer lateral, secondaire | Page plein ecran, interface principale |
| **Onboarding** | Direct dans la creation de session | Conversationnel, guide par etapes |
| **Ligne editoriale** | N'existait pas | Concept central, genere le calendrier |
| **Navigation** | 13 items dans la sidebar pour tous | 4 onglets USER / 7 items ADMIN / complet SUPERADMIN |
| **Calendrier** | Feature parmi d'autres | Resultat direct du chat IA, point central du USER |
| **Vocabulaire** | "Themes", "Sessions", "Montage" | "Mon contenu", "Mes videos", "S'enregistrer" |

---

## 11. Principes UX

1. **Le USER ne voit JAMAIS le back-office.** Vocabulaire client, pas technique.
2. **Le chat est l'interface.** Le calendrier et les videos sont des vues, le chat est le cockpit.
3. **L'IA agit, pas juste parle.** Tool calls = modifications reelles en temps reel.
4. **Maximum 3 choix a chaque instant.** Quick actions, pas de menus.
5. **Le plus simple gagne.** Si Marc doit reflechir a comment utiliser l'app, on a perdu.
