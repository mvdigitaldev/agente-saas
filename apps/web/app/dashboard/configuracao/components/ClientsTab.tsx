"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientsList } from "./ClientsList";
import { ImportClientsDialog } from "./ImportClientsDialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export function ClientsTab() {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("lista");

  // Abrir dialog automaticamente quando mudar para tab de importar
  useEffect(() => {
    if (activeTab === "importar" && !isImportDialogOpen) {
      setIsImportDialogOpen(true);
    }
  }, [activeTab, isImportDialogOpen]);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>
        <TabsContent value="lista" className="mt-6">
          <ClientsList onImportClick={() => setIsImportDialogOpen(true)} />
        </TabsContent>
        <TabsContent value="importar" className="mt-6">
          <ImportClientsDialog
            open={isImportDialogOpen}
            onOpenChange={(open) => {
              setIsImportDialogOpen(open);
              if (!open) {
                setActiveTab("lista");
              }
            }}
          />
          {!isImportDialogOpen && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Importação de Clientes</h3>
                <p className="text-sm text-muted-foreground">
                  O diálogo de importação será aberto automaticamente. Se não aparecer, clique no botão abaixo.
                </p>
              </div>
              <Button onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Abrir Importação
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

