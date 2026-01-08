import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from './llm/llm.service';
import { ToolRegistry } from './tools/tool.registry';
import { ToolExecutorService } from './tools/tool-executor.service';
import { ToolContextService } from './context/tool-context.service';
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
    private readonly toolContext: ToolContextService,
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
      const { data: conversation, error: conversationError } = await db
        .from('conversations')
        .select('client_id')
        .eq('conversation_id', job.conversation_id)
        .single();

      if (conversationError || !conversation) {
        this.logger.error('Erro ao buscar conversation:', conversationError);
        throw new Error(`Conversa não encontrada: ${conversationError?.message || 'conversation_id inválido'}`);
      }

      if (!conversation.client_id) {
        this.logger.error('Conversa sem client_id:', { conversation_id: job.conversation_id });
        throw new Error(`Conversa ${job.conversation_id} não possui client_id. Isso não deveria acontecer. Verifique se o cliente foi criado corretamente.`);
      }

      const context: AgentContext = {
        empresa_id: job.company_id,
        conversation_id: job.conversation_id,
        client_id: conversation.client_id,
        job_id: job.job_id,
      };

      this.logger.debug('Context criado:', { 
        empresa_id: context.empresa_id, 
        conversation_id: context.conversation_id, 
        client_id: context.client_id,
        has_client_id: !!context.client_id 
      });

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

    // Limpar contexto expirado
    this.toolContext.cleanupExpiredContext(context.conversation_id);

    // Obter contexto de tool calls recentes (especialmente para agendamento)
    const schedulingContext = this.toolContext.getSchedulingContext(context.conversation_id);

    // Logging de contexto disponível
    if (schedulingContext.availableSlots) {
      const slotsCount = Array.isArray(schedulingContext.availableSlots) 
        ? schedulingContext.availableSlots.reduce((sum, staff) => sum + (staff.slots?.length || 0), 0)
        : 0;
      
      this.logger.log(
        JSON.stringify({
          event: 'context_available',
          conversation_id: context.conversation_id,
          has_slots: true,
          slots_count: slotsCount,
          staff_count: Array.isArray(schedulingContext.availableSlots) ? schedulingContext.availableSlots.length : 0,
          has_formatted_context: !!schedulingContext.formattedContext,
          last_service_id: schedulingContext.lastServiceId,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    // Construir prompt
    const promptMessages = await this.promptBuilder.build({
      config: config || {},
      features: features || {},
      messages: messages || [],
      summary: memory?.summary || null,
      incomingMessage,
      client_id: context.client_id,
      toolContext: schedulingContext,
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

    const loopStartTime = Date.now();
    
    // Loop de tool calling
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const iterationStartTime = Date.now();
      
      try {
        this.logger.debug(
          JSON.stringify({
            event: 'llm_call_start',
            iteration: iteration + 1,
            max_iterations: maxIterations,
            conversation_id: context.conversation_id,
            tools_available: tools.length,
            timestamp: new Date().toISOString(),
          }),
        );
        
        // Obter modelo configurado (se houver) ou usar padrão
        const modelOverride = features?.openai_model || undefined;
        const maxTokens = features?.max_tokens || undefined;
        
        // Chamar LLM
        const response = await this.llmService.generateResponse({
          messages,
          tools: tools.length > 0 ? tools : undefined,
          model: modelOverride,
          maxTokens,
        });
        
        const iterationDuration = Date.now() - iterationStartTime;
        
        this.logger.debug(
          JSON.stringify({
            event: 'llm_call_complete',
            iteration: iteration + 1,
            conversation_id: context.conversation_id,
            duration_ms: iterationDuration,
            has_tool_calls: (response.toolCalls?.length || 0) > 0,
            tool_calls_count: response.toolCalls?.length || 0,
            tokens_used: response.usage?.total_tokens,
            timestamp: new Date().toISOString(),
          }),
        );

        // Se não há tool calls, retornar resposta final
        if (!response.toolCalls || response.toolCalls.length === 0) {
          const totalDuration = Date.now() - loopStartTime;
          
          this.logger.log(
            JSON.stringify({
              event: 'agent_response_complete',
              conversation_id: context.conversation_id,
              total_iterations: iteration + 1,
              total_duration_ms: totalDuration,
              tokens_used: response.usage?.total_tokens,
              has_content: !!response.content,
              timestamp: new Date().toISOString(),
            }),
          );
          
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

