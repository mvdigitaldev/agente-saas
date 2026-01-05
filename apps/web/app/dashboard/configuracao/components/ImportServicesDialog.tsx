"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HelpCircle, Upload, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";

interface CSVColumn {
  name: string;
  sampleValue: string;
}

interface ColumnMapping {
  sistema: string;
  planilha: string;
}

interface ImportServicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  onSuccess: () => void;
}

export function ImportServicesDialog({
  open,
  onOpenChange,
  empresaId,
  onSuccess,
}: ImportServicesDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [delimitador, setDelimitador] = useState<string>("auto");
  const [charset, setCharset] = useState<string>("latin1");
  const [csvColumns, setCsvColumns] = useState<CSVColumn[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping[]>([
    { sistema: "nome", planilha: "" },
    { sistema: "descricao", planilha: "" },
    { sistema: "preco", planilha: "" },
    { sistema: "duracao_minutos", planilha: "" },
  ]);

  // Resetar quando dialog fechar
  useEffect(() => {
    if (!open) {
      setFile(null);
      setShowMapping(false);
      setCsvColumns([]);
      setCsvData([]);
      setColumnMapping([
        { sistema: "nome", planilha: "" },
        { sistema: "descricao", planilha: "" },
        { sistema: "preco", planilha: "" },
        { sistema: "duracao_minutos", planilha: "" },
      ]);
    }
  }, [open]);

  // Campos do sistema e seus labels
  const camposSistema = [
    { value: "nome", label: "Nome", obrigatorio: true },
    { value: "descricao", label: "Descrição", obrigatorio: false },
    { value: "preco", label: "Preço", obrigatorio: false },
    { value: "duracao_minutos", label: "Duração (Minutos)", obrigatorio: true },
  ];

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

      // Ler arquivo com o charset especificado
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          let content = e.target?.result as string;

          // Aplicar charset se necessário
          if (charset === "utf8") {
            // UTF-8 já é o padrão
          } else if (charset === "latin1") {
            // Converter de Latin-1 para UTF-8
            const bytes = new Uint8Array(content.length);
            for (let i = 0; i < content.length; i++) {
              bytes[i] = content.charCodeAt(i);
            }
            const decoder = new TextDecoder("windows-1252");
            content = decoder.decode(bytes);
          } else if (charset === "windows1252") {
            const bytes = new Uint8Array(content.length);
            for (let i = 0; i < content.length; i++) {
              bytes[i] = content.charCodeAt(i);
            }
            const decoder = new TextDecoder("windows-1252");
            content = decoder.decode(bytes);
          }

          // Detectar delimitador se automático
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
          } else if (delimitador === "espaco") {
            delimiter = " ";
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
            // Parse CSV linha considerando aspas
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

          // Primeira linha são os cabeçalhos
          const headers = parsedData[0];
          const dataRows = parsedData.slice(1);

          // Criar array de colunas com nome e valor de exemplo
          const columns: CSVColumn[] = headers.map((header, index) => {
            // Pegar primeiro valor não vazio da coluna como exemplo
            const sampleRow = dataRows.find((row) => row[index] && row[index].trim());
            return {
              name: header.trim(),
              sampleValue: sampleRow ? sampleRow[index].trim() : "",
            };
          });

          setCsvColumns(columns);
          setCsvData(parsedData);
          setShowMapping(true);

          // Auto-mapear se possível (por nome similar)
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

      reader.readAsText(file, "ISO-8859-1"); // Ler como Latin-1 primeiro
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

    // Validar mapeamentos obrigatórios
    const nomeMapping = columnMapping.find((m) => m.sistema === "nome");
    const duracaoMapping = columnMapping.find((m) => m.sistema === "duracao_minutos");

    if (!nomeMapping?.planilha) {
      toast({
        title: "Erro",
        description: "Mapeie a coluna 'Nome' (obrigatório)",
        variant: "destructive",
      });
      return;
    }

    if (!duracaoMapping?.planilha) {
      toast({
        title: "Erro",
        description: "Mapeie a coluna 'Duração (Minutos)' (obrigatório)",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const headers = csvData[0];
      const dataRows = csvData.slice(1);

      // Preparar dados para importação
      const servicosData: any[] = [];

      for (const row of dataRows) {
        const servicoData: any = {};

        for (const mapping of columnMapping) {
          if (!mapping.planilha) continue;

          const columnIndex = headers.findIndex((h) => h === mapping.planilha);
          if (columnIndex === -1 || !row[columnIndex]) continue;

          const value = row[columnIndex].trim();

          switch (mapping.sistema) {
            case "nome":
              servicoData.nome = value;
              break;
            case "descricao":
              servicoData.descricao = value || null;
              break;
            case "preco":
              // Converter formato brasileiro para número
              const precoStr = value.replace(/[^\d,.-]/g, "").replace(",", ".");
              servicoData.preco = parseFloat(precoStr) || null;
              break;
            case "duracao_minutos":
              // Converter tempo para minutos
              let minutos = 0;
              if (value.includes("h")) {
                const parts = value.toLowerCase().split("h");
                const horas = parseInt(parts[0]) || 0;
                const mins = parts[1]
                  ? parseInt(parts[1].replace(/[^\d]/g, "")) || 0
                  : 0;
                minutos = horas * 60 + mins;
              } else {
                minutos = parseInt(value.replace(/[^\d]/g, "")) || 0;
              }
              servicoData.duracao_minutos = minutos;
              break;
          }
        }

        // Validar campos obrigatórios
        if (!servicoData.nome || !servicoData.duracao_minutos) {
          continue; // Pula linha inválida
        }

        servicosData.push(servicoData);
      }

      if (servicosData.length === 0) {
        toast({
          title: "Erro",
          description: "Nenhum serviço válido encontrado para importar",
          variant: "destructive",
        });
        return;
      }

      // Enviar para API de importação em lote
      const response = await apiClient.post(
        `/services/import?empresa_id=${empresaId}`,
        { services: servicosData }
      );

      const result = response.data;
      
      toast({
        title: "Sucesso",
        description: `${result.importados} serviço(s) importado(s) com sucesso!`,
      });
      
      if (result.erros > 0) {
        toast({
          title: "Aviso",
          description: `${result.erros} serviço(s) não puderam ser importados`,
          variant: "destructive",
        });
        
        if (result.errosDetalhes && result.errosDetalhes.length > 0) {
          console.error("Erros detalhados:", result.errosDetalhes);
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao importar serviços:", error);
      toast({
        title: "Erro",
        description: error.response?.data?.message || "Erro ao importar serviços",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importação de Serviços</DialogTitle>
          <DialogDescription>
            Importe serviços em lote através de um arquivo CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instruções */}
          <div className="space-y-2">
            <p className="font-semibold text-sm">
              Selecione um arquivo .csv clicando no campo abaixo
            </p>
            <p className="text-sm text-muted-foreground">
              Para garantir que os dados sejam importados corretamente, exporte um arquivo .csv
              a partir de uma planilha do Excel ou Google Planilhas.
            </p>
          </div>

          {/* Upload de Arquivo */}
          <div className="space-y-2">
            <Label>Arquivo CSV</Label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {file ? file.name : "Clique para selecionar arquivo CSV"}
                </p>
                {file && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                )}
              </label>
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
              <Select value={delimitador} onValueChange={setDelimitador}>
                <SelectTrigger id="delimitador">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="virgula">, (Vírgula)</SelectItem>
                  <SelectItem value="ponto_virgula">; (Ponto e Vírgula)</SelectItem>
                  <SelectItem value="pipe">| (Barra Vertical)</SelectItem>
                  <SelectItem value="tab">TAB</SelectItem>
                  <SelectItem value="espaco">Espaço</SelectItem>
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
              <Select value={charset} onValueChange={setCharset}>
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

          {/* Botão Importar (primeira etapa) */}
          {!showMapping && (
            <div className="flex justify-end">
              <Button onClick={parseCSV} disabled={!file || loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Processar CSV
              </Button>
            </div>
          )}

          {/* Mapeamento de Colunas */}
          {showMapping && csvColumns.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <p className="font-semibold text-sm">
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
                          {campo.obrigatorio && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                      </div>
                      <Select
                        value={mapping?.planilha || "none"}
                        onValueChange={(value) => handleMappingChange(campo.value, value)}
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {showMapping ? (
            <Button onClick={handleImport} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importar Serviços
            </Button>
          ) : (
            <Button onClick={parseCSV} disabled={!file || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Processar CSV
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

