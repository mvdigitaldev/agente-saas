"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useClients, type Client } from "../hooks/useClients";
import { normalizePhoneNumber, formatPhoneNumber } from "@/lib/phone-utils";
import { Loader2 } from "lucide-react";

const clientSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  whatsapp_number: z.string().min(1, "Telefone é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

/**
 * Aplica máscara de telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  
  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  } else if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  } else {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
}

export function ClientFormDialog({ open, onOpenChange, client }: ClientFormDialogProps) {
  const { createClient, updateClient } = useClients();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneDisplay, setPhoneDisplay] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      nome: "",
      whatsapp_number: "",
      email: "",
    },
  });

  const phoneValue = watch("whatsapp_number");

  // Atualizar display do telefone quando o valor muda
  useEffect(() => {
    if (phoneValue) {
      setPhoneDisplay(maskPhone(phoneValue));
    } else {
      setPhoneDisplay("");
    }
  }, [phoneValue]);

  // Resetar formulário quando dialog abre/fecha ou cliente muda
  useEffect(() => {
    if (open) {
      if (client) {
        // Modo edição
        reset({
          nome: client.nome,
          whatsapp_number: client.whatsapp_number,
          email: client.email || "",
        });
        setPhoneDisplay(formatPhoneNumber(client.whatsapp_number));
      } else {
        // Modo criação
        reset({
          nome: "",
          whatsapp_number: "",
          email: "",
        });
        setPhoneDisplay("");
      }
    }
  }, [open, client, reset]);

  const onSubmit = async (data: ClientFormData) => {
    try {
      setIsSubmitting(true);

      // Normalizar telefone antes de enviar
      const normalizedPhone = normalizePhoneNumber(data.whatsapp_number);

      if (!normalizedPhone) {
        throw new Error("Telefone inválido");
      }

      const clientData = {
        nome: data.nome.trim(),
        whatsapp_number: normalizedPhone,
        email: data.email?.trim() || undefined,
      };

      if (client) {
        await updateClient(client.client_id, clientData);
      } else {
        await createClient(clientData);
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar cliente:", error);
      // Erro já é tratado no hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const masked = maskPhone(value);
    setPhoneDisplay(masked);
    // Atualizar valor do formulário com apenas dígitos
    setValue("whatsapp_number", value.replace(/\D/g, ""), { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <DialogDescription>
            {client
              ? "Atualize as informações do cliente"
              : "Preencha as informações para cadastrar um novo cliente"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome"
                {...register("nome")}
                placeholder="Nome completo"
                disabled={isSubmitting}
              />
              {errors.nome && (
                <p className="text-sm text-destructive">{errors.nome.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="whatsapp_number">
                Telefone (WhatsApp) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="whatsapp_number"
                value={phoneDisplay}
                onChange={handlePhoneChange}
                placeholder="(41) 98765-4321"
                maxLength={15}
                disabled={isSubmitting}
              />
              {errors.whatsapp_number && (
                <p className="text-sm text-destructive">{errors.whatsapp_number.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                O número será salvo apenas com dígitos para identificação pelo agente
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="email@exemplo.com"
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {client ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

