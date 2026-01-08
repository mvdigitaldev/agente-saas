import { Injectable, OnModuleInit } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';
import { SchedulingTools } from './handlers/scheduling.tools';
import { InfoTools } from './handlers/info.tools';
import { PaymentTools } from './handlers/payment.tools';
import { HumanTools } from './handlers/human.tools';
import { MediaTools } from './handlers/media.tools';

@Injectable()
export class ToolsRegistrationService implements OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly schedulingTools: SchedulingTools,
    private readonly infoTools: InfoTools,
    private readonly paymentTools: PaymentTools,
    private readonly humanTools: HumanTools,
    private readonly mediaTools: MediaTools,
  ) { }

  onModuleInit() {
    this.registerAllTools();
  }

  private registerAllTools() {
    // Scheduling tools
    this.toolRegistry.registerTool({
      name: 'get_available_slots',
      description:
        'Buscar horários disponíveis para agendamento. Retorna os slots livres agrupados por colaborador (staff). Cada slot contém: staff_id (UUID), staff_name (nome do profissional), start_iso (horário ISO UTC para usar em create_appointment), end_iso (horário ISO UTC para usar em create_appointment), start_time (horário legível "HH:MM" para exibir), end_time (horário legível "HH:MM" para exibir), date (data "YYYY-MM-DD"). IMPORTANTE: Quando o cliente escolher um horário, use EXATAMENTE o staff_id e os campos start_iso/end_iso retornados por esta ferramenta para criar o agendamento. NÃO tente reconstruir horários ou buscar staff_id novamente. IMPORTANTE: Se você não souber o service_id, SEMPRE chame list_services primeiro para obter os service_ids válidos (são UUIDs, não números simples). Se o cliente mencionar um serviço pelo nome (ex: "cílios"), use list_services para encontrar o service_id correto antes de chamar esta ferramenta.',
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'Data de início no formato ISO 8601 (YYYY-MM-DD). Exemplo: 2026-01-12',
          },
          end_date: {
            type: 'string',
            description:
              'Data de fim no formato ISO 8601 (YYYY-MM-DD). Deve ser posterior a start_date. Exemplo: 2026-01-12',
          },
          service_id: {
            type: 'string',
            description: 'ID do serviço (UUID) para filtrar disponibilidade. OBRIGATÓRIO: Este deve ser um UUID válido obtido através de list_services. NUNCA use números simples como "1" ou "2". Se não souber o service_id, chame list_services primeiro.',
          },
          staff_id: {
            type: 'string',
            description: 'ID do profissional específico (UUID) para filtrar disponibilidade (opcional). Se não fornecido, retorna horários de todos os profissionais disponíveis.',
          },
        },
        required: ['start_date', 'service_id'],
      },
      handler: (args, context) => this.schedulingTools.getAvailableSlots(args, context),
    });

    this.toolRegistry.registerTool({
      name: 'create_appointment',
      description:
        'Criar um novo agendamento. Verifica conflitos automaticamente e cria o agendamento se o horário estiver disponível. ' +
        '🚨 CRÍTICO - LEIA COM ATENÇÃO: ' +
        '1. Você DEVE usar EXATAMENTE os valores retornados por get_available_slots na chamada ANTERIOR. ' +
        '2. Quando o cliente escolher um horário (ex: "09:30 com Tereza"), procure no contexto de slots disponíveis o slot correspondente. ' +
        '3. Use EXATAMENTE: client_id (UUID do cliente fornecido no contexto do sistema), staff_id (UUID do profissional do slot), start_iso (horário ISO UTC do slot), end_iso (horário ISO UTC do slot). ' +
        '4. NUNCA use a string literal "client_id" - sempre use o UUID real fornecido no prompt do sistema na seção "CLIENTE ATUAL". ' +
        '5. NUNCA tente reconstruir horários a partir de "HH:MM" ou buscar staff_id novamente. ' +
        '6. Se você não encontrar o slot no contexto, chame get_available_slots novamente para a data correta. ' +
        '7. Se os dados não corresponderem a um slot válido, a tool retornará erro. Use os dados EXATOS dos slots.',
      parameters: {
        type: 'object',
        properties: {
          client_id: {
            type: 'string',
            description:
              'ID do cliente (UUID válido). IMPORTANTE: Use o client_id fornecido no contexto do sistema (não use a string literal "client_id"). ' +
              'O client_id está disponível no prompt do sistema na seção "CLIENTE ATUAL". ' +
              'Se você não tiver o client_id, o sistema tentará usar o client_id do contexto automaticamente, mas é melhor usar o valor correto desde o início.',
          },
          service_id: { type: 'string', description: 'ID do serviço' },
          staff_id: {
            type: 'string',
            description: 'ID do profissional (UUID). DEVE ser o staff_id EXATO retornado pelo slot escolhido em get_available_slots. NÃO use o nome do profissional.',
          },
          start_time: {
            type: 'string',
            description: 'Data/hora de início no formato ISO 8601 UTC. DEVE ser o campo start_iso EXATO do slot escolhido em get_available_slots. Exemplo: 2026-01-14T12:00:00Z',
          },
          end_time: {
            type: 'string',
            description:
              'Data/hora de fim no formato ISO 8601 UTC. DEVE ser o campo end_iso EXATO do slot escolhido em get_available_slots. Exemplo: 2026-01-14T13:00:00Z',
          },
          resource_id: { type: 'string', description: 'ID do recurso (opcional)' },
          notes: { type: 'string', description: 'Observações sobre o agendamento (opcional)' },
        },
        required: ['client_id', 'service_id', 'staff_id', 'start_time', 'end_time'],
      },
      handler: (args, context) => this.schedulingTools.createAppointment(args, context),
    });

    this.toolRegistry.registerTool({
      name: 'reschedule_appointment',
      description:
        'Reagendar um agendamento existente. Atualiza a data/hora do agendamento para novos horários.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'ID do agendamento a ser reagendado' },
          start_time: {
            type: 'string',
            description: 'Nova data/hora de início no formato ISO 8601. Exemplo: 2024-01-15T14:00:00Z',
          },
          end_time: {
            type: 'string',
            description:
              'Nova data/hora de fim no formato ISO 8601. Deve ser posterior a start_time. Exemplo: 2024-01-15T15:00:00Z',
          },
        },
        required: ['appointment_id', 'start_time', 'end_time'],
      },
      handler: (args, context) => this.schedulingTools.rescheduleAppointment(args, context),
    });

    this.toolRegistry.registerTool({
      name: 'cancel_appointment',
      description:
        'Cancelar um agendamento existente. Verifica políticas de cancelamento antes de cancelar.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'ID do agendamento a ser cancelado' },
        },
        required: ['appointment_id'],
      },
      handler: (args, context) => this.schedulingTools.cancelAppointment(args, context),
    });

    this.toolRegistry.registerTool({
      name: 'list_appointments',
      description:
        'Listar agendamentos do cliente. Permite filtrar por status, data e cliente específico.',
      parameters: {
        type: 'object',
        properties: {
          client_id: {
            type: 'string',
            description: 'ID do cliente (opcional, usa cliente da conversa se não fornecido)',
          },
          status: {
            type: 'string',
            description: 'Status do agendamento para filtrar (opcional). Ex: scheduled, confirmed, cancelled',
          },
          start_date: {
            type: 'string',
            description: 'Data de início para filtro no formato ISO 8601 (opcional)',
          },
          end_date: {
            type: 'string',
            description: 'Data de fim para filtro no formato ISO 8601 (opcional)',
          },
        },
        required: [],
      },
      handler: (args, context) => this.schedulingTools.listAppointments(args, context),
    });

    // Info tools
    this.toolRegistry.registerTool({
      name: 'list_staff',
      description:
        'Listar profissionais/staff disponíveis na empresa. Retorna lista com nomes, IDs e disponibilidade.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: (args, context) => this.infoTools.listStaff(args, context),
    });

    this.toolRegistry.registerTool({
      name: 'list_services',
      description:
        'Listar serviços disponíveis na empresa. Retorna lista com nomes, preços, duração e descrições. Use esta ferramenta para obter informações sobre serviços. NÃO use as URLs de imagens retornadas a menos que o cliente explicitamente solicite fotos.',
      parameters: {
        type: 'object',
        properties: {
          active_only: {
            type: 'boolean',
            description: 'Listar apenas serviços ativos (padrão: true)',
          },
        },
        required: [],
      },
      handler: (args, context) => this.infoTools.listServices(args, context),
    });

    this.toolRegistry.registerTool({
      name: 'list_prices',
      description: 'Listar preços/valores dos serviços. Retorna apenas informações de preço formatadas.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: (args, context) => this.infoTools.listPrices(args, context),
    });

    // Payment tools
    this.toolRegistry.registerTool({
      name: 'check_payment_status',
      description:
        'Verificar status de pagamento PIX. Retorna status atual do pagamento e link se ainda estiver pendente.',
      parameters: {
        type: 'object',
        properties: {
          payment_id: {
            type: 'string',
            description: 'ID do pagamento ou appointment_id para verificar status',
          },
        },
        required: ['payment_id'],
      },
      handler: (args, context) => this.paymentTools.checkPaymentStatus(args, context),
    });

    this.toolRegistry.registerTool({
      name: 'create_payment_link',
      description:
        'Criar link de pagamento PIX para um agendamento. Só funciona se ask_for_pix estiver habilitado para a empresa.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'ID do agendamento' },
          amount: {
            type: 'number',
            description: 'Valor do pagamento (deve ser maior que zero)',
          },
        },
        required: ['appointment_id', 'amount'],
      },
      handler: (args, context) => this.paymentTools.createPaymentLink(args, context),
      requiredFeatures: ['ask_for_pix'],
    });

    // Human tools
    this.toolRegistry.registerTool({
      name: 'request_human_handoff',
      description:
        'Escalar conversa para atendente humano. Marca a conversa como necessitando intervenção humana e notifica a equipe.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description:
              'Motivo da escalação (opcional). Ex: cliente solicitou, problema técnico, etc.',
          },
        },
        required: [],
      },
      handler: (args, context) => this.humanTools.requestHumanHandoff(args, context),
    });

    // Media tools
    this.toolRegistry.registerTool({
      name: 'send_media',
      description:
        'Enviar mídia (fotos, vídeos, documentos) via WhatsApp. Suporta imagens, vídeos e documentos.',
      requiredFeatures: ['send_media_enabled'],
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL da mídia a ser enviada. Deve ser uma URL válida e acessível obtida via list_services. NUNCA invente uma URL (ex: não use example.com). Se não tiver a URL, chame list_services primeiro.',
          },
          media_type: {
            type: 'string',
            enum: ['image', 'video', 'document'],
            description: 'Tipo de mídia (padrão: image)',
          },
          caption: {
            type: 'string',
            description: 'Legenda da mídia (opcional)',
          },
        },
        required: ['url'],
      },
      handler: (args, context) => this.mediaTools.sendMedia(args, context),
    });
  }
}

