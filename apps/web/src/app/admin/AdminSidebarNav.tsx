'use client'

import React from 'react'
import { LayoutGrid, Clapperboard, Building2, Activity, Users, Brain, Music, MessageSquare, Mic, LifeBuoy } from 'lucide-react'
import { AdminNavItem } from './AdminNavItem'

interface AdminSidebarNavProps {
  userRole?: string
}

export function AdminSidebarNav({ userRole }: AdminSidebarNavProps) {
  return (
    <nav className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1 custom-scrollbar">
        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground px-3 pb-3 pt-2 select-none">
          Contenu
        </p>
        <AdminNavItem href="/admin" label="Vue d'ensemble" icon={Activity} />
        <AdminNavItem href="/admin/themes" label="Thèmes" icon={LayoutGrid} />
        <AdminNavItem href="/admin/montage" label="Montage" icon={Clapperboard} />
        <AdminNavItem href="/admin/sounds" label="Sons" icon={Music} />
        <AdminNavItem href="/admin/voices" label="Voix IA" icon={Mic} />
        <AdminNavItem href="/admin/feedbacks" label="Feedbacks" icon={MessageSquare} />

        {(userRole === 'ADMIN' || userRole === 'USER') && (
          <>
            <div className="h-px bg-border/40 mx-3 my-4" />
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground px-3 pb-3 select-none">
              Équipe
            </p>
            <AdminNavItem href="/admin/org-team" label="Mon Équipe" icon={Users} />
          </>
        )}

        {userRole === 'SUPERADMIN' && (
          <>
            <div className="h-px bg-border/40 mx-3 my-4" />
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground px-3 pb-3 select-none">
              IA
            </p>
            <AdminNavItem href="/admin/ai-profile" label="Profil IA" icon={Brain} />

            <div className="h-px bg-border/40 mx-3 my-4" />
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground px-3 pb-3 select-none">
              Superadmin
            </p>
            <AdminNavItem href="/admin/organizations" label="Organisations" icon={Building2} />
            <AdminNavItem href="/admin/team" label="Équipe" icon={Users} />
          </>
        )}
      </div>

      {/* Support Button (Crisp) — Fixed at bottom of nav */}
      <div className="px-4 py-4 border-t border-border/40">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).$crisp) {
              (window as any).$crisp.push(['do', 'chat:show']);
              (window as any).$crisp.push(['do', 'chat:open']);
            }
          }}
          className="group flex items-center gap-3 px-3 h-9 text-xs font-mono transition-all duration-200 outline-none w-full text-muted-foreground hover:text-foreground hover:bg-surface-raised"
        >
          <LifeBuoy
            size={14}
            className="shrink-0 transition-transform duration-200 group-hover:scale-110"
          />
          <span className="tracking-tight">Support</span>
        </button>
      </div>
    </nav>
  )
}
