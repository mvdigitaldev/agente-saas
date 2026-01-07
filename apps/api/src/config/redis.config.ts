import { RedisOptions } from 'ioredis';

export function getRedisConnection(url?: string): RedisOptions {
  console.log('🔧 getRedisConnection() chamado');
  const connectionString = url || process.env.REDIS_URL;
  console.log('🔧 REDIS_URL:', connectionString ? 'DEFINIDA' : 'NÃO DEFINIDA');

  if (connectionString) {
    const redisUrl = connectionString.trim().replace(/^["']|["']$/g, '');
    const isTls = redisUrl.startsWith('rediss://');

    console.log('🔧 URL começa com rediss://:', isTls);

    const url = new URL(redisUrl);

    const options: RedisOptions = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      username: url.username || 'default',
      password: url.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    if (isTls) {
      options.tls = {
        rejectUnauthorized: false,
      };
    }

    console.log('🔧 REDIS CONFIG FINAL:', {
      host: options.host,
      port: options.port,
      tls: !!options.tls,
      username: options.username,
      passwordLength: options.password?.length || 0,
    });

    return options;
  }

  console.warn('⚠️ REDIS_URL não definida, usando localhost');
  return {
    host: 'localhost',
    port: 6379,
  };
}
