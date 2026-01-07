import { RedisOptions } from 'ioredis';

export function getRedisConnection(): RedisOptions {
  /**
   * PRIORIDADE 1 — REDIS_URL (Redis Cloud / Upstash)
   */
  if (process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_URL.trim().replace(/^["']|["']$/g, '');
    const isTls = redisUrl.startsWith('rediss://');
    
    // Se for rediss://, remover o 's' temporariamente para fazer parse do URL
    const urlToParse = isTls ? redisUrl.replace('rediss://', 'redis://') : redisUrl;
    const url = new URL(urlToParse);

    // Para Redis Cloud com SSL, configurar TLS corretamente
    const tlsConfig = isTls ? {
      rejectUnauthorized: false,
      // Redis Cloud requer essas configurações
      servername: url.hostname, // SNI
      checkServerIdentity: () => undefined, // Aceitar certificado
    } : undefined;

    return {
      host: url.hostname,
      port: Number(url.port) || (isTls ? 6380 : 6379),
      // Se username não vier na URL mas for rediss://, usar 'default' (Redis Cloud padrão)
      username: url.username || (isTls ? 'default' : undefined),
      password: url.password
        ? decodeURIComponent(url.password)
        : undefined,
      tls: tlsConfig,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false, // Conectar imediatamente para detectar erros
    };
  }

  /**
   * PRIORIDADE 2 — Variáveis separadas
   */
  if (process.env.REDIS_HOST) {
    const isTls = process.env.REDIS_HOST.includes('upstash') ||
                  process.env.REDIS_HOST.includes('rediscloud');

    return {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 6379),
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  /**
   * FALLBACK LOCAL (DEV)
   */
  console.warn('⚠️ Nenhuma configuração Redis encontrada. Usando localhost.');

  return {
    host: 'localhost',
    port: 6379,
  };
}
