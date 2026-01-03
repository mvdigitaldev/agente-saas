"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface DisconnectConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DisconnectConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: DisconnectConfirmDialogProps) {
  const { toast } = useToast();

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
          <AlertDialogDescription>
            Você tem certeza que deseja desconectar o WhatsApp? Esta ação interromperá todas as mensagens automáticas e você precisará escanear o QR Code novamente para reconectar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive"
          >
            Desconectar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

