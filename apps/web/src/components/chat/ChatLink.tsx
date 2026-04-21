'use client'

import { Children, Fragment, type ReactNode } from 'react'
import NextLink from 'next/link'
import { ExternalLink, FileText, Mic } from 'lucide-react'

// Détecte un chemin ou URL complète vers une session d'enregistrement.
// Accepte /s/{id}, http(s)://host/s/{id} — capturing le {id}.
const SESSION_RE = /(?:https?:\/\/[^\s/]+)?\/s\/([a-z0-9]+)(?=[/?#]|$)/i
const SUBJECT_RE = /(?:https?:\/\/[^\s/]+)?\/sujets\/([a-z0-9]+)(?=[/?#]|$)/i

// Regex pour splitter un texte et retrouver les URLs nues (http(s)://...).
// ReactMarkdown sans remark-gfm ne linkifie pas automatiquement les URLs en
// texte brut, d'où ce fallback côté rendu.
const BARE_URL_RE = /(https?:\/\/[^\s)]+)/g

/**
 * Remplacement de `<a>` pour ReactMarkdown. Détecte les liens internes
 * pointant vers une session ou un sujet et les rend comme un bouton visible
 * plutôt qu'un lien texte noyé dans le paragraphe.
 */
export function ChatLink({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href) return <>{children}</>

  const sessionMatch = href.match(SESSION_RE)
  if (sessionMatch) {
    return (
      <NextLink
        href={`/s/${sessionMatch[1]}`}
        className="my-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline shadow-sm transition hover:bg-primary/90"
      >
        <Mic className="h-4 w-4" />
        Lancer le tournage
      </NextLink>
    )
  }

  const subjectMatch = href.match(SUBJECT_RE)
  if (subjectMatch) {
    return (
      <NextLink
        href={`/sujets/${subjectMatch[1]}`}
        className="my-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary no-underline transition hover:bg-primary/10"
      >
        <FileText className="h-3.5 w-3.5" />
        Ouvrir le sujet
      </NextLink>
    )
  }

  const isExternal = /^https?:\/\//i.test(href)
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:no-underline"
    >
      {children}
      {isExternal && <ExternalLink className="inline h-3 w-3" />}
    </a>
  )
}

/**
 * Remplacement de `<p>` pour ReactMarkdown. Reprend les enfants rendus par
 * markdown et transforme les URLs en texte brut en ChatLink (boutons si la
 * cible est une session/sujet connus).
 */
export function ChatParagraph({ children }: { children?: ReactNode }) {
  const isUrl = (s: string) => /^https?:\/\//i.test(s)
  const transformed = Children.map(children, (child, idx) => {
    if (typeof child !== 'string') return child
    const parts = child.split(BARE_URL_RE)
    if (parts.length === 1) return child
    return (
      <Fragment key={idx}>
        {parts.map((part, i) =>
          isUrl(part)
            ? <ChatLink key={i} href={part}>{part}</ChatLink>
            : <Fragment key={i}>{part}</Fragment>
        )}
      </Fragment>
    )
  })
  return <p>{transformed}</p>
}
