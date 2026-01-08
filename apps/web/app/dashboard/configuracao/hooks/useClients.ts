import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export interface Client {
  client_id: string;
  empresa_id: string;
  nome: string;
  whatsapp_number: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientInput {
  nome: string;
  whatsapp_number: string;
  email?: string;
}

export interface UpdateClientInput {
  nome?: string;
  whatsapp_number?: string;
  email?: string;
}

export interface ImportClientsInput {
  clients: CreateClientInput[];
}

interface UseClientsReturn {
  clients: Client[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createClient: (data: CreateClientInput) => Promise<Client | null>;
  updateClient: (id: string, data: UpdateClientInput) => Promise<Client | null>;
  deleteClient: (id: string) => Promise<boolean>;
  importClients: (data: ImportClientsInput) => Promise<{ imported: number; errors: number } | null>;
}

export function useClients(): UseClientsReturn {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get("/clients");
      // A resposta pode vir diretamente como array ou dentro de data
      const clientsData = Array.isArray(response.data) ? response.data : (response.data?.data || response.data || []);
      setClients(clientsData);
    } catch (err: any) {
      const error = new Error(err.response?.data?.message || "Erro ao carregar clientes");
      setError(error);
      console.error("Erro ao carregar clientes:", err);
      toast({
        title: "Erro",
        description: err.response?.data?.message || "Erro ao carregar clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const createClient = useCallback(
    async (data: CreateClientInput): Promise<Client | null> => {
      try {
        setError(null);
        const response = await apiClient.post("/clients", data);
        toast({
          title: "Sucesso",
          description: "Cliente criado com sucesso!",
        });
        await fetchClients();
        return response.data;
      } catch (err: any) {
        const error = new Error(err.response?.data?.message || "Erro ao criar cliente");
        setError(error);
        console.error("Erro ao criar cliente:", err);
        toast({
          title: "Erro",
          description: err.response?.data?.message || "Erro ao criar cliente",
          variant: "destructive",
        });
        return null;
      }
    },
    [toast, fetchClients]
  );

  const updateClient = useCallback(
    async (id: string, data: UpdateClientInput): Promise<Client | null> => {
      try {
        setError(null);
        const response = await apiClient.put(`/clients/${id}`, data);
        toast({
          title: "Sucesso",
          description: "Cliente atualizado com sucesso!",
        });
        await fetchClients();
        return response.data;
      } catch (err: any) {
        const error = new Error(err.response?.data?.message || "Erro ao atualizar cliente");
        setError(error);
        console.error("Erro ao atualizar cliente:", err);
        toast({
          title: "Erro",
          description: err.response?.data?.message || "Erro ao atualizar cliente",
          variant: "destructive",
        });
        return null;
      }
    },
    [toast, fetchClients]
  );

  const deleteClient = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setError(null);
        await apiClient.delete(`/clients/${id}`);
        toast({
          title: "Sucesso",
          description: "Cliente excluído com sucesso!",
        });
        await fetchClients();
        return true;
      } catch (err: any) {
        const error = new Error(err.response?.data?.message || "Erro ao excluir cliente");
        setError(error);
        console.error("Erro ao excluir cliente:", err);
        toast({
          title: "Erro",
          description: err.response?.data?.message || "Erro ao excluir cliente",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, fetchClients]
  );

  const importClients = useCallback(
    async (data: ImportClientsInput): Promise<{ imported: number; errors: number } | null> => {
      try {
        setError(null);
        const response = await apiClient.post("/clients/import", data);
        const result = response.data;
        toast({
          title: "Importação concluída",
          description: `${result.imported} cliente(s) importado(s)${result.errors > 0 ? `. ${result.errors} erro(s).` : "."}`,
        });
        await fetchClients();
        return result;
      } catch (err: any) {
        const error = new Error(err.response?.data?.message || "Erro ao importar clientes");
        setError(error);
        console.error("Erro ao importar clientes:", err);
        toast({
          title: "Erro",
          description: err.response?.data?.message || "Erro ao importar clientes",
          variant: "destructive",
        });
        return null;
      }
    },
    [toast, fetchClients]
  );

  return {
    clients,
    loading,
    error,
    refetch: fetchClients,
    createClient,
    updateClient,
    deleteClient,
    importClients,
  };
}

