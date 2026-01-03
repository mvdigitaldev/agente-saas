'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase/client'

export default function ConfiguracaoPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [config, setConfig] = useState({ tone: '', rules: '', policies: {} })
  const [features, setFeatures] = useState({
    ask_for_pix: false,
    require_deposit: false,
    auto_confirmations_48h: true,
    auto_confirmations_24h: true,
    auto_confirmations_2h: true,
    waitlist_enabled: false,
    marketing_campaigns: false,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadEmpresaId()
  }, [])

  useEffect(() => {
    if (empresaId) {
      loadConfig()
      loadFeatures()
    }
  }, [empresaId])

  const loadEmpresaId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Buscar empresa_id do usuário
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

  const loadConfig = async () => {
    try {
      const { data } = await apiClient.get(`/agent-config/${empresaId}`)
      if (data) {
        setConfig({
          tone: data.tone || '',
          rules: data.rules || '',
          policies: data.policies || {},
        })
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  const loadFeatures = async () => {
    try {
      const { data } = await apiClient.get(`/agent-config/${empresaId}/features`)
      if (data) {
        setFeatures(data)
      }
    } catch (error) {
      console.error('Error loading features:', error)
    }
  }

  const handleSaveConfig = async () => {
    setLoading(true)
    try {
      await apiClient.patch(`/agent-config/${empresaId}`, config)
      alert('Configuração salva!')
    } catch (error) {
      alert('Erro ao salvar configuração')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFeature = async (key: string, value: boolean) => {
    setLoading(true)
    try {
      await apiClient.patch(`/agent-config/${empresaId}/features`, {
        [key]: value,
      })
      setFeatures({ ...features, [key]: value })
    } catch (error) {
      alert('Erro ao atualizar feature')
    } finally {
      setLoading(false)
    }
  }

  if (!empresaId) {
    return <div>Carregando...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <h1>Configuração do Agente</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>Tom de Voz</h2>
        <textarea
          value={config.tone}
          onChange={(e) => setConfig({ ...config, tone: e.target.value })}
          rows={4}
          style={{ width: '100%', padding: '0.5rem' }}
          placeholder="Ex: Amigável, profissional, descontraído..."
        />
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Regras do Salão</h2>
        <textarea
          value={config.rules}
          onChange={(e) => setConfig({ ...config, rules: e.target.value })}
          rows={6}
          style={{ width: '100%', padding: '0.5rem' }}
          placeholder="Ex: Horário de funcionamento, políticas de cancelamento..."
        />
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Features / Toggles</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={features.ask_for_pix}
              onChange={(e) => handleToggleFeature('ask_for_pix', e.target.checked)}
            />
            Pedir Pix após agendamento
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={features.require_deposit}
              onChange={(e) => handleToggleFeature('require_deposit', e.target.checked)}
            />
            Exigir sinal/depósito
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={features.auto_confirmations_48h}
              onChange={(e) => handleToggleFeature('auto_confirmations_48h', e.target.checked)}
            />
            Confirmação automática 48h antes
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={features.auto_confirmations_24h}
              onChange={(e) => handleToggleFeature('auto_confirmations_24h', e.target.checked)}
            />
            Confirmação automática 24h antes
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={features.auto_confirmations_2h}
              onChange={(e) => handleToggleFeature('auto_confirmations_2h', e.target.checked)}
            />
            Confirmação automática 2h antes
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={features.waitlist_enabled}
              onChange={(e) => handleToggleFeature('waitlist_enabled', e.target.checked)}
            />
            Lista de espera habilitada
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={features.marketing_campaigns}
              onChange={(e) => handleToggleFeature('marketing_campaigns', e.target.checked)}
            />
            Campanhas de marketing
          </label>
        </div>
      </section>

      <button
        onClick={handleSaveConfig}
        disabled={loading}
        style={{ marginTop: '2rem', padding: '0.75rem 1.5rem' }}
      >
        {loading ? 'Salvando...' : 'Salvar Configuração'}
      </button>
    </div>
  )
}

