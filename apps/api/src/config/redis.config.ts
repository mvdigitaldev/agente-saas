/**
 * Configuração do Redis para BullMQ
 * Suporta tanto Redis local quanto Upstash Redis
 */

import { RedisOptions } from 'ioredis';

export function getRedisConnection(): RedisOptions | string {
  // Prioridade 1: REDIS_URL
  let redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    redisUrl = redisUrl.trim().replace(/^["']|["']$/g, '');
  }

  if (redisUrl) {
    const isTls = redisUrl.startsWith('rediss://');

    // Se for URL válida, retorne objeto de configuração parseado ou a própria URL se o BullMQ aceitar bem.
    // Melhor retornar objeto para garantir opções de TLS explicitas se necessário.

    // Opção: Retornar apenas a URL se for simples.
    // Mas para garantir compatibilidade com "tls: { rejectUnauthorized: false }" (comum em cloud), 
    // vamos retornar objeto.

    // Parse básico para extrair componentes se precisar injetar opções
    // BullMQ aceita URL string connection, mas para opções extras precisa de objeto.
    // Vamos usar a URL como 'connection' string se não precisarmos de opções extras, 
    // mas se for TLS, é mais seguro passar objeto.

    // SOLUÇÃO ROBUSTA: Retornar objeto ioredis config
    return {
      href: redisUrl, // ioredis não usa href diretamente, mas funciona se passar url no construtor? Não.
      // ioredis aceita (url, options). 
      // BullModule connection aceita RedisOptions.
      // Se passarmos host/port/password extraídos é melhor.

      // Vamos simplificar: BullMQ aceita URL string.
      // Mas se precisar de configurações de TLS inseguro (self-signed):
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    } as any; // Cast para evitar erro de tipo estrito se url não for propriedade padrão de RedisOptions (ioredis suporta passar url como args[0], aqui estamos retornando config object)

    // CORREÇÃO: BullModule.forRoot({ connection: ... })
    // Se passarmos um objeto, ele é passado para o construtor do ioredis.
    // O construtor do ioredis ACEITA uma URL string como primeiro argumento, OU um objeto options.
    // Se passarmos objeto, não tem campo 'url' padrão. Temos que parsear.

    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: Number(url.port) || 6379,
        username: url.username || undefined,
        password: decodeURIComponent(url.password) || undefined,
        tls: isTls ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    } catch (e) {
      console.error('Erro ao parsear REDIS_URL, retornando string pura:', e);
      return redisUrl;
    }
  }

  // Fallback: Variáveis separadas
  if (process.env.REDIS_HOST) {
    return {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      tls: process.env.REDIS_HOST.includes('upstash') ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
    };
  }

  console.warn('⚠️  Nenhuma configuração Redis encontrada. Usando localhost.');
  return {
    host: 'localhost',
    port: 6379,
  };
}

