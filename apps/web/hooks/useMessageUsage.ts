import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface MessageUsage {
  used: number;
  limit: number;
  remaining: number;
  period_start: string;
  period_end: string;
  percentage_used: number;
}

export function useMessageUsage() {
  const [usage, setUsage] = useState<MessageUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      // Por enquanto, retornar dados mockados ou vazios
      // Quando o endpoint estiver disponível, usar:
      // const { data } = await apiClient.get('/whatsapp/usage');
      
      // Mock data para não quebrar a UI
      const mockData: MessageUsage = {
        used: 0,
        limit: 1000,
        remaining: 1000,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        percentage_used: 0,
      };
      
      setUsage(mockData);
      return mockData;
    } catch (error: any) {
      console.error('Erro ao buscar uso:', error);
      // Não mostrar toast para erro de uso (não é crítico)
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    loading,
    refetch: fetchUsage,
  };
}

