"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  RefreshCw, 
  Send, 
  Copy,
  Smartphone,
  Clock,
  AlertCircle,
  XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TestMessageModal } from "./TestMessageModal";

interface ConnectionInfo {
  status?: 'disconnected' | 'connecting' | 'connected' | 'error';
  phone_number?: string | null;
  connected_at?: string | null;
  instance_name?: string | null;
  last_sync_at?: string | null;
}

interface ManageConnectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionInfo | null;
  onReconnect?: () => void;
  onRefresh?: () => Promise<void>;
  onTestMessage?: (telefone: string) => Promise<void>;
  onDisconnect?: () => void;
}

export function ManageConnectionDrawer({
  open,
  onOpenChange,
  connection,
  onReconnect,
  onRefresh,
  onTestMessage,
  onDisconnect,
}: ManageConnectionDrawerProps) {
  const [testMessageModalOpen, setTestMessageModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return 'N/A';
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length === 11) {
      return `+${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${numbers.slice(4, 9)}-${numbers.slice(9)}`;
    } else if (numbers.length >= 10) {
      return `+${numbers.slice(0, 2)} ${numbers.slice(2, 4)} ${numbers.slice(4, 8)}-${numbers.slice(8)}`;
    }
    return phone;
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('pt-BR', { month: 'short' });
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} · ${hours}:${minutes}`;
  };

  const getTimeAgo = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'agora mesmo';
    if (diffMins === 1) return '1 minuto atrás';
    if (diffMins < 60) return `${diffMins} minutos atrás`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hora atrás';
    if (diffHours < 24) return `${diffHours} horas atrás`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 dia atrás';
    return `${diffDays} dias atrás`;
  };

  const handleCopyPhoneNumber = () => {
    if (connection?.phone_number) {
      navigator.clipboard.writeText(connection.phone_number);
      toast({
        title: "Sucesso",
        description: "Número do WhatsApp copiado!",
      });
    }
  };

  // Calcular status da conexão em linguagem humana
  const getConnectionStatus = () => {
    if (!connection || connection.status !== 'connected') {
      return {
        label: 'Desconectado',
        color: 'destructive',
        icon: XCircle,
        description: 'WhatsApp não está conectado.',
      };
    }

    // Verificar última atividade
    const lastActivity = connection.last_sync_at || connection.connected_at;
    if (!lastActivity) {
      return {
        label: 'Conectado, mas atenção',
        color: 'warning',
        icon: AlertCircle,
        description: 'Detectamos instabilidade recente.',
      };
    }

    const lastActivityDate = new Date(lastActivity);
    const now = new Date();
    const diffHours = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60);

    if (diffHours > 1) {
      return {
        label: 'Conectado, mas atenção',
        color: 'warning',
        icon: AlertCircle,
        description: 'Detectamos instabilidade recente.',
      };
    }

    return {
      label: 'Funcionando normalmente',
      color: 'success',
      icon: CheckCircle2,
      description: 'Seu WhatsApp está pronto para enviar e receber mensagens.',
    };
  };

  const connectionStatus = getConnectionStatus();
  const StatusIcon = connectionStatus.icon;
  const shouldShowReconnect = connection?.status !== 'connected' || connectionStatus.color === 'warning';

  // Calcular última atividade
  const lastActivity = connection?.last_sync_at || connection?.connected_at;
  const lastActivityText = lastActivity ? getTimeAgo(lastActivity) : 'N/A';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle>Gerenciar Conexão WhatsApp</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-6 px-6 pb-6">
            {/* Status da Conexão */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Status da conexão</h3>
              <div className="border rounded-lg p-4 space-y-2 bg-card">
                <div className="flex items-center gap-2.5">
                  <StatusIcon 
                    className={`w-4 h-4 flex-shrink-0 ${
                      connectionStatus.color === 'success' 
                        ? 'text-green-600' 
                        : connectionStatus.color === 'warning'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`} 
                  />
                  <span className="text-sm font-medium">{connectionStatus.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {connectionStatus.description}
                </p>
              </div>
            </div>

            {/* Última Atividade */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Última atividade</h3>
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Última atividade:</span>
                  <span className="font-medium">{lastActivityText}</span>
                </div>
              </div>
            </div>

            {/* Dispositivo Conectado */}
            {connection?.connected_at && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Dispositivo conectado</h3>
                <div className="border rounded-lg p-4 space-y-2 bg-card">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-muted rounded-lg flex-shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="font-medium text-sm">WhatsApp Web</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Conectado em {formatDate(connection.connected_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Ações</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full h-auto py-2.5 px-3"
                  onClick={async () => {
                    if (onRefresh) {
                      setRefreshing(true);
                      try {
                        await onRefresh();
                      } catch (error) {
                        console.error('Erro ao verificar conexão:', error);
                      } finally {
                        setRefreshing(false);
                      }
                    }
                  }}
                  disabled={refreshing}
                >
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="text-sm">
                      {refreshing ? 'Verificando...' : 'Verificar conexão'}
                    </span>
                  </div>
                </Button>

                {shouldShowReconnect && onReconnect && (
                  <Button
                    variant="outline"
                    className="w-full h-auto py-2.5 px-3"
                    onClick={onReconnect}
                  >
                    <div className="flex items-center gap-2.5">
                      <RefreshCw className="w-4 h-4" />
                      <span className="text-sm">Reconectar WhatsApp</span>
                    </div>
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full h-auto py-2.5 px-3"
                  onClick={() => setTestMessageModalOpen(true)}
                >
                  <div className="flex items-center gap-2.5">
                    <Send className="w-4 h-4" />
                    <span className="text-sm">Enviar mensagem de teste</span>
                  </div>
                </Button>
                <p className="text-xs text-muted-foreground px-1">
                  Envia uma mensagem para confirmar que o WhatsApp está funcionando.
                </p>

                <Button
                  variant="outline"
                  className="w-full h-auto py-2.5 px-3"
                  onClick={handleCopyPhoneNumber}
                  disabled={!connection?.phone_number}
                >
                  <div className="flex items-center gap-2.5">
                    <Copy className="w-4 h-4" />
                    <span className="text-sm">Copiar número do WhatsApp</span>
                  </div>
                </Button>
              </div>
            </div>

            {/* Zona de risco */}
            {connection?.status === 'connected' && onDisconnect && (
              <div className="space-y-3 border-t pt-6">
                <h3 className="text-sm font-semibold text-destructive">Zona de risco</h3>
                <Button
                  variant="destructive"
                  className="w-full h-auto py-2.5 px-3"
                  onClick={onDisconnect}
                >
                  <div className="flex items-center gap-2.5">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm">Desconectar WhatsApp</span>
                  </div>
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de teste de mensagem */}
      {onTestMessage && (
        <TestMessageModal
          open={testMessageModalOpen}
          onOpenChange={setTestMessageModalOpen}
          onSend={onTestMessage}
        />
      )}
    </>
  );
}

