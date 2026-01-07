import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from './llm/llm.service';
import { ToolRegistry } from './tools/tool.registry';
import { ToolExecutorService } from './tools/tool-executor.service';
import { PromptBuilderService } from './prompt/prompt-builder.service';
import { ConversationsService } from '../conversations/conversations.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { AgentConfigService } from '../agent-config/agent-config.service';
import { SupabaseService } from '../../database/supabase.service';

export interface AgentJob {
  job_id: string;
  company_id: string;
  conversation_id: string;
  message: string;
  channel?: string;
  created_at?: string;
  metadata?: any;
}

export interface AgentContext {
  empresa_id: string;
  conversation_id: string;
  client_id?: string;
  job_id: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly toolRegistry: ToolRegistry,
    private readonly toolExecutor: ToolExecutorService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly conversationsService: ConversationsService,
    private readonly whatsappService: WhatsappService,
    private readonly agentConfigService: AgentConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  async processIncomingMessage(job: AgentJob): Promise<void> {
    const logContext = {
      job_id: job.job_id,
      company_id: job.company_id,
      conversation_id: job.conversation_id,
    };

    try {
      this.logger.log('🤖 Início do processamento', logContext);

      // Verificar idempotência (usar Redis ou verificar na tabela de mensagens)
      // Por enquanto, usar o job_id do BullMQ para idempotência
      // O BullMQ já garante que o mesmo job não será processado duas vezes com o mesmo jobId

      // Construir contexto
      const db = this.supabase.getServiceRoleClient();
      const { data: conversation } = await db
        .from('conversations')
        .select('client_id')
        .eq('conversation_id', job.conversation_id)
        .single();

      const context: AgentContext = {
        empresa_id: job.company_id,
        conversation_id: job.conversation_id,
        client_id: conversation?.client_id,
        job_id: job.job_id,
      };

      // Executar conversa
      const response = await this.runConversation(context, job.message);

      // Se resposta foi gerada, persistir e enviar
      if (response.content) {
        // Persistir mensagem do assistente
        await this.conversationsService.upsertConversationAndMessage({
          empresa_id: job.company_id,
          whatsapp_instance_id: job.metadata?.whatsapp_instance_id || '',
          whatsapp_number: job.metadata?.sender || '',
          whatsapp_message_id: `assistant_${Date.now()}`,
          content: response.content,
          direction: 'outbound',
          role: 'assistant',
        });

        // Enviar via WhatsApp
        await this.whatsappService.sendMessage({
          empresa_id: job.company_id,
          conversation_id: job.conversation_id,
          message: response.content,
        });

        this.logger.log('✅ Resposta enviada com sucesso', logContext);
      }

      this.logger.log('✅ Job concluído com sucesso', logContext);
    } catch (error: any) {
      this.logger.error(`❌ Erro fatal no AgentService: ${error.message}`, error.stack, logContext);
      throw error;
    }
  }

  async runConversation(
    context: AgentContext,
    incomingMessage: string,
  ): Promise<{ content: string | null; shouldTerminate?: boolean }> {
    // Carregar configuração e features
    const [config, features] = await Promise.all([
      this.agentConfigService.getConfig(context.empresa_id),
      this.agentConfigService.getFeatures(context.empresa_id),
    ]);

    // Carregar histórico de mensagens
    const db = this.supabase.getServiceRoleClient();
    const { data: messages } = await db
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', context.conversation_id)
      .order('created_at', { ascending: true })
      .limit(20); // Últimas 20 mensagens

    // Carregar resumo/memória de longo prazo (se existir)
    const { data: memory } = await db
      .from('agent_conversation_memory')
      .select('summary')
      .eq('conversation_id', context.conversation_id)
      .single();

    // Construir prompt
    const promptMessages = await this.promptBuilder.build({
      config: config || {},
      features: features || {},
      messages: messages || [],
      summary: memory?.summary || null,
      incomingMessage,
    });

    // Obter max iterations
    const maxIterations = features?.max_tool_iterations || 5;

    // Executar tool loop
    return this.runToolLoop({
      messages: promptMessages,
      context,
      maxIterations,
      features: features || {},
    });
  }

  async runToolLoop(params: {
    messages: any[];
    context: AgentContext;
    maxIterations: number;
    features: any;
  }): Promise<{ content: string | null; shouldTerminate?: boolean }> {
    const { messages: initialMessages, context, maxIterations, features } = params;
    let messages = [...initialMessages];

    // Obter tools habilitadas
    const tools = this.toolRegistry.getToolsForOpenAI(context.empresa_id, features);

    // Loop de tool calling
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      try {
        // Chamar LLM
        const response = await this.llmService.generateResponse({
          messages,
          tools: tools.length > 0 ? tools : undefined,
        });

        // Se não há tool calls, retornar resposta final
        if (!response.toolCalls || response.toolCalls.length === 0) {
          return {
            content: response.content || null,
            shouldTerminate: false,
          };
        }

        // Executar tools
        const toolResults: any[] = [];
        let shouldTerminate = false;

        for (const toolCall of response.toolCalls) {
          const result = await this.toolExecutor.execute({
            toolName: toolCall.name,
            args: toolCall.arguments,
            context,
            features,
          });

          // Verificar se é human_handoff
          if (toolCall.name === 'request_human_handoff') {
            shouldTerminate = true;
          }

          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Se human_handoff foi chamado, encerrar imediatamente
        if (shouldTerminate) {
          this.logger.log('🛑 Human handoff detectado, encerrando loop', {
            conversation_id: context.conversation_id,
          });
          return {
            content: null,
            shouldTerminate: true,
          };
        }

        // Adicionar mensagem do assistente com tool calls
        messages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        });

        // Adicionar resultados das tools
        messages.push(...toolResults);
      } catch (error: any) {
        this.logger.error(
          `Erro no tool calling loop (iteration ${iteration + 1}): ${error.message}`,
          error.stack,
        );

        // Se última iteração, retornar erro amigável
        if (iteration === maxIterations - 1) {
          return {
            content: 'Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente ou solicite ajuda humana.',
            shouldTerminate: false,
          };
        }
        continue;
      }
    }

    // Se chegou aqui, excedeu max_iterations
    this.logger.warn(`Max iterations alcançado para conversa ${context.conversation_id}`);
    return {
      content: 'Desculpe, não consegui processar sua solicitação completamente. Por favor, reformule sua pergunta ou solicite ajuda humana.',
      shouldTerminate: false,
    };
  }
}

