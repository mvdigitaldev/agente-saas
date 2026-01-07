-- Adicionar colunas para gerenciamento de atendimento humano na tabela conversations

-- Coluna para indicar se precisa de atendimento humano
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS needs_human boolean DEFAULT false;

-- Motivo do encaminhamento para atendimento humano
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS human_handoff_reason text;

-- Data/hora em que foi solicitado atendimento humano
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS human_handoff_requested_at timestamp with time zone;

-- Data/hora em que um humano assumiu o atendimento
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS human_started_at timestamp with time zone;

-- Criar índice para busca por status
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);

-- Criar índice para busca por needs_human
CREATE INDEX IF NOT EXISTS idx_conversations_needs_human ON public.conversations(needs_human);

-- Criar índice composto para busca por empresa e status
CREATE INDEX IF NOT EXISTS idx_conversations_empresa_status ON public.conversations(empresa_id, status);
