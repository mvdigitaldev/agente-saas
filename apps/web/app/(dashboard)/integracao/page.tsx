'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function IntegracaoPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [instance, setInstance] = useState<any>(null)
  const [formData, setFormData] = useState({
    phone_number: '',
    uazapi_token: '',
    uazapi_instance_id: '',
  })

  useEffect(() => {
    loadEmpresaId()
  }, [])

  useEffect(() => {
    if (empresaId) {
      loadInstance()
    }
  }, [empresaId])

  const loadEmpresaId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('empresa_users')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single()
      
      if (data) {
        setEmpresaId(data.empresa_id)
      }
    }
  }

  const loadInstance = async () => {
    if (!empresaId) return

    const { data } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('empresa_id', empresaId)
      .single()

    if (data) {
      setInstance(data)
      setFormData({
        phone_number: data.phone_number || '',
        uazapi_token: data.uazapi_token || '',
        uazapi_instance_id: data.uazapi_instance_id || '',
      })
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId) return

    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .upsert({
          empresa_id: empresaId,
          ...formData,
          status: 'connected',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'empresa_id,phone_number',
        })

      if (error) throw error

      alert('Configuração salva!')
      loadInstance()
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message)
    }
  }

  if (!empresaId) {
    return <div>Carregando...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <h1>Integração Uazapi</h1>

      <form onSubmit={handleSave} style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label>Número do WhatsApp</label>
          <input
            type="text"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            required
            style={{ width: '100%', padding: '0.5rem' }}
            placeholder="5511999999999"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>Token Uazapi</label>
          <input
            type="password"
            value={formData.uazapi_token}
            onChange={(e) => setFormData({ ...formData, uazapi_token: e.target.value })}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>Instance ID Uazapi</label>
          <input
            type="text"
            value={formData.uazapi_instance_id}
            onChange={(e) => setFormData({ ...formData, uazapi_instance_id: e.target.value })}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        {instance && (
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0f0f0' }}>
            <strong>Status:</strong> {instance.status}
            <br />
            <strong>Webhook URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/webhook/uazapi
          </div>
        )}

        <button type="submit" style={{ padding: '0.75rem 1.5rem' }}>
          Salvar Configuração
        </button>
      </form>
    </div>
  )
}

