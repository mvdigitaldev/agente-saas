'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { 
  Loader2, 
  RefreshCw, 
  User, 
  Clock, 
  MessageCircle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Phone
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Client {
  client_id: string
  nome?: string
  whatsapp_number: string
}

interface Message {
  message_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  direction: 'inbound' | 'outbound'
  created_at: string
}

interface Conversation {
  conversation_id: string
  status: 'active' | 'pending_human' | 'with_human' | 'closed'
  needs_human?: boolean
  human_handoff_reason?: string
  human_handoff_requested_at?: string
  last_message_at: string
  created_at: string
  clients: Client
  messages?: Message[]
}

interface Stats {
  active: number
  pending_human: number
  with_human: number
  closed: number
}

const statusConfig = {
  active: { label: 'Ativo', variant: 'default' as const, color: 'bg-green-500' },
  pending_human: { label: 'Aguardando', variant: 'destructive' as const, color: 'bg-yellow-500' },
  with_human: { label: 'Em Atendimento', variant: 'secondary' as const, color: 'bg-blue-500' },
  closed: { label: 'Fechado', variant: 'outline' as const, color: 'bg-gray-500' },
}

export default function AtendimentoPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats, setStats] = useState<Stats>({ active: 0, pending_human: 0, with_human: 0, closed: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('pending_human')
  const { toast } = useToast()

  const loadStats = useCallback(async () => {
    try {
      const response = await apiClient.get('/conversations/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Erro ao carregar stats:', error)
    }
  }, [])

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter ? `?status=${filter}` : ''
      const response = await apiClient.get(`/conversations${params}`)
      setConversations(response.data || [])
    } catch (error: any) {
      console.error('Erro ao carregar conversas:', error)
      toast({
        title: 'Erro',
        description: error.response?.data?.message || 'Erro ao carregar conversas',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useEffect(() => {
    loadStats()
    loadConversations()
  }, [loadStats, loadConversations])

  const openConversationDetails = async (conversation: Conversation) => {
    try {
      const response = await apiClient.get(`/conversations/${conversation.conversation_id}`)
      setSelectedConversation(response.data)
      setDialogOpen(true)
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar detalhes da conversa',
        variant: 'destructive',
      })
    }
  }

  const handleStatusChange = async (conversationId: string, action: 'take' | 'close' | 'return-to-agent') => {
    setActionLoading(conversationId)
    try {
      await apiClient.post(`/conversations/${conversationId}/${action}`)
      
      const messages = {
        take: 'Você assumiu esta conversa',
        close: 'Conversa fechada com sucesso',
        'return-to-agent': 'Conversa devolvida ao agente',
      }
      
      toast({
        title: 'Sucesso',
        description: messages[action],
      })

      // Recarregar dados
      await Promise.all([loadStats(), loadConversations()])
      
      // Fechar dialog se estiver aberto
      if (dialogOpen) {
        setDialogOpen(false)
        setSelectedConversation(null)
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.response?.data?.message || 'Erro ao atualizar conversa',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPhone = (phone: string) => {
    if (!phone) return ''
    // Formatar telefone brasileiro
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`
    }
    return phone
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Atendimento</h1>
          <p className="text-muted-foreground">
            Gerencie conversas que precisam de atendimento humano
          </p>
        </div>
        <Button onClick={() => { loadStats(); loadConversations() }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className={`cursor-pointer transition-colors ${filter === 'pending_human' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('pending_human')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_human}</div>
            <p className="text-xs text-muted-foreground">
              Precisam de atendimento
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors ${filter === 'with_human' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('with_human')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
            <MessageCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.with_human}</div>
            <p className="text-xs text-muted-foreground">
              Sendo atendidos
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors ${filter === 'active' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('active')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Com o agente
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors ${filter === 'closed' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('closed')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fechados</CardTitle>
            <XCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closed}</div>
            <p className="text-xs text-muted-foreground">
              Encerrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversations List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Conversas {filter && `- ${statusConfig[filter as keyof typeof statusConfig]?.label || filter}`}
          </CardTitle>
          <CardDescription>
            Clique em uma conversa para ver detalhes e gerenciar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma conversa encontrada com este filtro
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((conversation) => (
                <div
                  key={conversation.conversation_id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => openConversationDetails(conversation)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {conversation.clients?.nome || formatPhone(conversation.clients?.whatsapp_number)}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {formatPhone(conversation.clients?.whatsapp_number)}
                      </div>
                      {conversation.human_handoff_reason && (
                        <div className="text-sm text-yellow-600 mt-1">
                          Motivo: {conversation.human_handoff_reason}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant={statusConfig[conversation.status]?.variant}>
                        {statusConfig[conversation.status]?.label}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDate(conversation.last_message_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedConversation?.clients?.nome || formatPhone(selectedConversation?.clients?.whatsapp_number || '')}
            </DialogTitle>
            <DialogDescription>
              {formatPhone(selectedConversation?.clients?.whatsapp_number || '')}
              {selectedConversation?.human_handoff_reason && (
                <span className="block text-yellow-600 mt-1">
                  Motivo do encaminhamento: {selectedConversation.human_handoff_reason}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Messages */}
          <ScrollArea className="h-[300px] border rounded-lg p-4">
            <div className="space-y-3">
              {selectedConversation?.messages?.map((message) => (
                <div
                  key={message.message_id}
                  className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-muted'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                      {formatDate(message.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              {(!selectedConversation?.messages || selectedConversation.messages.length === 0) && (
                <div className="text-center text-muted-foreground py-4">
                  Nenhuma mensagem encontrada
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            {selectedConversation?.status === 'pending_human' && (
              <Button
                onClick={() => handleStatusChange(selectedConversation.conversation_id, 'take')}
                disabled={actionLoading === selectedConversation.conversation_id}
              >
                {actionLoading === selectedConversation.conversation_id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-2" />
                )}
                Assumir Conversa
              </Button>
            )}
            
            {selectedConversation?.status === 'with_human' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange(selectedConversation.conversation_id, 'return-to-agent')}
                  disabled={actionLoading === selectedConversation.conversation_id}
                >
                  {actionLoading === selectedConversation.conversation_id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  )}
                  Devolver ao Agente
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleStatusChange(selectedConversation.conversation_id, 'close')}
                  disabled={actionLoading === selectedConversation.conversation_id}
                >
                  {actionLoading === selectedConversation.conversation_id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Fechar Conversa
                </Button>
              </>
            )}

            {selectedConversation?.status === 'active' && (
              <Button
                variant="destructive"
                onClick={() => handleStatusChange(selectedConversation.conversation_id, 'close')}
                disabled={actionLoading === selectedConversation.conversation_id}
              >
                {actionLoading === selectedConversation.conversation_id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Fechar Conversa
              </Button>
            )}

            {selectedConversation?.status === 'closed' && (
              <Button
                variant="outline"
                onClick={() => handleStatusChange(selectedConversation.conversation_id, 'return-to-agent')}
                disabled={actionLoading === selectedConversation.conversation_id}
              >
                {actionLoading === selectedConversation.conversation_id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowLeft className="h-4 w-4 mr-2" />
                )}
                Reabrir para Agente
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
