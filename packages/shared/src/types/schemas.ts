// Types compartilhados entre apps

export interface Empresa {
  empresa_id: string;
  nome: string;
  cnpj?: string;
  email: string;
  telefone?: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  client_id: string;
  empresa_id: string;
  whatsapp_number: string;
  nome?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  conversation_id: string;
  empresa_id: string;
  client_id: string;
  whatsapp_instance_id?: string;
  status: 'active' | 'closed' | 'handoff';
  summary?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  message_id: string;
  empresa_id: string;
  conversation_id: string;
  whatsapp_message_id: string;
  direction: 'inbound' | 'outbound';
  role: 'user' | 'assistant' | 'system';
  content: string;
  media_url?: string;
  created_at: string;
}

export interface Appointment {
  appointment_id: string;
  empresa_id: string;
  client_id: string;
  service_id: string;
  staff_id?: string;
  resource_id?: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentFeatures {
  feature_id: string;
  empresa_id: string;
  ask_for_pix: boolean;
  require_deposit: boolean;
  auto_confirmations_48h: boolean;
  auto_confirmations_24h: boolean;
  auto_confirmations_2h: boolean;
  waitlist_enabled: boolean;
  marketing_campaigns: boolean;
  created_at: string;
  updated_at: string;
}

export interface BlockedTime {
  block_id: string;
  empresa_id: string;
  start_time: string;
  end_time: string;
  motivo?: string;
  staff_id?: string;
  resource_id?: string;
  created_by?: string;
  created_at: string;
}

