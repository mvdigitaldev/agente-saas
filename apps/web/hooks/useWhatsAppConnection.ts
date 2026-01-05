import { useState, useCallback, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface ConnectionStatus {
  connected: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  phone_number?: string | null;
  connected_at?: string | null;
  instance_name?: string | null;
  instance_id?: string | null;
  error_message?: string | null;
  qr_code_expires_at?: string | null;
  qr_code?: string | null;
  last_sync_at?: string | null;
}

interface ConnectResponse {
  qr_code?: string;
  instance_name?: string;
  instance_id: string;
  status: string;
  connected: boolean;
  logged_in: boolean;
  qr_code_expires_at?: string;
}

export function useWhatsAppConnection() {
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Função para buscar empresa_id
  const getEmpresaId = async (): Promise<string | null> => {
    try {
      const response = await apiClient.get('/auth/me/empresa');
      return response.data?.empresa_id || null;
    } catch (error) {
      console.error('Erro ao buscar empresa_id:', error);
      return null;
    }
  };

  // Função para polling silencioso (sem loading state)
  const fetchStatusSilent = useCallback(async () => {
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return null;

      const { data } = await apiClient.get(`/whatsapp/status?empresa_id=${empresaId}`);
      
      const statusData: ConnectionStatus = {
        connected: data.connected || false,
        status: data.status || 'disconnected',
        phone_number: data.phone_number,
        instance_id: data.instance_id,
        qr_code: data.qr_code,
        qr_code_expires_at: data.qr_code_expires_at,
        connected_at: data.connected_at,
        last_sync_at: data.last_sync_at,
      };

      const previousStatus = connection?.status;
      setConnection(statusData);
      
      // Atualizar QR code apenas se status for connecting
      if (statusData.status === 'connecting' && data.qr_code) {
        setQrCode(data.qr_code);
      } else if (statusData.status !== 'connecting') {
        setQrCode(null); // Limpar QR code quando não está mais conectando
      }

      // Se o status mudou de connecting para connected, retornar flag especial
      if (previousStatus === 'connecting' && statusData.status === 'connected') {
        return { ...statusData, _statusChanged: true };
      }
      
      return statusData;
    } catch (error) {
      // Silenciosamente falha no polling
      console.error('Erro ao buscar status (polling):', error);
      return null;
    }
  }, [connection?.status]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) {
        setConnection({
          connected: false,
          status: 'disconnected',
          qr_code: null,
        });
        setQrCode(null);
        return null;
      }

      const { data } = await apiClient.get(`/whatsapp/status?empresa_id=${empresaId}`);
      
      const statusData: ConnectionStatus = {
        connected: data.connected || false,
        status: data.status || 'disconnected',
        phone_number: data.phone_number,
        instance_id: data.instance_id,
        qr_code: data.qr_code,
        qr_code_expires_at: data.qr_code_expires_at,
        connected_at: data.connected_at,
        last_sync_at: data.last_sync_at,
      };

      setConnection(statusData);
      
      // Atualizar QR code se vier na resposta
      if (data.qr_code) {
        setQrCode(data.qr_code);
      } else if (data.status !== 'connecting') {
        // Limpar QR code se não estiver mais conectando
        setQrCode(null);
      }
      
      // Se status é disconnected, garantir que QR code está limpo
      if (statusData.status === 'disconnected') {
        setQrCode(null);
      }
      
      return statusData;
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      // Se erro, resetar para estado disconnected
      setConnection({
        connected: false,
        status: 'disconnected',
        qr_code: null,
      });
      setQrCode(null);
      toast({
        title: "Erro",
        description: "Erro ao buscar status da conexão",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Carregar status inicial
  useEffect(() => {
    fetchStatus().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling quando status é 'connecting' - usa fetchStatusSilent para evitar piscadas
  useEffect(() => {
    if (connection?.status === 'connecting') {
      // Polling a cada 3 segundos (mais frequente para detectar conexão mais rápido)
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const updatedStatus = await fetchStatusSilent();
          // Se o status mudou para connected, fazer uma atualização completa
          if (updatedStatus && (updatedStatus as any)._statusChanged) {
            // Parar polling imediatamente
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            // Fazer uma atualização completa para garantir que todos os dados sejam atualizados
            await fetchStatus();
            toast({
              title: "Sucesso",
              description: "WhatsApp conectado com sucesso!",
            });
          }
        } catch (error) {
          console.error('Erro no polling:', error);
        }
      }, 3000);
    } else {
      // Parar polling quando não está conectando
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.status, fetchStatusSilent, fetchStatus, toast]);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) {
        throw new Error('Empresa não encontrada');
      }

      const { data }: { data: ConnectResponse } = await apiClient.post('/whatsapp/instances', {
        empresa_id: empresaId,
      });
      
      // Salvar QR Code (mesmo se vazio, para resetar estado anterior)
      setQrCode(data.qr_code || null);
      
      // Atualizar status
      const newStatus = (data.connected && data.logged_in ? 'connected' : 'connecting') as any;
      setConnection({
        connected: data.connected && data.logged_in,
        status: newStatus,
        instance_name: data.instance_name,
        instance_id: data.instance_id,
        qr_code_expires_at: data.qr_code_expires_at,
      });

      // Se já está conectado, buscar status completo
      if (data.connected && data.logged_in) {
        await fetchStatus();
        toast({
          title: "Sucesso",
          description: "WhatsApp conectado com sucesso!",
        });
      } else if (data.qr_code) {
        toast({
          title: "Sucesso",
          description: "QR Code gerado! Escaneie com seu WhatsApp",
        });
      }

      return data;
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.message || error.message || 'Erro ao conectar WhatsApp',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus, toast]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId || !connection?.instance_id) {
        throw new Error('Conexão não encontrada');
      }

      await apiClient.post(
        `/whatsapp/instances/${connection.instance_id}/disconnect?empresa_id=${empresaId}`
      );
      
      setConnection({
        connected: false,
        status: 'disconnected',
      });
      setQrCode(null);
      
      toast({
        title: "Sucesso",
        description: "WhatsApp desconectado com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: error.response?.data?.message || 'Erro ao desconectar WhatsApp',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [connection?.instance_id, toast]);

  const checkStatus = useCallback(async () => {
    return fetchStatus();
  }, [fetchStatus]);

  return {
    connection,
    loading,
    qrCode,
    connect,
    disconnect,
    checkStatus,
    refetch: fetchStatus,
  };
}

