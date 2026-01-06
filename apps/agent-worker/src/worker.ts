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

  console.log(`🔄 Processando job ${jobId}...`);

  // Validar payload
  if (!validateJobData(jobData)) {
    const error = new Error(`Payload inválido para job ${jobId}`);
    console.error('❌', error.message, jobData);
    throw error;
  }

  // Chamar agente Python
  await callAgent(jobData as AgentJob);

  console.log(`✅ Job ${jobId} concluído com sucesso`);
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
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completado`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id || 'unknown'} falhou:`, err.message);
});

worker.on('error', (err) => {
  console.error('❌ Erro no worker:', err);
});

console.log(`🟢 Worker BullMQ iniciado para fila: ${QUEUE_NAME} (concorrência: ${CONCURRENCY})`);

