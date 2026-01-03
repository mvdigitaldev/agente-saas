import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Agente SaaS - Dashboard',
  description: 'Dashboard de configuração do agente de IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}

