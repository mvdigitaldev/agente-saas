import { Injectable, Logger } from '@nestjs/common';
import { ToolDefinition, ToolContext } from './tool.interface';

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools: Map<string, ToolDefinition> = new Map();

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    this.logger.log(`Tool registrada: ${tool.name}`);
  }

  getToolsForOpenAI(empresaId: string, features: any): any[] {
    const enabledTools: any[] = [];

    for (const [name, tool] of this.tools.entries()) {
      // Verificar se todas as features requeridas estão habilitadas
      if (this.isToolAvailable(tool, features)) {
        enabledTools.push({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        });
      }
    }

    this.logger.debug(`Retornando ${enabledTools.length} tools habilitadas para empresa ${empresaId}`);
    return enabledTools;
  }

  private isToolAvailable(tool: ToolDefinition, features: any): boolean {
    if (!tool.requiredFeatures || tool.requiredFeatures.length === 0) {
      return true;
    }

    for (const requiredFeature of tool.requiredFeatures) {
      if (!features[requiredFeature]) {
        return false;
      }
    }

    return true;
  }

  async executeTool(
    name: string,
    args: any,
    context: ToolContext,
    features: any,
  ): Promise<any> {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool '${name}' não encontrada`);
    }

    // Verificar disponibilidade
    if (!this.isToolAvailable(tool, features)) {
      throw new Error(`Tool '${name}' não está habilitada para esta empresa`);
    }

    // Executar handler
    return tool.handler(args, context);
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }
}

