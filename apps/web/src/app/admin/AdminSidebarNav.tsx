'use client'

import React from 'react'
import { LayoutGrid, Clapperboard, Building2, Activity, Users, Brain, Music, MessageSquare, Mic } from 'lucide-react'
import { AdminNavItem } from './AdminNavItem'

interface AdminSidebarNavProps {
  userRole?: string
}

export function AdminSidebarNav({ userRole }: AdminSidebarNavProps) {
  return (
    <nav className="flex-1 px-4 py-2 flex flex-col gap-1">
      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/80 px-3 pb-3 pt-2 select-none">
        Contenu
      </p>
      <AdminNavItem href="/admin" label="Vue d'ensemble" icon={Activity} />
      <AdminNavItem href="/admin/themes" label="Thèmes" icon={LayoutGrid} />
      <AdminNavItem href="/admin/montage" label="Montage" icon={Clapperboard} />
      <AdminNavItem href="/admin/sounds" label="Sons" icon={Music} />
      <AdminNavItem href="/admin/voices" label="Voix IA" icon={Mic} />
      <AdminNavItem href="/admin/feedbacks" label="Feedbacks" icon={MessageSquare} />

      {userRole === 'SUPERADMIN' && (
        <>
          <div className="h-px bg-border/40 mx-3 my-4" />
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/80 px-3 pb-3 select-none">
            IA
          </p>
          <AdminNavItem href="/admin/ai-profile" label="Profil IA" icon={Brain} />

          <div className="h-px bg-border/40 mx-3 my-4" />
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/80 px-3 pb-3 select-none">
            Superadmin
          </p>
          <AdminNavItem href="/admin/organizations" label="Organisations" icon={Building2} />
          <AdminNavItem href="/admin/team" label="Équipe" icon={Users} />
        </>
      )}
    </nav>
  )
}
