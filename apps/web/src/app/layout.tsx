import type { Metadata } from 'next'
import { DM_Mono, Inter } from 'next/font/google'
import Script from 'next/script'
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
      <Script id="crisp-chat" strategy="afterInteractive">{`
        window.$crisp=[];
        window.CRISP_WEBSITE_ID="a231c099-7114-4a49-98dd-847a3f263a8c";
        window.CRISP_READY_TRIGGER=function(){
          window.$crisp.push(["do","chat:hide"]);
          window.$crisp.push(["on","chat:closed",function(){window.$crisp.push(["do","chat:hide"]);}]);
        };
        (function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
      `}</Script>
    </html>
  )
}
