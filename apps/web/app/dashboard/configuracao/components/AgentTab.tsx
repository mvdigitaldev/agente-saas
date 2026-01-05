"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface AgentTabProps {
  empresaId: string | null;
}

export function AgentTab({ empresaId }: AgentTabProps) {
  const [config, setConfig] = useState({ tone: "", rules: "", policies: {} });
  const [features, setFeatures] = useState({
    ask_for_pix: false,
    require_deposit: false,
    auto_confirmations_48h: true,
    auto_confirmations_24h: true,
    auto_confirmations_2h: true,
    waitlist_enabled: false,
    marketing_campaigns: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (empresaId) {
      loadConfig();
      loadFeatures();
    }
  }, [empresaId]);

  const loadConfig = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const response = await apiClient.get(`/agent-config/${empresaId}`);
      const data = response.data;
      if (data) {
        setConfig({
          tone: data.tone || "",
          rules: data.rules || "",
          policies: data.policies || {},
        });
      }
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  const loadFeatures = useCallback(async () => {
    if (!empresaId) return;

    try {
      const response = await apiClient.get(`/agent-config/${empresaId}/features`);
      const data = response.data;
      if (data) {
        setFeatures(data);
      }
    } catch (error: any) {
      console.error("Error loading features:", error);
      toast({
        title: "Erro ao carregar funcionalidades",
        description: error.response?.data?.message || "Tente recarregar a página.",
        variant: "destructive",
      });
    }
  }, [empresaId, toast]);

  const handleSaveConfig = useCallback(async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      await apiClient.patch(`/agent-config/${empresaId}`, config);
      toast({
        title: "Configuração salva!",
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.response?.data?.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [empresaId, config, toast]);

  const handleToggleFeature = useCallback(
    async (key: string, value: boolean) => {
      if (!empresaId) return;
      try {
        await apiClient.patch(`/agent-config/${empresaId}/features`, {
          [key]: value,
        });
        setFeatures({ ...features, [key]: value });
        toast({
          title: "Feature atualizada",
          description: "A configuração foi atualizada com sucesso.",
        });
      } catch (error: any) {
        toast({
          title: "Erro ao atualizar",
          description: error.response?.data?.message || "Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    },
    [empresaId, features, toast]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tom de Voz</CardTitle>
          <CardDescription>
            Defina como o agente deve se comunicar com os clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="tone">Tom de comunicação</Label>
            <Textarea
              id="tone"
              value={config.tone}
              onChange={(e) => setConfig({ ...config, tone: e.target.value })}
              rows={4}
              placeholder="Ex: Amigável, profissional, descontraído, acolhedor..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras do Salão</CardTitle>
          <CardDescription>
            Informações importantes sobre horários, políticas e procedimentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="rules">Regras e informações</Label>
            <Textarea
              id="rules"
              value={config.rules}
              onChange={(e) => setConfig({ ...config, rules: e.target.value })}
              rows={6}
              placeholder="Ex: Horário de funcionamento, políticas de cancelamento, formas de pagamento..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Funcionalidades</CardTitle>
          <CardDescription>
            Ative ou desative funcionalidades do agente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ask_for_pix">Pedir Pix após agendamento</Label>
              <p className="text-sm text-muted-foreground">
                O agente solicitará o Pix automaticamente após confirmar um agendamento
              </p>
            </div>
            <Switch
              id="ask_for_pix"
              checked={features.ask_for_pix}
              onCheckedChange={(checked) => handleToggleFeature("ask_for_pix", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require_deposit">Exigir sinal/depósito</Label>
              <p className="text-sm text-muted-foreground">
                Requer pagamento de sinal para confirmar agendamento
              </p>
            </div>
            <Switch
              id="require_deposit"
              checked={features.require_deposit}
              onCheckedChange={(checked) => handleToggleFeature("require_deposit", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_confirmations_48h">Confirmação automática 48h antes</Label>
              <p className="text-sm text-muted-foreground">
                Envia mensagem de confirmação 48 horas antes do agendamento
              </p>
            </div>
            <Switch
              id="auto_confirmations_48h"
              checked={features.auto_confirmations_48h}
              onCheckedChange={(checked) => handleToggleFeature("auto_confirmations_48h", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_confirmations_24h">Confirmação automática 24h antes</Label>
              <p className="text-sm text-muted-foreground">
                Envia mensagem de confirmação 24 horas antes do agendamento
              </p>
            </div>
            <Switch
              id="auto_confirmations_24h"
              checked={features.auto_confirmations_24h}
              onCheckedChange={(checked) => handleToggleFeature("auto_confirmations_24h", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_confirmations_2h">Confirmação automática 2h antes</Label>
              <p className="text-sm text-muted-foreground">
                Envia mensagem de confirmação 2 horas antes do agendamento
              </p>
            </div>
            <Switch
              id="auto_confirmations_2h"
              checked={features.auto_confirmations_2h}
              onCheckedChange={(checked) => handleToggleFeature("auto_confirmations_2h", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="waitlist_enabled">Lista de espera habilitada</Label>
              <p className="text-sm text-muted-foreground">
                Permite adicionar clientes à lista de espera quando não há horários disponíveis
              </p>
            </div>
            <Switch
              id="waitlist_enabled"
              checked={features.waitlist_enabled}
              onCheckedChange={(checked) => handleToggleFeature("waitlist_enabled", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing_campaigns">Campanhas de marketing</Label>
              <p className="text-sm text-muted-foreground">
                Permite enviar campanhas promocionais para clientes
              </p>
            </div>
            <Switch
              id="marketing_campaigns"
              checked={features.marketing_campaigns}
              onCheckedChange={(checked) => handleToggleFeature("marketing_campaigns", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveConfig} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Configuração
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

