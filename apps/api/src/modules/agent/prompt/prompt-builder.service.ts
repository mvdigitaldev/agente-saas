import { Injectable } from '@nestjs/common';
import { LlmMessage } from '../llm/llm.service';

@Injectable()
export class PromptBuilderService {
  build(params: {
    config: any;
    features: any;
    messages: any[];
    summary: string | null;
    incomingMessage: string;
  }): LlmMessage[] {
    const { config, features, messages, summary, incomingMessage } = params;

    const result: LlmMessage[] = [];

    // 1. System prompt: Identidade + regras fixas
    const systemContent = this.buildSystemPrompt(config, features);
    result.push({
      role: 'system',
      content: systemContent,
    });

    // 2. Assistant (hidden): Resumo da conversa se existir
    if (summary) {
      result.push({
        role: 'assistant',
        content: `CONTEXTO ANTERIOR (Resumo):\n${summary}`,
      });
    }

    // 3. Histórico de mensagens recentes
    for (const msg of messages) {
      if (msg.role && (msg.role === 'user' || msg.role === 'assistant')) {
        result.push({
          role: msg.role,
          content: msg.content || '',
        });
      }
    }

    // 4. Mensagem atual/incoming
    result.push({
      role: 'user',
      content: incomingMessage,
    });

    return result;
  }

  private buildSystemPrompt(config: any, features: any): string {
    const parts: string[] = [];

    // Identidade base
    parts.push('Você é um assistente de IA para um salão de beleza.');

    // Tom de voz
    const tone = config.tone || 'Amigável e profissional';
    parts.push(`\nTom de voz: ${tone}`);

    // Regras do salão
    if (config.rules) {
      parts.push(`\nRegras do salão:\n${config.rules}`);
    }

    // Features habilitadas
    parts.push('\n\nFeatures habilitadas:');
    parts.push(`- ask_for_pix: ${features.ask_for_pix || false}`);
    parts.push(`- require_deposit: ${features.require_deposit || false}`);

    // Instrução crítica sobre ask_for_pix
    if (!features.ask_for_pix) {
      parts.push(
        '\n⚠️ IMPORTANTE: Se ask_for_pix estiver False, NUNCA chame create_payment_link. Apenas confirme o agendamento sem cobrança.',
      );
    }

    // Diretrizes gerais
    parts.push('\n\nDiretrizes:');
    parts.push('- Use o contexto fornecido para personalizar a resposta.');
    parts.push('- Seja direto e conciso.');
    parts.push('- Se precisar de informações extras, pergunte.');
    parts.push('- Sempre confirme informações importantes com o cliente.');

    return parts.join('\n');
  }
}

