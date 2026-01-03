/**
 * Configuração do Redis para BullMQ
 * Suporta tanto Redis local quanto Upstash Redis
 */

let sharedRedisConnection: any = null;

export function getRedisConnection() {
  // Prioridade 1: REDIS_URL (formato do dashboard do Upstash)
  // Remover aspas se houver (alguns .env podem ter aspas)
  let redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    redisUrl = redisUrl.trim().replace(/^["']|["']$/g, '');
  }

  if (redisUrl) {
    // Upstash Redis - conforme documentação oficial
    // Formato correto: rediss://:PASSWORD@HOST:PORT (sem username)
    // Documentação: https://upstash.com/docs/redis/integrations/bullmq
    
    try {
      const url = new URL(redisUrl);
      
      console.log('Parsing Redis URL:', {
        protocol: url.protocol,
        username: url.username,
        password: url.password ? `${url.password.substring(0, 10)}...` : '(vazio)',
        hostname: url.hostname,
        port: url.port,
      });
      
      // Upstash fornece URL no formato: rediss://default:TOKEN@host:6379
      // url.username = "default"
      // url.password = "TOKEN"
      let password = url.password || '';
      
      // Se não tiver password, o token pode estar no username (formato alternativo)
      if (!password && url.username) {
        // Se username contém ":", pode ser username:password
        if (url.username.includes(':')) {
          const parts = url.username.split(':');
          password = parts[1] || parts[0];
        } else if (url.username !== 'default') {
          // Se username não é "default", pode ser o token
          password = url.username;
        }
      }
      
      // Decodificar se necessário (caso tenha sido URL-encoded)
      if (password) {
        try {
          password = decodeURIComponent(password);
        } catch (e) {
          // Se falhar, usar password original
        }
      }
      
      if (!password) {
        throw new Error('Password não encontrado na URL do Redis');
      }
      
      // Upstash aceita tanto com "default" quanto sem
      // Vamos usar a URL original que vem do dashboard (com default)
      // Mas também criar versão sem default como fallback
      
      // URL original do dashboard (com default)
      const originalUrl = redisUrl;
      
      // URL sem default (formato alternativo)
      const urlWithoutDefault = `rediss://:${password}@${url.hostname}:${url.port || '6379'}`;
      
      console.log('Redis config (Upstash):', { 
        usingOriginalUrl: true,
        url: originalUrl.replace(/:[^:@]+@/, ':****@'),
        passwordLength: password?.length,
        hasTLS: true
      });

      // Criar instância compartilhada do ioredis (singleton)
      // Isso garante que todas as conexões do BullMQ usem a mesma configuração
      if (!sharedRedisConnection) {
        const Redis = require('ioredis');
        sharedRedisConnection = new Redis(originalUrl, {
          maxRetriesPerRequest: null, // Importante para BullMQ
          enableReadyCheck: false, // Upstash pode não suportar alguns comandos
          lazyConnect: true, // Conectar sob demanda
        });
        
        console.log('Redis instance compartilhada criada com URL do Upstash');
      }
      
      return sharedRedisConnection;
    } catch (error) {
      console.error('Erro ao parsear REDIS_URL:', error);
      // Fallback: tentar usar URL diretamente
      return redisUrl;
    }
  }

  // Fallback 1: Tentar variáveis separadas (se REDIS_URL não estiver definido)
  if (process.env.REDIS_HOST && process.env.REDIS_PASSWORD) {
    const host = process.env.REDIS_HOST;
    const port = parseInt(process.env.REDIS_PORT || '6379');
    const password = process.env.REDIS_PASSWORD;
    
    // Se for Upstash, usar URL string
    if (host.includes('upstash.io')) {
      const url = `rediss://:${password}@${host}:${port}`;
      console.log('Redis config (Upstash - usando variáveis separadas):', {
        url: url.replace(/:[^:@]+@/, ':****@'),
        passwordLength: password.length,
      });
      return url;
    }
    
    // Para outros Redis, usar objeto
    console.log('Redis config (usando variáveis separadas):', {
      host,
      port,
      hasPassword: !!password,
    });
    return {
      host,
      port,
      password,
      tls: host.includes('upstash.io') ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  }

  // Fallback 2: Redis local (desenvolvimento) - apenas se não tiver nada configurado
  console.warn('⚠️  Nenhuma configuração Redis encontrada. Usando localhost (desenvolvimento).');
  return {
    host: 'localhost',
    port: 6379,
  };
}

