"use client";

import React, { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { X, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";

interface ServiceImageUploaderProps {
  empresaId: string;
  serviceId?: string;
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ServiceImageUploader({
  empresaId,
  serviceId,
  images,
  onImagesChange,
  maxImages = 10,
}: ServiceImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const remainingSlots = maxImages - images.length;
      if (remainingSlots <= 0) {
        toast({
          title: "Limite atingido",
          description: `Você pode adicionar no máximo ${maxImages} imagens.`,
          variant: "destructive",
        });
        return;
      }

      const filesToUpload = Array.from(files).slice(0, remainingSlots);
      setUploading(true);

      try {
        const uploadPromises = filesToUpload.map(async (file) => {
          // Validar tipo de arquivo
          if (!file.type.startsWith("image/")) {
            throw new Error(`${file.name} não é uma imagem válida`);
          }

          // Validar tamanho (5MB)
          if (file.size > 5 * 1024 * 1024) {
            throw new Error(`${file.name} é muito grande (máx 5MB)`);
          }

          const formData = new FormData();
          formData.append("file", file);
          formData.append("empresa_id", empresaId);
          if (serviceId) {
            formData.append("service_id", serviceId);
          }

          const response = await apiClient.post("/storage/services/upload", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          return response.data.image_url;
        });

        const uploadedUrls = await Promise.all(uploadPromises);
        onImagesChange([...images, ...uploadedUrls]);

        toast({
          title: "Imagens enviadas!",
          description: `${uploadedUrls.length} imagem(ns) adicionada(s) com sucesso.`,
        });
      } catch (error: any) {
        toast({
          title: "Erro ao enviar imagens",
          description: error.response?.data?.message || error.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [empresaId, serviceId, images, maxImages, onImagesChange, toast]
  );

  const handleRemoveImage = useCallback(
    async (imageUrl: string, index: number) => {
      try {
        // Remover da lista localmente primeiro (otimista)
        const newImages = images.filter((_, i) => i !== index);
        onImagesChange(newImages);

        // Tentar deletar do storage (não bloquear se falhar)
        try {
          await apiClient.delete("/storage/services", {
            data: { image_url: imageUrl },
          });
        } catch (error) {
          console.warn("Erro ao deletar imagem do storage:", error);
          // Não mostrar erro ao usuário, já removemos da lista
        }
      } catch (error: any) {
        toast({
          title: "Erro ao remover imagem",
          description: error.message || "Tente novamente.",
          variant: "destructive",
        });
        // Reverter se falhar
        onImagesChange(images);
      }
    },
    [images, onImagesChange, toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">
              Arraste imagens aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, WEBP até 5MB. Máximo {maxImages} imagens.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || images.length >= maxImages}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Selecionar Imagens
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={uploading || images.length >= maxImages}
          />
        </div>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((imageUrl, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square relative rounded-lg overflow-hidden border">
                <Image
                  src={imageUrl}
                  alt={`Imagem ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveImage(imageUrl, index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {images.length} de {maxImages} imagens adicionadas
        </p>
      )}
    </div>
  );
}

