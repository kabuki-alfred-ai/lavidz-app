'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Shield,
  User,
  Camera,
  X,
  Briefcase,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ActivityTab } from '@/components/profile/ActivityTab'

type Tab = 'activite' | 'compte'

interface UserInfo {
  email: string
  firstName: string
  lastName: string
  hasAvatar: boolean
}

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

export function ClientProfile() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('activite')

  // Account state
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [accountSuccess, setAccountSuccess] = useState('')

  // Avatar state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const fetchUser = useCallback(async () => {
    setLoading(true)
    try {
      const meRes = await fetch('/api/auth/me', { credentials: 'include' })
      if (meRes.ok) {
        const meData = await meRes.json()
        const info: UserInfo = { email: meData.email ?? '', firstName: meData.firstName ?? '', lastName: meData.lastName ?? '', hasAvatar: false }
        setUserInfo(info)
        setEmail(info.email)
        setFirstName(info.firstName)
        setLastName(info.lastName)
        try {
          const avatarRes = await fetch('/api/admin/profile/avatar', { method: 'HEAD', credentials: 'include' })
          if (avatarRes.ok) { info.hasAvatar = true; setAvatarPreview(`/api/admin/profile/avatar?t=${Date.now()}`) }
        } catch { /* */ }
      }
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUser() }, [fetchUser])

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountError(''); setAccountSuccess('')
    if (newPassword && newPassword !== confirmPassword) { setAccountError('Les nouveaux mots de passe ne correspondent pas.'); return }
    if (newPassword && !currentPassword) { setAccountError('Veuillez renseigner votre mot de passe actuel.'); return }
    setAccountLoading(true)
    try {
      const res = await fetch('/api/admin/profile', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, firstName, lastName, currentPassword, newPassword }) })
      if (!res.ok) throw new Error(await res.text())
      setAccountSuccess('Profil mis a jour.'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); router.refresh()
    } catch (err: any) { setAccountError(err.message || 'Une erreur est survenue.') } finally { setAccountLoading(false) }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)) }

  const handleAvatarUpload = async () => {
    if (!avatarFile) return
    setUploadingAvatar(true); setAccountError('')
    try {
      const fd = new FormData(); fd.append('file', avatarFile)
      const res = await fetch('/api/admin/profile/avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      setAvatarFile(null); setAccountSuccess('Photo mise a jour.'); router.refresh()
    } catch (err: any) { setAccountError(err.message || 'Erreur.') } finally { setUploadingAvatar(false) }
  }

  const displayName = firstName ? `${firstName} ${lastName}`.trim() : email.split('@')[0]
  const initials = firstName ? `${firstName[0]}${lastName?.[0] ?? ''}`.toUpperCase() : email[0]?.toUpperCase() ?? '?'

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-40 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Mon profil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gere ton compte et ton activite</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl w-fit">
        <TabButton active={tab === 'activite'} onClick={() => setTab('activite')} icon={Briefcase} label="Mon activite" />
        <TabButton active={tab === 'compte'} onClick={() => setTab('compte')} icon={User} label="Compte" />
      </div>

      {/* Tab: Mon activite */}
      {tab === 'activite' && <ActivityTab />}

      {/* Tab: Compte */}
      {tab === 'compte' && (
        <form onSubmit={handleSaveAccount} className="space-y-6">
          {/* Avatar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Camera size={14} className="text-primary" /></div>
                Photo de profil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-5">
                <div className="relative group shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-raised flex items-center justify-center">
                    {avatarPreview ? <img src={avatarPreview} alt={displayName} className="w-full h-full object-cover" onError={() => setAvatarPreview(null)} /> : <span className="text-lg font-semibold text-primary">{initials}</span>}
                  </div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Camera size={16} className="text-white" /></button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{email}</p>
                  {avatarFile ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Button type="button" size="sm" onClick={handleAvatarUpload} disabled={uploadingAvatar} className="h-8 px-4 text-xs">
                        {uploadingAvatar && <Loader2 size={12} className="animate-spin mr-1.5" />}{uploadingAvatar ? 'Upload...' : 'Enregistrer'}
                      </Button>
                      <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(userInfo?.hasAvatar ? `/api/admin/profile/avatar?t=${Date.now()}` : null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"><X size={14} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-primary/60 hover:text-primary transition-colors text-left mt-0.5">Changer la photo</button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><User size={14} className="text-primary" /></div>
                Informations personnelles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="firstName">Prenom</Label><Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Marie" /></div>
                <div className="space-y-1.5"><Label htmlFor="lastName">Nom</Label><Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="email">Adresse email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Shield size={14} className="text-primary" /></div>
                Securite
              </CardTitle>
              <CardDescription>Laisse vide si tu ne souhaites pas changer de mot de passe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="currentPassword">Mot de passe actuel</Label><Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="newPassword">Nouveau mot de passe</Label><Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="confirmPassword">Confirmer</Label><Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          {accountError && <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-lg">{accountError}</div>}
          {accountSuccess && <div className="p-3 text-sm text-emerald-600 bg-emerald-500/10 rounded-lg">{accountSuccess}</div>}

          <div className="flex justify-end">
            <Button type="submit" disabled={accountLoading} className="gap-2">
              {accountLoading && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
