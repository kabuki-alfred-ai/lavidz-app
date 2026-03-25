'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowRight, Sparkles, Play, MessageSquare,
  Loader2, Mail, Check, Zap, Shield, Clock,
  Video, ChevronRight, Star, Target, TrendingUp, Eye
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
        <div className="absolute inset-0 bg-transparent opacity-[0.15]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 400 400%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%222.5%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")', mixBlendMode: 'overlay' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative">
            <span className="block w-4 h-4 bg-primary rounded-none transition-all duration-500 group-hover:rotate-90 group-hover:scale-75" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary/40 rounded-none group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-500" />
          </div>
          <span className="font-syne font-bold text-xl uppercase text-foreground">
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
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/80 font-bold">
                La vidéo qui vend à votre place
              </p>
            </div>

            {/* Headline — Hormozi-style: Outcome + Mechanism */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4.2rem] font-syne font-bold leading-[1.3] pb-8">
              Récoltez des témoignages vidéo{' '}
              <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-500 pb-4 mb-[-1rem]">
                à la demande.
              </span>
              <br />
              <span className="text-white/60 text-3xl sm:text-4xl lg:text-[2.8rem] font-syne leading-relaxed block mt-4">
                Sans agenda. Sans plateau. Sans excuse.
              </span>
            </h1>

            {/* Sub-head — Agitate the pain */}
            <p className="text-lg lg:text-xl text-zinc-300 font-inter max-w-xl leading-relaxed border-l-2 border-primary/40 pl-5">
              Vos clients sont satisfaits mais personne ne le sait.
              Lavidz envoie un lien, guide la personne face caméra,
              et vous livre un rush prêt à monter — <strong className="text-white">pendant que vous dormez.</strong>
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
                        <MessageSquare size={12} /> La question
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
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PROBLEM — Agitation Section                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-t border-white/5 bg-zinc-950/50 backdrop-blur-3xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_theme(colors.primary.DEFAULT)]" />

        <div className="max-w-5xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-16">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/80 mb-4">Le vrai problème</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-syne font-bold leading-snug text-white pb-2">
              Vos clients adorent ce que vous faites.<br />
              <span className="text-zinc-400">Mais personne ne les entend.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                emoji: '📅',
                title: 'Impossible de caler un créneau',
                desc: 'Entre leur agenda et le vôtre, un témoignage vidéo prend des semaines à organiser. La plupart ne se font jamais.',
              },
              {
                emoji: '😬',
                title: 'Les gens sont mal à l\'aise',
                desc: 'Face à une caméra, sans cadre ni guidance, même votre meilleur client devient muet. Le résultat ? Du contenu inutilisable.',
              },
              {
                emoji: '💸',
                title: 'Ça coûte une fortune à produire',
                desc: 'Vidéaste, monteur, studio. Pour 3 minutes de témoignage, vous dépensez plus que ce que ça vous rapporte.',
              },
            ].map((item, i) => (
              <div key={i} className="p-8 bg-background border border-border/60 hover:border-primary/20 transition-all duration-500 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-3xl mb-6 block">{item.emoji}</span>
                <h3 className="text-lg font-syne font-bold text-foreground mb-3 pb-1 leading-normal">{item.title}</h3>
                <p className="text-sm text-zinc-400 font-inter leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <p className="text-xl sm:text-2xl font-syne font-bold text-foreground leading-relaxed pb-2">
              Résultat : votre meilleure preuve sociale{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400 py-1">reste bloquée dans la tête</span>
              {' '}de vos clients.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SOLUTION — How It Works (3 Steps)                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-t border-white/5 bg-black">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent shadow-[0_0_20px_theme(colors.emerald.500)]" />

        <div className="max-w-5xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-20">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-500/80 mb-4">
              Stupidement simple
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-syne font-bold leading-snug pb-2">
              3 étapes. Zéro friction.<br />
              <span className="text-emerald-400">Des vidéos qui convertissent.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {[
              {
                step: '01',
                icon: Zap,
                title: 'Envoyez un lien',
                desc: 'Choisissez un parcours de questions. Personnalisez-le avec votre marque. Envoyez le lien à votre client — par email, SMS, WhatsApp. 10 secondes.',
                color: 'text-primary',
                borderColor: 'border-primary/20',
              },
              {
                step: '02',
                icon: Video,
                title: 'Il s\'enregistre seul',
                desc: 'Votre client ouvre le lien sur son téléphone. Les questions défilent une par une. Il répond face caméra, guidé naturellement. Aucune app à télécharger.',
                color: 'text-blue-400',
                borderColor: 'border-blue-500/20',
              },
              {
                step: '03',
                icon: Sparkles,
                title: 'Vous recevez les rushs',
                desc: 'Chaque réponse est isolée, nommée, prête à être montée. Transcription automatique incluse. Vous n\'avez plus qu\'à assembler votre chef-d\'œuvre.',
                color: 'text-emerald-400',
                borderColor: 'border-emerald-500/20',
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
                <h3 className="text-xl font-syne font-bold text-foreground mb-4 pb-1 group-hover:text-foreground transition-colors leading-normal">{item.title}</h3>
                <p className="text-sm text-zinc-400 font-inter leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* USE CASES — Who It's For                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-t border-white/5 bg-zinc-950/50 backdrop-blur-3xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_theme(colors.primary.DEFAULT)]" />

        <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-20">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60 mb-4">Qui utilise Lavidz</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-syne font-bold leading-snug pb-2">
              Un outil. <span className="text-primary">Des dizaines de cas d'usage.</span>
            </h2>
            <p className="mt-6 text-zinc-300 font-inter max-w-2xl mx-auto text-lg leading-relaxed">
              À chaque fois qu'une voix authentique vaut plus qu'un PowerPoint, Lavidz entre en jeu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Case 1 */}
            <div className="p-8 lg:p-10 bg-background border border-border/60 hover:border-blue-500/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-3xl group-hover:bg-blue-500/10 transition-colors" />
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Target size={18} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-syne font-bold text-white tracking-normal">Coaches & Consultants</h3>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Personal branding</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 font-inter leading-relaxed relative z-10 mb-6">
                Transformez chaque client satisfait en machine à générer de la confiance. Un témoignage vidéo authentique vaut plus que 100 posts LinkedIn.
              </p>
              <div className="flex flex-wrap gap-2 relative z-10">
                <Badge variant="outline" className="font-mono text-[9px] bg-blue-500/5 text-blue-400 border-blue-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Témoignages clients</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-blue-500/5 text-blue-400 border-blue-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Études de cas</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-blue-500/5 text-blue-400 border-blue-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Preuve sociale</Badge>
              </div>
            </div>

            {/* Case 2 */}
            <div className="p-8 lg:p-10 bg-background border border-border/60 hover:border-primary/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-3xl group-hover:bg-primary/10 transition-colors" />
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-syne font-bold text-white tracking-normal">Agences & Marques</h3>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">UGC & contenu</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 font-inter leading-relaxed relative z-10 mb-6">
                Récoltez du contenu vidéo authentique à grande échelle. Plus besoin de courir après les influenceurs : vos vrais clients sont vos meilleurs ambassadeurs.
              </p>
              <div className="flex flex-wrap gap-2 relative z-10">
                <Badge variant="outline" className="font-mono text-[9px] bg-primary/5 text-primary border-primary/15 uppercase tracking-widest px-2.5 py-1 rounded-none">UGC scalable</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-primary/5 text-primary border-primary/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Feedback produit</Badge>
                <Badge variant="outline" className="font-mono text-[9px] bg-primary/5 text-primary border-primary/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Social Ads</Badge>
              </div>
            </div>

            {/* Case 3 — Full Width */}
            <div className="md:col-span-2 p-8 lg:p-10 bg-surface/40 border border-border/60 hover:border-emerald-500/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-48 bg-emerald-500/5 blur-3xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />

              <div className="flex flex-col md:flex-row items-start lg:items-center justify-between gap-10 relative z-10">
                <div className="max-w-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Eye size={18} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-syne font-bold text-white tracking-normal">RH & Marque employeur</h3>
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Recrutement & culture</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 font-inter leading-relaxed mb-6">
                    Donnez la parole à vos équipes. Les meilleurs talents ne lisent pas vos offres : ils veulent <strong className="text-white">sentir votre culture</strong> avant de postuler. La vidéo rend ça possible. Sans organiser un seul tournage.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="font-mono text-[9px] bg-emerald-500/5 text-emerald-400 border-emerald-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Témoignages employés</Badge>
                    <Badge variant="outline" className="font-mono text-[9px] bg-emerald-500/5 text-emerald-400 border-emerald-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">Onboarding stories</Badge>
                    <Badge variant="outline" className="font-mono text-[9px] bg-emerald-500/5 text-emerald-400 border-emerald-500/15 uppercase tracking-widest px-2.5 py-1 rounded-none">"Vis ma vie"</Badge>
                  </div>
                </div>

                <div className="hidden md:flex flex-col gap-3 w-full max-w-xs shrink-0">
                  {[
                    { icon: Clock, text: 'Set-up en 2 minutes' },
                    { icon: Shield, text: 'Données hébergées en France' },
                    { icon: Star, text: 'Parcours 100% personnalisable' },
                  ].map((f, i) => (
                    <div key={i} className="bg-background/80 backdrop-blur-md border border-border p-4 group-hover:border-emerald-500/20 transition-colors flex items-center gap-3">
                      <f.icon size={14} className="text-emerald-400 shrink-0" />
                      <span className="text-xs font-inter text-muted-foreground">{f.text}</span>
                    </div>
                  ))}
                </div>
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
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-syne font-bold leading-[1.3] pb-4">
              Imaginez un monde où chaque client satisfait{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-500 py-1">
                devient une preuve vivante
              </span>
              {' '}de votre valeur.
            </h2>
            <p className="text-lg text-zinc-300 font-inter max-w-2xl mx-auto leading-relaxed">
              Plus besoin de supplier pour un avis Google. Plus besoin de scripter des faux témoignages. Plus besoin de payer un vidéaste.
              Juste un lien, une question, et la vérité brute face caméra.
            </p>
            <p className="text-lg font-inter font-bold text-foreground max-w-xl mx-auto">
              C'est ça, l'avenir de la preuve sociale. Et il commence ici.
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
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-syne font-bold leading-snug pb-2">
              Prêt à transformer vos clients<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-500 py-1">en arme commerciale ?</span>
            </h2>
            <p className="text-zinc-300 font-inter text-lg">
              Inscrivez-vous à la bêta. Les premiers inscrits auront un accès gratuit et illimité.
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
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-primary rounded-none" />
            <span className="font-syne font-bold text-lg uppercase text-white">
              Lavidz
            </span>
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
