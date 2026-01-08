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

export default function AgendaPage() {
    const [loading, setLoading] = useState(true)
    const [empresaId, setEmpresaId] = useState<string | null>(null)
    const [events, setEvents] = useState<any[]>([])
    const { toast } = useToast()

    const fetchEmpresaId = useCallback(async () => {
        try {
            const response = await apiClient.get('/auth/me/empresa')
            setEmpresaId(response.data.empresa_id)
        } catch (error) {
            console.error('Erro ao buscar empresa:', error)
            toast({
                title: 'Erro',
                description: 'Não foi possível carregar as informações da empresa.',
                variant: 'destructive',
            })
        }
    }, [toast])

    const fetchEvents = useCallback(async (id: string) => {
        try {
            const [appointmentsRes, blocksRes] = await Promise.all([
                apiClient.get(`/scheduling/appointments?empresa_id=${id}`),
                apiClient.get(`/scheduling/blocked-times?empresa_id=${id}`),
            ])

            const appointments = (appointmentsRes.data || [])
                .filter((app: any) => app.status !== 'cancelled')
                .map((app: any) => ({
                    id: app.appointment_id,
                    title: `Agendamento: ${app.service_id || 'Serviço'}`, // Idealmente buscar nome do serviço
                    start: app.start_time,
                    end: app.end_time,
                    backgroundColor: app.status === 'confirmed' ? '#10b981' : '#3b82f6', // Green for confirmed, Blue for scheduled
                    borderColor: 'transparent',
                    extendedProps: { ...app, type: 'appointment' },
                }))

            const blocks = (blocksRes.data || []).map((block: any) => ({
                id: block.block_id,
                title: block.motivo || 'Bloqueio',
                start: block.start_time,
                end: block.end_time,
                backgroundColor: '#94a3b8', // Slate color for blocks
                borderColor: 'transparent',
                extendedProps: { ...block, type: 'block' },
            }))

            setEvents([...appointments, ...blocks])
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
    }, [toast])

    useEffect(() => {
        fetchEmpresaId()
    }, [fetchEmpresaId])

    useEffect(() => {
        if (empresaId) {
            fetchEvents(empresaId)
        }
    }, [empresaId, fetchEvents])

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
                                // TODO: Abrir modal de detalhes
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
