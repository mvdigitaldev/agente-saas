import { Redis, RedisOptions } from 'ioredis';

/**
 * Cria conexão Redis compatível com Redis Cloud (TLS)
 */
function getRedisConnectionOptions(): RedisOptions {
  /**
   * PRIORIDADE 1 — REDIS_URL (Redis Cloud / Upstash)
   */
  if (process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_URL.trim().replace(/^["']|["']$/g, '');
    const url = new URL(redisUrl);

    const isTls = redisUrl.startsWith('rediss://');

    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      username: url.username || undefined,
      password: url.password
        ? decodeURIComponent(url.password)
        : undefined,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
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

/**
 * Instância única de conexão Redis
 */
export const connection = new Redis(getRedisConnectionOptions());

// Log de conexão
connection.on('connect', () => {
  console.log('✅ Redis conectado');
});

connection.on('error', (err) => {
  console.error('❌ Erro Redis:', err);
});

