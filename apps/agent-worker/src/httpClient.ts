import axios, { AxiosError } from 'axios';
import { AgentJob } from './types';

const AGENT_PYTHON_URL = process.env.AGENT_PYTHON_URL;

if (!AGENT_PYTHON_URL) {
  throw new Error('AGENT_PYTHON_URL não definida nas variáveis de ambiente');
}

/**
 * Chama o agente Python via HTTP para processar um job
 */
export async function callAgent(job: AgentJob): Promise<void> {
  const url = `${AGENT_PYTHON_URL}/api/process`;
  
  try {
    console.log(`📤 Enviando job ${job.job_id} para agente Python: ${url}`);
    
    const response = await axios.post(
      url,
      job,
      {
        timeout: 60000, // 60 segundos
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Job ${job.job_id} processado com sucesso:`, response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response) {
        // Resposta HTTP com erro
        console.error(
          `❌ Erro HTTP ao processar job ${job.job_id}:`,
          axiosError.response.status,
          axiosError.response.data
        );
        throw new Error(
          `Agente Python retornou erro ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data)}`
        );
      } else if (axiosError.request) {
        // Request feito mas sem resposta
        console.error(`❌ Sem resposta do agente Python para job ${job.job_id}`);
        throw new Error('Agente Python não respondeu');
      } else {
        // Erro ao configurar request
        console.error(`❌ Erro ao configurar request para job ${job.job_id}:`, axiosError.message);
        throw new Error(`Erro ao chamar agente Python: ${axiosError.message}`);
      }
    } else {
      // Erro não relacionado ao axios
      console.error(`❌ Erro inesperado ao processar job ${job.job_id}:`, error);
      throw error;
    }
  }
}

