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
    // IMPORTANTE: Adicionar aviso para ignorar datas antigas no resumo
    if (summary) {
      result.push({
        role: 'assistant',
        content: `CONTEXTO ANTERIOR (Resumo):\n${summary}\n\n⚠️ ATENÇÃO: Se este resumo contiver informações sobre datas, IGNORE-AS. Use APENAS as datas fornecidas no prompt do sistema.`,
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

    // Obter data atual no timezone do Brasil
    const now = new Date();
    // Converter para timezone do Brasil (UTC-3)
    const brasilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const year = brasilTime.getUTCFullYear();
    const month = String(brasilTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(brasilTime.getUTCDate()).padStart(2, '0');
    const hours = String(brasilTime.getUTCHours()).padStart(2, '0');
    const minutes = String(brasilTime.getUTCMinutes()).padStart(2, '0');
    
    // Calcular amanhã corretamente (lidando com mudança de mês/ano)
    const tomorrow = new Date(brasilTime);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowYear = tomorrow.getUTCFullYear();
    const tomorrowMonth = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
    const tomorrowDay = String(tomorrow.getUTCDate()).padStart(2, '0');
    const tomorrowISO = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
    
    // Nomes dos dias da semana em português
    const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayOfWeek = daysOfWeek[brasilTime.getUTCDay()];
    const tomorrowDayOfWeek = daysOfWeek[tomorrow.getUTCDay()];
    
    // Nomes dos meses em português
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const monthName = months[brasilTime.getUTCMonth()];
    const tomorrowMonthName = months[tomorrow.getUTCMonth()];
    
    const currentDate = `${day}/${month}/${year}`;
    const currentDateTime = `${day}/${month}/${year} às ${hours}:${minutes}`;
    const currentDateFull = `${dayOfWeek}, ${day} de ${monthName} de ${year}`;
    const tomorrowDateFull = `${tomorrowDayOfWeek}, ${tomorrowDay} de ${tomorrowMonthName} de ${tomorrowYear}`;

    // ⚠️ REGRAS CRÍTICAS - PRIMEIRA COISA NO PROMPT
    parts.push('🚨🚨🚨 REGRAS ABSOLUTAS - LEIA ANTES DE QUALQUER COISA 🚨🚨🚨');
    parts.push('1. NUNCA invente, crie ou suponha informações que não foram retornadas por ferramentas.');
    parts.push('2. NUNCA diga horários de funcionamento genéricos. Use get_available_slots para descobrir.');
    parts.push('3. SEMPRE use ferramentas para obter informações. Se não souber, use a ferramenta apropriada.');
    parts.push('4. Se uma ferramenta não retornar resultados, diga que não há informações disponíveis. NÃO invente.');
    parts.push('');
    
    // ⚠️ DATA ATUAL
    parts.push('📅 DATA ATUAL DO SISTEMA:');
    parts.push(`HOJE É: ${currentDateFull} (${currentDate})`);
    parts.push(`AMANHÃ É: ${tomorrowDateFull} (${tomorrowDay}/${tomorrowMonth}/${tomorrowYear})`);
    parts.push(`DATA ISO HOJE: ${year}-${month}-${day}`);
    parts.push(`DATA ISO AMANHÃ: ${tomorrowISO}`);
    parts.push('');
    parts.push('⚠️ REGRA CRÍTICA SOBRE DATAS:');
    parts.push(`- Se o cliente perguntar "que dia é hoje", você DEVE responder: "${currentDateFull}"`);
    parts.push(`- Se o cliente perguntar "que dia é amanhã", você DEVE responder: "${tomorrowDateFull}"`);
    parts.push(`- Se o cliente perguntar "qual dia é hoje no sistema", você DEVE responder: "${currentDateFull}"`);
    parts.push(`- IGNORE qualquer informação de data no histórico de conversas ou resumos anteriores.`);
    parts.push(`- IGNORE qualquer data que não seja ${currentDateFull} ou ${tomorrowDateFull}.`);
    parts.push(`- Use APENAS as datas fornecidas acima. NUNCA use datas antigas como "abril de 2024".`);
    parts.push('');

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
    parts.push('\n\n🚨 REGRAS CRÍTICAS - LEIA COM ATENÇÃO:');
    parts.push('- Você é um agente de agendamento para clínicas/serviços.');
    parts.push('- NUNCA, JAMAIS, inventar, criar ou supor informações que não foram retornadas por ferramentas.');
    parts.push('- NUNCA inventar horários de funcionamento. Se não souber, use get_available_slots para descobrir.');
    parts.push('- NUNCA dizer horários de funcionamento genéricos como "atendemos de segunda a sexta das 08:30 às 19:00".');
    parts.push('- SEMPRE use ferramentas para obter informações. NUNCA invente ou assuma.');
    parts.push('');
    parts.push('📅 SOBRE HORÁRIOS:');
    parts.push('- Para verificar disponibilidade, SEMPRE use get_available_slots com a data e service_id.');
    parts.push('- Se o cliente perguntar "terça atende?" ou "que dias atendem?", use get_available_slots para descobrir.');
    parts.push('- Quando exibir horários para o cliente, use o formato "HH:MM" (ex: "09:00", "14:30"). Os horários retornados pelas ferramentas já estão no horário do Brasil.');
    parts.push('- Se não houver horários disponíveis em uma data, diga que não há horários disponíveis naquela data. NÃO invente horários.');
    parts.push('');
    parts.push('👥 SOBRE COLABORADORES:');
    parts.push('- Se houver múltiplos colaboradores disponíveis para o serviço:');
    parts.push('  - Pergunte se o cliente tem preferência por algum profissional.');
    parts.push('  - Se o cliente não tiver preferência ou disser "tanto faz", escolha o colaborador com o horário mais próximo/conveniente.');
    parts.push('');
    parts.push('✅ SOBRE AGENDAMENTOS:');
    parts.push('- Somente confirme um agendamento após o cliente escolher explicitamente um horário disponível.');
    parts.push('- Se não houver horários, ofereça outra data ou uma lista de opções.');
    parts.push('- Use o contexto fornecido para personalizar a resposta.');
    parts.push('- Seja direto e conciso.');
    parts.push('- Se precisar de informações extras (como serviço ou data), pergunte.');
    parts.push('- Sempre confirme informações importantes com o cliente.');
    parts.push('\n🚫 REGRAS CRÍTICAS SOBRE ENVIO DE MÍDIA:');
    parts.push('- PROIBIDO enviar imagens, fotos ou mídia a menos que o cliente EXPLICITAMENTE peça.');
    parts.push('- NUNCA chame a ferramenta send_media sem solicitação explícita do cliente.');
    parts.push('- Quando o cliente mencionar um serviço (ex: "cílios", "cabelo"), apenas liste informações TEXTUAIS. NÃO envie imagens.');
    parts.push('- Quando o cliente perguntar sobre horários, apenas responda com os horários. NÃO envie imagens.');
    parts.push('- Quando o cliente perguntar "qual serviço", apenas liste os serviços. NÃO envie imagens.');
    parts.push('- SÓ envie imagens se o cliente disser EXATAMENTE: "quero ver fotos", "mostre imagens", "tem exemplos?", "como fica?", "envie fotos".');
    parts.push('- Se o cliente disser apenas o nome do serviço (ex: "cílios"), isso NÃO é pedido de foto. Apenas responda sobre o serviço.');
    parts.push('- Se você não tiver CERTEZA ABSOLUTA de que o cliente pediu fotos, NÃO envie.');

    return parts.join('\n');
  }
}

