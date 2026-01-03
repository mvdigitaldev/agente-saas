'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  return (
    <div>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <a href="/dashboard">Dashboard</a> | 
        <a href="/dashboard/configuracao">Configuração</a> | 
        <a href="/dashboard/bloqueios">Bloqueios</a> | 
        <a href="/dashboard/integracao">Integração</a>
      </nav>
      {children}
    </div>
  )
}

