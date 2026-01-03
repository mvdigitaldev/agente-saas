'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase/client'

interface BlockedTime {
  block_id: string
  start_time: string
  end_time: string
  motivo?: string
}

export default function BloqueiosPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    start_time: '',
    end_time: '',
    motivo: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadEmpresaId()
  }, [])

  useEffect(() => {
    if (empresaId) {
      loadBlockedTimes()
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

  const loadBlockedTimes = async () => {
    try {
      const { data } = await apiClient.get(`/scheduling/blocked-times?empresa_id=${empresaId}`)
      setBlockedTimes(data || [])
    } catch (error) {
      console.error('Error loading blocked times:', error)
    }
  }

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await apiClient.post('/scheduling/blocked-times', {
        empresa_id: empresaId,
        ...formData,
      })
      setShowForm(false)
      setFormData({ start_time: '', end_time: '', motivo: '' })
      loadBlockedTimes()
    } catch (error) {
      alert('Erro ao criar bloqueio')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBlock = async (id: string) => {
    if (!confirm('Deseja remover este bloqueio?')) return

    try {
      await apiClient.delete(`/scheduling/blocked-times/${id}`)
      loadBlockedTimes()
    } catch (error) {
      alert('Erro ao remover bloqueio')
    }
  }

  if (!empresaId) {
    return <div>Carregando...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Bloqueios de Agenda</h1>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Novo Bloqueio'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateBlock} style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
          <h2>Criar Bloqueio</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label>Data/Hora Início</label>
            <input
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Data/Hora Fim</label>
            <input
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Motivo (opcional)</label>
            <input
              type="text"
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Criando...' : 'Criar Bloqueio'}
          </button>
        </form>
      )}

      <div style={{ marginTop: '2rem' }}>
        <h2>Bloqueios Existentes</h2>
        {blockedTimes.length === 0 ? (
          <p>Nenhum bloqueio cadastrado</p>
        ) : (
          <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Início</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Fim</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Motivo</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {blockedTimes.map((block) => (
                <tr key={block.block_id}>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                    {new Date(block.start_time).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                    {new Date(block.end_time).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                    {block.motivo || '-'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                    <button onClick={() => handleDeleteBlock(block.block_id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

