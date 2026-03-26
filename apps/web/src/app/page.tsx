'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowRight, Sparkles, Play, MessageSquare,
  Loader2, Mail, Check, Zap, Shield, Clock,
  Video, ChevronRight, Star, Target, TrendingUp, Eye,
  Brain, Mic, Users, Lightbulb, Bot, Volume2, Send
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DEMO_VOICE_ID = 'KSyQzmsYhFbuOhqj1Xxv'
const DEMO_QUESTION = 'Qu\'attendez-vous pour faire du contenu rapidement ?'

export default function Home() {
  // Demo phases: idle → welcome → loading → speaking → recording → done → sending → sent
  const [demoPhase, setDemoPhase] = useState<'idle' | 'welcome' | 'loading' | 'speaking' | 'recording' | 'done' | 'sending' | 'sent'>('idle')
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(24).fill(10))
  const [recTimer, setRecTimer] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const waveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const recIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoStopRef = useRef<NodeJS.Timeout | null>(null)

  const stopEverything = useCallback(() => {
    audioRef.current?.pause()
    if (audioRef.current?.src) {
      URL.revokeObjectURL(audioRef.current.src)
      audioRef.current.src = ''
    }
    if (waveIntervalRef.current) clearInterval(waveIntervalRef.current)
    if (recIntervalRef.current) clearInterval(recIntervalRef.current)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    setWaveHeights(Array(24).fill(10))
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Welcome → Loading: get webcam + play TTS
  const handleDemoStart = useCallback(async () => {
    if (demoPhase !== 'welcome') return
    setDemoPhase('loading')

    try {
      // Request webcam
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      streamRef.current = mediaStream
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.muted = true
      }

      // Fetch cached TTS audio (generated once, served from disk)
      const res = await fetch('/api/demo-tts')
      if (!res.ok) throw new Error('TTS error')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      // Play TTS with waveform animation
      setDemoPhase('speaking')
      waveIntervalRef.current = setInterval(() => {
        setWaveHeights(Array(24).fill(0).map(() => Math.random() * 80 + 20))
      }, 120)

      audio.play()
      audio.onended = () => {
        if (waveIntervalRef.current) clearInterval(waveIntervalRef.current)
        setWaveHeights(Array(24).fill(10))
        URL.revokeObjectURL(url)

        // Transition to recording phase
        setDemoPhase('recording')
        setRecTimer(0)
        recIntervalRef.current = setInterval(() => setRecTimer(t => t + 1), 1000)

        // Auto-stop recording after 8 seconds
        autoStopRef.current = setTimeout(() => {
          if (recIntervalRef.current) clearInterval(recIntervalRef.current)
          setDemoPhase('done')
        }, 8000)
      }
    } catch {
      setDemoPhase('idle')
      stopCamera()
    }
  }, [demoPhase, stopCamera])

  // Stop recording manually
  const handleStopRecording = useCallback(() => {
    if (recIntervalRef.current) clearInterval(recIntervalRef.current)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    setDemoPhase('done')
  }, [])

  // Idle → Welcome
  const handleWelcome = useCallback(() => {
    setDemoPhase('welcome')
  }, [])

  // Simulate "Envoyer"
  const handleSend = useCallback(() => {
    setDemoPhase('sending')
    stopCamera()
    setTimeout(() => setDemoPhase('sent'), 1500)
  }, [stopCamera])

  // Reset demo
  const handleReset = useCallback(() => {
    stopEverything()
    stopCamera()
    setDemoPhase('idle')
    setWaveHeights(Array(24).fill(10))
    setRecTimer(0)
  }, [stopEverything, stopCamera])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEverything()
      stopCamera()
    }
  }, [stopEverything, stopCamera])

  // Callback ref: attach stream as soon as the <video> element mounts
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el && streamRef.current) {
      el.srcObject = streamRef.current
      el.muted = true
    }
  }, [demoPhase])

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full mix-blend-screen animate-[pulse_12s_infinite] duration-1000" />
        <div className="absolute top-[40%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-transparent opacity-[0.12]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 400 400%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%222.5%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")', mixBlendMode: 'overlay' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative">
            <span className="block w-4 h-4 bg-primary rounded-none transition-all duration-500 group-hover:rotate-90 group-hover:scale-75" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary/40 rounded-none group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-500" />
          </div>
          <span className="font-inter font-bold text-xl uppercase text-foreground">
            Lavidz
          </span>
        </div>
        <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-widest py-1 px-3 border-primary/30 bg-primary/5 text-primary animate-pulse">
          Lancement bientôt
        </Badge>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* HERO — The Big Promise                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 sm:pt-24 pb-24 sm:pb-32">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">

          {/* Text Content */}
          <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">

            {/* Eyebrow — Pattern Interrupt */}
            <div className="flex items-center gap-3">
              <span className="w-8 h-[1px] bg-primary/60" />
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/80 font-bold flex items-center gap-2">
                <Bot size={12} /> Votre machine à contenu vidéo
              </p>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4.2rem] font-inter font-extrabold leading-[1.15]">
              L'IA pose les questions.{' '}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-500">
                Vous récoltez le contenu.
              </span>
            </h1>

            {/* Sub-head */}
            <p className="text-lg lg:text-xl text-zinc-300 font-inter max-w-xl leading-relaxed border-l-2 border-primary/40 pl-5">
              Témoignages clients. Personal branding. Idées de contenu.
              Une IA qui comprend votre business et fait parler les gens face caméra.{' '}
              <strong className="text-white">Sans script. Sans vidéaste. Sans effort.</strong>
            </p>

            {/* Waitlist Form */}
            <div className="pt-4">
              <WaitlistForm />
            </div>

            {/* Micro-trust line */}
            <div className="flex items-center gap-3 pt-2">
              <Shield size={14} className="text-zinc-500" />
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                Gratuit pendant la bêta · Aucune CB requise · Accès prioritaire
              </p>
            </div>
          </div>

          {/* Phone Mockup Visual — KEPT */}
          <div className="flex-1 relative w-full flex justify-center lg:justify-end animate-in fade-in slide-in-from-right-12 duration-1000 delay-300 fill-mode-both">
            <div className={cn(
              "absolute top-1/2 left-1/2 lg:left-[60%] -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] blur-[100px] rounded-full pointer-events-none transition-colors duration-1000",
              demoPhase === 'recording' ? 'bg-red-500/20' : demoPhase === 'speaking' ? 'bg-primary/25' : 'bg-primary/15'
            )} />

            <div className="relative w-[300px] sm:w-[320px] h-[600px] sm:h-[650px] bg-[#09090b] border-[8px] border-[#27272a] rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden shrink-0 z-10 group/phone transition-transform duration-500">
              <div className="absolute top-32 -left-[10px] w-1 h-12 bg-[#27272a] rounded-l-md" />
              <div className="absolute top-48 -left-[10px] w-1 h-12 bg-[#27272a] rounded-l-md" />
              <div className="absolute top-36 -right-[10px] w-1 h-16 bg-[#27272a] rounded-r-md" />

              <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50">
                <div className="w-28 h-6 bg-[#09090b] rounded-b-3xl relative">
                  <div className={cn(
                    "absolute top-2 right-4 w-1.5 h-1.5 rounded-full transition-colors",
                    demoPhase === 'recording' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse' :
                    demoPhase === 'speaking' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' :
                    'bg-emerald-500/30'
                  )} />
                </div>
              </div>

              <div className="w-full h-full relative bg-[#0a0a0a] rounded-[2.5rem] overflow-hidden flex flex-col">

                {/* ── WEBCAM FEED (visible during speaking, recording) ── */}
                {(demoPhase === 'speaking' || demoPhase === 'recording' || demoPhase === 'loading') && (
                  <>
                    <video
                      ref={videoCallbackRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]"
                    />
                    <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10 pointer-events-none" />
                  </>
                )}

                {/* ── IDLE STATE — Intro screen ── */}
                {demoPhase === 'idle' && (
                  <div className="flex-1 flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[#111] overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_black_100%)] z-10 pointer-events-none" />
                      <div className="w-[150%] h-[150%] absolute top-[-25%] left-[-25%] bg-[radial-gradient(circle_at_center,_hsl(14_50%_40%_/_0.12)_0%,_transparent_60%)] animate-[spin_20s_linear_infinite]" />
                      <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%221.5%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
                    </div>

                    <div className="relative z-20 flex flex-col items-center gap-8 px-8 text-center" style={{ animation: 'fadeSlideIn 0.6s ease forwards' }}>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="block w-4 h-4 bg-primary rounded-none" />
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary/40 rounded-none" />
                        </div>
                        <span className="font-inter font-bold text-lg uppercase text-white">Lavidz</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white mb-3 leading-tight">Bienvenue dans<br />l'expérience Lavidz</h3>
                        <p className="text-xs text-white/40 leading-relaxed">J'ai une question pour vous.</p>
                      </div>
                      <button
                        onClick={handleWelcome}
                        className="px-8 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 hover:scale-105"
                        style={{ background: '#FF4D1C', color: '#fff' }}
                      >
                        Commencer →
                      </button>
                    </div>
                  </div>
                )}

                {/* ── WELCOME STATE — Ready to launch ── */}
                {demoPhase === 'welcome' && (
                  <div className="flex-1 flex flex-col items-center justify-between relative">
                    <div className="absolute inset-0 bg-[#111] overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_black_100%)] z-10 pointer-events-none" />
                      <div className="w-[150%] h-[150%] absolute top-[-25%] left-[-25%] bg-[radial-gradient(circle_at_center,_hsl(14_50%_40%_/_0.15)_0%,_transparent_60%)] animate-[spin_20s_linear_infinite]" />
                      <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%221.5%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
                    </div>

                    <div className="relative z-20 pt-14 px-6 w-full" style={{ animation: 'fadeSlideIn 0.4s ease forwards' }}>
                      <p className="text-[10px] font-mono text-primary/60 uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                        <Brain size={12} /> Question générée par l'IA
                      </p>
                      <p className="text-lg font-inter font-bold text-white leading-snug">
                        « {DEMO_QUESTION} »
                      </p>
                    </div>

                    <div className="relative z-20 pb-10 flex flex-col items-center gap-4">
                      <div className="flex items-end justify-center gap-[3px] h-8 px-6 opacity-40">
                        {Array(24).fill(0).map((_, i) => (
                          <div key={i} className="flex-1 max-w-[4px] rounded-full bg-primary/50" style={{ height: `${Math.random() * 25 + 8}%` }} />
                        ))}
                      </div>
                      <div
                        onClick={handleDemoStart}
                        className="w-16 h-16 rounded-full border-[3px] border-white/20 p-1 flex items-center justify-center cursor-pointer hover:scale-105 transition-all duration-300"
                      >
                        <div className="w-full h-full bg-primary rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,77,28,0.4)]">
                          <Play size={20} className="text-white ml-1" />
                        </div>
                      </div>
                      <p className="text-[10px] font-mono uppercase tracking-widest font-bold text-white/40">Lancer la démo</p>
                    </div>
                  </div>
                )}

                {/* ── LOADING STATE (webcam bg) ── */}
                {demoPhase === 'loading' && (
                  <div className="flex-1 flex flex-col items-center justify-center z-20 gap-4">
                    <Loader2 size={32} className="text-primary animate-spin" />
                    <p className="text-xs font-mono text-white/50 uppercase tracking-widest">Préparation...</p>
                  </div>
                )}

                {/* ── SPEAKING + RECORDING (shared layout, question transitions from center → top) ── */}
                {(demoPhase === 'speaking' || demoPhase === 'recording') && (
                  <div className="flex-1 flex flex-col z-20 relative">

                    {/* REC badge — only during recording */}
                    {demoPhase === 'recording' && (
                      <div className="absolute top-12 inset-x-5 flex items-center justify-between z-30" style={{ animation: 'fadeSlideIn 0.4s ease forwards' }}>
                        <div className="flex items-center gap-2 bg-red-500/20 backdrop-blur-md border border-red-500/40 rounded-full px-3 py-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-widest">REC {formatTime(recTimer)}</span>
                        </div>
                        <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5">
                          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest font-bold">1/1</span>
                        </div>
                      </div>
                    )}

                    {/* Question card — centered during speaking, slides to top during recording */}
                    <div className={cn(
                      "absolute inset-x-5 z-20 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                      demoPhase === 'speaking'
                        ? "top-1/2 -translate-y-1/2"
                        : "top-24 translate-y-0"
                    )}>
                      <div className={cn(
                        "bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-500",
                        demoPhase === 'speaking' ? 'p-5' : 'p-3'
                      )}>
                        <p className={cn(
                          "font-mono uppercase tracking-widest font-bold flex items-center gap-2 transition-all duration-500",
                          demoPhase === 'speaking'
                            ? "text-[10px] text-primary mb-2"
                            : "text-[9px] text-white/40 mb-1"
                        )}>
                          {demoPhase === 'speaking' ? (
                            <><Volume2 size={12} className="animate-pulse" /> L'IA vous pose la question</>
                          ) : (
                            <>Question</>
                          )}
                        </p>
                        <p className={cn(
                          "font-inter font-bold leading-snug transition-all duration-500",
                          demoPhase === 'speaking'
                            ? "text-base text-white"
                            : "text-sm text-white/80"
                        )}>
                          « {DEMO_QUESTION} »
                        </p>
                      </div>
                    </div>

                    {/* Bottom area — waveform during speaking, "Répondez" during recording */}
                    <div className="mt-auto pb-10 pt-4 flex flex-col items-center gap-3">
                      {demoPhase === 'speaking' && (
                        <>
                          <div className="flex items-end justify-center gap-[3px] h-10 px-6">
                            {waveHeights.map((h, i) => (
                              <div key={i} className="flex-1 max-w-[4px] rounded-full bg-primary transition-all duration-100" style={{ height: `${h}%` }} />
                            ))}
                          </div>
                          <p className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">Écoute en cours...</p>
                        </>
                      )}
                      {demoPhase === 'recording' && (
                        <>
                          <div className="flex items-end justify-center gap-[3px] h-8 px-6">
                            {Array(24).fill(0).map((_, i) => (
                              <div key={i} className="flex-1 max-w-[4px] rounded-full bg-red-500/60 transition-all duration-150" style={{ height: `${Math.random() * 50 + 15}%` }} />
                            ))}
                          </div>
                          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">Répondez face caméra</p>
                          <div
                            onClick={handleStopRecording}
                            className="w-14 h-14 rounded-full border-[3px] border-red-500/40 p-1 flex items-center justify-center cursor-pointer hover:scale-95 transition-all duration-300"
                          >
                            <div className="w-full h-full bg-red-500 rounded-full flex items-center justify-center">
                              <div className="w-5 h-5 bg-white rounded-sm" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ── DONE STATE — "C'est dans la boîte" ── */}
                {demoPhase === 'done' && (
                  <div className="flex-1 flex flex-col items-center justify-center z-20 gap-6 px-8" style={{ animation: 'fadeSlideIn 0.5s ease forwards' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
                      <Check size={28} className="text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-black text-white mb-2">Dans la boîte.</h3>
                      <p className="text-xs text-white/40 leading-relaxed">Votre réponse a été enregistrée.</p>
                    </div>
                    <button
                      onClick={handleSend}
                      className="px-8 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2"
                      style={{ background: '#FF4D1C', color: '#fff' }}
                    >
                      <Send size={14} /> Envoyer
                    </button>
                  </div>
                )}

                {/* ── SENDING STATE ── */}
                {demoPhase === 'sending' && (
                  <div className="flex-1 flex flex-col items-center justify-center z-20 gap-4">
                    <Loader2 size={28} className="text-primary animate-spin" />
                    <p className="text-sm font-mono text-white/50 uppercase tracking-widest">Envoi en cours...</p>
                  </div>
                )}

                {/* ── SENT STATE — "Montage en cours" ── */}
                {demoPhase === 'sent' && (
                  <div className="flex-1 flex flex-col items-center justify-center z-20 gap-6 px-8" style={{ animation: 'fadeSlideIn 0.5s ease forwards' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,77,28,0.12)', border: '1px solid rgba(255,77,28,0.25)' }}>
                      <Video size={28} className="text-primary" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-2xl font-black text-white mb-2">Montage en cours</h3>
                      <p className="text-xs text-white/40 leading-relaxed">Vous recevrez votre vidéo<br />prête à publier par email.</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-[10px] font-mono text-white/25 uppercase tracking-widest mt-4 hover:text-white/50 transition-colors"
                    >
                      Relancer la démo
                    </button>
                  </div>
                )}

              </div>

              <style>{`
                @keyframes fadeSlideIn {
                  from { opacity: 0; transform: translateY(12px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
            </div>
          </div>

        </div>

        {/* Powered by Kabuki - Hero Section */}
        <div className="mt-20 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-both">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">Powered by</p>
          <Link href="https://kabuki.team" target="_blank" className="group/logo flex items-center gap-3 grayscale hover:grayscale-0 transition-all duration-500 opacity-60 hover:opacity-100">
            <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8">
              <rect clipPath="url(#hero-clip)" className="h-8 transition-all duration-300 fill-primary w-0 group-hover/logo:w-8"></rect>
              <use href="#hero-path" className="stroke-white" fill="none" strokeWidth="1.5"></use>
              <defs>
                <path id="hero-path" d="M3.25 26v.75H7c1.305 0 2.384-.21 3.346-.627.96-.415 1.763-1.02 2.536-1.752.695-.657 1.39-1.443 2.152-2.306l.233-.263c.864-.975 1.843-2.068 3.071-3.266 1.209-1.18 2.881-1.786 4.621-1.786h5.791V5.25H25c-1.305 0-2.384.21-3.346.627-.96.415-1.763 1.02-2.536 1.751-.695.658-1.39 1.444-2.152 2.307l-.233.263c-.864.975-1.843 2.068-3.071 3.266-1.209 1.18-2.881 1.786-4.621 1.786H3.25V26Z"></path>
                <clipPath id="hero-clip"><use href="#hero-path"></use></clipPath>
              </defs>
            </svg>
            <span className="font-inter font-bold text-xl tracking-tight text-white">Kabuki</span>
          </Link>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PROBLEM — Agitation Section                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-t border-white/5 bg-zinc-950/50 backdrop-blur-3xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_theme(colors.primary.DEFAULT)]" />

        <div className="max-w-5xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-16">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/80 mb-4">Le vrai problème</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
              La vidéo convertit 5x plus.<br />
              <span className="text-zinc-400">Vous en produisez 0.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                emoji: '🧠',
                title: 'Page blanche',
                desc: 'Vous vous filmez. Rien ne sort. Zéro contenu publié cette semaine.',
              },
              {
                emoji: '📅',
                title: 'Clients fantômes',
                desc: '"Oui je fais le témoignage." Ça fait 6 mois. Toujours rien.',
              },
              {
                emoji: '💸',
                title: 'Budget explosé',
                desc: 'Vidéaste + monteur + studio = 2000€ pour 3 minutes. Non merci.',
              },
            ].map((item, i) => (
              <div key={i} className="p-8 bg-background border border-border/60 hover:border-primary/20 transition-all duration-500 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-3xl mb-6 block">{item.emoji}</span>
                <h3 className="text-lg font-inter font-bold text-white mb-3 leading-normal">{item.title}</h3>
                <p className="text-sm text-zinc-400 font-inter leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <p className="text-xl sm:text-2xl font-inter font-bold text-white leading-relaxed">
              Vos concurrents publient tous les jours.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">Pas vous.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECRET WEAPON — AI + Smart Questioning                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-t border-white/5 bg-black">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent shadow-[0_0_20px_theme(colors.emerald.500)]" />

        <div className="max-w-5xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-20">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-500/80 mb-4">
              Comment ça marche
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
              3 étapes.<br />
              <span className="text-emerald-400">Du contenu en 10 minutes.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {[
              {
                step: '01',
                icon: Lightbulb,
                title: 'Décrivez votre business',
                desc: '2 phrases. L\'IA comprend votre marché, votre cible, ce qui vous rend unique.',
                color: 'text-primary',
              },
              {
                step: '02',
                icon: Brain,
                title: 'L\'IA génère les questions',
                desc: 'Sur mesure. Pas du générique. Calibrées pour faire sortir les meilleures réponses face caméra.',
                color: 'text-blue-400',
              },
              {
                step: '03',
                icon: Sparkles,
                title: 'Filmez. Recevez. Publiez.',
                desc: 'Vous ou vos clients. Rushs isolés, transcrits, prêts à poster.',
                color: 'text-emerald-400',
              },
            ].map((item, i) => (
              <div key={i} className={cn(
                "p-8 lg:p-10 border border-border/40 relative group hover:bg-surface/40 transition-all duration-500",
                i === 1 && "md:border-x-0"
              )}>
                <div className="flex items-center gap-3 mb-6">
                  <span className={cn("text-[10px] font-mono font-black uppercase tracking-widest", item.color)}>
                    {item.step}
                  </span>
                  <div className="flex-1 h-[1px] bg-border/40" />
                  <item.icon size={18} className={cn(item.color, "opacity-60 group-hover:opacity-100 transition-opacity")} />
                </div>
                <h3 className="text-xl font-inter font-bold text-white mb-4 leading-normal">{item.title}</h3>
                <p className="text-sm text-zinc-400 font-inter leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3 MODES — The Power of Lavidz                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-t border-white/5 bg-zinc-950/50 backdrop-blur-3xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_theme(colors.primary.DEFAULT)]" />

        <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-20">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60 mb-4">Un outil, quatre armes</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
              Preuve sociale. Branding.{' '}
              <span className="text-primary">RH. Idéation.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Mode 1 — Preuve Sociale */}
            <div className="p-8 lg:p-10 bg-background border border-border/60 hover:border-blue-500/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-3xl group-hover:bg-blue-500/10 transition-colors" />
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Target size={18} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-inter font-bold text-white">Mode Preuve Sociale</h3>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Témoignages clients</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 font-inter leading-relaxed relative z-10 mb-6">
                Un lien. L'IA pose les questions. Vos clients répondent face caméra. Vous récoltez des témoignages <strong className="text-white">pendant que vous dormez</strong>.
              </p>
              <div className="flex flex-wrap gap-2 relative z-10">
                <Badge variant="outline" className="font-mono text-[9px] bg-blue-500/5 text-blue-400 border-blue-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Témoignages clients</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-blue-500/5 text-blue-400 border-blue-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Études de cas</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-blue-500/5 text-blue-400 border-blue-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Avis vidéo</Badge>
              </div>
            </div>

            {/* Mode 2 — Personal Branding */}
            <div className="p-8 lg:p-10 bg-background border border-border/60 hover:border-primary/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-3xl group-hover:bg-primary/10 transition-colors" />
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Mic size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-inter font-bold text-white">Mode Personal Branding</h3>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Votre Ghostwriter vidéo</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 font-inter leading-relaxed relative z-10 mb-6">
                L'IA vous challenge. Vous répondez. <strong className="text-white">30 jours de contenu en 1 session</strong>. Votre ghostwriter vidéo.
              </p>
              <div className="flex flex-wrap gap-2 relative z-10">
                <Badge variant="outline" className="font-mono text-[9px] bg-primary/5 text-primary border-primary/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Contenu LinkedIn</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-primary/5 text-primary border-primary/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Reels & Shorts</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-primary/5 text-primary border-primary/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Podcasts solo</Badge>
              </div>
            </div>

            {/* Mode 3 — Challenge Entrepreneur */}
            <div className="p-8 lg:p-10 bg-background border border-border/60 hover:border-emerald-500/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Brain size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-inter font-bold text-white">Mode Challenge</h3>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Idéation business</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 font-inter leading-relaxed relative z-10 mb-6">
                L'IA creuse votre vision, vos process, vos convictions. Elle vous pousse à <strong className="text-white">dire ce que personne d'autre ne peut dire</strong>. Chaque réponse = du contenu.
              </p>
              <div className="flex flex-wrap gap-2 relative z-10">
                <Badge variant="outline" className="font-mono text-[9px] bg-emerald-500/5 text-emerald-400 border-emerald-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Vision & Stratégie</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-emerald-500/5 text-emerald-400 border-emerald-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Positionnement</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-emerald-500/5 text-emerald-400 border-emerald-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Idéation contenu</Badge>
              </div>
            </div>

            {/* Mode 4 — RH & Marque Employeur */}
            <div className="p-8 lg:p-10 bg-background border border-border/60 hover:border-violet-500/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/5 blur-3xl group-hover:bg-violet-500/10 transition-colors" />
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users size={18} className="text-violet-400" />
                </div>
                <div>
                  <h3 className="text-lg font-inter font-bold text-white">Mode RH</h3>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Marque employeur</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 font-inter leading-relaxed relative z-10 mb-6">
                Vos équipes parlent de leur quotidien face caméra. <strong className="text-white">Les meilleurs talents ne lisent pas vos offres — ils veulent sentir votre culture</strong>. Zéro tournage. Zéro coordo.
              </p>
              <div className="flex flex-wrap gap-2 relative z-10">
                <Badge variant="outline" className="font-mono text-[9px] bg-violet-500/5 text-violet-400 border-violet-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Témoignages employés</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-violet-500/5 text-violet-400 border-violet-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Onboarding</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-violet-500/5 text-violet-400 border-violet-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Recrutement</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PROMISE — The Big Vision                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-t border-border/40">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="max-w-4xl mx-auto px-6 py-24 lg:py-32 text-center">
          <div className="space-y-8">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60">La vision</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
              Zéro script. Zéro tournage.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-500">
                Du contenu vidéo tous les jours.
              </span>
            </h2>
            <p className="text-lg text-zinc-300 font-inter max-w-2xl mx-auto leading-relaxed">
              Une IA. Une caméra. La vérité brute.
            </p>
            <p className="text-lg font-inter font-bold text-white max-w-xl mx-auto">
              Le futur du contenu commence ici.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* FINAL CTA                                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-t border-border/40 bg-surface/30">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[20%] left-[20%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-3xl mx-auto px-6 py-24 lg:py-32 text-center relative z-10">
          <div className="space-y-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-inter font-extrabold leading-snug text-white">
              Arrêtez de réfléchir.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-500">Commencez à filmer.</span>
            </h2>
            <p className="text-zinc-300 font-inter text-lg">
              Accès gratuit et illimité pour les premiers inscrits.
            </p>

            <div className="flex justify-center">
              <WaitlistForm />
            </div>

            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              Pas de spam · Juste l'accès quand c'est prêt
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 px-6 bg-background relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-none" />
              <span className="font-inter font-bold text-lg uppercase text-white">
                Lavidz
              </span>
            </div>
            <div className="flex items-center gap-3 opacity-60">
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Un produit</span>
              <Link href="https://kabuki.team" target="_blank" className="flex items-center gap-2 group/logo-footer grayscale hover:grayscale-0 transition-all duration-500 hover:opacity-100">
                <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5">
                  <rect clipPath="url(#footer-clip)" className="h-5 transition-all duration-300 fill-primary w-0 group-hover/logo-footer:w-5"></rect>
                  <use href="#footer-path" className="stroke-white" fill="none" strokeWidth="1.5"></use>
                  <defs>
                    <path id="footer-path" d="M3.25 26v.75H7c1.305 0 2.384-.21 3.346-.627.96-.415 1.763-1.02 2.536-1.752.695-.657 1.39-1.443 2.152-2.306l.233-.263c.864-.975 1.843-2.068 3.071-3.266 1.209-1.18 2.881-1.786 4.621-1.786h5.791V5.25H25c-1.305 0-2.384.21-3.346.627-.96.415-1.763 1.02-2.536 1.751-.695.658-1.39 1.444-2.152 2.307l-.233.263c-.864.975-1.843 2.068-3.071 3.266-1.209 1.18-2.881 1.786-4.621 1.786H3.25V26Z"></path>
                    <clipPath id="footer-clip"><use href="#footer-path"></use></clipPath>
                  </defs>
                </svg>
                <span className="font-inter font-bold text-sm tracking-tight text-white">Kabuki</span>
              </Link>
            </div>
          </div>
          <p className="text-xs font-mono text-zinc-400">
            © {new Date().getFullYear()} Lavidz. Tous droits réservés.
          </p>
          <div className="flex flex-col items-end gap-3">
            <Link 
              href="https://www.linkedin.com/in/julien-software-engineer/" 
              target="_blank"
              className="group/build flex items-center gap-3 transition-all"
            >
              <div className="flex items-center gap-1.5 py-1.5 px-3 bg-zinc-900 border border-zinc-800 group-hover/build:border-primary/50 group-hover/build:bg-zinc-800/50 transition-all rounded-none">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                </span>
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest group-hover/build:text-white">Build in public</span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 group-hover/build:text-white transition-colors">LinkedIn</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Waitlist Form ──────────────────────────────────────────────────────────────

function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Une erreur est survenue')
      }
      setSuccess(true)
      setEmail('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-3 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 animate-in fade-in zoom-in duration-500">
        <Check size={18} />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest font-bold">
            Vous êtes sur la liste.
          </p>
          <p className="font-inter text-[11px] text-emerald-400/70 mt-0.5">
            On vous envoie l'accès dès que c'est prêt.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="flex flex-col sm:flex-row gap-0 border border-white/20 bg-white/5 backdrop-blur-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all duration-500 shadow-2xl">
          <div className="relative flex-1">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors" size={14} />
            <Input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-14 pl-12 border-none bg-transparent rounded-none focus-visible:ring-0 text-white placeholder:text-white/30 text-sm"
            />
          </div>
          <Button 
            type="submit" 
            disabled={loading}
            className="h-14 sm:w-auto px-8 rounded-none font-mono text-[10px] uppercase tracking-[0.2em] bg-primary hover:bg-primary/90 text-white shadow-lg transition-all"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <>Rejoindre la bêta <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={14} /></>
            )}
          </Button>
        </div>
        {error && (
          <p className="absolute -bottom-6 left-0 text-[9px] font-mono text-pink-500 uppercase tracking-widest animate-in fade-in slide-in-from-top-2">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
