'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Camera,
  Loader2,
  Shield,
  User,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UserInfo {
  email: string
  firstName: string
  lastName: string
  hasAvatar: boolean
}

/**
 * Compte pur — email, nom, avatar, mot de passe. Tout ce qui concerne le
 * profil IA (activité, mémoires, sources, thèse, arche) vit désormais sous
 * /mon-univers.
 */
export function ClientProfile() {
  const router = useRouter()

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
        const info: UserInfo = {
          email: meData.email ?? '',
          firstName: meData.firstName ?? '',
          lastName: meData.lastName ?? '',
          hasAvatar: false,
        }
        setUserInfo(info)
        setEmail(info.email)
        setFirstName(info.firstName)
        setLastName(info.lastName)
        try {
          const avatarRes = await fetch('/api/admin/profile/avatar', { method: 'HEAD', credentials: 'include' })
          if (avatarRes.ok) {
            info.hasAvatar = true
            setAvatarPreview(`/api/admin/profile/avatar?t=${Date.now()}`)
          }
        } catch { /* */ }
      }
    } catch {
      /* swallow */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountError('')
    setAccountSuccess('')
    if (newPassword && newPassword !== confirmPassword) {
      setAccountError('Les nouveaux mots de passe ne correspondent pas.')
      return
    }
    if (newPassword && !currentPassword) {
      setAccountError('Veuillez renseigner votre mot de passe actuel.')
      return
    }
    setAccountLoading(true)
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName, currentPassword, newPassword }),
      })
      if (!res.ok) throw new Error(await res.text())
      setAccountSuccess('Profil mis à jour.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      router.refresh()
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setAccountLoading(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile) return
    setUploadingAvatar(true)
    setAccountError('')
    try {
      const fd = new FormData()
      fd.append('file', avatarFile)
      const res = await fetch('/api/admin/profile/avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      setAvatarFile(null)
      setAccountSuccess('Photo mise à jour.')
      router.refresh()
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Erreur.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const displayName = firstName ? `${firstName} ${lastName}`.trim() : email.split('@')[0]
  const initials = firstName
    ? `${firstName[0]}${lastName?.[0] ?? ''}`.toUpperCase()
    : email[0]?.toUpperCase() ?? '?'

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Mon compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tes infos de connexion. Pour ton profil créatif (activité, mémoire, thèse…), file sur{' '}
          <Link href="/mon-univers" className="text-primary hover:underline">
            Mon univers
          </Link>
          .
        </p>
      </div>

      {/* Link to Mon univers */}
      <Link
        href="/mon-univers"
        className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 transition hover:bg-primary/10"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Mon univers créatif</p>
            <p className="text-xs text-muted-foreground">
              Mémoire, thèse, arche narrative
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      <form onSubmit={handleSaveAccount} className="space-y-6">
        {/* Avatar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Camera size={14} className="text-primary" />
              </div>
              Photo de profil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-5">
              <div className="group relative shrink-0">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface-raised">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarPreview(null)}
                    />
                  ) : (
                    <span className="text-lg font-semibold text-primary">{initials}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Camera size={16} className="text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">{email}</p>
                {avatarFile ? (
                  <div className="mt-1 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAvatarUpload}
                      disabled={uploadingAvatar}
                      className="h-8 px-4 text-xs"
                    >
                      {uploadingAvatar && <Loader2 size={12} className="mr-1.5 animate-spin" />}
                      {uploadingAvatar ? 'Upload…' : 'Enregistrer'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarFile(null)
                        setAvatarPreview(userInfo?.hasAvatar ? `/api/admin/profile/avatar?t=${Date.now()}` : null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="text-muted-foreground/40 transition-colors hover:text-muted-foreground"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-0.5 text-left text-xs text-primary/60 transition-colors hover:text-primary"
                  >
                    Changer la photo
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <User size={14} className="text-primary" />
              </div>
              Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Marie"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Shield size={14} className="text-primary" />
              </div>
              Sécurité
            </CardTitle>
            <CardDescription>
              Laisse vide si tu ne souhaites pas changer de mot de passe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Mot de passe actuel</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmer</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {accountError && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{accountError}</div>
        )}
        {accountSuccess && (
          <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-600">
            {accountSuccess}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={accountLoading} className="gap-2">
            {accountLoading && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
          </Button>
        </div>
      </form>
    </div>
  )
}
