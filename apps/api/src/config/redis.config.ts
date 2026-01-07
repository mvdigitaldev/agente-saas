import { RedisOptions } from 'ioredis';

export function getRedisConnection(): RedisOptions {
  /**
   * REDIS_URL (Redis Cloud / Upstash)
   * Detecta automaticamente se deve usar TLS baseado no protocolo
   */
  if (process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_URL.trim().replace(/^["']|["']$/g, '');
    const isTls = redisUrl.startsWith('rediss://');

    // Parse da URL para extrair componentes
    const url = new URL(redisUrl);

    const options: RedisOptions = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      username: url.username || 'default',
      password: url.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    // Adiciona TLS apenas se a URL começar com rediss://
    if (isTls) {
      options.tls = {
        rejectUnauthorized: false,
      };
    }

    console.log(`🔗 Conectando ao Redis: ${url.hostname}:${url.port} (TLS: ${isTls})`);

    return options;
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