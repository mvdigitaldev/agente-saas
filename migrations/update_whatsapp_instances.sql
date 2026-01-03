-- Migração: Atualizar tabela whatsapp_instances para suportar nova implementação Uazapi
-- Data: 2024-01-XX
-- Descrição: Adiciona campos necessários para nova implementação baseada em token

-- Verificar se a tabela existe (caso não exista, criar)
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  instance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(empresa_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas se não existirem
DO $$ 
BEGIN
  -- instance_name: Nome sanitizado da instância no Uazapi
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'instance_name') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN instance_name VARCHAR(255);
  END IF;

  -- uazapi_instance_id: ID da instância no Uazapi (retornado pelo initInstance)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'uazapi_instance_id') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN uazapi_instance_id VARCHAR(255);
  END IF;

  -- uazapi_token: Token retornado pelo initInstance (usado em todas as chamadas)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'uazapi_token') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN uazapi_token TEXT;
  END IF;

  -- Manter uazapi_apikey por compatibilidade (pode ser removido depois)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'uazapi_apikey') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN uazapi_apikey TEXT;
  END IF;

  -- status: disconnected | connecting | connected
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'status') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN status VARCHAR(20) DEFAULT 'disconnected';
  END IF;

  -- phone_number: Número de telefone quando conectado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'phone_number') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN phone_number VARCHAR(20);
  END IF;

  -- qr_code_url: QR code em base64 (obtido do connectInstance)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'qr_code_url') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN qr_code_url TEXT;
  END IF;

  -- qr_code_expires_at: Data de expiração do QR code (2 minutos após geração)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'qr_code_expires_at') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN qr_code_expires_at TIMESTAMPTZ;
  END IF;

  -- connected_at: Data/hora da conexão
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'connected_at') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN connected_at TIMESTAMPTZ;
  END IF;

  -- webhook_url: URL do webhook configurada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'webhook_url') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN webhook_url TEXT;
  END IF;

  -- last_sync_at: Última sincronização de status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'whatsapp_instances' AND column_name = 'last_sync_at') THEN
    ALTER TABLE whatsapp_instances ADD COLUMN last_sync_at TIMESTAMPTZ;
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_empresa_id 
  ON whatsapp_instances(empresa_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_uazapi_instance_id 
  ON whatsapp_instances(uazapi_instance_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_name 
  ON whatsapp_instances(instance_name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status 
  ON whatsapp_instances(status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_phone_number 
  ON whatsapp_instances(phone_number);

-- Constraint: Uma empresa pode ter apenas uma instância ativa (connected ou connecting)
-- Nota: Isso permite ter múltiplas instâncias desconectadas, mas apenas uma ativa
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_empresa_active 
  ON whatsapp_instances(empresa_id) 
  WHERE status IN ('connected', 'connecting');

-- Constraint: instance_name deve ser único
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_name_unique 
  ON whatsapp_instances(instance_name) 
  WHERE instance_name IS NOT NULL;

-- Habilitar RLS (Row Level Security)
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Política RLS: Usuários só podem ver instâncias da sua empresa
DROP POLICY IF EXISTS whatsapp_instances_empresa_policy ON whatsapp_instances;
CREATE POLICY whatsapp_instances_empresa_policy ON whatsapp_instances
  FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM empresa_users WHERE user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_whatsapp_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_whatsapp_instances_updated_at ON whatsapp_instances;
CREATE TRIGGER trigger_update_whatsapp_instances_updated_at
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_instances_updated_at();

-- Comentários nas colunas para documentação
COMMENT ON COLUMN whatsapp_instances.instance_name IS 'Nome sanitizado da instância no Uazapi (baseado em nome da empresa)';
COMMENT ON COLUMN whatsapp_instances.uazapi_instance_id IS 'ID da instância no Uazapi (retornado pelo initInstance)';
COMMENT ON COLUMN whatsapp_instances.uazapi_token IS 'Token da instância (retornado pelo initInstance, usado em todas as chamadas)';
COMMENT ON COLUMN whatsapp_instances.status IS 'Status da conexão: disconnected, connecting, connected';
COMMENT ON COLUMN whatsapp_instances.phone_number IS 'Número de telefone quando conectado (extraído de status.jid.user)';
COMMENT ON COLUMN whatsapp_instances.qr_code_url IS 'QR code em base64 (obtido do connectInstance)';
COMMENT ON COLUMN whatsapp_instances.qr_code_expires_at IS 'Data de expiração do QR code (2 minutos após geração)';
COMMENT ON COLUMN whatsapp_instances.connected_at IS 'Data/hora da conexão bem-sucedida';
COMMENT ON COLUMN whatsapp_instances.webhook_url IS 'URL do webhook configurada automaticamente quando conecta';
COMMENT ON COLUMN whatsapp_instances.last_sync_at IS 'Última sincronização de status com Uazapi';

