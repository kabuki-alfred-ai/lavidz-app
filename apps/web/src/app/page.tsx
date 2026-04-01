'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight, Sparkles, Play, MessageSquare,
  Loader2, Mail, Check, Shield, Video, Brain,
  Mic, Users, Lightbulb, Volume2, Send, Target
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DEMO_QUESTION = 'Qu\'attendez-vous pour faire du contenu rapidement ?'

export default function Home() {
  const [demoPhase, setDemoPhase] = useState<'idle' | 'welcome' | 'loading' | 'speaking' | 'recording' | 'done' | 'sending' | 'sent'>('idle')
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(24).fill(10))
  const [recTimer, setRecTimer] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const waveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const recIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoStopRef = useRef<NodeJS.Timeout | null>(null)
  const phoneRef = useRef<HTMLDivElement>(null)

  // Quiz state
  const [phoneMode, setPhoneMode] = useState<'demo' | 'quiz'>('demo')
  const [quizStep, setQuizStep] = useState(0) // 0-2 = questions, 3 = email
  const [quizAnswers, setQuizAnswers] = useState({ forWho: '', comWay: '', frequency: '' })
  const [quizEmail, setQuizEmail] = useState('')
  const [quizSubmitting, setQuizSubmitting] = useState(false)
  const [quizSuccess, setQuizSuccess] = useState(false)
  const [quizError, setQuizError] = useState('')

  const stopEverything = useCallback(() => {
    audioRef.current?.pause()
    if (audioRef.current?.src) { URL.revokeObjectURL(audioRef.current.src); audioRef.current.src = '' }
    if (waveIntervalRef.current) clearInterval(waveIntervalRef.current)
    if (recIntervalRef.current) clearInterval(recIntervalRef.current)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    setWaveHeights(Array(24).fill(10))
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  const handleDemoStart = useCallback(async () => {
    if (demoPhase !== 'welcome') return
    setDemoPhase('loading')
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      streamRef.current = mediaStream
      if (videoRef.current) { videoRef.current.srcObject = mediaStream; videoRef.current.muted = true }
      const res = await fetch('/api/demo-tts')
      if (!res.ok) throw new Error('TTS error')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      setDemoPhase('speaking')
      waveIntervalRef.current = setInterval(() => { setWaveHeights(Array(24).fill(0).map(() => Math.random() * 80 + 20)) }, 120)
      audio.play()
      audio.onended = () => {
        if (waveIntervalRef.current) clearInterval(waveIntervalRef.current)
        setWaveHeights(Array(24).fill(10))
        URL.revokeObjectURL(url)
        setDemoPhase('recording')
        setRecTimer(0)
        recIntervalRef.current = setInterval(() => setRecTimer(t => t + 1), 1000)
        autoStopRef.current = setTimeout(() => { if (recIntervalRef.current) clearInterval(recIntervalRef.current); setDemoPhase('done') }, 8000)
      }
    } catch { setDemoPhase('idle'); stopCamera() }
  }, [demoPhase, stopCamera])

  const handleStopRecording = useCallback(() => { if (recIntervalRef.current) clearInterval(recIntervalRef.current); if (autoStopRef.current) clearTimeout(autoStopRef.current); setDemoPhase('done') }, [])
  const handleWelcome = useCallback(() => { setDemoPhase('welcome') }, [])
  const handleSend = useCallback(() => { setDemoPhase('sending'); stopCamera(); setTimeout(() => setDemoPhase('sent'), 1500) }, [stopCamera])
  const handleReset = useCallback(() => { stopEverything(); stopCamera(); setDemoPhase('idle'); setWaveHeights(Array(24).fill(10)); setRecTimer(0) }, [stopEverything, stopCamera])

  const handleJoinBeta = useCallback(() => {
    stopEverything(); stopCamera(); setDemoPhase('idle')
    setPhoneMode('quiz'); setQuizStep(0)
    setQuizAnswers({ forWho: '', comWay: '', frequency: '' })
    setQuizEmail(''); setQuizSuccess(false); setQuizError('')
  }, [stopEverything, stopCamera])

  const handleAnswer = useCallback((field: 'forWho' | 'comWay' | 'frequency', value: string) => {
    setQuizAnswers(prev => ({ ...prev, [field]: value }))
    setTimeout(() => setQuizStep(s => s + 1), 250)
  }, [])

  const handleQuizSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setQuizSubmitting(true); setQuizError('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: quizEmail, forWho: quizAnswers.forWho, comWay: quizAnswers.comWay, frequency: quizAnswers.frequency }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erreur') }
      setQuizSuccess(true)
    } catch (err: any) { setQuizError(err.message) }
    finally { setQuizSubmitting(false) }
  }, [quizEmail, quizAnswers])

  const handleStartDemo = useCallback(() => {
    setPhoneMode('demo'); setDemoPhase('welcome')
  }, [])

  useEffect(() => { return () => { stopEverything(); stopCamera() } }, [stopEverything, stopCamera])

  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el && streamRef.current) { el.srcObject = streamRef.current; el.muted = true }
  }, [demoPhase])

  const isPhoneActive = phoneMode === 'quiz' || demoPhase !== 'idle'

  const handleClosePhone = useCallback(() => {
    stopEverything(); stopCamera()
    setDemoPhase('idle')
    setPhoneMode('demo')
    setQuizStep(0)
    setQuizSuccess(false)
  }, [stopEverything, stopCamera])

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden font-sans">
      {/* Overlay — desktop only, shown when phone is active */}
      {isPhoneActive && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          style={{ zIndex: 9998, animation: 'fadeIn 0.35s ease forwards' }}
          onClick={handleClosePhone}
        />
      )}

      {/* BG */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full mix-blend-screen animate-[pulse_12s_infinite]" />
        <div className="absolute top-[40%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-transparent opacity-[0.12]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 400 400%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%222.5%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")', mixBlendMode: 'overlay' }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative">
            <span className="block w-4 h-4 bg-primary rounded-none transition-all duration-500 group-hover:rotate-90 group-hover:scale-75" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary/40 rounded-none group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-500" />
          </div>
          <span className="font-inter font-bold text-xl uppercase text-foreground">Lavidz</span>
        </div>
        <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest py-1 px-3 border-primary/30 bg-primary/5 text-primary animate-pulse">
          Lancement bientôt
        </Badge>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <main className="relative max-w-7xl mx-auto px-6 pt-16 sm:pt-24 pb-24 sm:pb-32">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
          <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
            <div className="flex items-center gap-3">
              <span className="w-8 h-[1px] bg-primary/60" />
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/80 font-bold flex items-center gap-2">
                <Mic size={12} /> Personal Branding LinkedIn
              </p>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4.2rem] font-inter font-extrabold leading-[1.1]">
              Vous avez l'expertise.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-500">
                LinkedIn ne le sait pas encore.
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-zinc-300 font-inter max-w-xl leading-relaxed border-l-2 border-primary/40 pl-5">
              On vous pose les bonnes questions face caméra. Vous répondez naturellement.{' '}
              <strong className="text-white">On s'occupe du montage. Vous recevez une vidéo LinkedIn prête à poster.</strong>
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button onClick={handleJoinBeta} className="group flex items-center justify-center gap-2 h-14 px-8 font-mono text-[10px] uppercase tracking-[0.2em] bg-primary hover:bg-primary/90 text-white shadow-lg transition-all">
                Rejoindre la liste d'attente <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={handleStartDemo} className="flex items-center justify-center gap-2 h-14 px-8 font-mono text-[10px] uppercase tracking-[0.2em] border border-white/20 text-white/60 hover:border-white/40 hover:text-white transition-all">
                <Play size={13} /> Voir la démo
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Shield size={14} className="text-zinc-500" />
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                1 vidéo offerte · Aucune CB requise · Sans engagement
              </p>
            </div>
          </div>

          {/* ═══════════ PHONE DEMO ═══════════ */}
          {/* Placeholder preserving layout when phone is lifted on desktop */}
          {isPhoneActive && <div className="flex-1 pointer-events-none" aria-hidden="true" />}

          <div
            ref={phoneRef}
            className={cn(
              isPhoneActive
                ? "flex-1 w-full flex justify-center fixed inset-0 items-center justify-center"
                : "flex-1 relative w-full flex justify-center lg:justify-end animate-in fade-in slide-in-from-right-12 duration-1000 delay-300 fill-mode-both"
            )}
            style={isPhoneActive ? { zIndex: 9999 } : undefined}
          >
            <div className={cn("absolute top-1/2 left-1/2 lg:left-[60%] -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] blur-[100px] rounded-full pointer-events-none transition-colors duration-1000 hidden lg:block", isPhoneActive ? 'opacity-0' : demoPhase === 'recording' ? 'bg-red-500/20' : demoPhase === 'speaking' ? 'bg-primary/25' : 'bg-primary/15')} />
            <div
              className={cn(
                "relative bg-[#09090b] overflow-hidden shrink-0 z-10 group/phone",
                isPhoneActive
                  ? "w-full h-full rounded-none border-0 shadow-none lg:w-[320px] lg:h-[650px] lg:border-[8px] lg:border-[#27272a] lg:rounded-[3rem] lg:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]"
                  : "w-[300px] sm:w-[320px] h-[600px] sm:h-[650px] border-[8px] border-[#27272a] rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]"
              )}
              style={isPhoneActive ? { animation: 'phoneFocusIn 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' } : undefined}
            >
              <div className={cn("absolute top-32 -left-[10px] w-1 h-12 bg-[#27272a] rounded-l-md", isPhoneActive && "hidden lg:block")} />
              <div className={cn("absolute top-48 -left-[10px] w-1 h-12 bg-[#27272a] rounded-l-md", isPhoneActive && "hidden lg:block")} />
              <div className={cn("absolute top-36 -right-[10px] w-1 h-16 bg-[#27272a] rounded-r-md", isPhoneActive && "hidden lg:block")} />
              <div className={cn("absolute top-0 inset-x-0 h-7 flex justify-center z-50", isPhoneActive && "hidden lg:flex")}>
                <div className="w-28 h-6 bg-[#09090b] rounded-b-3xl relative">
                  <div className={cn("absolute top-2 right-4 w-1.5 h-1.5 rounded-full transition-colors", demoPhase === 'recording' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse' : demoPhase === 'speaking' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-emerald-500/30')} />
                </div>
              </div>
              {isPhoneActive && (
                <button
                  onClick={handleClosePhone}
                  className="absolute top-8 right-4 z-[60] w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  aria-label="Fermer"
                >
                  <span className="text-white/60 text-sm leading-none">✕</span>
                </button>
              )}
              <div className="w-full h-full relative bg-[#0a0a0a] rounded-[2.5rem] overflow-hidden flex flex-col">
                {(demoPhase === 'speaking' || demoPhase === 'recording' || demoPhase === 'loading') && (
                  <>
                    <video ref={videoCallbackRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]" />
                    <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10 pointer-events-none" />
                  </>
                )}

                {phoneMode === 'quiz' && (
                  <div className="flex-1 flex flex-col relative overflow-hidden" style={{ animation: 'fadeSlideIn 0.4s ease forwards' }}>
                    <div className="absolute inset-0 bg-[#111]">
                      <div className="w-[150%] h-[150%] absolute top-[-25%] left-[-25%] bg-[radial-gradient(circle_at_center,_hsl(14_50%_40%_/_0.12)_0%,_transparent_60%)] animate-[spin_20s_linear_infinite]" />
                    </div>
                    {quizSuccess ? (
                      <div className="relative z-20 flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center" style={{ animation: 'fadeSlideIn 0.5s ease forwards' }}>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,77,28,0.12)', border: '1px solid rgba(255,77,28,0.25)' }}><Check size={28} className="text-primary" /></div>
                        <div><h3 className="text-2xl font-black text-white mb-2">Vous êtes sur la liste.</h3><p className="text-xs text-white/40 leading-relaxed">On vous envoie l'accès dès que c'est prêt.</p></div>
                        <button onClick={() => { setPhoneMode('demo'); setQuizSuccess(false) }} className="text-[10px] font-mono text-white/25 uppercase tracking-widest hover:text-white/50 transition-colors">Voir la démo</button>
                      </div>
                    ) : (
                      <>
                        {/* Progress + back */}
                        <div className="relative z-20 pt-12 px-6 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {[0, 1, 2].map(i => (
                              <div key={i} className="h-1 rounded-full transition-all duration-300" style={{ width: i < quizStep ? 16 : i === quizStep && quizStep < 3 ? 24 : 12, background: i < quizStep ? 'rgba(255,77,28,0.5)' : i === quizStep && quizStep < 3 ? '#FF4D1C' : 'rgba(255,255,255,0.15)' }} />
                            ))}
                          </div>
                          <button onClick={() => { setPhoneMode('demo') }} className="text-[9px] font-mono text-white/20 uppercase tracking-widest hover:text-white/40 transition-colors">Démo →</button>
                        </div>

                        {/* Q1 */}
                        {quizStep === 0 && (
                          <div className="relative z-20 flex-1 flex flex-col justify-between px-5 pt-6 pb-10" style={{ animation: 'fadeSlideIn 0.35s ease forwards' }}>
                            <div>
                              <p className="text-[9px] font-mono text-primary/60 uppercase tracking-widest mb-3">Question 1 / 3</p>
                              <p className="text-base font-inter font-bold text-white leading-snug">Pour qui allez-vous créer ces vidéos ?</p>
                            </div>
                            <div className="flex flex-col gap-2.5 mt-6">
                              {[
                                { label: 'Pour moi', sub: 'Personal Branding', val: 'personal' },
                                { label: 'Pour mon entreprise', sub: 'Com\' / Marque employeur', val: 'company' },
                                { label: 'Pour mes clients', sub: 'Agence / Freelance', val: 'clients' },
                              ].map(opt => (
                                <button key={opt.val} onClick={() => handleAnswer('forWho', opt.val)}
                                  className="w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 active:scale-[0.97]"
                                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF4D1C'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,77,28,0.08)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                                >
                                  <p className="text-sm font-bold text-white">{opt.label}</p>
                                  <p className="text-[10px] text-white/40 mt-0.5">{opt.sub}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Q2 */}
                        {quizStep === 1 && (
                          <div className="relative z-20 flex-1 flex flex-col justify-between px-5 pt-6 pb-10" style={{ animation: 'fadeSlideIn 0.35s ease forwards' }}>
                            <div>
                              <p className="text-[9px] font-mono text-primary/60 uppercase tracking-widest mb-3">Question 2 / 3</p>
                              <p className="text-base font-inter font-bold text-white leading-snug">Comment gérez-vous vos montages vidéo aujourd'hui ?</p>
                            </div>
                            <div className="flex flex-col gap-2 mt-5">
                              {[
                                { label: 'Je paie un monteur ou une agence', val: 'agency' },
                                { label: 'J\'utilise des outils IA', val: 'ai_tools' },
                                { label: 'Je bricole avec des logiciels gratuits', val: 'diy' },
                                { label: 'Je n\'en fais pas encore', val: 'none' },
                              ].map(opt => (
                                <button key={opt.val} onClick={() => handleAnswer('comWay', opt.val)}
                                  className="w-full text-left px-4 py-2.5 rounded-xl border transition-all duration-150 active:scale-[0.97]"
                                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF4D1C'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,77,28,0.08)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                                >
                                  <p className="text-xs font-bold text-white leading-snug">{opt.label}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Q3 */}
                        {quizStep === 2 && (
                          <div className="relative z-20 flex-1 flex flex-col justify-between px-5 pt-6 pb-10" style={{ animation: 'fadeSlideIn 0.35s ease forwards' }}>
                            <div>
                              <p className="text-[9px] font-mono text-primary/60 uppercase tracking-widest mb-3">Question 3 / 3</p>
                              <p className="text-base font-inter font-bold text-white leading-snug">Combien de vidéos par mois pour être efficace sur LinkedIn ?</p>
                            </div>
                            <div className="flex flex-col gap-2 mt-5">
                              {[
                                { label: '1 à 2 vidéos', val: '1-2' },
                                { label: '3 à 4 vidéos (1 par semaine)', val: '3-4' },
                                { label: '5 vidéos et plus', val: '5+' },
                                { label: 'Je ne sais pas', val: 'unknown' },
                              ].map(opt => (
                                <button key={opt.val} onClick={() => handleAnswer('frequency', opt.val)}
                                  className="w-full text-left px-4 py-2.5 rounded-xl border transition-all duration-150 active:scale-[0.97]"
                                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF4D1C'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,77,28,0.08)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                                >
                                  <p className="text-xs font-bold text-white leading-snug">{opt.label}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Email */}
                        {quizStep === 3 && (
                          <div className="relative z-20 flex-1 flex flex-col justify-between px-5 pt-6 pb-10" style={{ animation: 'fadeSlideIn 0.35s ease forwards' }}>
                            <div>
                              <p className="text-[9px] font-mono text-primary/60 uppercase tracking-widest mb-3">Dernière étape</p>
                              <p className="text-base font-inter font-bold text-white leading-snug">Où vous envoyer votre vidéo offerte ?</p>
                              <p className="text-[11px] text-white/40 mt-2">1 vidéo LinkedIn montée offerte, sans CB.</p>
                            </div>
                            <form onSubmit={handleQuizSubmit} className="flex flex-col gap-3 mt-6">
                              <input
                                type="email" required
                                value={quizEmail} onChange={e => setQuizEmail(e.target.value)}
                                placeholder="votre@email.com"
                                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 transition-all"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF4D1C' }}
                                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
                              />
                              {quizError && <p className="text-[10px] font-mono text-red-400">{quizError}</p>}
                              <button type="submit" disabled={quizSubmitting}
                                className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                                style={{ background: '#FF4D1C', color: '#fff' }}
                              >
                                {quizSubmitting ? <Loader2 size={14} className="animate-spin" /> : <><Mail size={14} /> Rejoindre la liste d'attente</>}
                              </button>
                            </form>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {phoneMode === 'demo' && demoPhase === 'idle' && (
                  <div className="flex-1 flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[#111] overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_black_100%)] z-10 pointer-events-none" />
                      <div className="w-[150%] h-[150%] absolute top-[-25%] left-[-25%] bg-[radial-gradient(circle_at_center,_hsl(14_50%_40%_/_0.12)_0%,_transparent_60%)] animate-[spin_20s_linear_infinite]" />
                    </div>
                    <div className="relative z-20 flex flex-col items-center gap-8 px-8 text-center" style={{ animation: 'fadeSlideIn 0.6s ease forwards' }}>
                      <div className="flex items-center gap-2">
                        <div className="relative"><span className="block w-4 h-4 bg-primary rounded-none" /><span className="absolute -top-1 -right-1 w-2 h-2 bg-primary/40 rounded-none" /></div>
                        <span className="font-inter font-bold text-lg uppercase text-white">Lavidz</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white mb-3 leading-tight">Testez l'expérience<br />en 30 secondes</h3>
                        <p className="text-xs text-white/40 leading-relaxed">On vous pose une question. Vous répondez.</p>
                      </div>
                      <button onClick={handleWelcome} className="px-8 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 hover:scale-105" style={{ background: '#FF4D1C', color: '#fff' }}>Commencer →</button>
                    </div>
                  </div>
                )}

                {phoneMode === 'demo' && demoPhase === 'welcome' && (
                  <div className="flex-1 flex flex-col items-center justify-between relative">
                    <div className="absolute inset-0 bg-[#111] overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_black_100%)] z-10 pointer-events-none" />
                      <div className="w-[150%] h-[150%] absolute top-[-25%] left-[-25%] bg-[radial-gradient(circle_at_center,_hsl(14_50%_40%_/_0.15)_0%,_transparent_60%)] animate-[spin_20s_linear_infinite]" />
                    </div>
                    <div className="relative z-20 pt-14 px-6 w-full" style={{ animation: 'fadeSlideIn 0.4s ease forwards' }}>
                      <p className="text-[10px] font-mono text-primary/60 uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><MessageSquare size={12} /> La question</p>
                      <p className="text-lg font-inter font-bold text-white leading-snug">« {DEMO_QUESTION} »</p>
                    </div>
                    <div className="relative z-20 pb-10 flex flex-col items-center gap-4">
                      <div className="flex items-end justify-center gap-[3px] h-8 px-6 opacity-40">
                        {Array(24).fill(0).map((_, i) => (<div key={i} className="flex-1 max-w-[4px] rounded-full bg-primary/50" style={{ height: `${Math.random() * 25 + 8}%` }} />))}
                      </div>
                      <div onClick={handleDemoStart} className="w-16 h-16 rounded-full border-[3px] border-white/20 p-1 flex items-center justify-center cursor-pointer hover:scale-105 transition-all duration-300">
                        <div className="w-full h-full bg-primary rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,77,28,0.4)]"><Play size={20} className="text-white ml-1" /></div>
                      </div>
                      <p className="text-[10px] font-mono uppercase tracking-widest font-bold text-white/40">Lancer la démo</p>
                    </div>
                  </div>
                )}

                {phoneMode === 'demo' && demoPhase === 'loading' && (
                  <div className="flex-1 flex flex-col items-center justify-center z-20 gap-4"><Loader2 size={32} className="text-primary animate-spin" /><p className="text-xs font-mono text-white/50 uppercase tracking-widest">Préparation...</p></div>
                )}

                {phoneMode === 'demo' && (demoPhase === 'speaking' || demoPhase === 'recording') && (
                  <div className="flex-1 flex flex-col z-20 relative">
                    {demoPhase === 'recording' && (
                      <div className="absolute top-12 inset-x-5 flex items-center justify-between z-30" style={{ animation: 'fadeSlideIn 0.4s ease forwards' }}>
                        <div className="flex items-center gap-2 bg-red-500/20 backdrop-blur-md border border-red-500/40 rounded-full px-3 py-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-widest">REC {formatTime(recTimer)}</span></div>
                        <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5"><span className="text-[10px] font-mono text-white/50 uppercase tracking-widest font-bold">1/1</span></div>
                      </div>
                    )}
                    <div className={cn("absolute inset-x-5 z-20 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]", demoPhase === 'speaking' ? "top-1/2 -translate-y-1/2" : "top-24 translate-y-0")}>
                      <div className={cn("bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-500", demoPhase === 'speaking' ? 'p-5' : 'p-3')}>
                        <p className={cn("font-mono uppercase tracking-widest font-bold flex items-center gap-2 transition-all duration-500", demoPhase === 'speaking' ? "text-[10px] text-primary mb-2" : "text-[9px] text-white/40 mb-1")}>
                          {demoPhase === 'speaking' ? <><Volume2 size={12} className="animate-pulse" /> Écoute en cours</> : <>Question</>}
                        </p>
                        <p className={cn("font-inter font-bold leading-snug transition-all duration-500", demoPhase === 'speaking' ? "text-base text-white" : "text-sm text-white/80")}>« {DEMO_QUESTION} »</p>
                      </div>
                    </div>
                    <div className="mt-auto pb-10 pt-4 flex flex-col items-center gap-3">
                      {demoPhase === 'speaking' && (<><div className="flex items-end justify-center gap-[3px] h-10 px-6">{waveHeights.map((h, i) => (<div key={i} className="flex-1 max-w-[4px] rounded-full bg-primary transition-all duration-100" style={{ height: `${h}%` }} />))}</div><p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">Écoute en cours...</p></>)}
                      {demoPhase === 'recording' && (<><div className="flex items-end justify-center gap-[3px] h-8 px-6">{Array(24).fill(0).map((_, i) => (<div key={i} className="flex-1 max-w-[4px] rounded-full bg-red-500/60 transition-all duration-150" style={{ height: `${Math.random() * 50 + 15}%` }} />))}</div><p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">Répondez face caméra</p><div onClick={handleStopRecording} className="w-14 h-14 rounded-full border-[3px] border-red-500/40 p-1 flex items-center justify-center cursor-pointer hover:scale-95 transition-all duration-300"><div className="w-full h-full bg-red-500 rounded-full flex items-center justify-center"><div className="w-5 h-5 bg-white rounded-sm" /></div></div></>)}
                    </div>
                  </div>
                )}

                {phoneMode === 'demo' && demoPhase === 'done' && (
                  <div className="flex-1 flex flex-col items-center justify-center z-20 gap-6 px-8" style={{ animation: 'fadeSlideIn 0.5s ease forwards' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}><Check size={28} className="text-emerald-400" /></div>
                    <div className="text-center"><h3 className="text-2xl font-black text-white mb-2">Dans la boîte.</h3><p className="text-xs text-white/40">Votre réponse a été enregistrée.</p></div>
                    <button onClick={handleSend} className="px-8 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2" style={{ background: '#FF4D1C', color: '#fff' }}><Send size={14} /> Envoyer</button>
                  </div>
                )}

                {phoneMode === 'demo' && demoPhase === 'sending' && (<div className="flex-1 flex flex-col items-center justify-center z-20 gap-4"><Loader2 size={28} className="text-primary animate-spin" /><p className="text-sm font-mono text-white/50 uppercase tracking-widest">Envoi en cours...</p></div>)}

                {phoneMode === 'demo' && demoPhase === 'sent' && (
                  <div className="flex-1 flex flex-col items-center justify-center z-20 gap-6 px-8" style={{ animation: 'fadeSlideIn 0.5s ease forwards' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,77,28,0.12)', border: '1px solid rgba(255,77,28,0.25)' }}><Video size={28} className="text-primary" /></div>
                    <div className="text-center"><h3 className="text-2xl font-black text-white mb-2">Montage en cours</h3><p className="text-xs text-white/40">Vidéo prête à publier par email.</p></div>
                    <div className="flex items-center gap-2 mt-2"><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /><div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.2s' }} /><div className="w-2 h-2 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: '0.4s' }} /></div>
                    <button onClick={handleReset} className="text-[10px] font-mono text-white/25 uppercase tracking-widest mt-4 hover:text-white/50 transition-colors">Relancer la démo</button>
                  </div>
                )}
              </div>
              <style>{`
                @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes phoneFocusIn { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
              `}</style>
            </div>
          </div>
        </div>

        {/* Powered by Kabuki */}
        <div className="mt-20 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-both">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">Powered by</p>
          <Link href="https://kabuki.team" target="_blank" className="group/logo flex items-center gap-3 grayscale hover:grayscale-0 transition-all duration-500 opacity-60 hover:opacity-100">
            <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8"><rect clipPath="url(#hc)" className="h-8 transition-all duration-300 fill-primary w-0 group-hover/logo:w-8" /><use href="#hp" className="stroke-white" fill="none" strokeWidth="1.5" /><defs><path id="hp" d="M3.25 26v.75H7c1.305 0 2.384-.21 3.346-.627.96-.415 1.763-1.02 2.536-1.752.695-.657 1.39-1.443 2.152-2.306l.233-.263c.864-.975 1.843-2.068 3.071-3.266 1.209-1.18 2.881-1.786 4.621-1.786h5.791V5.25H25c-1.305 0-2.384.21-3.346.627-.96.415-1.763 1.02-2.536 1.751-.695.658-1.39 1.444-2.152 2.307l-.233.263c-.864.975-1.843 2.068-3.071 3.266-1.209 1.18-2.881 1.786-4.621 1.786H3.25V26Z" /><clipPath id="hc"><use href="#hp" /></clipPath></defs></svg>
            <span className="font-inter font-bold text-xl tracking-tight text-white">Kabuki</span>
          </Link>
        </div>
      </main>

      {/* ═══════════ PROBLEM — AGITATION ═══════════ */}
      <section className="relative z-10 border-t border-white/5 bg-zinc-950/50 backdrop-blur-3xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_theme(colors.primary.DEFAULT)]" />
        <div className="max-w-5xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-16">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/80 mb-4">Le problème</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
              Vous êtes expert dans votre domaine.<br /><span className="text-zinc-400">Mais personne ne vous voit sur LinkedIn.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {[
              { emoji: '🧠', title: 'Syndrome de la page blanche', desc: 'Vous savez que vous devriez poster. Mais devant la caméra, rien ne sort. Vous repoussez. Encore. Et encore.' },
              { emoji: '⏳', title: '"Je n\'ai pas le temps"', desc: 'Scripter, tourner, monter, sous-titrer. Pour UN post. Les consultants qui cartonnent sur LinkedIn n\'ont pas plus de temps que vous. Ils ont un système.' },
              { emoji: '👻', title: 'Profil fantôme', desc: 'Votre profil est beau. Votre offre est claire. Mais 0 vidéo = 0 confiance. 75% des décideurs LinkedIn veulent voir un visage avant de signer.' },
            ].map((item, i) => (
              <div key={i} className="p-8 bg-background border border-border/60 hover:border-primary/20 transition-all duration-500 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-3xl mb-6 block">{item.emoji}</span>
                <h3 className="text-lg font-inter font-bold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-zinc-400 font-inter leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16 space-y-3">
            <p className="text-xl sm:text-2xl font-inter font-bold text-white leading-relaxed">
              Le contenu texte est mort pour la Gen Z et les Millennials.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">Ils représentent 71% des décideurs B2B.</span>
            </p>
            <p className="text-sm text-zinc-500 font-mono uppercase tracking-widest">Source : LinkedIn B2B Marketing 2026</p>
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="relative z-10 border-t border-white/5 bg-black">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent shadow-[0_0_20px_theme(colors.emerald.500)]" />
        <div className="max-w-5xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-20">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-500/80 mb-4">Votre système LinkedIn</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
              Répondez. <span className="text-emerald-400">On s'occupe du reste.</span>
            </h2>
            <p className="text-lg text-zinc-400 font-inter mt-6 max-w-2xl mx-auto">Pas de script. Pas de vidéaste. Pas de monteur. Juste vous, votre expertise, et une vidéo prête à publier.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {[
              { step: '01', icon: Lightbulb, title: 'Choisissez un thème', desc: 'Votre métier, vos clients, votre sujet du moment. Lavidz génère un questionnaire taillé pour faire ressortir le meilleur de votre expertise.', color: 'text-primary' },
              { step: '02', icon: Brain, title: 'Répondez face caméra', desc: 'Chaque question vous est posée à voix haute. Vous répondez naturellement, comme dans une conversation. Pas de script, pas de stress.', color: 'text-blue-400' },
              { step: '03', icon: Sparkles, title: 'Recevez votre vidéo', desc: 'Vos réponses sont assemblées, montées et sous-titrées automatiquement. Une vidéo LinkedIn native, prête à publier. Vous n\'avez rien à faire.', color: 'text-emerald-400' },
            ].map((item, i) => (
              <div key={i} className={cn("p-8 lg:p-10 border border-border/40 relative group hover:bg-surface/40 transition-all duration-500", i === 1 && "md:border-x-0")}>
                <div className="flex items-center gap-3 mb-6">
                  <span className={cn("text-[10px] font-mono font-black uppercase tracking-widest", item.color)}>{item.step}</span>
                  <div className="flex-1 h-[1px] bg-border/40" />
                  <item.icon size={18} className={cn(item.color, "opacity-60 group-hover:opacity-100 transition-opacity")} />
                </div>
                <h3 className="text-xl font-inter font-bold text-white mb-4">{item.title}</h3>
                <p className="text-sm text-zinc-400 font-inter leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ POUR QUI ═══════════ */}
      <section className="relative z-10 border-t border-white/5 bg-zinc-950/50 backdrop-blur-3xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_theme(colors.primary.DEFAULT)]" />
        <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-20">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60 mb-4">Fait pour vous</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
              Si vous vendez votre expertise,<br /><span className="text-primary">LinkedIn est votre vitrine.</span>
            </h2>
            <p className="text-lg text-zinc-400 font-inter mt-6 max-w-2xl mx-auto">Lavidz transforme n'importe quel expert en créateur LinkedIn régulier. Sans effort. Sans équipe.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UseCard icon={Mic} color="primary" title="Consultant / Coach" sub="Thought Leadership" desc="Vous passez votre temps à résoudre les problèmes de vos clients. Lavidz extrait cette expertise et la transforme en une vidéo LinkedIn qui attire de nouveaux leads." badges={['Posts d\'expertise', 'Vidéos méthode', 'FAQ de votre métier']} stat="5 min" statLabel="pour créer une vidéo" />
            <UseCard icon={Target} color="blue" title="Fondateur / CEO" sub="Personal Branding" desc="94% des décisions B2B reposent sur la confiance. Montrez votre vision, votre parcours, vos convictions. Les gens achètent des gens, pas des logos." badges={['Storytelling fondateur', 'Behind the scenes', 'Vision produit']} stat="94%" statLabel="achètent par confiance" />
            <UseCard icon={Brain} color="emerald" title="Expert / Freelance" sub="Autorité dans votre niche" desc="Vous savez des choses que personne d'autre ne peut dire. Lavidz vous pousse à les exprimer naturellement. Chaque session = une vidéo prête à poster." badges={['Prise de position', 'Contenu evergreen', 'Reels LinkedIn']} stat="x 1.6" statLabel="plus de leads avec la vidéo" />
            <UseCard icon={Users} color="violet" title="Agence / Équipe" sub="Scalez le contenu" desc="Faites tourner Lavidz pour chaque membre de votre team. Multipliez les voix, les angles, la portée. Zéro coordination. Zéro production." badges={['Multi-créateurs', 'Employer branding', 'Contenu scalé']} stat="0 €" statLabel="de production vidéo" />
          </div>
        </div>
      </section>

      {/* ═══════════ LINKEDIN STATS ═══════════ */}
      <section className="relative z-10 border-t border-border/40">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="max-w-5xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-16">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60 mb-4">Pourquoi maintenant</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
              LinkedIn pousse la vidéo.<br /><span className="text-zinc-400">Ceux qui bougent maintenant raflent tout.</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '78%', label: 'des marketeurs B2B font déjà de la vidéo', src: 'LinkedIn Ads 2026' },
              { value: '94%', label: 'disent que la confiance fait la vente', src: 'LinkedIn Ads 2026' },
              { value: '75%', label: 'se fient à leur réseau, pas aux pubs', src: 'Ioana Erhan, LinkedIn' },
              { value: 'x1.6', label: 'plus de leads avec une vidéo vue', src: 'LinkedIn Ads 2026' },
            ].map((s, i) => (
              <div key={i} className="p-6 bg-background border border-border/60 hover:border-primary/20 transition-all group text-center">
                <p className="text-4xl font-inter font-black text-white group-hover:text-primary transition-colors">{s.value}</p>
                <p className="text-xs text-zinc-400 font-inter mt-3 leading-relaxed">{s.label}</p>
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mt-2">— {s.src}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section className="relative z-10 border-t border-white/5 bg-black">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="max-w-3xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-16">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60 mb-4">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-inter font-extrabold text-white">Questions fréquentes</h2>
          </div>
          <FaqList />
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="relative z-10 border-t border-border/40 bg-surface/30">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute inset-0 pointer-events-none"><div className="absolute top-[20%] left-[20%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" /></div>
        <div className="max-w-3xl mx-auto px-6 py-24 lg:py-32 text-center relative z-10 space-y-8">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
            Répondez à quelques questions.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-500">Recevez votre vidéo LinkedIn.</span>
          </h2>
          <p className="text-zinc-300 font-inter text-lg">Rejoignez la liste et recevez votre <strong className="text-white">première vidéo LinkedIn offerte.</strong></p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button onClick={handleJoinBeta} className="group flex items-center justify-center gap-2 h-14 px-10 font-mono text-[10px] uppercase tracking-[0.2em] bg-primary hover:bg-primary/90 text-white shadow-lg transition-all">
              Rejoindre la liste d'attente <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={handleStartDemo} className="flex items-center justify-center gap-2 h-14 px-8 font-mono text-[10px] uppercase tracking-[0.2em] border border-white/20 text-white/60 hover:border-white/40 hover:text-white transition-all">
              <Play size={13} /> Voir la démo
            </button>
          </div>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Pas de spam · Juste l'accès quand c'est prêt</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 px-6 bg-background relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3"><div className="w-2 h-2 bg-primary rounded-none" /><span className="font-inter font-bold text-lg uppercase text-white">Lavidz</span></div>
            <div className="flex items-center gap-3 opacity-60">
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Un produit</span>
              <Link href="https://kabuki.team" target="_blank" className="flex items-center gap-2 group/lf grayscale hover:grayscale-0 transition-all duration-500 hover:opacity-100">
                <svg viewBox="0 0 32 32" className="h-5 w-5"><rect clipPath="url(#fc)" className="h-5 transition-all duration-300 fill-primary w-0 group-hover/lf:w-5" /><use href="#fp" className="stroke-white" fill="none" strokeWidth="1.5" /><defs><path id="fp" d="M3.25 26v.75H7c1.305 0 2.384-.21 3.346-.627.96-.415 1.763-1.02 2.536-1.752.695-.657 1.39-1.443 2.152-2.306l.233-.263c.864-.975 1.843-2.068 3.071-3.266 1.209-1.18 2.881-1.786 4.621-1.786h5.791V5.25H25c-1.305 0-2.384.21-3.346.627-.96.415-1.763 1.02-2.536 1.751-.695.658-1.39 1.444-2.152 2.307l-.233.263c-.864.975-1.843 2.068-3.071 3.266-1.209 1.18-2.881 1.786-4.621 1.786H3.25V26Z" /><clipPath id="fc"><use href="#fp" /></clipPath></defs></svg>
                <span className="font-inter font-bold text-sm text-white">Kabuki</span>
              </Link>
            </div>
          </div>
          <p className="text-xs font-mono text-zinc-400">© {new Date().getFullYear()} Lavidz. Tous droits réservés.</p>
          <Link href="https://www.linkedin.com/in/julien-software-engineer/" target="_blank" className="group/build flex items-center gap-3">
            <div className="flex items-center gap-1.5 py-1.5 px-3 bg-zinc-900 border border-zinc-800 group-hover/build:border-primary/50 group-hover/build:bg-zinc-800/50 transition-all rounded-none">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" /></span>
              <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest group-hover/build:text-white">Build in public</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 group-hover/build:text-white transition-colors">LinkedIn</span>
          </Link>
        </div>
      </footer>
    </div>
  )
}

// ── FAQ ──
const FAQ_ITEMS = [
  {
    q: "C'est quoi exactement Lavidz ?",
    a: "Lavidz est un outil qui transforme vos réponses face caméra en vidéos LinkedIn montées automatiquement. Vous répondez à des questions guidées par IA — on s'occupe du montage, des sous-titres et de la livraison.",
  },
  {
    q: "Est-ce que j'ai besoin d'expérience en vidéo ?",
    a: "Aucune. Lavidz est conçu pour les experts qui veulent créer du contenu, pas pour les vidéastes. Pas de logiciel à maîtriser, pas de script à écrire. Vous parlez, on assemble.",
  },
  {
    q: "Combien de temps ça prend par vidéo ?",
    a: "Entre 5 et 15 minutes selon la longueur. Vous répondez aux questions face caméra depuis votre navigateur, et la vidéo montée vous est envoyée par email. Zéro post-production de votre côté.",
  },
  {
    q: "Quelle est la qualité du montage automatique ?",
    a: "Le montage supprime les silences, les tics de langage et les hésitations grâce à l'IA. Les sous-titres sont générés et synchronisés automatiquement. Le résultat est une vidéo native LinkedIn, prête à publier.",
  },
  {
    q: "Mes données et ma vidéo sont-elles sécurisées ?",
    a: "Oui. Vos enregistrements sont chiffrés et stockés de manière sécurisée. Vous restez propriétaire de votre contenu à 100%. Aucune vidéo n'est utilisée pour entraîner des modèles IA.",
  },
  {
    q: "Ça fonctionne pour quel type de contenu LinkedIn ?",
    a: "Témoignages experts, prises de position, conseils métier, storytelling fondateur, FAQ de votre niche — tout contenu où votre parole a de la valeur. Lavidz génère les questions pour maximiser l'engagement.",
  },
]

function FaqList() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="flex flex-col divide-y divide-border/40">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="group">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 py-5 text-left"
          >
            <span className="font-inter font-semibold text-base text-white group-hover:text-primary transition-colors">{item.q}</span>
            <span className={cn("text-primary/60 text-lg leading-none transition-transform duration-300 shrink-0", open === i && "rotate-45")}>+</span>
          </button>
          {open === i && (
            <p className="pb-5 text-sm text-zinc-400 font-inter leading-relaxed" style={{ animation: 'fadeSlideIn 0.25s ease forwards' }}>
              {item.a}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Use Case Card ──
function UseCard({ icon: Icon, color, title, sub, desc, badges, stat, statLabel }: { icon: any; color: string; title: string; sub: string; desc: string; badges: string[]; stat: string; statLabel: string }) {
  const colors: Record<string, { border: string; bg: string; text: string; badge: string }> = {
    primary: { border: 'hover:border-primary/30', bg: 'bg-primary/5', text: 'text-primary', badge: 'bg-primary/5 text-primary border-primary/15' },
    blue: { border: 'hover:border-blue-500/30', bg: 'bg-blue-500/5', text: 'text-blue-400', badge: 'bg-blue-500/5 text-blue-400 border-blue-500/15' },
    emerald: { border: 'hover:border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15' },
    violet: { border: 'hover:border-violet-500/30', bg: 'bg-violet-500/5', text: 'text-violet-400', badge: 'bg-violet-500/5 text-violet-400 border-violet-500/15' },
  }
  const c = colors[color]
  return (
    <div className={`p-8 lg:p-10 bg-background border border-border/60 ${c.border} transition-all duration-500 group relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-48 h-48 ${c.bg} blur-3xl group-hover:opacity-100 opacity-50 transition-opacity`} />
      <div className="flex items-center gap-4 mb-6 relative z-10">
        <div className={`w-10 h-10 ${c.bg} border border-current/20 flex items-center justify-center group-hover:scale-110 transition-transform ${c.text}`}><Icon size={18} /></div>
        <div><h3 className="text-lg font-inter font-bold text-white">{title}</h3><p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{sub}</p></div>
      </div>
      <p className="text-sm text-zinc-400 font-inter leading-relaxed relative z-10 mb-6">{desc}</p>
      <div className="flex flex-wrap gap-2 relative z-10 mb-6">{badges.map(b => <Badge key={b} variant="outline" className={`font-mono text-[9px] ${c.badge} uppercase tracking-widest px-2.5 py-1 rounded-none`}>{b}</Badge>)}</div>
      <div className="relative z-10 border-t border-border/40 pt-4 flex items-baseline gap-3">
        <span className={`text-2xl font-inter font-black ${c.text}`}>{stat}</span>
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{statLabel}</span>
      </div>
    </div>
  )
}

