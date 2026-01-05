"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Pencil,
  Trash2,
  Grid3x3,
  List as ListIcon,
  Search,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Upload,
  Power,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useServices, type Service } from "../hooks/useServices";
import { createServiceSchema, updateServiceSchema, type CreateServiceInput, type UpdateServiceInput } from "@/lib/schemas/service.schema";
import { ServiceImageUploader } from "@/components/service-image-uploader";
import { ImportServicesDialog } from "./ImportServicesDialog";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "grid" | "list";

interface ServicesTabProps {
  empresaId: string | null;
}

export function ServicesTab({ empresaId }: ServicesTabProps) {
  const { toast } = useToast();
  const {
    services,
    loading,
    createService,
    updateService,
    deleteService,
    toggleServiceStatus,
    refetch,
  } = useServices(empresaId);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedServicos, setSelectedServicos] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [servicoToDelete, setServicoToDelete] = useState<string | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceImages, setServiceImages] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const form = useForm<CreateServiceInput | UpdateServiceInput>({
    resolver: zodResolver(editingService ? updateServiceSchema : createServiceSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      preco: 0,
      duracao_minutos: 30,
      image_url: "",
      ativo: true,
      available_online: true,
      show_price_online: true,
      fixed_price: true,
    },
  });

  useEffect(() => {
    if (editingService) {
      // Migrar image_url para images se necessário
      const images = (editingService.images as string[]) || [];
      const migratedImages = images.length > 0 
        ? images 
        : (editingService.image_url ? [editingService.image_url] : []);
      
      setServiceImages(migratedImages);
      
      form.reset({
        nome: editingService.nome,
        descricao: editingService.descricao || "",
        preco: editingService.preco || 0,
        duracao_minutos: editingService.duracao_minutos,
        image_url: editingService.image_url || "", // Manter para compatibilidade
        images: migratedImages,
        ativo: editingService.ativo,
        available_online: editingService.available_online,
        show_price_online: editingService.show_price_online ?? true,
        fixed_price: editingService.fixed_price,
      });
    } else {
      setServiceImages([]);
      form.reset({
        nome: "",
        descricao: "",
        preco: 0,
        duracao_minutos: 30,
        image_url: "",
        images: [],
        ativo: true,
        available_online: true,
        show_price_online: true,
        fixed_price: true,
      });
    }
  }, [editingService, form]);

  const handleOpenDialog = useCallback((service?: Service) => {
    setEditingService(service || null);
    setServiceDialogOpen(true);
  }, []);

  const handleCloseServiceDialog = useCallback(() => {
    setServiceDialogOpen(false);
    setEditingService(null);
    form.reset();
  }, [form]);


  const onSubmit = useCallback(
    async (data: CreateServiceInput | UpdateServiceInput) => {
      console.log("onSubmit chamado com dados:", data);
      
      if (!empresaId) {
        toast({
          title: "Erro",
          description: "Empresa não encontrada",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);
      try {
        // Limpar campos vazios e garantir valores padrão
        const payload: any = {
          nome: data.nome?.trim() || "",
          descricao: data.descricao?.trim() || null,
          preco: data.preco && data.preco > 0 ? Number(data.preco) : null,
          duracao_minutos: Number(data.duracao_minutos) || 30,
          images: serviceImages.length > 0 ? serviceImages : null,
          image_url: null, // Deprecated, sempre null
          ativo: data.ativo ?? true,
          available_online: true, // Sempre true
          show_price_online: true, // Sempre true
          fixed_price: data.fixed_price ?? true,
        };

        console.log("Payload a ser enviado:", payload);

        if (editingService) {
          const result = await updateService(editingService.service_id, payload as UpdateServiceInput);
          if (result) {
            toast({
              title: "Sucesso",
              description: "Serviço atualizado com sucesso!",
            });
            handleCloseServiceDialog();
            refetch();
          }
        } else {
          const result = await createService(payload as CreateServiceInput);
          if (result) {
            toast({
              title: "Sucesso",
              description: "Serviço criado com sucesso!",
            });
            handleCloseServiceDialog();
            refetch();
          }
        }
      } catch (error: any) {
        console.error("Erro ao salvar serviço:", error);
        toast({
          title: "Erro",
          description: error.message || error.response?.data?.message || "Erro ao salvar serviço",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [empresaId, editingService, createService, updateService, handleCloseServiceDialog, refetch, serviceImages, toast]
  );

  // Memoizar serviços filtrados
  const filteredServicos = useMemo(() => {
    return services.filter((servico) => {
      const matchesSearch =
        searchTerm === "" ||
        servico.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        servico.descricao?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "ativo" && servico.ativo) ||
        (filterStatus === "inativo" && !servico.ativo);

      return matchesSearch && matchesStatus;
    });
  }, [services, searchTerm, filterStatus]);

  // Funções memoizadas
  const handleDelete = useCallback(
    async (id: string) => {
      const success = await deleteService(id);
      if (success) {
        setDeleteDialogOpen(false);
        setServicoToDelete(null);
        setSelectedServicos((prev) => prev.filter((sId) => sId !== id));
      }
    },
    [deleteService]
  );

  const handleToggleStatus = useCallback(
    async (id: string, currentStatus: boolean) => {
      await toggleServiceStatus(id, currentStatus);
    },
    [toggleServiceStatus]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedServicos.length === 0) return;

    await Promise.all(selectedServicos.map((id) => deleteService(id)));
    setSelectedServicos([]);
  }, [selectedServicos, deleteService]);

  const toggleSelectServico = useCallback((id: string) => {
    setSelectedServicos((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedServicos((prev) =>
      prev.length === filteredServicos.length ? [] : filteredServicos.map((s) => s.service_id)
    );
  }, [filteredServicos]);

  // Formatação
  const formatarDuracao = useCallback((minutos: number) => {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0 && mins > 0) {
      return `${horas}h ${mins}min`;
    } else if (horas > 0) {
      return `${horas}h`;
    }
    return `${mins}min`;
  }, []);

  const formatarPreco = useCallback((preco: number | null) => {
    if (!preco) return "Não informado";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(preco);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Serviços</h2>
          <p className="text-muted-foreground">
            {loading ? "Carregando..." : `${filteredServicos.length} serviços encontrados`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button className="gap-2" onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4" />
            Novo Serviço
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filtros</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Esconder filtros
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Mostrar filtros
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Procurar por:</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Nome ou descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status:</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="inativo">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("all");
                  }}
                  className="w-full"
                >
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Ações em massa */}
      {selectedServicos.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedServicos.length} serviço(s) selecionado(s)
              </p>
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Remover selecionados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredServicos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {services.length === 0
                ? "Nenhum serviço cadastrado ainda."
                : "Nenhum serviço encontrado com os filtros aplicados."}
            </p>
            {services.length === 0 && (
              <Button className="gap-2" onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4" />
                Cadastrar Primeiro Serviço
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredServicos.map((servico) => (
            <ServiceCard
              key={servico.service_id}
              service={servico}
              onEdit={() => handleOpenDialog(servico)}
              onDelete={() => {
                setServicoToDelete(servico.service_id);
                setDeleteDialogOpen(true);
              }}
              formatarDuracao={formatarDuracao}
              formatarPreco={formatarPreco}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredServicos.length > 0 &&
                        selectedServicos.length === filteredServicos.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServicos.map((servico) => (
                  <ServiceTableRow
                    key={servico.service_id}
                    service={servico}
                    isSelected={selectedServicos.includes(servico.service_id)}
                    onSelect={() => toggleSelectServico(servico.service_id)}
                    onEdit={() => handleOpenDialog(servico)}
                    onToggleStatus={() => handleToggleStatus(servico.service_id, servico.ativo)}
                    onDelete={() => {
                      setServicoToDelete(servico.service_id);
                      setDeleteDialogOpen(true);
                    }}
                    formatarDuracao={formatarDuracao}
                    formatarPreco={formatarPreco}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog de criação/edição de serviço */}
      <Dialog open={serviceDialogOpen} onOpenChange={handleCloseServiceDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? "Atualize as informações do serviço"
                : "Preencha as informações para criar um novo serviço"}
            </DialogDescription>
          </DialogHeader>
          <form 
            onSubmit={form.handleSubmit(
              onSubmit,
              (errors) => {
                console.error("Erros de validação:", errors);
                toast({
                  title: "Erro de validação",
                  description: "Por favor, preencha todos os campos obrigatórios corretamente.",
                  variant: "destructive",
                });
              }
            )} 
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome"
                  {...form.register("nome")}
                  placeholder="Ex: Corte de Cabelo"
                />
                {form.formState.errors.nome && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.nome.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="preco">Preço (R$)</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("preco", { valueAsNumber: true })}
                  placeholder="0.00"
                />
                {form.formState.errors.preco && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.preco.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="duracao_minutos">
                  Duração (minutos) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="duracao_minutos"
                  type="number"
                  min="1"
                  {...form.register("duracao_minutos", { valueAsNumber: true })}
                  placeholder="30"
                />
                {form.formState.errors.duracao_minutos && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.duracao_minutos.message}
                  </p>
                )}
              </div>

            </div>

            <div className="space-y-2">
              <Label>Imagens do Serviço</Label>
              {empresaId && (
                <ServiceImageUploader
                  empresaId={empresaId}
                  serviceId={editingService?.service_id}
                  images={serviceImages}
                  onImagesChange={setServiceImages}
                  maxImages={10}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                rows={3}
                {...form.register("descricao")}
                placeholder="Descreva o serviço..."
              />
              {form.formState.errors.descricao && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.descricao.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ativo">Ativo</Label>
                  <p className="text-sm text-muted-foreground">
                    Serviço disponível para agendamento
                  </p>
                </div>
                <Switch
                  id="ativo"
                  checked={form.watch("ativo")}
                  onCheckedChange={(checked) => form.setValue("ativo", checked)}
                />
              </div>


              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="fixed_price">Preço Fixo</Label>
                  <p className="text-sm text-muted-foreground">
                    O preço não varia
                  </p>
                </div>
                <Switch
                  id="fixed_price"
                  checked={form.watch("fixed_price")}
                  onCheckedChange={(checked) =>
                    form.setValue("fixed_price", checked)
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseServiceDialog}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : editingService ? (
                  "Salvar Alterações"
                ) : (
                  "Criar Serviço"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este serviço? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => servicoToDelete && handleDelete(servicoToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de importação de serviços */}
      {empresaId && (
        <ImportServicesDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          empresaId={empresaId}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

// Componente memoizado para ServiceCard
const ServiceCard = React.memo(
  ({
    service,
    onEdit,
    onDelete,
    formatarDuracao,
    formatarPreco,
  }: {
    service: Service;
    onEdit: () => void;
    onDelete: () => void;
    formatarDuracao: (minutos: number) => string;
    formatarPreco: (preco: number | null) => string;
  }) => {
    return (
      <Card className="relative group">
        <CardContent className="p-0">
          <div className="relative">
            {service.image_url ? (
              <Image
                src={service.image_url}
                alt={service.nome}
                width={400}
                height={192}
                className="w-full h-48 object-cover rounded-t-lg"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                unoptimized
              />
            ) : (
              <div className="w-full h-48 bg-muted flex items-center justify-center rounded-t-lg">
                <span className="text-muted-foreground text-sm">Sem imagem</span>
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-background/80"
                onClick={onEdit}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-background/80"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-lg mb-2 line-clamp-1">{service.nome}</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Duração: {formatarDuracao(service.duracao_minutos)}</p>
              <p>
                Valor:{" "}
                {service.fixed_price
                  ? formatarPreco(service.preco)
                  : `A partir de ${formatarPreco(service.preco)}`}
              </p>
              {!service.ativo && <p className="text-destructive">Inativo</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);
ServiceCard.displayName = "ServiceCard";

// Componente memoizado para ServiceTableRow
const ServiceTableRow = React.memo(
  ({
    service,
    isSelected,
    onSelect,
    onEdit,
    onToggleStatus,
    onDelete,
    formatarDuracao,
    formatarPreco,
  }: {
    service: Service;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onToggleStatus: () => void;
    onDelete: () => void;
    formatarDuracao: (minutos: number) => string;
    formatarPreco: (preco: number | null) => string;
  }) => {
    return (
      <TableRow>
        <TableCell>
          <Checkbox checked={isSelected} onCheckedChange={onSelect} />
        </TableCell>
        <TableCell>
          <button
            onClick={onEdit}
            className="text-primary hover:underline cursor-pointer"
          >
            {service.nome}
          </button>
        </TableCell>
        <TableCell>
          {service.fixed_price
            ? formatarPreco(service.preco)
            : `A partir de ${formatarPreco(service.preco)}`}
        </TableCell>
        <TableCell>{formatarDuracao(service.duracao_minutos)}</TableCell>
        <TableCell>
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              service.ativo
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {service.ativo ? "Ativo" : "Inativo"}
          </span>
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleStatus}>
                <Power
                  className={`mr-2 h-4 w-4 ${
                    service.ativo ? "text-muted-foreground" : "text-primary"
                  }`}
                />
                {service.ativo ? "Desativar" : "Ativar"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  }
);
ServiceTableRow.displayName = "ServiceTableRow";

