import { RedisOptions } from 'ioredis';

export function getRedisConnection(): RedisOptions {
  if (process.env.REDIS_URL) {
    const rawUrl = process.env.REDIS_URL.trim().replace(/^["']|["']$/g, '');
    const isTls = rawUrl.startsWith('rediss://');

    const normalized = isTls
      ? rawUrl.replace('rediss://', 'redis://')
      : rawUrl;

    const url = new URL(normalized);

    const options: RedisOptions = {
      host: url.hostname,
      port: Number(url.port) || (isTls ? 6380 : 6379),
      username: url.username || 'default',
      password: url.password
        ? decodeURIComponent(url.password)
        : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    if (isTls) {
      options.tls = {
        rejectUnauthorized: false,
        servername: url.hostname, // 🔥 essencial pro Redis Cloud
      };
    }

    console.log(
      `🔗 Redis ${url.hostname}:${options.port} | TLS=${isTls}`,
    );

    return options;
  }

  return {
    host: 'localhost',
    port: 6379,
  };
}
