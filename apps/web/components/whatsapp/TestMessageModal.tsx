"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TestMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (telefone: string) => Promise<void>;
}

export function TestMessageModal({
  open,
  onOpenChange,
  onSend,
}: TestMessageModalProps) {
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const formatarTelefone = (value: string): string => {
    // Remove caracteres não numéricos
    const numbers = value.replace(/\D/g, "");
    return numbers;
  };

  const validarTelefone = (tel: string): boolean => {
    const numbers = tel.replace(/\D/g, "");
    // Aceita formato brasileiro (10 ou 11 dígitos) ou internacional (12+ dígitos)
    return numbers.length >= 10 && numbers.length <= 15;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!telefone.trim()) {
      setError("Por favor, informe o número de telefone");
      return;
    }

    if (!validarTelefone(telefone)) {
      setError("Número de telefone inválido. Use o formato brasileiro (DDD + número) ou internacional");
      return;
    }

    setLoading(true);
    try {
      await onSend(telefone);
      toast({
        title: "Sucesso",
        description: "Mensagem de teste enviada com sucesso!",
      });
      setTelefone("");
      onOpenChange(false);
    } catch (err: any) {
      const errorMessage = err?.message || "Erro ao enviar mensagem de teste";
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTelefone("");
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem de Teste</DialogTitle>
          <DialogDescription>
            Digite o número de telefone para enviar uma mensagem de teste e verificar se o WhatsApp está funcionando corretamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Número de Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="Ex: 5511999999999 ou 11999999999"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Digite o número com DDD (formato brasileiro) ou código do país (formato internacional)
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !telefone.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

