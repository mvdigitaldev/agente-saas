"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Clock, Pencil } from "lucide-react";
import { useAvailabilityRules, type AvailabilityRule } from "../hooks/useAvailabilityRules";
import { apiClient } from "@/lib/api-client";

interface AvailabilityTabProps {
  empresaId: string | null;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

export function AvailabilityTab({ empresaId }: AvailabilityTabProps) {
  const { rules, loading, createRule, updateRule, deleteRule } = useAvailabilityRules(empresaId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AvailabilityRule | null>(null);
  const [staff, setStaff] = useState<Array<{ staff_id: string; nome: string }>>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [formErrors, setFormErrors] = useState<{ start_time?: string; end_time?: string }>({});
  const [newRule, setNewRule] = useState<{
    day_of_week: string;
    start_time: string;
    end_time: string;
    staff_id: string;
  }>({
    day_of_week: "1",
    start_time: "09:00",
    end_time: "18:00",
    staff_id: "all",
  });

  useEffect(() => {
    const fetchStaff = async () => {
      if (!empresaId) return;
      try {
        setLoadingStaff(true);
        const response = await apiClient.get(`/scheduling/staff?empresa_id=${empresaId}`);
        setStaff(response.data.staff || []);
      } catch (error) {
        console.error("Erro ao buscar colaboradores:", error);
      } finally {
        setLoadingStaff(false);
      }
    };
    fetchStaff();
  }, [empresaId]);

  // Reset form when dialog opens or editingRule changes
  useEffect(() => {
    if (isDialogOpen) {
      if (editingRule) {
        // Modo edição: preencher com dados da regra
        setNewRule({
          day_of_week: editingRule.day_of_week.toString(),
          start_time: editingRule.start_time.slice(0, 5), // Remove segundos se houver
          end_time: editingRule.end_time.slice(0, 5),
          staff_id: editingRule.staff_id || "all",
        });
      } else {
        // Modo criação: resetar formulário
        setNewRule({
          day_of_week: "1",
          start_time: "09:00",
          end_time: "18:00",
          staff_id: "all",
        });
      }
      setFormErrors({});
    }
  }, [isDialogOpen, editingRule]);

  const validateForm = (): boolean => {
    const errors: { start_time?: string; end_time?: string } = {};
    
    if (newRule.start_time >= newRule.end_time) {
      errors.end_time = "Horário de fim deve ser maior que horário de início";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const staffId = newRule.staff_id === "all" || !newRule.staff_id ? null : newRule.staff_id;
      
      if (editingRule) {
        // Modo edição
        await updateRule(editingRule.rule_id, {
          day_of_week: parseInt(newRule.day_of_week),
          start_time: newRule.start_time,
          end_time: newRule.end_time,
          staff_id: staffId,
        });
      } else {
        // Modo criação
        await createRule({
          day_of_week: parseInt(newRule.day_of_week),
          start_time: newRule.start_time,
          end_time: newRule.end_time,
          staff_id: staffId || undefined,
        });
      }
      
      setIsDialogOpen(false);
      setEditingRule(null);
    } catch (e) {
      // Error handled in hook
    }
  };

  const handleEdit = (rule: AvailabilityRule) => {
    setEditingRule(rule);
    setIsDialogOpen(true);
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
    setFormErrors({});
  };

  const getDayLabel = (day: number) => {
    return DAYS_OF_WEEK.find((d) => d.value === day)?.label || "Desconhecido";
  };

  const getStaffName = (staffId: string | undefined) => {
    if (!staffId) return null;
    return staff.find((s) => s.staff_id === staffId)?.nome || "Desconhecido";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Horários de Funcionamento</h2>
          <p className="text-muted-foreground">
            Defina os horários em que sua empresa está disponível para agendamentos.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingRule(null);
            setFormErrors({});
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Horário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRule ? "Editar Regra de Horário" : "Adicionar Regra de Horário"}
              </DialogTitle>
              <DialogDescription>
                {editingRule
                  ? "Altere os campos desejados da regra de disponibilidade."
                  : "Configure um novo intervalo de disponiblidade."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="day" className="text-right">
                  Dia
                </Label>
                <Select
                  value={newRule.day_of_week}
                  onValueChange={(v) => setNewRule({ ...newRule, day_of_week: v })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="start" className="text-right">
                  Início
                </Label>
                <Input
                  id="start"
                  type="time"
                  value={newRule.start_time}
                  onChange={(e) => setNewRule({ ...newRule, start_time: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="end" className="text-right">
                  Fim
                </Label>
                <div className="col-span-3">
                  <Input
                    id="end"
                    type="time"
                    value={newRule.end_time}
                    onChange={(e) => {
                      setNewRule({ ...newRule, end_time: e.target.value });
                      if (formErrors.end_time) {
                        setFormErrors({ ...formErrors, end_time: undefined });
                      }
                    }}
                    className={formErrors.end_time ? "border-destructive" : ""}
                  />
                  {formErrors.end_time && (
                    <p className="text-sm text-destructive mt-1">{formErrors.end_time}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="staff" className="text-right">
                  Profissional
                </Label>
                {staff.length === 0 ? (
                  <div className="col-span-3 p-2 text-sm text-muted-foreground border rounded-md bg-muted/20">
                    Nenhum colaborador cadastrado. Comece criando um na aba "Colaboradores".
                  </div>
                ) : (
                  <Select
                    value={newRule.staff_id || "all"}
                    onValueChange={(v) => {
                      if (v && v !== "") {
                        setNewRule({ ...newRule, staff_id: v });
                      }
                    }}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Todos os profissionais" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os profissionais</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.staff_id} value={s.staff_id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!!formErrors.end_time || newRule.start_time >= newRule.end_time}
              >
                {editingRule ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Horários Cadastrados</CardTitle>
          <CardDescription>
            Lista de regras de disponibilidade ativas. Se o campo "Profissional" estiver vazio, a regra vale para todos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia da Semana</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    Nenhum horário cadastrado. Adicione regras para permitir agendamentos.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.rule_id}>
                    <TableCell className="font-medium">
                      {getDayLabel(rule.day_of_week)}
                    </TableCell>
                    <TableCell>{rule.start_time}</TableCell>
                    <TableCell>{rule.end_time}</TableCell>
                    <TableCell>
                      {rule.staff_id ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                          {getStaffName(rule.staff_id)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          Todos
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(rule)}
                          className="hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRule(rule.rule_id)}
                          className="text-destructive hover:text-destructive/90"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800">
        <h4 className="font-semibold mb-2">Sobre o campo Staff (Profissional)</h4>
        <p>
          A coluna <strong>staff_id</strong> na tabela do banco de dados serve para definir horários específicos de um profissional.
          <br />
          - Se o campo for <strong>NULL</strong> (vazio), o horário vale para <strong>toda a empresa</strong> (ou qualquer profissional sem horário específico).
          <br />
          - Se o campo for preenchido com o ID de um profissional, aquele horário se aplica <strong>apenas</strong> àquele profissional.
        </p>
      </div>
    </div>
  );
}
