'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { apiClient } from '@/lib/api-client'

export default function SignupPage() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    empresa_nome: '',
    empresa_cnpj: '',
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Criar usuário via API (que cria empresa automaticamente)
      const { data, error } = await apiClient.post('/auth/signup', formData)

      if (error) throw error

      // Se tiver session, fazer login automático
      if (data.session) {
        const { error: signInError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (signInError) throw signInError

        router.push('/dashboard')
      } else {
        // Se não tiver session (email confirmation required), redirecionar para login
        alert('Conta criada! Verifique seu email para confirmar.')
        router.push('/login')
      }
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <form onSubmit={handleSignup} style={{ width: '400px', padding: '2rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Criar Conta</h1>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Seu Nome</label>
          <input
            type="text"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Senha</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            minLength={6}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nome da Empresa</label>
          <input
            type="text"
            value={formData.empresa_nome}
            onChange={(e) => setFormData({ ...formData, empresa_nome: e.target.value })}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>CNPJ (opcional)</label>
          <input
            type="text"
            value={formData.empresa_cnpj}
            onChange={(e) => setFormData({ ...formData, empresa_cnpj: e.target.value })}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem' }}
        >
          {loading ? 'Criando conta...' : 'Criar Conta'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <a href="/login" style={{ color: '#0066cc' }}>Já tem conta? Faça login</a>
        </div>
      </form>
    </div>
  )
}

