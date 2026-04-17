'use client'

import { useState } from 'react'
import { Briefcase, User } from 'lucide-react'
import { ProfileForm } from './ProfileForm'
import { ActivityTab } from '@/components/profile/ActivityTab'

interface ProfileTabsProps {
  initialEmail: string
  initialFirstName: string
  initialLastName: string
  hasAvatar: boolean
}

type Tab = 'activite' | 'compte'

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof User; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

export function ProfileTabs({ initialEmail, initialFirstName, initialLastName, hasAvatar }: ProfileTabsProps) {
  const [tab, setTab] = useState<Tab>('activite')

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl w-fit">
        <TabButton active={tab === 'activite'} onClick={() => setTab('activite')} icon={Briefcase} label="Mon activite" />
        <TabButton active={tab === 'compte'} onClick={() => setTab('compte')} icon={User} label="Compte" />
      </div>

      {tab === 'activite' && <ActivityTab />}

      {tab === 'compte' && (
        <ProfileForm
          initialEmail={initialEmail}
          initialFirstName={initialFirstName}
          initialLastName={initialLastName}
          hasAvatar={hasAvatar}
        />
      )}
    </div>
  )
}
