'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Loader2, Trash2, Users, CheckSquare, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function ColaboradoresPage() {
    const [staff, setStaff] = useState<any[]>([])
    const [services, setServices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [empresaId, setEmpresaId] = useState<string | null>(null)
    const { toast } = useToast()

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [newStaffName, setNewStaffName] = useState('')
    const [isServicesModalOpen, setIsServicesModalOpen] = useState(false)
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
    const [staffServices, setStaffServices] = useState<Array<{ service_id: string; nome: string; ativo: boolean; associado: boolean }>>([])
    const [loadingServices, setLoadingServices] = useState(false)

    const fetchData = useCallback(async () => {
        try {
            const empRes = await apiClient.get('/auth/me/empresa')
            const id = empRes.data.empresa_id
            setEmpresaId(id)

            const [staffRes, servicesRes] = await Promise.all([
                apiClient.get(`/scheduling/staff?empresa_id=${id}`),
                apiClient.get(`/scheduling/services?empresa_id=${id}`)
            ])

            setStaff(staffRes.data.staff || [])
            setServices(servicesRes.data.services || [])
        } catch (error) {
            console.error('Erro ao buscar dados:', error)
            toast({
                title: 'Erro',
                description: 'Não foi possível carregar os colaboradores.',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }, [toast])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleCreateStaff = async () => {
        if (!newStaffName || !empresaId) return

        setLoading(true)
        try {
            await apiClient.post('/scheduling/staff', {
                empresa_id: empresaId,
                nome: newStaffName,
                ativo: true
            })

            toast({
                title: 'Sucesso',
                description: 'Colaborador criado com sucesso!',
            })

            setNewStaffName('')
            setIsCreateModalOpen(false)
            fetchData()
        } catch (error) {
            toast({
                title: 'Erro',
                description: 'Erro ao criar colaborador.',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteStaff = async (staffId: string) => {
        if (!confirm('Tem certeza que deseja remover este colaborador?')) return

        setLoading(true)
        try {
            await apiClient.delete(`/scheduling/staff/${staffId}?empresa_id=${empresaId}`)
            toast({
                title: 'Sucesso',
                description: 'Colaborador removido com sucesso!',
            })
            fetchData()
        } catch (error) {
            toast({
                title: 'Erro',
                description: 'Erro ao remover colaborador.',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleOpenServicesModal = async (staffId: string) => {
        if (!empresaId) return
        setSelectedStaffId(staffId)
        setIsServicesModalOpen(true)
        setLoadingServices(true)

        try {
            const response = await apiClient.get(`/scheduling/staff/${staffId}/services?empresa_id=${empresaId}`)
            setStaffServices(response.data.services || [])
        } catch (error) {
            console.error('Erro ao buscar serviços:', error)
            toast({
                title: 'Erro',
                description: 'Não foi possível carregar os serviços.',
                variant: 'destructive',
            })
        } finally {
            setLoadingServices(false)
        }
    }

    const handleToggleService = (serviceId: string) => {
        setStaffServices(prev => prev.map(s => 
            s.service_id === serviceId ? { ...s, associado: !s.associado } : s
        ))
    }

    const handleSaveServices = async () => {
        if (!selectedStaffId || !empresaId) return

        setLoadingServices(true)
        try {
            const selectedServiceIds = staffServices
                .filter(s => s.associado)
                .map(s => s.service_id)

            await apiClient.post(`/scheduling/staff/${selectedStaffId}/services?empresa_id=${empresaId}`, {
                service_ids: selectedServiceIds
            })

            toast({
                title: 'Sucesso',
                description: 'Serviços atualizados com sucesso!',
            })
            setIsServicesModalOpen(false)
            setSelectedStaffId(null)
        } catch (error) {
            console.error('Erro ao salvar serviços:', error)
            toast({
                title: 'Erro',
                description: 'Erro ao atualizar serviços.',
                variant: 'destructive',
            })
        } finally {
            setLoadingServices(false)
        }
    }

    if (loading && staff.length === 0) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Colaboradores</h1>
                    <p className="text-muted-foreground">
                        Gerencie sua equipe e associe profissionais aos serviços
                    </p>
                </div>
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogTrigger asChild>
                        <Button disabled={loading}>
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Colaborador
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Colaborador</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome Completo</Label>
                                <Input
                                    id="name"
                                    placeholder="Ex: João Silva"
                                    value={newStaffName}
                                    onChange={(e) => setNewStaffName(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreateStaff} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {staff.map((member) => (
                    <Card key={member.staff_id} className="overflow-hidden">
                        <CardHeader className="bg-muted/50 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">{member.nome}</CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        {member.ativo ? 'Ativo' : 'Inativo'}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1">
                                    <Clock className="mr-2 h-4 w-4" />
                                    Horários
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex-1"
                                    onClick={() => handleOpenServicesModal(member.staff_id)}
                                >
                                    <CheckSquare className="mr-2 h-4 w-4" />
                                    Serviços
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteStaff(member.staff_id)}
                                disabled={loading}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {staff.length === 0 && !loading && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <h3 className="text-lg font-medium">Nenhum colaborador cadastrado</h3>
                        <p className="text-sm text-muted-foreground">
                            Comece adicionando os membros da sua equipe.
                        </p>
                    </CardContent>
                </Card>
            )}

            <Dialog open={isServicesModalOpen} onOpenChange={setIsServicesModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Gerenciar Serviços do Colaborador</DialogTitle>
                    </DialogHeader>
                    {loadingServices ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            <ScrollArea className="max-h-[400px] pr-4">
                                <div className="space-y-3">
                                    {staffServices.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Nenhum serviço cadastrado. Crie serviços na aba "Serviços" primeiro.
                                        </p>
                                    ) : (
                                        staffServices.map((service) => (
                                            <div key={service.service_id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                                                <Checkbox
                                                    id={`service-${service.service_id}`}
                                                    checked={service.associado}
                                                    onCheckedChange={() => handleToggleService(service.service_id)}
                                                    disabled={!service.ativo}
                                                />
                                                <Label
                                                    htmlFor={`service-${service.service_id}`}
                                                    className={`flex-1 cursor-pointer ${!service.ativo ? 'text-muted-foreground' : ''}`}
                                                >
                                                    {service.nome}
                                                    {!service.ativo && (
                                                        <span className="ml-2 text-xs text-muted-foreground">(Inativo)</span>
                                                    )}
                                                </Label>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsServicesModalOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleSaveServices} disabled={loadingServices}>
                                    {loadingServices ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        'Salvar'
                                    )}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
