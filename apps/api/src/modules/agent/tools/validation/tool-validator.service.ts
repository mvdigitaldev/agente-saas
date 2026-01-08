import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { toolSchemas, ToolSchemaName } from './tool-schemas';

@Injectable()
export class ToolValidatorService {
  private readonly logger = new Logger(ToolValidatorService.name);

  /**
   * Valida os argumentos de uma tool usando o schema Zod correspondente
   * @param toolName Nome da tool
   * @param args Argumentos a validar
   * @returns Objeto com sucesso e dados validados ou erro
   */
  validateToolArgs(toolName: string, args: any): {
    success: boolean;
    data?: any;
    error?: {
      message: string;
      details: z.ZodIssue[];
    };
  } {
    try {
      const schema = toolSchemas[toolName as ToolSchemaName];

      if (!schema) {
        // Se não há schema definido, aceitar (para tools que não precisam validação)
        this.logger.warn(`Nenhum schema de validação encontrado para tool: ${toolName}`);
        return { success: true, data: args };
      }

      const result = schema.safeParse(args);

      if (!result.success) {
        const errorMessages = result.error.issues.map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });

        return {
          success: false,
          error: {
            message: `Validação falhou para ${toolName}: ${errorMessages.join('; ')}`,
            details: result.error.issues,
          },
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao validar argumentos da tool ${toolName}: ${error.message}`, error.stack);
      return {
        success: false,
        error: {
          message: `Erro interno na validação: ${error.message}`,
          details: [],
        },
      };
    }
  }

  /**
   * Valida e retorna os dados validados ou lança erro
   * @param toolName Nome da tool
   * @param args Argumentos a validar
   * @returns Dados validados
   * @throws Error se validação falhar
   */
  validateAndThrow(toolName: string, args: any): any {
    const result = this.validateToolArgs(toolName, args);

    if (!result.success) {
      throw new Error(result.error?.message || 'Validação falhou');
    }

    return result.data;
  }
}

