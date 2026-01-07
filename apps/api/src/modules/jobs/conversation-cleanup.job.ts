import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class ConversationCleanupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConversationCleanupJob.name);
  private intervalId: NodeJS.Timeout | null = null;

  // Intervalo de 1 hora em milissegundos
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000;

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly supabase: SupabaseService,
  ) {}

  onModuleInit() {
    // Executar limpeza após 5 minutos do início (dar tempo para app inicializar)
    setTimeout(() => {
      this.handleCleanup();
    }, 5 * 60 * 1000);

    // Configurar intervalo para executar a cada hora
    this.intervalId = setInterval(() => {
      this.handleCleanup();
    }, this.CLEANUP_INTERVAL);

    this.logger.log('ConversationCleanupJob iniciado - executa a cada 1 hora');
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('ConversationCleanupJob parado');
    }
  }

  /**
   * Executa a limpeza de conversations inativas
   */
  async handleCleanup() {
    this.logger.log('Iniciando limpeza de conversations inativas...');

    try {
      const db = this.supabase.getServiceRoleClient();

      // Buscar todas as empresas
      const { data: empresas } = await db
        .from('empresas')
        .select('empresa_id');

      if (!empresas?.length) {
        this.logger.log('Nenhuma empresa encontrada');
        return;
      }

      let totalClosed = 0;
      for (const empresa of empresas) {
        const closed = await this.conversationsService.closeInactiveConversations(
          empresa.empresa_id,
          24, // 24 horas de inatividade
        );
        totalClosed += closed;
      }

      this.logger.log(`Limpeza concluída. Total de conversations fechadas: ${totalClosed}`);
    } catch (error: any) {
      this.logger.error(`Erro na limpeza: ${error.message}`);
    }
  }
}
