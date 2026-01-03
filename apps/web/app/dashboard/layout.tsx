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

    const checkAuth = async () => {
      // Aguardar um pouco para garantir que o localStorage foi atualizado
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (!mounted) return
      
      if (error || !session) {
        router.push('/login')
        return
      }
      
      setLoading(false)
    }

    checkAuth()

    // Listener para mudanças na sessão
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/login')
      } else if (event === 'SIGNED_IN' && session) {
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

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

