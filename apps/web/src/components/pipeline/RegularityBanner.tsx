'use client'

import * as React from 'react'

export interface RegularityBannerProps {
  show: boolean
}

export function RegularityBanner({ show }: RegularityBannerProps) {
  if (!show) return null
  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
      <span className="text-xl">⚠️</span>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-sm">Alerte régularité</h3>
        <p className="text-sm text-muted-foreground">
          Aucun sujet prêt dans les 7 prochains jours. Travaille tes sujets pour ne pas casser le
          rythme.
        </p>
      </div>
    </div>
  )
}
