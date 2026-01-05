import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import type { CreateServiceInput, UpdateServiceInput } from "@/lib/schemas/service.schema";

export interface Service {
  service_id: string;
  empresa_id: string;
  nome: string;
  duracao_minutos: number;
  preco: number | null;
  descricao: string | null;
  available_online: boolean;
  show_price_online: boolean;
  image_url: string | null; // Deprecated: usar images[]
  images: string[] | null;
  fixed_price: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface UseServicesReturn {
  services: Service[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createService: (data: CreateServiceInput) => Promise<Service | null>;
  updateService: (id: string, data: UpdateServiceInput) => Promise<Service | null>;
  deleteService: (id: string) => Promise<boolean>;
  toggleServiceStatus: (id: string, currentStatus: boolean) => Promise<boolean>;
}

export function useServices(empresaId: string | null): UseServicesReturn {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchServices = useCallback(async () => {
    if (!empresaId) {
      setServices([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data } = await apiClient.get(`/services?empresa_id=${empresaId}`);
      setServices(data.services || []);
    } catch (err: any) {
      const error = new Error(err.response?.data?.message || "Erro ao carregar serviços");
      setError(error);
      console.error("Erro ao carregar serviços:", err);
      toast({
        title: "Erro",
        description: "Erro ao carregar serviços",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [empresaId, toast]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const createService = useCallback(
    async (data: CreateServiceInput): Promise<Service | null> => {
      if (!empresaId) {
        toast({
          title: "Erro",
          description: "Empresa não encontrada",
          variant: "destructive",
        });
        return null;
      }

      try {
        setError(null);
        const response = await apiClient.post(`/services?empresa_id=${empresaId}`, data);
        toast({
          title: "Sucesso",
          description: "Serviço criado com sucesso!",
        });
        await fetchServices();
        return response.data;
      } catch (err: any) {
        const error = new Error(err.response?.data?.message || "Erro ao criar serviço");
        setError(error);
        console.error("Erro ao criar serviço:", err);
        toast({
          title: "Erro",
          description: err.response?.data?.message || "Erro ao criar serviço",
          variant: "destructive",
        });
        return null;
      }
    },
    [empresaId, toast, fetchServices]
  );

  const updateService = useCallback(
    async (id: string, data: UpdateServiceInput): Promise<Service | null> => {
      if (!empresaId) {
        toast({
          title: "Erro",
          description: "Empresa não encontrada",
          variant: "destructive",
        });
        return null;
      }

      try {
        setError(null);
        const response = await apiClient.patch(`/services/${id}?empresa_id=${empresaId}`, data);
        toast({
          title: "Sucesso",
          description: "Serviço atualizado com sucesso!",
        });
        await fetchServices();
        return response.data;
      } catch (err: any) {
        const error = new Error(err.response?.data?.message || "Erro ao atualizar serviço");
        setError(error);
        console.error("Erro ao atualizar serviço:", err);
        toast({
          title: "Erro",
          description: err.response?.data?.message || "Erro ao atualizar serviço",
          variant: "destructive",
        });
        return null;
      }
    },
    [empresaId, toast, fetchServices]
  );

  const deleteService = useCallback(
    async (id: string): Promise<boolean> => {
      if (!empresaId) {
        toast({
          title: "Erro",
          description: "Empresa não encontrada",
          variant: "destructive",
        });
        return false;
      }

      try {
        setError(null);
        await apiClient.delete(`/services/${id}?empresa_id=${empresaId}`);
        toast({
          title: "Sucesso",
          description: "Serviço deletado com sucesso!",
        });
        await fetchServices();
        return true;
      } catch (err: any) {
        const error = new Error(err.response?.data?.message || "Erro ao deletar serviço");
        setError(error);
        console.error("Erro ao deletar serviço:", err);
        toast({
          title: "Erro",
          description: err.response?.data?.message || "Erro ao deletar serviço",
          variant: "destructive",
        });
        return false;
      }
    },
    [empresaId, toast, fetchServices]
  );

  const toggleServiceStatus = useCallback(
    async (id: string, currentStatus: boolean): Promise<boolean> => {
      return updateService(id, { ativo: !currentStatus }).then((result) => result !== null);
    },
    [updateService]
  );

  return {
    services,
    loading,
    error,
    refetch: fetchServices,
    createService,
    updateService,
    deleteService,
    toggleServiceStatus,
  };
}

