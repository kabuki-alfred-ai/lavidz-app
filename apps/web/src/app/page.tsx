'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Video, Sparkles, Play, Users, MessageSquare, Mic, Clapperboard } from 'lucide-react'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [timer, setTimer] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Manage timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => setTimer((t) => t + 1), 1000)
    } else {
      setTimer(0)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  // Attach stream to video when it changes
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
      // Stop recording
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      setStream(null)
      setIsRecording(false)
    } else {
      // Start recording
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

  // Cleanup on unmount
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
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full mix-blend-screen animate-[pulse_8s_infinite] duration-1000" />
        <div className="absolute top-[40%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-transparent opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")', mixBlendMode: 'overlay' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative">
            <span className="block w-4 h-4 bg-primary rounded-none transition-all duration-500 group-hover:rotate-90 group-hover:scale-75" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary/40 rounded-none group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform duration-500" />
          </div>
          <span className="font-sans font-black text-xl tracking-tighter uppercase text-foreground">
            Lavidz
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/auth/login" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            Espace pro
          </Link>
          <Button asChild className="rounded-none font-mono text-[10px] uppercase tracking-widest h-10 px-6">
            <Link href="/auth/login">Connexion <ArrowRight size={14} className="ml-2" /></Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-32">
        <div className="flex flex-col lg:flex-row items-center gap-20">
          
          {/* Text Content */}
          <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest py-1.5 px-3 border-primary/20 bg-primary/5 text-primary">
              <Sparkles size={12} className="mr-2 inline-block" />
              La nouvelle ère du témoignage
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4.5rem] font-sans font-black tracking-tighter leading-[1.05] text-balance">
              L'authenticité <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-yellow-500">sans filtre.</span>
            </h1>
            
            <p className="text-lg lg:text-xl text-muted-foreground/80 font-inter max-w-xl leading-relaxed text-balance border-l-2 border-primary/40 pl-4">
              Créez des parcours vidéos asynchrones. Récoltez des témoignages authentiques, des entretiens structurés et des retours poignants, où que soient vos interlocuteurs.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-6">
              <Button asChild size="lg" className="h-14 px-8 rounded-none font-mono text-xs uppercase tracking-[0.2em] shadow-[0_0_40px_-10px_rgba(255,87,34,0.4)] hover:shadow-[0_0_60px_-15px_rgba(255,87,34,0.6)] group transition-all duration-300">
                <Link href="/auth/login">
                  Créer un espace
                  <ArrowRight size={16} className="ml-3 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-14 px-8 rounded-none font-mono text-xs uppercase tracking-[0.2em] border-border/60 bg-surface/30 backdrop-blur-sm hover:bg-surface-raised hover:border-primary/40 text-foreground group transition-all duration-300">
                <Play size={16} className="mr-3 text-primary group-hover:scale-110 transition-transform" />
                Démo 1 min
              </Button>
            </div>
            
            <div className="pt-8 flex items-center gap-8 border-t border-border/40 max-w-lg">
              <div>
                <p className="font-sans font-black text-2xl text-foreground">10k+</p>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Vidéos générées</p>
              </div>
              <div className="w-px h-10 bg-border/60" />
              <div>
                <p className="font-sans font-black text-2xl text-foreground">98%</p>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Taux de complétion</p>
              </div>
            </div>
          </div>

          {/* Phone Mockup Visual */}
          <div className="flex-1 relative w-full flex justify-center lg:justify-end animate-in fade-in slide-in-from-right-12 duration-1000 delay-300 fill-mode-both">
            {/* Ambient glow behind phone */}
            <div className={`absolute top-1/2 left-1/2 lg:left-[60%] -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] blur-[100px] rounded-full pointer-events-none transition-colors duration-1000 ${isRecording ? 'bg-red-500/20' : 'bg-primary/20'}`} />
            
            {/* Phone Frame */}
            <div className="relative w-[300px] sm:w-[320px] h-[600px] sm:h-[650px] bg-[#09090b] border-[8px] border-[#27272a] rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden shrink-0 z-10 group/phone transition-transform duration-500">
              
              {/* Fake volume & side buttons */}
              <div className="absolute top-32 -left-[10px] w-1 h-12 bg-[#27272a] rounded-l-md" />
              <div className="absolute top-48 -left-[10px] w-1 h-12 bg-[#27272a] rounded-l-md" />
              <div className="absolute top-36 -right-[10px] w-1 h-16 bg-[#27272a] rounded-r-md" />

              {/* Dynamic Island / Notch */}
              <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50">
                <div className="w-28 h-6 bg-[#09090b] rounded-b-3xl relative">
                  <div className={`absolute top-2 right-4 w-1.5 h-1.5 rounded-full transition-colors ${isRecording ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-emerald-500/30'}`} />
                </div>
              </div>

              {/* Screen Content */}
              <div className="w-full h-full relative bg-zinc-900 border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col justify-between">
                
                {/* Simulated Camera Feed (Background) */}
                <div className={`absolute inset-0 z-0 overflow-hidden bg-[#111] transition-all duration-500 ${isRecording ? '' : 'mix-blend-screen'}`}>
                  {isRecording && (
                    <video 
                      ref={videoRef}
                      autoPlay 
                      muted 
                      playsInline 
                      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 scale-100 scale-x-[-1]"
                    />
                  )}
                  
                  {!isRecording && (
                    <>
                      {/* Sub-bg noise */}
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_black_100%)] z-10 pointer-events-none" />
                      {/* Subtle animated light moving around */}
                      <div className="w-[150%] h-[150%] absolute top-[-25%] left-[-25%] bg-[radial-gradient(circle_at_center,_hsl(14_50%_40%_/_0.15)_0%,_transparent_60%)] animate-[spin_20s_linear_infinite]" />
                    </>
                  )}
                  {/* Camera noise overlay */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%221.5%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
                </div>

                {/* Top UI */}
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

                {/* Question Area */}
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

                {/* Bottom Controls */}
                <div className={`relative z-20 flex flex-col items-center justify-end transition-all duration-700 ${isRecording ? 'pb-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 mt-auto' : 'pb-10 pt-6 bg-gradient-to-t from-black via-black/80 to-transparent'}`}>
                  
                  {/* Audio Visualizer */}
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

                  {/* Record Button */}
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
      
      {/* Use Cases Grid */}
      <section className="relative z-10 border-t border-border/40 bg-surface/40">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both">
            <h2 className="text-4xl lg:text-5xl font-sans font-black tracking-tighter">
              Une plateforme, <br/>
              <span className="text-primary text-3xl lg:text-4xl">des possibilités infinies.</span>
            </h2>
            <p className="mt-6 text-muted-foreground font-inter max-w-2xl mx-auto text-lg leading-relaxed">
              Lavidz s'adapte à vos enjeux, que vous cherchiez à accélérer le recrutement, rassurer vos prospects ou donner la parole à vos clients.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Cas 1 : RH */}
            <div className="p-8 lg:p-12 bg-background border border-border/60 hover:border-primary/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-3xl group-hover:bg-blue-500/10 transition-colors" />
              <div className="w-12 h-12 bg-surface/80 border border-border flex items-center justify-center mb-8 relative z-10 group-hover:scale-110 transition-transform">
                <Users size={20} className="text-blue-400" />
              </div>
              <h3 className="text-2xl font-sans font-black text-foreground tracking-tight mb-4 relative z-10">Ressources Humaines</h3>
              <p className="text-base text-muted-foreground/80 font-inter leading-relaxed relative z-10 mb-8">
                Dynamisez votre marque employeur en donnant la parole à vos équipes. L'authenticité attire mécaniquement les meilleurs talents.
              </p>
              <ul className="space-y-4 relative z-10">
                <li className="flex items-center gap-4 text-sm font-inter text-foreground/90">
                  <div className="w-1 h-3 rounded-none bg-blue-400 group-hover:scale-y-150 transition-transform" /> Témoignages collaborateurs
                </li>
                <li className="flex items-center gap-4 text-sm font-inter text-foreground/90">
                  <div className="w-1 h-3 rounded-none bg-blue-400 group-hover:scale-y-150 transition-transform delay-75" /> Interviews "Vis ma vie"
                </li>
                <li className="flex items-center gap-4 text-sm font-inter text-foreground/90">
                  <div className="w-1 h-3 rounded-none bg-blue-400 group-hover:scale-y-150 transition-transform delay-150" /> Retours d'onboarding asynchrones
                </li>
              </ul>
            </div>

            {/* Cas 2 : Consultants / Indépendants */}
            <div className="p-8 lg:p-12 bg-background border border-border/60 hover:border-primary/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-3xl group-hover:bg-primary/10 transition-colors" />
              <div className="w-12 h-12 bg-surface/80 border border-border flex items-center justify-center mb-8 relative z-10 group-hover:scale-110 transition-transform">
                <Sparkles size={20} className="text-primary" />
              </div>
              <h3 className="text-2xl font-sans font-black text-foreground tracking-tight mb-4 relative z-10">Consultants & Indépendants</h3>
              <p className="text-base text-muted-foreground/80 font-inter leading-relaxed relative z-10 mb-8">
                Construisez votre réputation en ligne grâce à la vidéo. Rien n'a plus d'impact qu'un client satisfait qui témoigne face caméra.
              </p>
              <ul className="space-y-4 relative z-10">
                <li className="flex items-center gap-4 text-sm font-inter text-foreground/90">
                  <div className="w-1 h-3 rounded-none bg-primary group-hover:scale-y-150 transition-transform" /> Avis client exclusifs
                </li>
                <li className="flex items-center gap-4 text-sm font-inter text-foreground/90">
                  <div className="w-1 h-3 rounded-none bg-primary group-hover:scale-y-150 transition-transform delay-75" /> Partage de retours d'expertise
                </li>
                <li className="flex items-center gap-4 text-sm font-inter text-foreground/90">
                  <div className="w-1 h-3 rounded-none bg-primary group-hover:scale-y-150 transition-transform delay-150" /> Personal branding & storytelling
                </li>
              </ul>
            </div>
            
            {/* Cas 3 : Sales & Marketing */}
            <div className="md:col-span-2 p-8 lg:p-12 bg-surface border border-border/60 hover:border-emerald-500/20 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-48 bg-emerald-500/5 blur-3xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />
              
              <div className="flex flex-col md:flex-row items-start lg:items-center justify-between gap-12 relative z-10">
                <div className="max-w-xl">
                  <div className="w-12 h-12 bg-background border border-border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <MessageSquare size={20} className="text-emerald-400" />
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-sans font-black text-foreground tracking-tight mb-4">Marketing & Marques</h3>
                  <p className="text-base text-muted-foreground/80 font-inter leading-relaxed mb-6">
                    Transformez l'engagement de votre communauté en contenu vidéo ultra-performant. Récoltez facilement du User Generated Content (UGC) pour vos campagnes ou vos réseaux sociaux.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 uppercase tracking-widest px-3 py-1.5 rounded-none">Feedback Produit</Badge>
                    <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 uppercase tracking-widest px-3 py-1.5 rounded-none">UGC Authentique</Badge>
                    <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 uppercase tracking-widest px-3 py-1.5 rounded-none">Format Snacking</Badge>
                  </div>
                </div>
                
                <div className="hidden md:flex flex-col gap-4 w-full max-w-sm shrink-0">
                   <div className="bg-background/80 backdrop-blur-md border border-border p-5 group-hover:border-emerald-500/20 transition-colors">
                     <div className="flex items-center gap-3 mb-2">
                       <span className="w-1.5 h-1.5 bg-emerald-500 blur-[1px]" />
                       <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Taux d'engagement</span>
                     </div>
                     <span className="text-3xl font-sans font-black text-foreground group-hover:text-emerald-400 transition-colors">+ 340%</span>
                   </div>
                   <div className="bg-background/80 backdrop-blur-md border border-border p-5 group-hover:border-blue-500/20 transition-colors">
                     <div className="flex items-center gap-3 mb-2">
                       <span className="w-1.5 h-1.5 bg-blue-500 blur-[1px]" />
                       <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Preuve Sociale</span>
                     </div>
                     <span className="text-3xl font-sans font-black text-foreground group-hover:text-blue-400 transition-colors">x 2.5</span>
                   </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 px-6 bg-background relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-primary rounded-none" />
            <span className="font-sans font-black text-lg tracking-tighter uppercase text-foreground">
              Lavidz
            </span>
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            © {new Date().getFullYear()} Lavidz. Tous droits réservés.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-xs font-inter text-muted-foreground hover:text-foreground transition-colors">Twitter</Link>
            <Link href="#" className="text-xs font-inter text-muted-foreground hover:text-foreground transition-colors">LinkedIn</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
