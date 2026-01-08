"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentTab } from "./components/AgentTab";
import { ServicesTab } from "./components/ServicesTab";
import { AvailabilityTab } from "./components/AvailabilityTab";

export default function ConfiguracaoPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Obter tab ativa da URL (query param)
  const activeTab = searchParams?.get("tab") || "agente";
  const [currentTab, setCurrentTab] = useState<string>(activeTab);

  useEffect(() => {
    loadEmpresaId();
  }, []);

  useEffect(() => {
    // Sincronizar tab com URL
    const tab = searchParams?.get("tab") || "agente";
    setCurrentTab(tab);
  }, [searchParams]);

  const loadEmpresaId = async () => {
    try {
      const response = await apiClient.get("/auth/me/empresa");
      const data = response.data;

      if (data?.empresa_id) {
        setEmpresaId(data.empresa_id);
      } else {
        toast({
          title: "Aviso",
          description: "Empresa não encontrada. Entre em contato com o suporte.",
          variant: "destructive",
        });
        setLoading(false);
      }
    } catch (error: any) {
      console.error("Erro inesperado:", error);
      toast({
        title: "Erro",
        description: error.response?.data?.message || "Não foi possível carregar os dados da empresa.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    router.push(`/dashboard/configuracao?tab=${value}`, { scroll: false });
  };

  if (loading && !empresaId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuração</h1>
          <p className="text-muted-foreground">
            Não foi possível carregar os dados da empresa. Por favor, recarregue a página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuração</h1>
        <p className="text-muted-foreground">
          Personalize o comportamento do seu agente de IA e gerencie seus serviços
        </p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="agente">Agente</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
        </TabsList>
        <TabsContent value="agente" className="mt-6">
          <AgentTab empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="servicos" className="mt-6">
          <ServicesTab empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="horarios" className="mt-6">
          <AvailabilityTab empresaId={empresaId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
