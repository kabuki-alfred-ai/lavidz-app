'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowRight, Sparkles, Play, MessageSquare,
  Loader2, Mail, Check, Zap, Shield, Clock,
  Video, ChevronRight, Star, Target, TrendingUp, Eye,
  Brain, Mic, Users, Lightbulb, Bot
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [timer, setTimer] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => setTimer((t) => t + 1), 1000)
    } else {
      setTimer(0)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleRecordClick = async () => {
    if (isRecording) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      setStream(null)
      setIsRecording(false)
    } else {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setStream(mediaStream)
        setIsRecording(true)
      } catch (err) {
        console.error('Camera error', err)
        alert("Impossible d'accéder à la caméra. Vérifiez vos permissions de navigateur.")
      }
    }
  }

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [stream])

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
            <div className={`absolute top-1/2 left-1/2 lg:left-[60%] -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] blur-[100px] rounded-full pointer-events-none transition-colors duration-1000 ${isRecording ? 'bg-red-500/20' : 'bg-primary/20'}`} />

            <div className="relative w-[300px] sm:w-[320px] h-[600px] sm:h-[650px] bg-[#09090b] border-[8px] border-[#27272a] rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden shrink-0 z-10 group/phone transition-transform duration-500">
              <div className="absolute top-32 -left-[10px] w-1 h-12 bg-[#27272a] rounded-l-md" />
              <div className="absolute top-48 -left-[10px] w-1 h-12 bg-[#27272a] rounded-l-md" />
              <div className="absolute top-36 -right-[10px] w-1 h-16 bg-[#27272a] rounded-r-md" />

              <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50">
                <div className="w-28 h-6 bg-[#09090b] rounded-b-3xl relative">
                  <div className={`absolute top-2 right-4 w-1.5 h-1.5 rounded-full transition-colors ${isRecording ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-emerald-500/30'}`} />
                </div>
              </div>

              <div className="w-full h-full relative bg-zinc-900 border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col justify-between">
                <div className={`absolute inset-0 z-0 overflow-hidden bg-[#111] transition-all duration-500 ${isRecording ? '' : 'mix-blend-screen'}`}>
                  {isRecording && (
                    <video
                      ref={videoRef}
                      autoPlay muted playsInline
                      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 scale-100 scale-x-[-1]"
                    />
                  )}
                  {!isRecording && (
                    <>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_black_100%)] z-10 pointer-events-none" />
                      <div className="w-[150%] h-[150%] absolute top-[-25%] left-[-25%] bg-[radial-gradient(circle_at_center,_hsl(14_50%_40%_/_0.15)_0%,_transparent_60%)] animate-[spin_20s_linear_infinite]" />
                    </>
                  )}
                  <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%221.5%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
                </div>

                <div className="relative z-20 pt-10 px-6 flex items-center justify-between pointer-events-none">
                  <div className={`px-3 py-1 ${isRecording ? 'bg-red-500/20 border-red-500/50' : 'bg-black/40 border-white/5'} backdrop-blur-md rounded-full border flex items-center gap-2 transition-colors duration-300`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-500 animate-[pulse_1s_infinite]' : 'bg-white/50'}`} />
                    <span className={`text-[9px] font-mono ${isRecording ? 'text-red-500' : 'text-white/80'} font-bold uppercase tracking-widest`}>
                      {isRecording ? formatTime(timer) : '00:00'}
                    </span>
                  </div>
                  {!isRecording && (
                    <div className="text-[10px] font-mono text-white/50 uppercase tracking-widest font-bold bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 transition-opacity duration-300">
                      Étape 2 / 5
                    </div>
                  )}
                </div>

                <div className={`relative z-20 px-5 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isRecording ? 'absolute top-24 inset-x-0 scale-90 translate-y-0' : 'mt-auto group-hover/phone:-translate-y-2'}`}>
                  <div className={`bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] shadow-2xl relative overflow-hidden transition-all duration-700 ${isRecording ? 'p-4' : 'p-5'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                    {!isRecording && (
                      <p className="text-[10px] font-mono text-primary uppercase tracking-widest mb-3 font-bold flex items-center gap-2">
                        <Brain size={12} /> Question générée par l'IA
                      </p>
                    )}
                    <p className={`${isRecording ? 'text-sm' : 'text-lg'} font-inter font-bold text-white leading-snug transition-all duration-700`}>
                      « Qu'est-ce qui vous a le plus surpris dans notre approche ? »
                    </p>
                  </div>
                </div>

                <div className={`relative z-20 flex flex-col items-center justify-end transition-all duration-700 ${isRecording ? 'pb-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 mt-auto' : 'pb-10 pt-6 bg-gradient-to-t from-black via-black/80 to-transparent'}`}>
                  <div className={`flex items-end justify-center gap-[3px] h-10 px-6 mb-4 transition-opacity duration-500 pointer-events-none ${isRecording ? 'opacity-100' : 'opacity-80'}`}>
                    {[...Array(24)].map((_, i) => {
                      const rand = Math.random()
                      return (
                        <div key={i} className={`flex-1 max-w-[4px] rounded-full ${isRecording ? 'bg-red-500' : 'bg-primary/80'}`} style={{
                          height: isRecording ? `${rand * 80 + 20}%` : `${rand * 30 + 10}%`,
                          animation: `pulse ${rand * 0.5 + 0.3}s infinite alternate`
                        }} />
                      )
                    })}
                  </div>

                  <div className="flex flex-col items-center justify-center gap-4">
                    <div
                      onClick={handleRecordClick}
                      className={`w-16 h-16 rounded-full border-[3px] p-1 flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all duration-500 ${isRecording ? 'border-red-500/40 hover:scale-95' : 'border-white/20 hover:scale-105'}`}
                    >
                      <div className={`w-full h-full flex items-center justify-center transition-all duration-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] ${isRecording ? 'bg-red-500 scale-50 rounded-lg shadow-none' : 'bg-red-500 rounded-full group-hover/phone:scale-95'}`}>
                        {isRecording ? (
                          <div className="w-full h-full bg-white rounded-md transition-all duration-300" />
                        ) : (
                          <span className="w-4 h-4 bg-white rounded-sm opacity-0 group-hover/phone:opacity-100 transition-opacity duration-300" />
                        )}
                      </div>
                    </div>
                    <p className={`text-[10px] font-mono uppercase tracking-widest font-bold transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-white/40'}`}>
                      {isRecording ? 'Stop' : 'Tester'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Powered by Kabuki - Hero Section */}
        <div className="mt-20 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-both">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">Powered by</p>
          <Link href="https://kabuki.fr" target="_blank" className="group/logo flex items-center gap-3 grayscale hover:grayscale-0 transition-all duration-500 opacity-60 hover:opacity-100">
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
              <div className="flex items-center gap-2 group/logo-footer grayscale hover:grayscale-0 transition-all duration-500 hover:opacity-100">
                <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5">
                  <rect clipPath="url(#footer-clip)" className="h-5 transition-all duration-300 fill-primary w-0 group-hover/logo-footer:w-5"></rect>
                  <use href="#footer-path" className="stroke-white" fill="none" strokeWidth="1.5"></use>
                  <defs>
                    <path id="footer-path" d="M3.25 26v.75H7c1.305 0 2.384-.21 3.346-.627.96-.415 1.763-1.02 2.536-1.752.695-.657 1.39-1.443 2.152-2.306l.233-.263c.864-.975 1.843-2.068 3.071-3.266 1.209-1.18 2.881-1.786 4.621-1.786h5.791V5.25H25c-1.305 0-2.384.21-3.346.627-.96.415-1.763 1.02-2.536 1.751-.695.658-1.39 1.444-2.152 2.307l-.233.263c-.864.975-1.843 2.068-3.071 3.266-1.209 1.18-2.881 1.786-4.621 1.786H3.25V26Z"></path>
                    <clipPath id="footer-clip"><use href="#footer-path"></use></clipPath>
                  </defs>
                </svg>
                <span className="font-inter font-bold text-sm tracking-tight text-white">Kabuki</span>
              </div>
            </div>
          </div>
          <p className="text-xs font-mono text-zinc-400">
            © {new Date().getFullYear()} Lavidz. Tous droits réservés.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-xs font-inter text-zinc-400 hover:text-white transition-colors">Twitter</Link>
            <Link href="#" className="text-xs font-inter text-zinc-400 hover:text-white transition-colors">LinkedIn</Link>
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
