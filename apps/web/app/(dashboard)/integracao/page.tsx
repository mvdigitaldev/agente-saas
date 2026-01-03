'use client'

import { useState, useEffect, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase/client'

export default function IntegracaoPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [instance, setInstance] = useState<any>(null)
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('disconnected')
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadEmpresaId()
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
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

    try {
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('empresa_id', empresaId)
        .single()

      if (data) {
        setInstance(data)
        setStatus(data.status || 'disconnected')
        
        // Se desconectado, buscar QR code
        if (data.status !== 'connected' && data.uazapi_instance_id) {
          loadQrCode(data.instance_id)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar instância:', error)
    }
  }

  const handleConnect = async () => {
    if (!empresaId) return

    setLoading(true)
    setConnecting(true)

    try {
      // Criar instância
      const { data: newInstance } = await apiClient.post('/whatsapp/instances', {
        empresa_id: empresaId,
      })

      setInstance(newInstance)
      
      // Buscar QR code
      if (newInstance.instance_id) {
        await loadQrCode(newInstance.instance_id)
        // Iniciar polling
        startPolling(newInstance.instance_id)
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao conectar WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  const loadQrCode = async (instanceId: string) => {
    if (!empresaId) return

    try {
      const { data } = await apiClient.get(
        `/whatsapp/instances/${instanceId}/qrcode?empresa_id=${empresaId}`
      )
      
      if (data.qrcode) {
        setQrcode(data.qrcode)
      }
    } catch (error) {
      console.error('Erro ao carregar QR code:', error)
    }
  }

  const checkStatus = async (instanceId: string) => {
    if (!empresaId) return

    try {
      const { data } = await apiClient.get(
        `/whatsapp/instances/${instanceId}/status?empresa_id=${empresaId}`
      )

      const newStatus = data.connected ? 'connected' : 'disconnected'
      setStatus(newStatus)

      if (data.connected) {
        // Parar polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        setConnecting(false)
        setQrcode(null)
        
        // Recarregar instância para pegar dados atualizados
        loadInstance()
        
        alert('WhatsApp conectado com sucesso!')
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error)
    }
  }

  const startPolling = (instanceId: string) => {
    // Verificar status a cada 3 segundos
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(() => {
      checkStatus(instanceId)
    }, 3000)

    // Primeira verificação imediata
    checkStatus(instanceId)
  }

  const handleDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp?')) return

    // Limpar polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    setInstance(null)
    setQrcode(null)
    setStatus('disconnected')
    setConnecting(false)
  }

  if (!empresaId) {
    return <div style={{ padding: '2rem' }}>Carregando...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <h1>Integração WhatsApp</h1>

      {!instance ? (
        <div style={{ marginTop: '2rem' }}>
          <p style={{ marginBottom: '1rem' }}>
            Conecte seu WhatsApp para começar a receber e enviar mensagens através do agente de IA.
          </p>
          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Conectando...' : 'Conectar WhatsApp'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: status === 'connected' ? '#d4edda' : '#fff3cd',
            border: `1px solid ${status === 'connected' ? '#c3e6cb' : '#ffeaa7'}`,
            borderRadius: '4px',
            marginBottom: '1rem',
          }}>
            <strong>Status:</strong> {status === 'connected' ? '✅ Conectado' : '⏳ Aguardando conexão'}
            {instance.phone_number && (
              <div style={{ marginTop: '0.5rem' }}>
                <strong>Número:</strong> {instance.phone_number}
              </div>
            )}
          </div>

          {status !== 'connected' && (
            <div>
              {qrcode ? (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <p style={{ marginBottom: '1rem' }}>
                    Escaneie o QR code com seu WhatsApp:
                  </p>
                  <div style={{ 
                    display: 'inline-block',
                    padding: '1rem',
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}>
                    {qrcode.startsWith('data:image') ? (
                      <img src={qrcode} alt="QR Code" style={{ maxWidth: '300px' }} />
                    ) : (
                      <img src={`data:image/png;base64,${qrcode}`} alt="QR Code" style={{ maxWidth: '300px' }} />
                    )}
                  </div>
                  <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                    {connecting && 'Aguardando você escanear o QR code...'}
                  </p>
                  <button
                    onClick={() => loadQrCode(instance.instance_id)}
                    style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
                  >
                    Gerar Novo QR Code
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p>Carregando QR code...</p>
                  <button
                    onClick={() => loadQrCode(instance.instance_id)}
                    style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
                  >
                    Buscar QR Code
                  </button>
                </div>
              )}
            </div>
          )}

          {instance.webhook_url && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              fontSize: '0.9rem',
            }}>
              <strong>Webhook URL:</strong>
              <div style={{ marginTop: '0.5rem', wordBreak: 'break-all' }}>
                {instance.webhook_url}
              </div>
            </div>
          )}

          <div style={{ marginTop: '2rem' }}>
            <button
              onClick={handleDisconnect}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Desconectar WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
