"use client";

import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Loader2, 
  Phone, 
  Calendar,
  ArrowRight,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { useMessageUsage } from "@/hooks/useMessageUsage";
import { QRCodeModal } from "@/components/whatsapp/QRCodeModal";
import { DisconnectConfirmDialog } from "@/components/whatsapp/DisconnectConfirmDialog";
import { ManageConnectionDrawer } from "@/components/whatsapp/ManageConnectionDrawer";
import { WhatsAppOnboarding } from "@/components/whatsapp/WhatsAppOnboarding";
import { apiClient } from "@/lib/api-client";

export default function IntegracaoPage() {
  const { connection, loading: connectionLoading, connect, disconnect, checkStatus, qrCode } = useWhatsAppConnection();
  const { usage, loading: usageLoading, refetch: refetchUsage } = useMessageUsage();
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [manageDrawerOpen, setManageDrawerOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasVerifiedOnOpenRef = useRef(false);
  const lastManageDrawerStateRef = useRef(false);
  const { toast } = useToast();

  // Verificar conexão automaticamente quando o modal de gerenciar conexão abrir (apenas uma vez)
  useEffect(() => {
    // Só executar quando o modal mudar de fechado para aberto
    if (manageDrawerOpen && !lastManageDrawerStateRef.current && connection?.status === 'connected' && !hasVerifiedOnOpenRef.current) {
      hasVerifiedOnOpenRef.current = true;
      lastManageDrawerStateRef.current = true;
      
      // Executar verificação em background
      checkStatus().catch((error) => {
        console.error('Erro ao verificar conexão automaticamente:', error);
      });
    }
    
    // Resetar flags quando o modal fechar
    if (!manageDrawerOpen) {
      lastManageDrawerStateRef.current = false;
      hasVerifiedOnOpenRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageDrawerOpen]);

  // Função para formatar número de telefone (mostra completo)
  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '';
    
    // Remove caracteres não numéricos
    const numbers = phone.replace(/\D/g, '');
    
    // Formato brasileiro: +55 11 99999-9999 (completo)
    if (numbers.length === 11) {
      return `+${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${numbers.slice(4, 9)}-${numbers.slice(9)}`;
    } else if (numbers.length === 10) {
      return `+${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${numbers.slice(4, 8)}-${numbers.slice(8)}`;
    } else if (numbers.length >= 13) {
      // Formato internacional completo
      return `+${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${numbers.slice(4, 9)}-${numbers.slice(9)}`;
    }
    
    return phone;
  };

  const getStatusBadge = () => {
    if (!connection) return null;
    
    switch (connection.status) {
      case 'connected':
        return (
          <Badge className="gap-1 bg-green-600 hover:bg-green-700 border-transparent text-white">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
            Conectado
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Conectando
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground border-muted-foreground/20">
            <XCircle className="w-3 h-3" />
            Desconectado
          </Badge>
        );
    }
  };

  const handleConnect = async () => {
    // Abrir modal IMEDIATAMENTE - FORÇAR atualização síncrona
    flushSync(() => {
      setQrModalOpen(true);
    });
    
    try {
      // Chamar connect em background (não bloquear)
      connect().catch((error) => {
        console.error('Erro ao conectar:', error);
        // Fechar modal apenas em caso de erro
        setQrModalOpen(false);
      });
      await refetchUsage();
    } catch (error) {
      console.error('Erro ao refetch:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      await refetchUsage();
    } catch (error) {
      console.error('Erro ao desconectar:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} · ${hours}:${minutes}`;
  };

  const handleCancelConnection = async () => {
    try {
      if (!connection?.instance_id) {
        await checkStatus();
        return;
      }

      const empresaId = await apiClient.get('/auth/me/empresa').then(res => res.data?.empresa_id);
      if (!empresaId) {
        throw new Error('Empresa não encontrada');
      }

      await apiClient.delete(`/whatsapp/instances/${connection.instance_id}?empresa_id=${empresaId}`);
      setQrModalOpen(false);
      await checkStatus();
      toast({
        title: "Tempo esgotado",
        description: "A conexão foi cancelada.",
        variant: "destructive",
      });
    } catch (error) {
      console.error('Erro ao cancelar conexão:', error);
      try {
        await checkStatus();
      } catch (refetchError) {
        console.error('Erro ao refetch status após cancelamento:', refetchError);
      }
      toast({
        title: "Erro",
        description: "Erro ao cancelar conexão",
        variant: "destructive",
      });
    }
  };

  // Fechar modal automaticamente quando conexão for estabelecida
  useEffect(() => {
    if (connection?.status === 'connected') {
      // Fechar modal imediatamente quando conectado
      setQrModalOpen(false);
      // Limpar QR code quando conectado
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
      setTimeRemaining(null);
    }
  }, [connection?.status]);

  // Timeout de 2 minutos para cancelar conexão
  useEffect(() => {
    if (timeoutRef.current) {
      clearInterval(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (connection?.status === 'connecting' && connection.qr_code_expires_at) {
      const expiresAt = new Date(connection.qr_code_expires_at).getTime();
      
      timeoutRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          if (timeoutRef.current) {
            clearInterval(timeoutRef.current);
            timeoutRef.current = null;
          }
          handleCancelConnection();
        }
      }, 1000);

      const now = Date.now();
      const initialTimeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeRemaining(initialTimeRemaining);
    } else {
      setTimeRemaining(null);
    }

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.status, connection?.qr_code_expires_at]);

  // Renderizar modal SEMPRE, mesmo durante loading
  const renderModal = () => (
    <>
      <QRCodeModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        qrCode={qrCode}
        loading={qrModalOpen && !qrCode}
      />
      <DisconnectConfirmDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
        onConfirm={handleDisconnect}
      />
      <ManageConnectionDrawer
        open={manageDrawerOpen}
        onOpenChange={setManageDrawerOpen}
        connection={connection}
        onReconnect={async () => {
          await handleConnect();
          toast({
            title: "Sucesso",
            description: "Reconexão iniciada",
          });
        }}
        onRefresh={async () => {
          try {
            // Se tem instance_id, atualizar status no Uazapi primeiro
            if (connection?.instance_id) {
              try {
                const empresaId = await apiClient.get('/auth/me/empresa').then(res => res.data?.empresa_id);
                if (empresaId) {
                  await apiClient.get(`/whatsapp/instances/${connection.instance_id}/status?empresa_id=${empresaId}`);
                }
              } catch (error) {
                console.error('Erro ao atualizar status no Uazapi:', error);
                // Continuar mesmo se falhar, para buscar status do banco
              }
            }
            await checkStatus();
            toast({
              title: "Sucesso",
              description: "Conexão verificada e atualizada",
            });
          } catch (error) {
            console.error('Erro ao verificar conexão:', error);
            await checkStatus().catch(() => {});
            toast({
              title: "Erro",
              description: "Erro ao verificar conexão",
              variant: "destructive",
            });
            throw error;
          }
        }}
        onTestMessage={async (telefone: string) => {
          try {
            const empresaId = await apiClient.get('/auth/me/empresa').then(res => res.data?.empresa_id);
            if (!empresaId) {
              throw new Error('Empresa não encontrada');
            }

            await apiClient.post('/whatsapp/send', {
              empresa_id: empresaId,
              phone_number: telefone,
              message: 'Mensagem de teste do sistema. Se você recebeu esta mensagem, o WhatsApp está funcionando corretamente!',
            });
          } catch (error: any) {
            console.error('Erro ao enviar mensagem de teste:', error);
            throw new Error(error.response?.data?.message || 'Erro ao enviar mensagem de teste');
          }
        }}
        onDisconnect={() => {
          setManageDrawerOpen(false);
          setDisconnectDialogOpen(true);
        }}
      />
    </>
  );

  if (connectionLoading || usageLoading) {
    return (
      <>
        <div className="container mx-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-24" />
        </div>
        {renderModal()}
      </>
    );
  }

  const isConnected = connection?.status === 'connected';
  const isConnecting = connection?.status === 'connecting';
  const isDisconnected = !connection || connection.status === 'disconnected';

  // Render onboarding screen when disconnected
  if (isDisconnected && !connectionLoading) {
    return (
      <>
        <div className="container mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold">Integração WhatsApp</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie sua conexão e uso do WhatsApp
              </p>
            </div>
            {getStatusBadge()}
          </div>

          {/* Onboarding Component */}
          <WhatsAppOnboarding 
            onConnect={handleConnect} 
            isLoading={connectionLoading}
          />
        </div>
        {renderModal()}
      </>
    );
  }

  // Render existing screen for connecting/connected states
  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Integração WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie sua conexão e uso do WhatsApp
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Main Grid - Connection Status and Message Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Connection Status Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status da Conexão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnecting ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="font-medium">Conectando...</span>
                </div>
                {timeRemaining !== null && (
                  <Alert variant={timeRemaining <= 30 ? "destructive" : "default"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Tempo restante: {formatTime(timeRemaining)}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Button 
                    onClick={() => setQrModalOpen(true)} 
                    className="w-full" 
                    size="sm"
                    disabled={!qrCode}
                  >
                    {qrCode ? 'Ver QR Code' : 'Gerando QR Code...'}
                  </Button>
                  <Button 
                    onClick={async () => {
                      if (connection?.instance_id) {
                        try {
                          const empresaId = await apiClient.get('/auth/me/empresa').then(res => res.data?.empresa_id);
                          if (empresaId) {
                            await apiClient.get(`/whatsapp/instances/${connection.instance_id}/status?empresa_id=${empresaId}`);
                          }
                        } catch (error) {
                          console.error('Erro ao atualizar status:', error);
                        }
                      }
                      await checkStatus();
                    }} 
                    variant="outline" 
                    className="w-full" 
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar Status
                  </Button>
                </div>
              </div>
            ) : isConnected ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Conectado</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Número conectado</div>
                    {connection.phone_number ? (
                      <div className="text-sm font-medium">
                        {formatPhoneNumber(connection.phone_number)}
                      </div>
                    ) : (
                      <Skeleton className="h-5 w-32" />
                    )}
                  </div>

                  {connection.connected_at && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Conectado desde</div>
                      <div className="text-sm flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>{formatDate(connection.connected_at)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setManageDrawerOpen(true)}
                >
                  Gerenciar conexão
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Message Usage Card */}
        {isConnected && usage && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Uso de Mensagens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">
                    {usage.remaining.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-sm text-muted-foreground">restantes</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help ml-auto" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          Seu limite de mensagens será renovado em {new Date(usage.period_end).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <Progress 
                  value={usage.percentage_used} 
                  className="h-2"
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{usage.percentage_used.toFixed(0)}% usado</span>
                  <span className="hover:text-foreground cursor-pointer transition-colors">
                    Ver detalhes
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Danger Zone - Isolated */}
      {isConnected && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive">Zona de Perigo</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setDisconnectDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              Desconectar WhatsApp
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modals and Drawers */}
      {renderModal()}
    </div>
  );
}
