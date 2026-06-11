import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'DGT Predict 2026 — Copa do Mundo',
  description: 'Bolão interno da DGT para a Copa do Mundo FIFA 2026',
  openGraph: {
    title: 'DGT Predict 2026',
    description: 'Bolão interno da DGT para a Copa do Mundo FIFA 2026',
    images: [{ url: '/logo-dgt.png', width: 512, height: 512, alt: 'DGT' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
