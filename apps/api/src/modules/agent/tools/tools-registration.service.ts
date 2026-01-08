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
        'Buscar horários disponíveis para agendamento. Retorna os slots livres agrupados por colaborador (staff). Se o cliente não tiver preferência, você pode escolher o primeiro horário disponível.',
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'Data de início no formato ISO 8601 (YYYY-MM-DD). Exemplo: 2024-01-15',
          },
          end_date: {
            type: 'string',
            description:
              'Data de fim no formato ISO 8601 (YYYY-MM-DD). Deve ser posterior a start_date. Exemplo: 2024-01-20',
          },
          service_id: {
            type: 'string',
            description: 'ID do serviço para filtrar disponibilidade',
          },
          staff_id: {
            type: 'string',
            description: 'ID do profissional específico para filtrar disponibilidade (opcional)',
          },
        },
        required: ['start_date', 'service_id'],
      },
      handler: (args, context) => this.schedulingTools.getAvailableSlots(args, context),
    });

    this.toolRegistry.registerTool({
      name: 'create_appointment',
      description:
        'Criar um novo agendamento. Verifica conflitos automaticamente e cria o agendamento se o horário estiver disponível.',
      parameters: {
        type: 'object',
        properties: {
          client_id: { type: 'string', description: 'ID do cliente' },
          service_id: { type: 'string', description: 'ID do serviço' },
          staff_id: { type: 'string', description: 'ID do profissional que realizará o serviço' },
          start_time: {
            type: 'string',
            description: 'Data/hora de início no formato ISO 8601. Exemplo: 2024-01-15T10:00:00Z',
          },
          end_time: {
            type: 'string',
            description:
              'Data/hora de fim no formato ISO 8601. Deve ser posterior a start_time. Exemplo: 2024-01-15T11:00:00Z',
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
        'Listar serviços disponíveis na empresa. Retorna lista com nomes, preços, duração, descrições e image_url. CRÍTICO: Use esta ferramenta ANTES de enviar fotos para obter a URL correta da imagem.',
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

