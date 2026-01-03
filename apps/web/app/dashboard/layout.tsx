'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Topbar } from '@/components/dashboard/topbar'
import { Loader2 } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let checkCount = 0
    const maxChecks = 3

    const checkAuth = async () => {
      if (checkCount >= maxChecks) {
        // Se já verificou várias vezes sem sucesso, parar de tentar
        setLoading(false)
        return
      }

      checkCount++
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (error) {
          console.error('Erro ao verificar sessão:', error)
          if (checkCount >= maxChecks) {
            router.push('/login')
            return
          }
          // Tentar novamente após um delay
          setTimeout(checkAuth, 500)
          return
        }
        
        if (!session) {
          if (checkCount >= maxChecks) {
            router.push('/login')
            return
          }
          // Tentar novamente após um delay
          setTimeout(checkAuth, 500)
          return
        }
        
        // Sessão encontrada, parar loading
        setLoading(false)
      } catch (err) {
        console.error('Erro inesperado ao verificar autenticação:', err)
        if (checkCount >= maxChecks) {
          setLoading(false)
        }
      }
    }

    // Verificar imediatamente
    checkAuth()

    // Listener para mudanças na sessão (apenas para logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        router.push('/login')
      } else if (session && loading) {
        // Se tiver sessão e ainda estiver carregando, parar loading
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, loading])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        <main className="container mx-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

