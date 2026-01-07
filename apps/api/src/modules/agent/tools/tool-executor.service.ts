import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';
import { ToolContext } from './tool.interface';

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);
  private readonly TOOL_TIMEOUT_MS = 30000; // 30 segundos

  constructor(private readonly toolRegistry: ToolRegistry) {}

  async execute(params: {
    toolName: string;
    args: any;
    context: ToolContext;
    features: any;
  }): Promise<any> {
    const { toolName, args, context, features } = params;
    const startTime = Date.now();

    const logContext = {
      tool: toolName,
      empresa_id: context.empresa_id,
      conversation_id: context.conversation_id,
    };

    try {
      this.logger.log(`🔧 Executando tool: ${toolName}`, logContext);
      this.logger.debug(`   Argumentos: ${JSON.stringify(args)}`);

      // Executar tool com timeout
      const result = await Promise.race([
        this.toolRegistry.executeTool(toolName, args, context, features),
        this.createTimeoutPromise(),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Tool executada com sucesso (${duration}ms): ${toolName}`, logContext);

      // Normalizar resposta para o LLM
      const normalizedResult = this.normalizeResult(result);

      return normalizedResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Erro ao executar tool (${duration}ms): ${toolName} - ${error.message}`,
        error.stack,
        logContext,
      );

      // Retornar erro formatado para o LLM
      return {
        error_type: 'system_error',
        message: error.message || 'Erro desconhecido ao executar tool',
        suggestion: 'Tente novamente ou solicite ajuda humana',
      };
    }
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool timeout após ${this.TOOL_TIMEOUT_MS}ms`));
      }, this.TOOL_TIMEOUT_MS);
    });
  }

  private normalizeResult(result: any): any {
    // Se já é um objeto de erro, retornar como está
    if (result && typeof result === 'object' && 'error_type' in result) {
      return result;
    }

    // Se é um objeto com erro, transformar
    if (result && typeof result === 'object' && 'error' in result) {
      return {
        error_type: 'system_error',
        message: result.error,
        suggestion: 'Tente novamente ou solicite ajuda humana',
      };
    }

    // Retornar resultado como está (será serializado para JSON)
    return result;
  }
}

