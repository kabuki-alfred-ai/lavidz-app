'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Camera, Loader2, X } from 'lucide-react'

interface ProfileFormProps {
  initialEmail: string
  initialFirstName: string
  initialLastName: string
  hasAvatar: boolean
}

export function ProfileForm({ initialEmail, initialFirstName, initialLastName, hasAvatar }: ProfileFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [email, setEmail] = useState(initialEmail)
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    hasAvatar ? `/api/admin/profile/avatar?t=${Date.now()}` : null,
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const displayName = firstName
    ? `${firstName} ${lastName || ''}`.trim()
    : email.split('@')[0]

  const initials = firstName
    ? `${firstName[0]}${lastName?.[0] ?? ''}`.toUpperCase()
    : email[0].toUpperCase()

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile) return
    setUploadingAvatar(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', avatarFile)
      const res = await fetch('/api/admin/profile/avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      setAvatarFile(null)
      setSuccess('Photo de profil mise à jour.')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword && newPassword !== confirmPassword) {
      setError('Les nouveaux mots de passe ne correspondent pas.')
      return
    }

    if (newPassword && !currentPassword) {
      setError('Veuillez renseigner votre mot de passe actuel pour le modifier.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName, currentPassword, newPassword }),
      })

      if (!res.ok) throw new Error(await res.text())

      setSuccess('Profil mis à jour avec succès.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar */}
      <Card className="bg-surface/40 backdrop-blur-md border border-border/60">
        <CardHeader>
          <CardTitle>Photo de profil</CardTitle>
          <CardDescription>Importez une photo au format JPG, PNG ou WebP.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Circle avatar */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border/60 bg-surface-raised flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarPreview(null)}
                  />
                ) : (
                  <span className="font-mono text-2xl font-bold text-primary">
                    {initials}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Camera size={18} className="text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <p className="font-inter font-bold text-sm text-foreground">{displayName}</p>
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                {email}
              </p>
              {avatarFile ? (
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="h-8 px-4 rounded-none font-mono text-[10px] uppercase tracking-widest"
                  >
                    {uploadingAvatar && <Loader2 size={12} className="animate-spin mr-1.5" />}
                    {uploadingAvatar ? 'Upload…' : 'Enregistrer la photo'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null)
                      setAvatarPreview(hasAvatar ? `/api/admin/profile/avatar?t=${Date.now()}` : null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] font-mono text-primary/60 hover:text-primary transition-colors uppercase tracking-widest text-left mt-1"
                >
                  Changer la photo →
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informations personnelles */}
      <Card className="bg-surface/40 backdrop-blur-md border border-border/60">
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
          <CardDescription>Mettez à jour vos informations de profil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-background"
                placeholder="Marie"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-background"
                placeholder="Dupont"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background"
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Sécurité */}
      <Card className="bg-surface/40 backdrop-blur-md border border-border/60">
        <CardHeader>
          <CardTitle>Sécurité</CardTitle>
          <CardDescription>Modifiez votre mot de passe. Laissez vide si vous ne souhaitez pas le changer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Mot de passe actuel</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md font-mono">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-md font-mono">
          {success}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="gap-2 font-bold uppercase tracking-wide">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer les modifications
        </Button>
      </div>
    </form>
  )
}
