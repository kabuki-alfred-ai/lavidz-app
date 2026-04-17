'use client'

import React, { useState } from 'react'
import { Sparkles, Link2, Copy, Check, ChevronRight, User, Users } from 'lucide-react'
import { FORMAT_CONFIGS, type ContentFormat } from '@lavidz/types'

type Audience = 'self' | 'client'

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'instagram', label: 'Instagram', icon: '📱' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
]

type GeneratedResult = {
  questions: { text: string; hint?: string; order: number }[]
  themeTitle: string
  themeDescription?: string
  shareLink: string
  session: { id: string }
}

export default function AiSessionPage() {
  const [audience, setAudience] = useState<Audience>('self')
  const [goal, setGoal] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [selectedFormat, setSelectedFormat] = useState<ContentFormat>('QUESTION_BOX')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('linkedin')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GeneratedResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!goal.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goal.trim(),
          targetAudience: audience,
          recipientEmail: audience === 'client' ? recipientEmail : undefined,
          recipientName: audience === 'client' ? recipientName : undefined,
          format: selectedFormat,
          platform: selectedPlatform,
        }),
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Erreur lors de la génération')
      }

      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!result?.shareLink) return
    await navigator.clipboard.writeText(result.shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <span>IA</span>
          <ChevronRight size={10} />
          <span className="text-foreground">Nouvelle session</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight uppercase">
          Générer une session IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          L&apos;IA génère un questionnaire adapté à votre business et crée un lien d&apos;enregistrement.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleGenerate} className="space-y-6">
        {/* Audience selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Pour qui ?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAudience('self')}
              className={`flex items-center gap-3 p-4 border rounded-lg text-left transition-colors ${
                audience === 'self'
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border bg-surface/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
              }`}
            >
              <User size={16} className={audience === 'self' ? 'text-primary' : ''} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider">Moi-même</p>
                <p className="text-xs text-muted-foreground mt-0.5">Je réponds au questionnaire</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setAudience('client')}
              className={`flex items-center gap-3 p-4 border rounded-lg text-left transition-colors ${
                audience === 'client'
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border bg-surface/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
              }`}
            >
              <Users size={16} className={audience === 'client' ? 'text-primary' : ''} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider">Un client</p>
                <p className="text-xs text-muted-foreground mt-0.5">J&apos;envoie à quelqu&apos;un</p>
              </div>
            </button>
          </div>
        </div>

        {/* Format selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Format de contenu
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(FORMAT_CONFIGS).map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setSelectedFormat(fmt.id)}
                className={`flex flex-col items-start gap-1 p-3 border rounded-lg text-left transition-colors ${
                  selectedFormat === fmt.id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-surface/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{fmt.icon}</span>
                  <span className="text-xs font-medium uppercase tracking-wider">{fmt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-tight">{fmt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Platform selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Plateforme cible
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlatform(p.id)}
                className={`flex items-center justify-center gap-1.5 p-3 border rounded-lg transition-colors ${
                  selectedPlatform === p.id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-surface/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                <span>{p.icon}</span>
                <span className="text-xs font-medium uppercase tracking-wider">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Client fields */}
        {audience === 'client' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Prénom
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Jean"
                className="w-full bg-surface/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="jean@exemple.com"
                className="w-full bg-surface/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Goal */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Objectif de la session
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ex: parler de mon lancement, expliquer ma méthode, recueillir un témoignage client sur la transformation vécue…"
            rows={3}
            className="w-full bg-surface/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !goal.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              Génération en cours…
            </>
          ) : (
            <>
              <Sparkles size={13} />
              Générer le questionnaire
            </>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="border border-primary/20 bg-primary/3 rounded-lg p-5 space-y-4">
            {/* Theme title */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Thème généré</p>
              <p className="font-black text-base uppercase tracking-tight">{result.themeTitle}</p>
              {result.themeDescription && (
                <p className="text-xs text-muted-foreground mt-1">{result.themeDescription}</p>
              )}
            </div>

            {/* Questions */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {result.questions.length} questions générées
              </p>
              <ol className="space-y-2">
                {result.questions.map((q, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-xs text-primary/60 mt-0.5 shrink-0 w-4">{i + 1}.</span>
                    <div>
                      <p className="text-sm text-foreground">{q.text}</p>
                      {q.hint && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">{q.hint}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Share link */}
            <div className="pt-2 border-t border-border/40 space-y-2">
              <p className="text-xs text-muted-foreground">Lien d&apos;enregistrement</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 min-w-0">
                  <Link2 size={12} className="text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">{result.shareLink}</span>
                </div>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs uppercase tracking-wider hover:border-primary/50 hover:text-primary transition-colors shrink-0"
                >
                  {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
