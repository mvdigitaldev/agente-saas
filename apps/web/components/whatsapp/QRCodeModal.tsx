"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Smartphone } from "lucide-react";

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  qrCode: string | null;
  loading?: boolean;
}

export function QRCodeModal({ open, onClose, qrCode, loading }: QRCodeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>
            Escaneie o QR Code com seu WhatsApp para conectar
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Área do QR Code - sempre presente, mostra loading ou QR code */}
          <div className="flex justify-center py-2">
            {loading || !qrCode ? (
              <div className="flex flex-col items-center justify-center space-y-4 w-full">
                <Skeleton className="w-64 h-64 rounded-lg" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando QR Code...</span>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-300 flex justify-center">
                <img
                  src={
                    qrCode.startsWith('data:image') 
                      ? qrCode 
                      : qrCode.startsWith('data:image/png;base64,')
                      ? qrCode
                      : `data:image/png;base64,${qrCode}`
                  }
                  alt="QR Code WhatsApp"
                  className="border rounded-lg w-64 h-64 object-contain"
                  key={qrCode}
                />
              </div>
            )}
          </div>

          {/* Instruções - sempre visíveis */}
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Abra o WhatsApp no seu celular</li>
                <li>Toque em Menu ou Configurações</li>
                <li>Toque em Aparelhos conectados</li>
                <li>Toque em Conectar um aparelho</li>
                <li>Escaneie este QR Code</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Botão Fechar - sempre visível */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

