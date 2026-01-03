'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return <div style={{ padding: '2rem' }}>Carregando...</div>
  }

  return (
    <div>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc', display: 'flex', gap: '1rem' }}>
        <a href="/dashboard">Dashboard</a>
        <a href="/dashboard/configuracao">Configuração</a>
        <a href="/dashboard/bloqueios">Bloqueios</a>
        <a href="/dashboard/integracao">Integração</a>
        <div style={{ marginLeft: 'auto' }}>
          <button 
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Sair
          </button>
        </div>
      </nav>
      {children}
    </div>
  )
}

