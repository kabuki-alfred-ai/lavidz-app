---
stepsCompleted: [party-mode-discovery]
inputDocuments: []
date: 2026-04-15
author: Antoine
---

# Product Brief: Lavidz V1 — Le copilote vidéo personal branding

## 1. Vision

**Lavidz transforme n'importe quel professionnel en créateur de contenu vidéo performant, sans compétences techniques.**

L'IA de Lavidz agit comme un réalisateur, un interviewer et un growth hacker fusionnés en un seul système. Elle dit quoi dire, guide l'enregistrement, propose le montage, et livre un contenu calibré pour performer sur les réseaux sociaux — tout en préservant l'authenticité de la voix du créateur.

**Pitch en une phrase :** "Tu as 10 minutes ? Lavidz te dit quoi dire, te guide pendant l'enregistrement, et te livre un contenu prêt à poster."

---

## 2. Problème

Les professionnels savent qu'ils doivent poster du contenu vidéo pour construire leur personal branding. Mais ils se heurtent à 4 murs :

| Mur | Douleur |
|---|---|
| **La page blanche** | "Je ne sais pas quoi dire" |
| **La qualité** | "Quand je me filme, c'est amateur" |
| **Le temps** | "Je n'ai pas 2h pour monter une vidéo" |
| **Les codes** | "Je ne connais pas les codes de viralité par plateforme" |

**Aucun outil actuel ne résout les 4 à la fois.** CapCut/Descript font le montage mais pas l'idéation. Opus Clip fait du repurposing mais il faut déjà avoir le contenu. Castmagic génère du texte, pas de la vidéo. Captions est un éditeur, pas un coach.

---

## 3. Cible

**Segment primaire : le professionnel qui veut construire sa marque personnelle**

- Consultants, coaches, formateurs, entrepreneurs
- Facturent 500-1500€/jour, le temps a plus de valeur que l'argent
- Savent que LinkedIn/Instagram/TikTok sont devenus incontournables
- Ne sont PAS des créateurs de contenu — c'est un moyen, pas une fin
- Budget : 75-250€/mois pour du contenu qui génère des leads

**Persona de référence — Marc :**
Marc, consultant en stratégie, 42 ans. Il voit ses concurrents poster des vidéos qui génèrent des leads. Mais il ne sait jamais de quoi parler, il fait 14 prises et déteste le résultat, il n'a pas le temps de monter, et il trouve les vidéos trop "produites" des autres fake.

---

## 4. Modèle de lancement

### Done-for-you avec conciergerie

Le modèle initial n'est PAS du self-service. C'est l'équipe Lavidz qui assure le montage final.

**Flow :**
1. L'IA génère des questions/scripts personnalisés pour le client
2. Le client s'enregistre via l'interface guidée
3. L'équipe Lavidz monte dans le Studio semi-auto (accéléré par l'IA)
4. Le client reçoit sa vidéo montée, prête à publier

**Pourquoi ce modèle :**
- Qualité garantie dès le jour 1
- Chaque montage humain enrichit la knowledge base IA
- On apprend ce que les clients veulent vraiment avant d'automatiser
- Le monteur entraîne le système semi-auto qui le remplacera progressivement

**Trajectoire de scaling :**

| Phase | Montage | Rendering |
|---|---|---|
| Phase 1 — Conciergerie | Monteur humain assisté par l'IA (15 min/vidéo) | Remotion serveur (BullMQ workers) |
| Phase 2 — Semi-auto | Monteur fait du QA + ajustement (5-8 min/vidéo) | Remotion serveur |
| Phase 3 — Self-service | Le client utilise le Studio directement | Remotion Lambda (AWS) |

---

## 5. Pricing

**Offre simplifiée pour le go-to-market — 2 options uniquement :**

### A la carte — 75€ HT / vidéo

- Questions IA personnalisées
- Enregistrement guidé
- Montage pro par l'équipe Lavidz
- Sous-titres + musique
- Export 1 plateforme
- 1 round de révision inclus
- Brand Kit appliqué

### Abonnement — 249€ HT / mois (4 vidéos)

Tout ce qui est dans "A la carte" +
- Export multi-plateforme inclus
- 2 rounds de révisions par vidéo
- Calendrier de contenu IA
- L'IA apprend le style du client au fil du temps
- Soit 62€/vidéo au lieu de 75€

**Suppléments :**
- Plateforme d'export supplémentaire (hors abo) : +15€
- Révision supplémentaire : +20€

**Acquisition : première vidéo offerte.** Coût ~15€ (temps monteur). Taux de conversion estimé : 30-50%.

**Facturation manuelle** pour le lancement (pas de Stripe). L'intégration paiement en ligne viendra avec le scale.

### Unit Economics

| Poste | Coût estimé / vidéo |
|---|---|
| IA (Gemini Flash) | ~0.05€ |
| Transcription | ~0.10€ |
| Stockage (S3/R2) | ~0.02€ |
| Rendering Remotion | ~0.20€ |
| Temps monteur humain (15-30 min) | 8-15€ |
| Overhead | ~2€ |
| **Total** | **~10-18€** |

| Modèle | Revenu/vidéo | Coût/vidéo | Marge brute |
|---|---|---|---|
| A la carte 75€ | 75€ | ~15€ | **80%** |
| Abonnement 62€ | 62€ | ~15€ | **76%** |

**Breakeven :** 1 monteur temps plein (~2 500€/mois) = ~200 vidéos/mois = 10 000-15 000€ de revenu.

### Trajectoire client type

| Mois | Comportement | Revenu |
|---|---|---|
| Mois 1 | 1ère vidéo offerte + 1 achat unité | 75€ |
| Mois 2 | 2 achats supplémentaires | 150€ |
| Mois 3 | Passe à l'abonnement | 249€/mois |
| LTV 18 mois | Abonné fidèle | ~5 500€ |

---

## 6. Avantage compétitif (Moat)

**Le moat de Lavidz repose sur 3 piliers :**

### 1. L'intelligence des questions (Couche IA)

L'IA ne pose pas des questions génériques. Elle dirige une session d'enregistrement comme un réalisateur dirige un acteur. Trois couches de connaissance :

**Couche 1 — Knowledge Base métier (statique, versionnée)**
- Codes de viralité (hook 3s, pattern interrupt, boucle ouverte, CTA émotionnel)
- Techniques d'interview (entonnoir, relances, silence, questions "dernière fois que", miroir)
- Codes par plateforme (LinkedIn autorité, TikTok énergie, Instagram esthétique, YouTube profondeur)
- Structures narratives par format

**Couche 2 — Profil créateur (RAG, pgvector)**
- Transcriptions passées vectorisées
- Sujets d'expertise et vocabulaire
- Style naturel (formel, décontracté, humoristique)
- Anecdotes passées (pour ne pas répéter + en tirer de nouvelles)
- Performance historique
- Audience cible et leurs douleurs

**Couche 3 — Contexte temps réel**
- Trending topics du secteur
- Calendrier éditorial du créateur
- Format choisi + plateforme cible
- Saisonnalité et événements

**Exemple concret :**

IA générique : "Parlez de vos conseils en recrutement."

IA Lavidz pour Marc (consultant recrutement) :
> Format Mythe vs Réalité — LinkedIn — 60s
>
> Hook (0-3s) : "Le CV est mort. Et si tu recrutes encore en le lisant ligne par ligne, tu perds tes meilleurs candidats."
> Question : "Dis-moi la chose la plus absurde que tu as vue un recruteur faire avec un CV."
>
> Développement (3-40s) : "Tu m'as raconté un cas client la semaine dernière — celui qui a rejeté un candidat pour une faute d'orthographe. Raconte cette histoire, mais commence par le résultat : qu'est-ce que le client a perdu ?"
>
> Pivot (40-50s) : "OK maintenant en une phrase : qu'est-ce que tu regardes EN PREMIER quand toi tu reçois un CV ?"
>
> CTA (50-60s) : "Termine avec : Si tu veux savoir comment je recrute sans CV, commente METHODE."

### 2. Le flow de bout en bout

Personne ne fait idéation → enregistrement guidé → montage → livraison multi-plateforme dans un seul outil.

### 3. Le data moat de la conciergerie

Chaque montage humain enrichit la Couche 1. Les choix du monteur (quels passages garder, où couper, quel B-roll) deviennent des patterns codifiés. Plus on monte de vidéos, meilleure est l'IA.

---

## 7. Features V1

### 7.1 Intelligence Artificielle (coeur du produit)

**Génération de questions/scripts personnalisés**
- System prompt enrichi par la Knowledge Base métier (Couche 1)
- Profil créateur récupéré via pgvector (Couche 2)
- Contexte dynamique injecté (Couche 3)
- Stack : Vercel AI SDK → Gemini Flash par défaut, switch via `AI_MODEL` env var

**Knowledge Base métier**
```
packages/ai/knowledge/
├── virality-codes.md
├── interview-techniques.md
├── platform-linkedin.md
├── platform-tiktok.md
├── platform-instagram.md
├── platform-youtube.md
├── formats/
│   ├── question-box.md
│   ├── teleprompter.md
│   ├── hot-take.md
│   ├── storytelling.md
│   ├── daily-tip.md
│   └── myth-vs-reality.md
└── scoring/
    └── virality-checklist.md
```

Fichiers markdown dans le repo, versionnés avec git, éditables par l'équipe. Injectés dans le system prompt — pas besoin de fine-tuning.

### 7.2 Multi-format d'enregistrement

| Format | Principe | Code viral exploité |
|---|---|---|
| **Boite à questions** | L'IA pose des questions, réponse naturelle | Authenticité, curiosité |
| **Teleprompter** | Script IA affiché, l'user suit | Storytelling structuré, hook maîtrisé |
| **Take chaud** | Réaction à un sujet d'actu en 60s | Réactivité, opinion, algo-friendly |
| **Storytelling guidé** | Structure 3 actes : situation → conflit → résolution | Emotion, identification |
| **Conseil du jour** | Tip actionnable en 30-45s | Valeur immédiate, save & share |
| **Mythe vs Réalité** | "On croit que X... en fait Y" | Surprise, pattern interrupt |

**Chaque format = une configuration, pas du code supplémentaire :**
```
Format = {
  recordingMode: 'teleprompter' | 'questions' | 'freeform',
  promptTemplate: PromptConfig,
  recordingGuide: GuideConfig,
  editingTemplate: RemotionTemplate,
  exportPresets: Platform[]
}
```

**UX : le client ne choisit pas un "format".** L'IA propose des options contextualisées :
> "Salut Marc ! Cette semaine tu pourrais :"
> - Option A : "Raconte ton expérience en 60s" (storytelling)
> - Option B : "Réponds à 3 questions de ton audience" (boite à questions)
> - Option C : "Donne ton avis sur [tendance]" (take chaud)

### 7.3 Pre-recording quality check

Avant chaque enregistrement :
- Check audio en temps réel (indicateur vert/orange/rouge)
- Détection de contre-jour
- Guide de cadrage (overlay semi-transparent)
- Alerte environnement bruyant

**Si l'input est mauvais, tout le pipeline downstream est gaspillé.** C'est la feature la moins sexy mais la plus impactante.

### 7.4 Studio semi-auto

**Double usage :**

Pour le monteur Lavidz (usage principal au lancement) :
- Voit l'enregistrement brut + suggestions IA pré-calculées
- Coupes de silences/hésitations pré-marquées
- B-rolls pré-positionnés
- Sous-titres générés et synchronisés
- Brand Kit client appliqué
- Ajuste en 10-15 min au lieu de 30

Pour le client (usage secondaire) :
- Preview du montage en cours
- Commentaires directement sur la timeline ("à 0:32 je préfère couper")
- Remplace le va-et-vient par email
- Outil de collaboration, pas juste de montage

**Interface Studio :**
- Gauche : timeline vidéo avec suggestions IA (silences en gris, moments forts en vert)
- Droite : panneau d'ajustements et d'export

### 7.5 B-rolls automatiques

**Deux sources, une seule interface :**

A. Bibliothèque externe (API Pexels — gratuit, 200 req/h)
- Après transcription, l'IA extrait les mots-clés
- Requête Pexels → sélection des 5-8 meilleurs B-rolls
- Pré-positionnés sur la timeline
- Le monteur/client accepte, refuse ou remplace en 1 clic

B. Bibliothèque perso (upload client)
- Le client upload ses propres B-rolls (locaux, équipe, produit)
- Taggés par catégorie
- L'IA les suggère en contexte

**Pipeline technique :**
```
Enregistrement → Transcription → Analyse IA (mots-clés)
→ Requête Pexels API → Sélection + placement → Studio
```

Cache de B-rolls par catégorie pour limiter les appels API.

### 7.6 Calendrier IA

**Vue semaine/mois avec :**
- Enregistrements planifiés (proposés par l'IA selon profil + trending + performance)
- Vidéos en cours de montage (statut temps réel)
- Vidéos livrées et publiées
- Drag & drop pour réorganiser
- L'IA s'adapte si le client skip un jour

**Notifications :**
> "Marc, tu as un enregistrement prévu aujourd'hui : '5 signaux qu'un candidat ment en entretien'. Pret ?"

### 7.7 Analytics

**V1 — Analytics basiques (sans connexion API réseaux sociaux) :**
- Nombre de vidéos produites ce mois
- Formats utilisés (répartition)
- Plateformes ciblées
- Saisie manuelle des stats par le client (vues, likes) ou lien vers le post
- Progression dans le temps

**V2 (futur) — Analytics connectés :**
- APIs LinkedIn / Instagram / TikTok / YouTube
- Dashboard unifié de performance
- Corrélation IA : quel format + quel sujet + quelle plateforme = meilleure performance
- Ajustement automatique du calendrier

### 7.8 Brand Kit

| Element | Source |
|---|---|
| Couleurs (primaire, secondaire, accent) | Color picker ou import depuis URL du site web |
| Typographies (titres, sous-titres) | Google Fonts ou upload OTF/TTF |
| Logo | Upload PNG/SVG |
| Intro/Outro | Template personnalisé ou upload vidéo |
| Ton de voix IA | "Professionnel", "Decontracte", "Expert" |
| Infos profil | Secteur, expertise, audience cible |

**Quick win technique :** scraping de palette depuis une URL web (extraction CSS + fonts + logo).

Stocké au niveau Organisation. Injecté automatiquement dans les compositions Remotion.

### 7.9 Export multi-plateforme

Un enregistrement → plusieurs exports adaptés :

| Plateforme | Format | Sous-titres | Ton |
|---|---|---|---|
| LinkedIn | 1:1 ou 16:9, 60-90s | Sobres, lisibles | Expert, valeur |
| TikTok | 9:16, 15-45s | Gros, animés | Punchy, énergie |
| Instagram Reels | 9:16, 30-60s | Stylés, brandés | Esthétique |
| YouTube Shorts | 9:16, 30-60s | Standards | Educatif |

L'IA sélectionne les meilleurs segments par plateforme. Ce n'est pas juste un recadrage — c'est un remontage intelligent adapté aux codes de chaque plateforme.

---

## 8. Architecture UX

### Dashboard client — 4 onglets

```
🏠 Accueil | 📅 Calendrier | 📊 Stats | ⚙️ Mon Brand
```

**🏠 Accueil** — "Que faire aujourd'hui ?"
- Prochain enregistrement suggéré + bouton "S'enregistrer"
- Dernière vidéo livrée + stats rapides
- Un seul CTA visible à chaque instant

**📅 Calendrier** — Vue semaine/mois interactive

**📊 Stats** — Progression et performance

**⚙️ Mon Brand** — Brand Kit + profil IA

### Principes UX fondamentaux

- **Règle des 3 clics :** à chaque moment, maximum 3 choix
- **L'IA cache la complexité :** le client ne choisit pas un "format", il choisit ce qu'il a envie de dire
- **Guidé mais pas forcé :** l'authenticité vient du créateur, la structure vient de l'IA
- **Semi-auto = l'IA fait 90%, le client/monteur ajuste 10%**

### Onboarding

**Première vidéo en 5 minutes — avant même de configurer le Brand Kit :**
1. Inscription (email + nom + secteur)
2. L'IA propose immédiatement un sujet + format
3. Enregistrement guidé (template par défaut)
4. L'équipe Lavidz monte et livre
5. Marc est bluffé → ENSUITE il configure son Brand Kit et paie

---

## 9. Architecture technique

### Stack existante (réutilisable)

- **apps/web** : Next.js 15 App Router, TypeScript, Tailwind CSS, Remotion
- **apps/api** : NestJS, BullMQ + Redis, MinIO/S3, Prisma + PostgreSQL
- **packages/database** : Prisma schema + client
- **packages/types** : Types partagés
- **IA** : Vercel AI SDK (Gemini Flash défaut, switch via AI_MODEL env var)
- **RAG** : pgvector (prévu)

### Nouveaux modèles de données (Prisma)

```prisma
model BrandKit {
  id             String   @id @default(uuid())
  organizationId String   @unique
  primaryColor   String
  secondaryColor String
  accentColor    String
  fontTitle      String
  fontBody       String
  logoUrl        String?
  introVideoUrl  String?
  outroVideoUrl  String?
  watermark      Json?
  voiceTone      String
}

model BRoll {
  id             String   @id @default(uuid())
  organizationId String
  source         String   // 'user' | 'pexels' | 'unsplash'
  url            String
  thumbnailUrl   String
  tags           String[]
  duration       Float
}

model ContentCalendar {
  id             String   @id @default(uuid())
  organizationId String
  scheduledDate  DateTime
  topic          String
  format         String
  platforms      String[]
  status         String   // planned, recorded, editing, delivered, published
  recordingId    String?
}

model Composition {
  id             String   @id @default(uuid())
  organizationId String
  recordings     String[]
  brolls         Json[]
  timeline       Json
  exports        Json[]
}
```

### Pipeline post-enregistrement

```
Recording (raw)
       │
       ▼
[BullMQ: Transcription + Analyse]
  ├── Transcription (existant)
  ├── Détection silences/hésitations
  ├── Extraction mots-clés
  └── Segmentation en sections
       │
       ▼
[BullMQ: Suggestions IA + B-rolls]
  ├── Requête Pexels API (mots-clés)
  ├── Proposition de coupes
  ├── Matching B-rolls sur timeline
  └── Génération sous-titres stylés (Brand Kit)
       │
       ▼
[Studio semi-auto]
  ├── Preview Remotion Player
  ├── Ajustements monteur/client
  └── Export multi-plateforme parallèle
```

### Contraintes techniques identifiées

| Contrainte | Mitigation |
|---|---|
| Rendering coûteux à l'échelle | Phase 1 serveur, Phase 3 Remotion Lambda |
| Stockage vidéo volumineux (~300Mo/enregistrement) | Cloudflare R2 + lifecycle (raw 30j, exports 90j) |
| Pexels API limitée (200 req/h) | Cache B-rolls par catégorie |
| Performance Studio sur devices faibles | Preview basse résolution, export haute résolution |
| Pre-recording check nécessite Web Audio API | Déjà utilisé dans le projet |

---

## 10. Risques

| Risque | Impact | Mitigation |
|---|---|---|
| **Studio semi-auto lag/buggy** | Expérience dégradée | Prototyper en premier, dégrader gracieusement |
| **IA hors-sujet / creepy** | Perte de confiance | Fallback sur sujets génériques par industrie si pas assez de contexte |
| **Marché saturé (CapCut, Descript...)** | Perte de différenciation | Le flow bout en bout est le moat — ne pas devenir "juste un outil de montage" |
| **Cold start (1ère visite = expérience vide)** | Churn immédiat | Onboarding "1ère vidéo en 5 min" avec defaults intelligents |
| **Qualité des enregistrements clients** | Matière première inexploitable | Pre-recording quality check obligatoire |
| **Scaling monteurs** | Goulot d'étranglement humain | IA accélère le montage → moins de temps/vidéo → plus de capacité |

---

## 11. Metriques de succès

| Métrique | Cible |
|---|---|
| **North Star : vidéos livrées par semaine** | Croissance semaine/semaine |
| Activation : 1ère vidéo livrée dans les 7 jours | > 60% |
| Conversion vidéo offerte → achat | > 30% |
| Conversion unité → abonnement | > 25% en 3 mois |
| Temps de montage par vidéo | < 15 min (Phase 1), < 8 min (Phase 2) |
| Satisfaction client (NPS) | > 50 |
| Churn abonnement mensuel | < 8% |

---

## 12. Go-to-market

### Stratégie de lancement

**Soft launch** (dès que IA + enregistrement fonctionnent) :
- Premiers clients acquis en direct (réseau, LinkedIn)
- Vidéos montées manuellement
- Objectif : valider le pricing et le product-market fit
- Facturation manuelle

**Lancement complet** (quand le produit est complet) :
- Landing page simple (1 page, 1 CTA)
- Hook : "Ta première vidéo pro, offerte"
- Le client voit le pricing APRES avoir reçu sa vidéo gratuite
- Preuve sociale : avant/après (vidéo brute vs résultat Lavidz)

### Boucle virale intégrée

- Watermark "Fait avec Lavidz" sur les vidéos gratuites
- Templates partageables entre créateurs
- Lavidz mange sa propre nourriture : les vidéos de l'équipe sont faites avec Lavidz

### Message marketing

> "Une vidéo pro de personal branding pour 75 euros. Ou 4 par mois pour 249 euros."

Simple. Compris en 3 secondes.

---

## 13. Hors scope V1

| Feature | Raison du report | Horizon |
|---|---|---|
| Paiement en ligne (Stripe) | Facturation manuelle suffit pour < 50 clients | V1.1 |
| Self-service complet (client monte seul) | Le done-for-you nourrit l'IA | V2 |
| Combinaison multi-enregistrements | Power feature, complexité technique NLE | V2 |
| App mobile native | Web responsive suffit | V2 |
| Score de viralité prédictif | Besoin de data | V2 |
| Analytics connectés (APIs réseaux sociaux) | V1 en saisie manuelle | V1.2 |
| Multi-langue / voiceover IA | Marché francophone d'abord | V3 |
| Gamification / streaks | Besoin d'une base users active | V2 |
| Preview partageable / review interne | Nice-to-have communautaire | V2 |

---

## 14. Vision long terme

> **Lavidz commence comme un service de conciergerie vidéo premium (done-for-you à 75 euros/vidéo) et évolue vers une plateforme self-service de personal branding propulsée par l'IA la plus intelligente du marché.**

Le data moat se construit vidéo après vidéo : chaque montage humain enrichit l'IA, chaque session créateur enrichit le profil RAG, chaque publication enrichit les analytics. Plus Lavidz a d'utilisateurs, meilleures sont les suggestions, plus les nouveaux utilisateurs restent.

L'IA de Lavidz n'est pas un chatbot. C'est un réalisateur invisible. Le client a l'impression de "juste parler". Mais ce qui sort est calibré pour performer.
