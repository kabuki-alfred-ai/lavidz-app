'use client'

import React from 'react'
import { Clapperboard, Building2, Activity, Users, Music, MessageSquare, Mic, Palette, LifeBuoy, CalendarDays, Film, BarChart3, ClipboardList, Workflow } from 'lucide-react'
import { AdminNavItem } from './AdminNavItem'

interface AdminSidebarNavProps {
  userRole?: string
  activeOrgId?: string | null
}

export function AdminSidebarNav({ userRole, activeOrgId }: AdminSidebarNavProps) {
  const isSuperadmin = userRole === 'SUPERADMIN'

  return (
    <nav className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-0.5 custom-scrollbar">

        {/* SUPERADMIN: Global management */}
        {isSuperadmin && (
          <>
            <p className="text-xs font-medium text-muted-foreground px-3 pb-2 pt-4 select-none">
              Plateforme
            </p>
            <AdminNavItem href="/admin" label="Vue d'ensemble" icon={Activity} />
            <AdminNavItem href="/admin/organizations" label="Organisations" icon={Building2} />
            <AdminNavItem href="/admin/team" label="Utilisateurs" icon={Users} />
            <div className="my-3" />
          </>
        )}

        {/* Sessions & Montage — core workflow */}
        <p className={`text-xs font-medium text-muted-foreground px-3 pb-2 ${isSuperadmin ? '' : 'pt-4'} select-none`}>
          Production
        </p>
        <AdminNavItem href="/admin/pipeline" label="Pipeline" icon={Workflow} />
        <AdminNavItem href="/admin/sessions" label="Sessions" icon={ClipboardList} />
        <AdminNavItem href="/admin/montage" label="Montage" icon={Clapperboard} />
        <AdminNavItem href="/admin/calendar" label="Calendrier" icon={CalendarDays} />

        <div className="my-3" />

        {/* Content tools */}
        <p className="text-xs font-medium text-muted-foreground px-3 pb-2 select-none">
          Contenu
        </p>
        <AdminNavItem href="/admin/broll" label="B-Rolls" icon={Film} />
        <AdminNavItem href="/admin/sounds" label="Sons" icon={Music} />
        <AdminNavItem href="/admin/voices" label="Voix IA" icon={Mic} />

        <div className="my-3" />

        {/* Settings */}
        <p className="text-xs font-medium text-muted-foreground px-3 pb-2 select-none">
          Parametres
        </p>
        <AdminNavItem href="/admin/brand-kit" label="Brand Kit" icon={Palette} />
        <AdminNavItem href="/admin/analytics" label="Analytics" icon={BarChart3} />
        <AdminNavItem href="/admin/feedbacks" label="Feedbacks" icon={MessageSquare} />

        {(userRole === 'ADMIN' || (isSuperadmin && activeOrgId)) && (
          <>
            <div className="my-3" />
            <p className="text-xs font-medium text-muted-foreground px-3 pb-2 select-none">
              Equipe
            </p>
            <AdminNavItem href="/admin/org-team" label="Mon Equipe" icon={Users} />
          </>
        )}
      </div>

      {/* Support Button */}
      <div className="px-3 py-4">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).$crisp) {
              (window as any).$crisp.push(['do', 'chat:show']);
              (window as any).$crisp.push(['do', 'chat:open']);
            }
          }}
          className="group flex items-center gap-3 px-3 h-9 text-sm rounded-lg transition-colors w-full text-muted-foreground hover:text-foreground hover:bg-surface-raised"
        >
          <LifeBuoy size={16} className="shrink-0" />
          <span>Support</span>
        </button>
      </div>
    </nav>
  )
}
