import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface LlmTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface LlmResponse {
  content: string | null;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: any;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY não encontrada nas variáveis de ambiente');
    }

    this.client = new OpenAI({
      apiKey,
    });

    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4.1-mini';
    // Não logar a apiKey por segurança
    this.logger.log(`LlmService inicializado com modelo: ${this.model}`);
  }

  async generateResponse(params: {
    messages: LlmMessage[];
    tools?: LlmTool[];
  }): Promise<LlmResponse> {
    const { messages, tools } = params;

    try {
      const requestMessages = messages.map((msg) => {
        const base: any = {
          role: msg.role,
        };

        if (msg.content) {
          base.content = msg.content;
        }

        if (msg.tool_calls) {
          base.tool_calls = msg.tool_calls;
        }

        if (msg.tool_call_id) {
          base.tool_call_id = msg.tool_call_id;
        }

        return base;
      });

      const requestOptions: any = {
        model: this.model,
        messages: requestMessages,
        temperature: 0,
      };

      if (tools && tools.length > 0) {
        requestOptions.tools = tools;
        requestOptions.tool_choice = 'auto';
      }

      const response = await this.client.chat.completions.create(requestOptions);

      const message = response.choices[0].message;

      // Parse tool calls
      const toolCalls = message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      const result: LlmResponse = {
        content: message.content || null,
        toolCalls,
        usage: response.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens,
              total_tokens: response.usage.total_tokens,
            }
          : undefined,
      };

      if (toolCalls && toolCalls.length > 0) {
        this.logger.debug(
          `LLM retornou ${toolCalls.length} tool call(s): ${toolCalls.map((tc) => tc.name).join(', ')}`,
        );
      } else {
        this.logger.debug(
          `LLM retornou resposta final (tokens: ${result.usage?.total_tokens || 'N/A'})`,
        );
      }

      return result;
    } catch (error: any) {
      this.logger.error(`Erro ao chamar OpenAI: ${error.message}`, error.stack);
      throw error;
    }
  }
}

