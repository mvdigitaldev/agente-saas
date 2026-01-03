/**
 * Teste usando variáveis separadas do .env
 */

require('dotenv').config({ path: '.env' });
const Redis = require('ioredis');

const host = process.env.REDIS_HOST;
const port = parseInt(process.env.REDIS_PORT || '6379');
const password = process.env.REDIS_PASSWORD;

console.log('Testando com variáveis separadas:');
console.log('Host:', host);
console.log('Port:', port);
console.log('Password length:', password?.length);
console.log('Password preview:', password ? `${password.substring(0, 20)}...` : '(vazio)');

// Testar com URL
const url = `rediss://:${password}@${host}:${port}`;
console.log('\nURL gerada:', url.replace(/:[^:@]+@/, ':****@'));

const redis = new Redis(url);

redis.on('connect', () => {
  console.log('✅ Conectado!');
});

redis.on('error', (err) => {
  console.error('❌ Erro:', err.message);
});

redis.ping()
  .then((result) => {
    console.log('✅ PING retornou:', result);
    redis.quit();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro no PING:', err.message);
    console.error('\n💡 O token pode estar incorreto. Verifique no dashboard do Upstash.');
    redis.quit();
    process.exit(1);
  });

