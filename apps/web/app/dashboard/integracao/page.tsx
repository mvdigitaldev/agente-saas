'use client'

import { useState, useEffect, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Loader2, QrCode, CheckCircle2, XCircle, RefreshCw, Trash2 } from 'lucide-react'

export default function IntegracaoPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [instance, setInstance] = useState<any>(null)
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('disconnected')
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

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
      const { data: newInstance } = await apiClient.post('/whatsapp/instances', {
        empresa_id: empresaId,
      })

      setInstance(newInstance)
      
      if (newInstance.instance_id) {
        await loadQrCode(newInstance.instance_id)
        startPolling(newInstance.instance_id)
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao conectar',
        description: error.response?.data?.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      })
      setConnecting(false)
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
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        setConnecting(false)
        setQrcode(null)
        loadInstance()
        toast({
          title: 'WhatsApp conectado!',
          description: 'Sua conta foi conectada com sucesso.',
        })
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error)
    }
  }

  const startPolling = (instanceId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(() => {
      checkStatus(instanceId)
    }, 3000)

    checkStatus(instanceId)
  }

  const handleDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp?')) return

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    setInstance(null)
    setQrcode(null)
    setStatus('disconnected')
    setConnecting(false)
    
    toast({
      title: 'WhatsApp desconectado',
      description: 'A conexão foi removida.',
    })
  }

  if (!empresaId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integração WhatsApp</h1>
        <p className="text-muted-foreground">
          Conecte seu WhatsApp para começar a receber e enviar mensagens
        </p>
      </div>

      {!instance ? (
        <Card>
          <CardHeader>
            <CardTitle>Conectar WhatsApp</CardTitle>
            <CardDescription>
              Conecte seu WhatsApp para começar a receber e enviar mensagens através do agente de IA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleConnect} disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  Conectar WhatsApp
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Status da Conexão</CardTitle>
                  <CardDescription>
                    Informações sobre a conexão do WhatsApp
                  </CardDescription>
                </div>
                <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
                  {status === 'connected' ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-1 h-3 w-3" />
                      Desconectado
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {instance.phone_number && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Número conectado</p>
                  <p className="text-lg font-semibold">{instance.phone_number}</p>
                </div>
              )}

              {instance.webhook_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Webhook URL</p>
                  <code className="text-xs bg-muted p-2 rounded block break-all">
                    {instance.webhook_url}
                  </code>
                </div>
              )}
            </CardContent>
          </Card>

          {status !== 'connected' && (
            <Card>
              <CardHeader>
                <CardTitle>QR Code de Conexão</CardTitle>
                <CardDescription>
                  Escaneie o QR code com seu WhatsApp para conectar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {qrcode ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-white rounded-lg border-2 border-border">
                      {qrcode.startsWith('data:image') ? (
                        <img src={qrcode} alt="QR Code" className="w-64 h-64" />
                      ) : (
                        <img src={`data:image/png;base64,${qrcode}`} alt="QR Code" className="w-64 h-64" />
                      )}
                    </div>
                    {connecting && (
                      <p className="text-sm text-muted-foreground text-center">
                        Aguardando você escanear o QR code...
                      </p>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => loadQrCode(instance.instance_id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Gerar Novo QR Code
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">Carregando QR code...</p>
                    <Button
                      variant="outline"
                      onClick={() => loadQrCode(instance.instance_id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Buscar QR Code
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Ações</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                className="w-full sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Desconectar WhatsApp
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
