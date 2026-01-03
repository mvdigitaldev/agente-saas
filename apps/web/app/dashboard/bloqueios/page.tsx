'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2, Calendar } from 'lucide-react'

interface BlockedTime {
  block_id: string
  start_time: string
  end_time: string
  motivo?: string
}

export default function BloqueiosPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    start_time: '',
    end_time: '',
    motivo: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadEmpresaId()
  }, [])

  useEffect(() => {
    if (empresaId) {
      loadBlockedTimes()
    }
  }, [empresaId])

  const loadEmpresaId = async () => {
    try {
      const { data, error } = await apiClient.get('/auth/me/empresa')
      
      if (error) {
        console.error('Erro ao buscar empresa_id:', error)
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados da empresa.',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }
      
      if (data?.empresa_id) {
        setEmpresaId(data.empresa_id)
      } else {
        toast({
          title: 'Aviso',
          description: 'Empresa não encontrada. Entre em contato com o suporte.',
          variant: 'destructive',
        })
        setLoading(false)
      }
    } catch (error: any) {
      console.error('Erro inesperado:', error)
      toast({
        title: 'Erro',
        description: error.response?.data?.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  const loadBlockedTimes = async () => {
    setLoading(true)
    try {
      const { data } = await apiClient.get(`/scheduling/blocked-times?empresa_id=${empresaId}`)
      setBlockedTimes(data || [])
    } catch (error) {
      console.error('Error loading blocked times:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiClient.post('/scheduling/blocked-times', {
        empresa_id: empresaId,
        ...formData,
      })
      setShowForm(false)
      setFormData({ start_time: '', end_time: '', motivo: '' })
      loadBlockedTimes()
      toast({
        title: 'Bloqueio criado!',
        description: 'O período foi bloqueado com sucesso.',
      })
    } catch (error: any) {
      toast({
        title: 'Erro ao criar bloqueio',
        description: error.response?.data?.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBlock = async (id: string) => {
    if (!confirm('Deseja remover este bloqueio?')) return

    try {
      await apiClient.delete(`/scheduling/blocked-times/${id}`)
      loadBlockedTimes()
      toast({
        title: 'Bloqueio removido',
        description: 'O período foi desbloqueado.',
      })
    } catch (error: any) {
      toast({
        title: 'Erro ao remover bloqueio',
        description: error.response?.data?.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      })
    }
  }

  if (loading && !empresaId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!empresaId && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bloqueios de Agenda</h1>
          <p className="text-muted-foreground">
            Não foi possível carregar os dados da empresa. Por favor, recarregue a página.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bloqueios de Agenda</h1>
          <p className="text-muted-foreground">
            Gerencie períodos bloqueados na agenda
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            'Cancelar'
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Novo Bloqueio
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Bloqueio</CardTitle>
            <CardDescription>
              Defina um período em que a agenda estará bloqueada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBlock} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Data/Hora Início</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Data/Hora Fim</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo (opcional)</Label>
                <Input
                  id="motivo"
                  type="text"
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  placeholder="Ex: Feriado, manutenção, evento..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setFormData({ start_time: '', end_time: '', motivo: '' })
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Criar Bloqueio
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bloqueios Existentes</CardTitle>
          <CardDescription>
            Lista de períodos bloqueados na agenda
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : blockedTimes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum bloqueio cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedTimes.map((block) => (
                <div
                  key={block.block_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(block.start_time).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">Início</p>
                      </div>
                      <div className="text-muted-foreground">→</div>
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(block.end_time).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">Fim</p>
                      </div>
                      {block.motivo && (
                        <div className="ml-4">
                          <p className="text-sm text-muted-foreground">{block.motivo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteBlock(block.block_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
