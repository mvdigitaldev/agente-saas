"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2, HelpCircle } from "lucide-react";
import { useClients } from "../hooks/useClients";
import { normalizePhoneNumber } from "@/lib/phone-utils";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CSVColumn {
  name: string;
  sampleValue: string;
}

interface ColumnMapping {
  sistema: string;
  planilha: string;
}

interface ImportClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const camposSistema = [
  { value: "nome", label: "Nome", obrigatorio: true },
  { value: "whatsapp_number", label: "Telefone", obrigatorio: true },
  { value: "email", label: "Email", obrigatorio: false },
];

export function ImportClientsDialog({ open, onOpenChange }: ImportClientsDialogProps) {
  const { importClients } = useClients();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [delimitador, setDelimitador] = useState<string>("auto");
  const [charset, setCharset] = useState<string>("latin1");
  const [csvColumns, setCsvColumns] = useState<CSVColumn[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping[]>([
    { sistema: "nome", planilha: "" },
    { sistema: "whatsapp_number", planilha: "" },
    { sistema: "email", planilha: "" },
  ]);

  // Resetar quando dialog fecha
  useEffect(() => {
    if (!open) {
      setFiles([]);
      setCsvColumns([]);
      setCsvData([]);
      setShowMapping(false);
      setColumnMapping([
        { sistema: "nome", planilha: "" },
        { sistema: "whatsapp_number", planilha: "" },
        { sistema: "email", planilha: "" },
      ]);
    }
  }, [open]);

  const detectDelimiter = (firstLine: string): string => {
    const delimiters = [";", ",", "|", "\t", " "];
    let maxCount = 0;
    let detectedDelimiter = ";";

    for (const delim of delimiters) {
      const count = firstLine.split(delim).length - 1;
      if (count > maxCount) {
        maxCount = count;
        detectedDelimiter = delim;
      }
    }

    return detectedDelimiter;
  };

  const parseCSV = async () => {
    const file = files[0];
    if (!file) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo CSV primeiro",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          let content = e.target?.result as string;

          // Aplicar charset
          if (charset === "latin1" || charset === "windows1252") {
            const bytes = new Uint8Array(content.length);
            for (let i = 0; i < content.length; i++) {
              bytes[i] = content.charCodeAt(i);
            }
            const decoder = new TextDecoder("windows-1252");
            content = decoder.decode(bytes);
          }

          // Detectar delimitador
          let delimiter = delimitador === "auto" ? ";" : delimitador;
          if (delimitador === "auto") {
            const firstLine = content.split("\n")[0];
            delimiter = detectDelimiter(firstLine);
          } else if (delimitador === "virgula") {
            delimiter = ",";
          } else if (delimitador === "ponto_virgula") {
            delimiter = ";";
          } else if (delimitador === "pipe") {
            delimiter = "|";
          } else if (delimitador === "tab") {
            delimiter = "\t";
          }

          // Parse CSV
          const lines = content.split("\n").filter((line) => line.trim());
          if (lines.length === 0) {
            toast({
              title: "Erro",
              description: "Arquivo CSV vazio",
              variant: "destructive",
            });
            return;
          }

          const parsedData: string[][] = [];
          for (const line of lines) {
            const row: string[] = [];
            let current = "";
            let insideQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                insideQuotes = !insideQuotes;
              } else if (char === delimiter && !insideQuotes) {
                row.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            row.push(current.trim());
            parsedData.push(row);
          }

          if (parsedData.length === 0) {
            toast({
              title: "Erro",
              description: "Não foi possível ler o arquivo CSV",
              variant: "destructive",
            });
            return;
          }

          const headers = parsedData[0];
          const dataRows = parsedData.slice(1);

          const columns: CSVColumn[] = headers.map((header, index) => {
            const sampleRow = dataRows.find((row) => row[index] && row[index].trim());
            return {
              name: header.trim(),
              sampleValue: sampleRow ? sampleRow[index].trim() : "",
            };
          });

          setCsvColumns(columns);
          setCsvData(parsedData);
          setShowMapping(true);

          // Auto-mapear
          const autoMapping: ColumnMapping[] = camposSistema.map((campo) => {
            const lowerCampo = campo.label.toLowerCase();
            const found = columns.find(
              (col) =>
                col.name.toLowerCase().includes(lowerCampo) ||
                lowerCampo.includes(col.name.toLowerCase())
            );
            return {
              sistema: campo.value,
              planilha: found ? found.name : "",
            };
          });
          setColumnMapping(autoMapping);

          toast({
            title: "Sucesso",
            description: `${dataRows.length} linha(s) encontrada(s) no CSV`,
          });
        } catch (error) {
          console.error("Erro ao processar CSV:", error);
          toast({
            title: "Erro",
            description: "Erro ao processar arquivo CSV",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        toast({
          title: "Erro",
          description: "Erro ao ler arquivo",
          variant: "destructive",
        });
        setLoading(false);
      };

      reader.readAsText(file, "ISO-8859-1");
    } catch (error) {
      console.error("Erro ao ler arquivo:", error);
      toast({
        title: "Erro",
        description: "Erro ao ler arquivo",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleMappingChange = (campoSistema: string, colunaPlanilha: string) => {
    setColumnMapping((prev) =>
      prev.map((mapping) =>
        mapping.sistema === campoSistema
          ? { ...mapping, planilha: colunaPlanilha === "none" ? "" : colunaPlanilha }
          : mapping
      )
    );
  };

  const handleImport = async () => {
    if (!csvData.length || csvData.length < 2) {
      toast({
        title: "Erro",
        description: "Nenhum dado encontrado no CSV",
        variant: "destructive",
      });
      return;
    }

    const nomeMapping = columnMapping.find((m) => m.sistema === "nome");
    const telefoneMapping = columnMapping.find((m) => m.sistema === "whatsapp_number");

    if (!nomeMapping?.planilha) {
      toast({
        title: "Erro",
        description: "Mapeie a coluna 'Nome' (obrigatório)",
        variant: "destructive",
      });
      return;
    }

    if (!telefoneMapping?.planilha) {
      toast({
        title: "Erro",
        description: "Mapeie a coluna 'Telefone' (obrigatório)",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const headers = csvData[0];
      const dataRows = csvData.slice(1);

      const clientesData: Array<{
        nome: string;
        whatsapp_number: string;
        email?: string;
      }> = [];

      for (const row of dataRows) {
        const clienteData: any = {};

        for (const mapping of columnMapping) {
          if (!mapping.planilha) continue;

          const columnIndex = headers.findIndex((h) => h === mapping.planilha);
          if (columnIndex === -1 || !row[columnIndex]) continue;

          const value = row[columnIndex].trim();

          switch (mapping.sistema) {
            case "nome":
              clienteData.nome = value;
              break;
            case "whatsapp_number":
              // Normalizar telefone (remover formatação)
              clienteData.whatsapp_number = normalizePhoneNumber(value);
              break;
            case "email":
              clienteData.email = value || undefined;
              break;
          }
        }

        if (!clienteData.nome || !clienteData.whatsapp_number) {
          continue; // Pula linha inválida
        }

        clientesData.push(clienteData);
      }

      if (clientesData.length === 0) {
        toast({
          title: "Erro",
          description: "Nenhum cliente válido encontrado para importar",
          variant: "destructive",
        });
        return;
      }

      const result = await importClients({ clients: clientesData });

      if (result) {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Erro ao importar clientes:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao importar clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles([selectedFiles[0]]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Clientes</DialogTitle>
          <DialogDescription>
            Importe clientes em lote através de um arquivo CSV. Os números de telefone serão
            automaticamente convertidos para o formato usado pelo agente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!showMapping ? (
            <>
              {/* Upload de Arquivo */}
              <div className="space-y-2">
                <Label>Arquivo CSV</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                  {files.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{files[0].name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFiles([])}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Opções de Delimitador e Charset */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="delimitador">Delimitador:</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Caractere que separa as colunas no arquivo CSV</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={delimitador} onValueChange={setDelimitador} disabled={loading}>
                    <SelectTrigger id="delimitador">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático</SelectItem>
                      <SelectItem value="virgula">, (Vírgula)</SelectItem>
                      <SelectItem value="ponto_virgula">; (Ponto e Vírgula)</SelectItem>
                      <SelectItem value="pipe">| (Barra Vertical)</SelectItem>
                      <SelectItem value="tab">TAB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="charset">Charset:</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Codificação de caracteres do arquivo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={charset} onValueChange={setCharset} disabled={loading}>
                    <SelectTrigger id="charset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latin1">Latin-1</SelectItem>
                      <SelectItem value="utf8">UTF-8</SelectItem>
                      <SelectItem value="windows1252">Windows-1252</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Mapeamento de Colunas */}
              <div className="space-y-4">
                <p className="font-semibold">
                  Para cada campo do sistema, selecione a coluna correspondente da planilha
                </p>

                <div className="space-y-3">
                  {camposSistema.map((campo) => {
                    const mapping = columnMapping.find((m) => m.sistema === campo.value);

                    return (
                      <div key={campo.value} className="grid grid-cols-2 gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <Label className="font-medium">
                            {campo.label}
                            {campo.obrigatorio && <span className="text-destructive ml-1">*</span>}
                          </Label>
                        </div>
                        <Select
                          value={mapping?.planilha || "none"}
                          onValueChange={(value) => handleMappingChange(campo.value, value)}
                          disabled={loading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Coluna / Exemplo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Não mapear --</SelectItem>
                            {csvColumns.map((col) => (
                              <SelectItem key={col.name} value={col.name}>
                                {col.name} / {col.sampleValue || "vazio"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {!showMapping ? (
            <Button onClick={parseCSV} disabled={files.length === 0 || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Processar CSV
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

