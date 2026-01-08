'use client'

import { useState, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api-client'
import { Loader2, Plus, Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function AgendaPage() {
    const [loading, setLoading] = useState(true)
    const [empresaId, setEmpresaId] = useState<string | null>(null)
    const [staff, setStaff] = useState<any[]>([])
    const [selectedStaff, setSelectedStaff] = useState<string>('all')
    const { toast } = useToast()

    const fetchEmpresaId = useCallback(async () => {
        try {
            const response = await apiClient.get('/auth/me/empresa')
            const id = response.data.empresa_id
            setEmpresaId(id)

            // Buscar staff também
            const staffRes = await apiClient.get(`/scheduling/staff?empresa_id=${id}`)
            setStaff(staffRes.data.staff || [])
        } catch (error) {
            console.error('Erro ao buscar empresa/staff:', error)
            toast({
                title: 'Erro',
                description: 'Não foi possível carregar as informações iniciais.',
                variant: 'destructive',
            })
        }
    }, [toast])

    const fetchEvents = useCallback(async (id: string, staffId: string = 'all') => {
        try {
            let apptUrl = `/scheduling/appointments?empresa_id=${id}`
            let blockUrl = `/scheduling/blocked-times?empresa_id=${id}`

            // Note: Currently the backend list endpoints don't filter by staff_id for list yet, 
            // but the returned list has staff_id. We'll filter on frontend for now 
            // or I could update the backend to filter. Better filter on frontend for simplicity in this view.

            const [appointmentsRes, blocksRes] = await Promise.all([
                apiClient.get(apptUrl),
                apiClient.get(blockUrl),
            ])

            let appointments = appointmentsRes.data || []
            let blocks = blocksRes.data || []

            if (staffId !== 'all') {
                appointments = appointments.filter((a: any) => a.staff_id === staffId)
                blocks = blocks.filter((b: any) => b.staff_id === staffId)
            }

            const staffMap = new Map(staff.map(s => [s.staff_id, s.nome]))

            const formattedAppointments = appointments
                .filter((app: any) => app.status !== 'cancelled')
                .map((app: any) => ({
                    id: app.appointment_id,
                    title: `${staffMap.get(app.staff_id) || 'Profissional'}: ${app.notes || 'Agendamento'}`,
                    start: app.start_time,
                    end: app.end_time,
                    backgroundColor: app.status === 'confirmed' ? '#10b981' : '#3b82f6',
                    borderColor: 'transparent',
                    extendedProps: { ...app, type: 'appointment' },
                }))

            const formattedBlocks = blocks.map((block: any) => ({
                id: block.block_id,
                title: `[Bloqueio] ${staffMap.get(block.staff_id) || ''}: ${block.motivo || ''}`,
                start: block.start_time,
                end: block.end_time,
                backgroundColor: '#94a3b8',
                borderColor: 'transparent',
                extendedProps: { ...block, type: 'block' },
            }))

            setEvents([...formattedAppointments, ...formattedBlocks])
        } catch (error) {
            console.error('Erro ao buscar eventos:', error)
            toast({
                title: 'Erro',
                description: 'Não foi possível carregar os agendamentos.',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }, [toast, staff])

    useEffect(() => {
        fetchEmpresaId()
    }, [fetchEmpresaId])

    useEffect(() => {
        if (empresaId) {
            fetchEvents(empresaId, selectedStaff)
        }
    }, [empresaId, selectedStaff, fetchEvents])

    if (loading) {
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
                    <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
                    <p className="text-muted-foreground">
                        Gerencie seus agendamentos e bloqueios de horários
                    </p>
                </div>
                <div className="flex gap-2">
                    <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Todos os Profissionais" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Profissionais</SelectItem>
                            {staff.map((s) => (
                                <SelectItem key={s.staff_id} value={s.staff_id}>
                                    {s.nome}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Configurar Regras
                    </Button>
                    <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Agendamento
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="calendar-container">
                        <FullCalendar
                            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
                            initialView="timeGridDay"
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: 'timeGridDay,timeGridWeek,dayGridMonth,listMonth',
                            }}
                            locale="pt-br"
                            buttonText={{
                                today: 'Hoje',
                                month: 'Mês',
                                week: 'Semana',
                                day: 'Dia',
                                list: 'Lista',
                            }}
                            events={events}
                            slotMinTime="06:00:00"
                            slotMaxTime="22:00:00"
                            allDaySlot={false}
                            height="auto"
                            nowIndicator={true}
                            eventClick={(info) => {
                                console.log('Event clicked:', info.event.extendedProps)
                            }}
                        />
                    </div>
                </CardContent>
            </Card>

            <style jsx global>{`
        .fc {
          --fc-border-color: hsl(var(--border));
          --fc-page-bg-color: transparent;
          --fc-list-event-hover-bg-color: hsl(var(--accent));
          font-family: inherit;
        }
        .fc .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .fc .fc-button-primary {
          background-color: hsl(var(--secondary));
          border-color: hsl(var(--border));
          color: hsl(var(--secondary-foreground));
          text-transform: capitalize;
        }
        .fc .fc-button-primary:hover {
          background-color: hsl(var(--accent));
          border-color: hsl(var(--border));
        }
        .fc .fc-button-primary:not(:disabled).fc-button-active {
          background-color: hsl(var(--primary));
          border-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }
        .fc .fc-col-header-cell-cushion {
          padding: 8px 0;
          font-size: 0.875rem;
          font-weight: 500;
          color: hsl(var(--muted-foreground));
        }
        .fc .fc-timegrid-slot-label-cushion {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: hsl(var(--border));
        }
      `}</style>
        </div>
    )
}
