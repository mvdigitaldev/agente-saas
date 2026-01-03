/**
 * Script para testar conexão com Upstash Redis
 * Execute: node test-redis-connection.js
 */

const Redis = require('ioredis');

// Substitua pelos valores do seu .env
const REDIS_URL = process.env.REDIS_URL || 'rediss://:AUH2AAIncDIwZGIwOTJmZDY3Yzc0Y2RmYTRjODNmMTEwYTk5MWIxZXAYMTY4ODY@fun-warthog-16886.upstash.io:6379';

console.log('Testando conexão Redis...');
console.log('URL:', REDIS_URL.replace(/:[^:@]+@/, ':****@'));

// Tentar com URL direta
console.log('\n1. Testando com URL direta...');
const redis1 = new Redis(REDIS_URL);

redis1.on('connect', () => {
  console.log('✅ Conectado!');
});

redis1.on('error', (err) => {
  console.error('❌ Erro:', err.message);
});

redis1.ping()
  .then((result) => {
    console.log('✅ PING retornou:', result);
    redis1.quit();
  })
  .catch((err) => {
    console.error('❌ Erro no PING:', err.message);
    redis1.quit();
    
    // Tentar com objeto de configuração
    console.log('\n2. Testando com objeto de configuração...');
    const url = new URL(REDIS_URL);
    const password = url.password || '';
    
    const redis2 = new Redis({
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: password,
      tls: {},
      maxRetriesPerRequest: null,
    });
    
    redis2.on('connect', () => {
      console.log('✅ Conectado com objeto!');
    });
    
    redis2.on('error', (err) => {
      console.error('❌ Erro com objeto:', err.message);
    });
    
    redis2.ping()
      .then((result) => {
        console.log('✅ PING retornou:', result);
        redis2.quit();
        process.exit(0);
      })
      .catch((err) => {
        console.error('❌ Erro no PING com objeto:', err.message);
        console.error('\n💡 Possíveis soluções:');
        console.error('1. Verifique o token no dashboard do Upstash');
        console.error('2. Certifique-se de que o token está correto');
        console.error('3. Verifique se o Redis está ativo no Upstash');
        redis2.quit();
        process.exit(1);
      });
  });

