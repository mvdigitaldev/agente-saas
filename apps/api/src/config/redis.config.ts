import { RedisOptions } from 'ioredis';

export function getRedisConnection(): RedisOptions {
  /**
   * PRIORIDADE 1 — REDIS_URL
   * TLS APENAS se a URL for rediss://
   */
  if (process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_URL.trim().replace(/^["']|["']$/g, '');
    const isTls = redisUrl.startsWith('rediss://');

    const normalizedUrl = isTls
      ? redisUrl.replace('rediss://', 'redis://')
      : redisUrl;

    const url = new URL(normalizedUrl);

    return {
      host: url.hostname,
      port: Number(url.port) || (isTls ? 6380 : 6379),
      username: url.username || undefined,
      password: url.password
        ? decodeURIComponent(url.password)
        : undefined,
      ...(isTls && {
        tls: {
          rejectUnauthorized: false,
          servername: url.hostname,
          checkServerIdentity: () => undefined,
        },
      }),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    };
  }

  /**
   * PRIORIDADE 2 — Variáveis separadas
   * ❌ NÃO inferir TLS por hostname
   * TLS só se REDIS_TLS=true
   */
  if (process.env.REDIS_HOST) {
    const useTls = process.env.REDIS_TLS === 'true';

    return {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 6379),
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      ...(useTls && {
        tls: { rejectUnauthorized: false },
      }),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  /**
   * FALLBACK LOCAL
   */
  console.warn('⚠️ Nenhuma configuração Redis encontrada. Usando localhost.');

  return {
    host: 'localhost',
    port: 6379,
  };
}
