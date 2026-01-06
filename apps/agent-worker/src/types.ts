/**
 * Tipos TypeScript compatíveis com AgentJob do Python
 */
export interface AgentJob {
  job_id: string;
  company_id: string;
  conversation_id: string;
  message: string;
  channel: string;
  metadata?: Record<string, any>;
  created_at: string; // ISO string
}

