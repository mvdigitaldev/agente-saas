import { Injectable, Logger } from '@nestjs/common';

interface ToolCallContext {
  toolName: string;
  args: any;
  result: any;
  timestamp: number;
  expiresAt: number;
}

@Injectable()
export class ToolContextService {
  private readonly logger = new Logger(ToolContextService.name);
  private readonly contextStore = new Map<string, ToolCallContext[]>();
  private readonly CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_CONTEXT_ITEMS = 10; // Máximo de itens por conversa

  /**
   * Armazena o resultado de uma tool call no contexto da conversa
   */
  storeToolResult(
    conversationId: string,
    toolName: string,
    args: any,
    result: any,
  ): void {
    try {
      if (!this.contextStore.has(conversationId)) {
        this.contextStore.set(conversationId, []);
      }

      const context = this.contextStore.get(conversationId)!;
      const now = Date.now();

      // Adicionar novo resultado
      context.push({
        toolName,
        args,
        result,
        timestamp: now,
        expiresAt: now + this.CONTEXT_TTL_MS,
      });

      // Manter apenas os últimos N itens
      if (context.length > this.MAX_CONTEXT_ITEMS) {
        context.shift(); // Remove o mais antigo
      }

      // Logging estruturado de armazenamento de contexto
      if (toolName === 'get_available_slots' && result && Array.isArray(result)) {
        const slotsCount = result.reduce((sum: number, staff: any) => sum + (staff.slots?.length || 0), 0);
        this.logger.log(
          JSON.stringify({
            event: 'context_stored',
            tool: toolName,
            conversation_id: conversationId,
            staff_count: result.length,
            slots_count: slotsCount,
            timestamp: new Date(now).toISOString(),
          }),
        );
      } else {
        this.logger.debug(
          `Contexto armazenado para ${toolName} na conversa ${conversationId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Erro ao armazenar contexto: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Recupera resultados recentes de uma tool específica
   */
  getRecentToolResults(
    conversationId: string,
    toolName: string,
    maxResults: number = 1,
  ): ToolCallContext[] {
    try {
      const context = this.contextStore.get(conversationId);
      if (!context) {
        return [];
      }

      const now = Date.now();
      const relevantResults = context
        .filter(
          (item) =>
            item.toolName === toolName &&
            item.expiresAt > now, // Ainda válido
        )
        .sort((a, b) => b.timestamp - a.timestamp) // Mais recente primeiro
        .slice(0, maxResults);

      return relevantResults;
    } catch (error: any) {
      this.logger.error(
        `Erro ao recuperar contexto: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Recupera todos os resultados recentes de tools relevantes para agendamento
   */
  getSchedulingContext(conversationId: string): {
    availableSlots?: any;
    lastServiceId?: string;
    formattedContext?: string;
  } {
    try {
      const context = this.contextStore.get(conversationId);
      if (!context) {
        return {};
      }

      const now = Date.now();
      const validContext = context.filter((item) => item.expiresAt > now);

      // Buscar último resultado de get_available_slots
      const slotsResult = validContext
        .filter((item) => item.toolName === 'get_available_slots')
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      // Buscar último service_id usado
      const listServicesResult = validContext
        .filter((item) => item.toolName === 'list_services')
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      const availableSlots = slotsResult?.result || undefined;
      const lastServiceId = slotsResult?.args?.service_id || listServicesResult?.result?.[0]?.service_id || undefined;

      // Formatar contexto de forma estruturada e legível para o LLM
      let formattedContext: string | undefined;
      if (availableSlots && Array.isArray(availableSlots)) {
        formattedContext = this.formatSlotsForLLM(availableSlots, slotsResult?.args);
      }

      return {
        availableSlots,
        lastServiceId,
        formattedContext,
      };
    } catch (error: any) {
      this.logger.error(
        `Erro ao recuperar contexto de agendamento: ${error.message}`,
        error.stack,
      );
      return {};
    }
  }

  /**
   * Formata slots de forma estruturada e legível para o LLM
   * Inclui instruções explícitas sobre como encontrar o slot correto
   */
  private formatSlotsForLLM(slots: any[], originalArgs?: any): string {
    try {
      const parts: string[] = [];
      
      // Cabeçalho com informações do contexto
      const dateRequested = originalArgs?.start_date || 'data solicitada';
      parts.push(`📅 SLOTS DISPONÍVEIS PARA: ${dateRequested}`);
      parts.push(`⏰ Contexto válido por 5 minutos a partir de agora`);
      parts.push('');

      // Instruções de uso
      parts.push('🔍 COMO USAR ESTE CONTEXTO:');
      parts.push('1. Quando o cliente escolher um horário (ex: "09:30 com Tereza"):');
      parts.push('   - Procure neste contexto o slot correspondente');
      parts.push('   - Use EXATAMENTE os campos staff_id, start_iso e end_iso desse slot');
      parts.push('   - NÃO busque novamente ou reconstrua os horários');
      parts.push('2. Para encontrar o slot correto:');
      parts.push('   - Compare o nome do profissional (staff_name) com o mencionado pelo cliente');
      parts.push('   - Compare o horário (start_time no formato "HH:MM") com o mencionado pelo cliente');
      parts.push('   - Use os campos start_iso e end_iso EXATOS desse slot em create_appointment');
      parts.push('');

      // Listar slots agrupados por profissional
      parts.push('📋 SLOTS DISPONÍVEIS:');
      slots.forEach((staffSlot, staffIndex) => {
        const staffName = staffSlot.staff_name || 'Profissional sem nome';
        const staffId = staffSlot.staff_id || 'N/A';
        
        parts.push(`\n👤 ${staffName} (ID: ${staffId}):`);
        
        if (staffSlot.slots && Array.isArray(staffSlot.slots)) {
          staffSlot.slots.forEach((slot: any, slotIndex: number) => {
            const slotNumber = slotIndex + 1;
            parts.push(`   Slot ${slotNumber}:`);
            parts.push(`      - Horário: ${slot.start_time} às ${slot.end_time}`);
            parts.push(`      - Data: ${slot.date}`);
            parts.push(`      - staff_id: ${staffId}`);
            parts.push(`      - start_iso: ${slot.start_iso}`);
            parts.push(`      - end_iso: ${slot.end_iso}`);
            parts.push(`      → Use estes valores EXATOS se o cliente escolher "${slot.start_time} com ${staffName}"`);
          });
        } else {
          parts.push(`   (Nenhum slot disponível)`);
        }
      });

      parts.push('');
      parts.push('⚠️ REGRA CRÍTICA:');
      parts.push('Se o cliente escolher um horário listado acima, você DEVE:');
      parts.push('1. Encontrar o slot correspondente nesta lista');
      parts.push('2. Usar EXATAMENTE os valores staff_id, start_iso e end_iso desse slot');
      parts.push('3. NÃO tentar reconstruir horários ou buscar staff_id novamente');
      parts.push('4. Se não encontrar o slot, pergunte ao cliente para escolher novamente dos horários listados');

      return parts.join('\n');
    } catch (error: any) {
      this.logger.error(
        `Erro ao formatar slots para LLM: ${error.message}`,
        error.stack,
      );
      return JSON.stringify(slots, null, 2);
    }
  }

  /**
   * Limpa contexto expirado de uma conversa
   */
  cleanupExpiredContext(conversationId: string): void {
    try {
      const context = this.contextStore.get(conversationId);
      if (!context) {
        return;
      }

      const now = Date.now();
      const validContext = context.filter((item) => item.expiresAt > now);

      if (validContext.length === 0) {
        this.contextStore.delete(conversationId);
      } else {
        this.contextStore.set(conversationId, validContext);
      }
    } catch (error: any) {
      this.logger.error(
        `Erro ao limpar contexto: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Limpa todo o contexto de uma conversa
   */
  clearContext(conversationId: string): void {
    this.contextStore.delete(conversationId);
    this.logger.debug(`Contexto limpo para conversa ${conversationId}`);
  }
}

