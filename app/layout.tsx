import './globals.css'
import type { Metadata } from 'next'
import Header from '@/components/Header'

export const metadata: Metadata = {
  title: 'FoxESS × RCE — Revenue Dashboard',
  description: 'Compute net-billing revenue from FoxESS production and hourly RCE prices.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <div className="container py-8">
          <Header />
          {children}
        </div>
      </body>
    </html>
  )
}
