import { Worker, Job } from 'bullmq';
import { connection } from './redis';
import { callAgent } from './httpClient';
import { AgentJob } from './types';

const QUEUE_NAME = 'process-inbound-message';
const CONCURRENCY = 5;

/**
 * Valida se o payload do job é um AgentJob válido
 */
function validateJobData(data: any): data is AgentJob {
  return (
    typeof data === 'object' &&
    typeof data.job_id === 'string' &&
    typeof data.company_id === 'string' &&
    typeof data.conversation_id === 'string' &&
    typeof data.message === 'string' &&
    typeof data.channel === 'string' &&
    (data.metadata === undefined || typeof data.metadata === 'object') &&
    typeof data.created_at === 'string'
  );
}

/**
 * Processa um job do BullMQ
 */
async function processJob(job: Job): Promise<void> {
  const jobId = job.id;
  const jobData = job.data;

  console.log(`\n🔄 [${new Date().toISOString()}] Processando job ${jobId}...`);
  console.log(`   Tipo: ${typeof jobData}`);
  console.log(`   Dados recebidos:`, JSON.stringify(jobData, null, 2));

  // Validar payload
  if (!validateJobData(jobData)) {
    const error = new Error(`Payload inválido para job ${jobId}`);
    console.error('❌', error.message);
    console.error('   Dados recebidos:', JSON.stringify(jobData, null, 2));
    throw error;
  }

  console.log(`   ✅ Payload válido - Job ID: ${jobData.job_id}, Company: ${jobData.company_id}, Conversation: ${jobData.conversation_id}`);

  // Chamar agente Python
  try {
    await callAgent(jobData as AgentJob);
    console.log(`✅ Job ${jobId} concluído com sucesso\n`);
  } catch (error: any) {
    console.error(`❌ Erro ao processar job ${jobId}:`, error.message);
    console.error(`   Stack:`, error.stack);
    throw error;
  }
}

/**
 * Worker BullMQ que consome jobs da fila
 */
export const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    await processJob(job);
  },
  {
    connection,
    concurrency: CONCURRENCY,
    removeOnComplete: {
      count: 100, // Manter últimos 100 jobs completados
      age: 24 * 3600, // 24 horas
    },
    removeOnFail: {
      count: 1000, // Manter últimos 1000 jobs falhados
    },
  }
);

// Event listeners
worker.on('active', (job) => {
  console.log(`🔄 Job ${job.id} ativado - começando processamento`);
  console.log(`   Dados:`, JSON.stringify(job.data, null, 2));
});

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completado com sucesso`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id || 'unknown'} falhou:`, err.message);
  console.error(`   Stack:`, err.stack);
  if (job?.data) {
    console.error(`   Dados do job:`, JSON.stringify(job.data, null, 2));
  }
});

worker.on('error', (err) => {
  console.error('❌ Erro no worker:', err);
  console.error('   Stack:', err.stack);
});

worker.on('stalled', (jobId) => {
  console.warn(`⚠️ Job ${jobId} travado (stalled)`);
});

worker.on('progress', (job, progress) => {
  console.log(`📊 Job ${job.id} progresso: ${progress}%`);
});

console.log(`🟢 Worker BullMQ iniciado para fila: ${QUEUE_NAME} (concorrência: ${CONCURRENCY})`);
console.log(`📡 Aguardando jobs da fila...`);

