import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';
import { ToolContext } from './tool.interface';
import { ToolValidatorService } from './validation/tool-validator.service';
import { ToolContextService } from '../context/tool-context.service';

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);
  private readonly TOOL_TIMEOUT_MS = 30000; // 30 segundos
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 500; // 500ms

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly toolValidator: ToolValidatorService,
    private readonly toolContext: ToolContextService,
  ) {}

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
      // Log estruturado de início
      this.logger.log(
        JSON.stringify({
          event: 'tool_execution_start',
          tool: toolName,
          conversation_id: context.conversation_id,
          empresa_id: context.empresa_id,
          args_keys: Object.keys(args || {}),
          timestamp: new Date().toISOString(),
        }),
        logContext,
      );
      
      this.logger.debug(`   Argumentos: ${JSON.stringify(args)}`);

      // Validar argumentos antes de executar
      const validationResult = this.toolValidator.validateToolArgs(toolName, args);
      
      if (!validationResult.success) {
        const errorMessage = validationResult.error?.message || 'Validação falhou';
        this.logger.warn(`❌ Validação falhou para ${toolName}: ${errorMessage}`, logContext);
        
        return {
          error_type: 'validation_error',
          message: errorMessage,
          suggestion: 'Por favor, verifique os parâmetros fornecidos e tente novamente. Certifique-se de que todos os IDs são UUIDs válidos e as datas estão no formato correto (YYYY-MM-DD para datas, ISO 8601 para datetimes).',
          details: validationResult.error?.details || [],
        };
      }

      // Usar dados validados
      const validatedArgs = validationResult.data;

      // Executar tool com retry logic
      const result = await this.executeWithRetry(
        toolName,
        validatedArgs,
        context,
        features,
        logContext,
      );

      const duration = Date.now() - startTime;
      
      // Log estruturado de sucesso com métricas
      this.logger.log(
        JSON.stringify({
          event: 'tool_execution_success',
          tool: toolName,
          conversation_id: context.conversation_id,
          empresa_id: context.empresa_id,
          duration_ms: duration,
          result_type: typeof result,
          has_error: result?.error_type !== undefined,
          timestamp: new Date().toISOString(),
        }),
        logContext,
      );
      
      this.logger.log(`✅ Tool executada com sucesso (${duration}ms): ${toolName}`, logContext);

      // Armazenar resultado no contexto para uso futuro
      this.toolContext.storeToolResult(
        context.conversation_id,
        toolName,
        validatedArgs,
        result,
      );

      // Normalizar resposta para o LLM
      const normalizedResult = this.normalizeResult(result);

      return normalizedResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Log estruturado de erro
      this.logger.error(
        JSON.stringify({
          event: 'tool_execution_error',
          tool: toolName,
          conversation_id: context.conversation_id,
          empresa_id: context.empresa_id,
          duration_ms: duration,
          error_message: error.message,
          error_type: error.constructor?.name || 'Unknown',
          timestamp: new Date().toISOString(),
        }),
        error.stack,
        logContext,
      );
      
      this.logger.error(
        `❌ Erro ao executar tool (${duration}ms): ${toolName} - ${error.message}`,
        error.stack,
        logContext,
      );

      // Detectar erros relacionados a service_id inválido
      const errorMessage = error.message || '';
      const isServiceIdError = 
        toolName === 'get_available_slots' && 
        (errorMessage.includes('Serviço não encontrado') || 
         errorMessage.includes('service_id') ||
         errorMessage.includes('não existe'));

      // Retornar erro formatado para o LLM com sugestão de recuperação
      return {
        error_type: isServiceIdError ? 'validation_error' : 'system_error',
        message: error.message || 'Erro desconhecido ao executar tool',
        suggestion: isServiceIdError 
          ? 'O service_id fornecido é inválido. Por favor, chame list_services primeiro para obter os service_ids válidos (UUIDs) antes de chamar get_available_slots novamente.'
          : 'Tente novamente ou solicite ajuda humana',
        recovery_action: isServiceIdError ? 'call_list_services_first' : undefined,
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

  /**
   * Executa a tool com retry logic para falhas transitórias
   */
  private async executeWithRetry(
    toolName: string,
    args: any,
    context: ToolContext,
    features: any,
    logContext: any,
  ): Promise<any> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Executar tool com timeout
        const result = await Promise.race([
          this.toolRegistry.executeTool(toolName, args, context, features),
          this.createTimeoutPromise(),
        ]);

        // Se chegou aqui, sucesso
        if (attempt > 0) {
          this.logger.log(
            `✅ Tool ${toolName} executada com sucesso após ${attempt} tentativa(s)`,
            logContext,
          );
        }

        return result;
      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message || '';

        // Verificar se é um erro que deve ser retry
        const shouldRetry = this.shouldRetry(error, attempt);

        if (!shouldRetry) {
          // Erro não é retry-able, lançar imediatamente
          throw error;
        }

        // Se ainda há tentativas, fazer retry com backoff exponencial
        if (attempt < this.MAX_RETRIES) {
          const delay = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          this.logger.warn(
            `⚠️ Tentativa ${attempt + 1}/${this.MAX_RETRIES + 1} falhou para ${toolName}. Retry em ${delay}ms. Erro: ${errorMessage}`,
            logContext,
          );

          await this.sleep(delay);
          continue;
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    this.logger.error(
      `❌ Tool ${toolName} falhou após ${this.MAX_RETRIES + 1} tentativas`,
      lastError?.stack,
      logContext,
    );
    throw lastError;
  }

  /**
   * Determina se um erro deve ser retry-able
   */
  private shouldRetry(error: any, attempt: number): boolean {
    // Não retry se já excedeu max tentativas
    if (attempt >= this.MAX_RETRIES) {
      return false;
    }

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code || error.status || '';

    // Erros que NÃO devem ser retry:
    // - Erros de validação (4xx)
    // - Erros de autenticação
    // - Erros de permissão
    if (
      errorCode >= 400 && errorCode < 500 ||
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden')
    ) {
      return false;
    }

    // Erros que DEVEM ser retry:
    // - Timeout
    // - Erros de rede
    // - Erros 5xx (server errors)
    // - Rate limiting (429)
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('etimedout') ||
      errorCode === 429 ||
      (errorCode >= 500 && errorCode < 600)
    ) {
      return true;
    }

    // Por padrão, não retry para erros desconhecidos
    return false;
  }

  /**
   * Helper para sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

