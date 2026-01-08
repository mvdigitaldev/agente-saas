import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export interface AvailabilityRule {
  rule_id: string;
  empresa_id: string;
  staff_id?: string;
  resource_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at?: string;
}

export interface CreateAvailabilityRuleInput {
  empresa_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  staff_id?: string;
}

export interface UpdateAvailabilityRuleInput {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  staff_id?: string | null;
}

export function useAvailabilityRules(empresaId: string | null) {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRules = useCallback(async () => {
    if (!empresaId) return;
    try {
      setLoading(true);
      const response = await apiClient.get(`/scheduling/availability-rules?empresa_id=${empresaId}`);
      setRules(response.data);
    } catch (error) {
      console.error("Erro ao buscar regras:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as regras de disponibilidade.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [empresaId, toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = async (data: Omit<CreateAvailabilityRuleInput, "empresa_id">) => {
    if (!empresaId) return;
    try {
      const response = await apiClient.post("/scheduling/availability-rules", {
        ...data,
        empresa_id: empresaId,
      });
      setRules((prev) => [...prev, response.data]);
      toast({
        title: "Sucesso",
        description: "Regra criada com sucesso!",
      });
      return response.data;
    } catch (error) {
      console.error("Erro ao criar regra:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a regra.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateRule = async (ruleId: string, data: UpdateAvailabilityRuleInput) => {
    if (!empresaId) return;
    try {
      const response = await apiClient.put(
        `/scheduling/availability-rules/${ruleId}?empresa_id=${empresaId}`,
        data
      );
      setRules((prev) =>
        prev.map((r) => (r.rule_id === ruleId ? response.data : r))
      );
      toast({
        title: "Sucesso",
        description: "Regra atualizada com sucesso!",
      });
      return response.data;
    } catch (error: any) {
      console.error("Erro ao atualizar regra:", error);
      toast({
        title: "Erro",
        description: error.response?.data?.message || "Não foi possível atualizar a regra.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!empresaId) return;
    try {
      await apiClient.delete(`/scheduling/availability-rules/${ruleId}?empresa_id=${empresaId}`);
      setRules((prev) => prev.filter((r) => r.rule_id !== ruleId));
      toast({
        title: "Sucesso",
        description: "Regra removida com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao deletar regra:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a regra.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    rules,
    loading,
    createRule,
    updateRule,
    deleteRule,
    refetch: fetchRules,
  };
}
