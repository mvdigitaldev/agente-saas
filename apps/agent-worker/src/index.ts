import './worker';

console.log('🚀 Agent Worker iniciado');
console.log('📋 Variáveis de ambiente:');
console.log(`   - REDIS_URL: ${process.env.REDIS_URL ? '✅ definida' : '❌ não definida'}`);
console.log(`   - AGENT_PYTHON_URL: ${process.env.AGENT_PYTHON_URL || '❌ não definida'}`);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recebido, encerrando worker...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recebido, encerrando worker...');
  process.exit(0);
});

