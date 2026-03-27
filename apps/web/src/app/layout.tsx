import type { Metadata } from 'next'
import { DM_Mono, Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Lavidz',
  description: 'Créez des vidéos authentiques en répondant à des questions',
  manifest: '/manifest.json',
  appleWebApp: {
    title: 'Lavidz',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${dmMono.variable} ${inter.variable} font-sans`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
