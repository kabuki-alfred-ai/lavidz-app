import { HelpPopover } from '@/components/ui/HelpPopover'

/**
 * Bibliothèque d'aides contextuelles pour la page Sujet. Chaque export est
 * un `<HelpPopover>` pré-rempli — on les dispose dans l'UI sans dupliquer le
 * contenu. Changer le texte ici change partout.
 */

export function AngleHelp() {
  return (
    <HelpPopover title="L'angle — ta prise de position">
      <p>
        La thèse que tu défends, et <strong>pour qui</strong>. Un angle clair
        permet à Kabou de t'aider ensuite à extraire les piliers, cibler les
        sources, et poser le hook.
      </p>
      <p className="italic">
        Exemple : « Pourquoi doubler la taille d'une équipe ne double jamais
        son impact — pour les fondateurs de PME sous pression de recruter. »
      </p>
    </HelpPopover>
  )
}

export function PillarsHelp() {
  return (
    <HelpPopover title="Les piliers — l'ancre narrative">
      <p>
        3 à 5 points de fond qui survivent à tous les formats. Si tu tournes
        une Réaction, une Histoire et un Guide sur ce sujet, ces piliers
        réapparaîtront — juste sous une forme différente.
      </p>
      <p>
        Les piliers font passer le sujet de <em>« une idée »</em> à
        <em> « une thèse défendable »</em>.
      </p>
    </HelpPopover>
  )
}

export function SourcesHelp() {
  return (
    <HelpPopover title="Les sources — ancrages factuels">
      <p>
        Pour muscler l'angle avec du factuel plutôt que de l'opinion pure.
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>
          <strong>Ancrées</strong> : sources que <em>tu</em> as sélectionnées.
          Elles nourrissent le contexte IA de Kabou.
        </li>
        <li>
          <strong>Candidates</strong> : sources trouvées par Kabou/Tavily en
          attente de ton pin. Kabou ne les utilise pas tant qu'elles ne sont
          pas ancrées.
        </li>
      </ul>
    </HelpPopover>
  )
}

export function SessionsHelp() {
  return (
    <HelpPopover title="Les tournages — plusieurs incarnations">
      <p>
        Un sujet peut vivre sous plusieurs formats. Le même angle + mêmes
        piliers génèrent un script différent selon le format choisi. Tu peux
        tourner autant de formats que tu veux ; seulement un peut être en
        cours à la fois.
      </p>
    </HelpPopover>
  )
}

export function TimelineHelp() {
  return (
    <HelpPopover title="Le fil du sujet">
      <p>
        Historique chronologique des décisions et mutations sur ce sujet :
        angle retravaillé, sources ajoutées, tournages lancés, interventions
        de Kabou. Utile pour comprendre « comment j'en suis arrivé là ».
      </p>
    </HelpPopover>
  )
}

export function StageHelp() {
  return (
    <HelpPopover title="L'état créatif du sujet" align="start">
      <ul className="list-none pl-0 space-y-1.5">
        <li>
          <strong>🌱 Graine</strong> — idée à peine posée, angle flou. Discute
          avec Kabou pour la faire émerger.
        </li>
        <li>
          <strong>🌿 Jeune pousse</strong> — angle solide OU au moins 3
          piliers. Le sujet tient debout mais n'est pas encore déclaré prêt.
        </li>
        <li>
          <strong>🌳 Arbre</strong> — tu l'as déclaré prêt à tourner. C'est
          une décision éditoriale, pas une accumulation de données.
        </li>
      </ul>
      <p className="italic pt-1">
        Le passage Jeune pousse → Arbre est <em>manuel</em> : tu cliques
        « Marquer comme prêt » quand tu signes.
      </p>
    </HelpPopover>
  )
}

export function SignalsHelp() {
  return (
    <HelpPopover title="Les 4 signaux" align="end">
      <p>
        Tableau de bord de ce qui tient dans le sujet. Pas un score — tu peux
        passer en Arbre avec 2/4 si tu es sûr·e.
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>
          <strong>Angle</strong> : brief &gt; 400 chars, 2 paragraphes ou liste.
        </li>
        <li>
          <strong>Piliers</strong> : ≥ 3 bullets narratifs.
        </li>
        <li>
          <strong>Sources</strong> : ≥ 2 sources ancrées.
        </li>
        <li>
          <strong>Hook</strong> : au moins une accroche posée.
        </li>
      </ul>
      <p className="italic">
        Clique un signal éteint pour sauter vers la section à traiter.
      </p>
    </HelpPopover>
  )
}

/** Métadonnées riches par format — utilisées dans la tooltip des chips. */
export const FORMAT_META: Record<
  string,
  { label: string; emoji: string; duration: string; purpose: string; example: string }
> = {
  HOT_TAKE: {
    label: 'Réaction',
    emoji: '🔥',
    duration: '60–120s',
    purpose:
      "Prendre position à chaud sur une idée reçue, une actualité ou un consensus qu'on veut contester.",
    example: '« Arrêtez de féliciter les boîtes qui doublent leurs effectifs. »',
  },
  STORYTELLING: {
    label: 'Histoire',
    emoji: '📖',
    duration: '3–5 min · 3–5 chapitres',
    purpose:
      "Raconter un parcours, une anecdote avec un retournement. Narratif, émotionnel, mémorisable.",
    example: '« En 2023 on était 12. On a refusé 3 recrutements. Voilà pourquoi. »',
  },
  QUESTION_BOX: {
    label: 'Interview',
    emoji: '❓',
    duration: '5–10 questions · ~3 min',
    purpose:
      "Explorer un sujet sous forme Q&A — sans script rigide. Laisse place à l'improvisation.",
    example: '« Si tu devais embaucher demain, qui serait la première personne ? »',
  },
  DAILY_TIP: {
    label: 'Conseil du jour',
    emoji: '💡',
    duration: '30–60s',
    purpose:
      'Un conseil actionnable et bref, qu\'on peut appliquer sans contexte supplémentaire.',
    example: '« Avant de poster une offre d\'emploi, écris ce que tu arrêtes. »',
  },
  MYTH_VS_REALITY: {
    label: 'Mythe vs Réalité',
    emoji: '🪞',
    duration: '90s–2 min',
    purpose:
      'Confronter une idée reçue avec ce que tu observes vraiment. Structure binaire, percutante.',
    example: '« Mythe : plus de monde = plus d\'impact. Réalité : plus de coordination. »',
  },
  TELEPROMPTER: {
    label: 'Guide',
    emoji: '📜',
    duration: '2–4 min',
    purpose:
      "Contenu structuré lu au prompteur. Pour un message précis où chaque mot compte.",
    example: '« Voici la méthode en 4 étapes pour croître sans grossir. »',
  },
}

export function FormatHelp({ format }: { format: string }) {
  const meta = FORMAT_META[format]
  if (!meta) return null
  return (
    <HelpPopover title={`${meta.emoji} ${meta.label}`}>
      <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/80">
        {meta.duration}
      </p>
      <p>{meta.purpose}</p>
      <p className="italic">{meta.example}</p>
    </HelpPopover>
  )
}

export function SourceKindsHelp() {
  return (
    <HelpPopover title="Rôles éditoriaux des sources" align="end">
      <ul className="list-none pl-0 space-y-1.5">
        <li>
          <strong>ANCRAGE</strong> — source externe vérifiable avec lien
          (article, étude, site spécialisé).
        </li>
        <li>
          <strong>RÉFÉRENCE</strong> — livre, auteur ou cadre intellectuel
          qu'on cite, avec ou sans URL propre.
        </li>
        <li>
          <strong>VÉCU</strong> — anecdote, chiffre perso ou expérience
          directe de l'entrepreneur. Pas d'URL externe.
        </li>
      </ul>
    </HelpPopover>
  )
}
