-- Tabela de serviços (multi-tenant)
CREATE TABLE IF NOT EXISTS services (
  service_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(empresa_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  available_online BOOLEAN DEFAULT true,
  show_price_online BOOLEAN DEFAULT true,
  fixed_price BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT services_duration_check CHECK (duration_minutes > 0),
  CONSTRAINT services_price_check CHECK (price IS NULL OR price >= 0)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_services_empresa_id ON services(empresa_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(empresa_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_services_available_online ON services(empresa_id, available_online) WHERE available_online = true;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_services_updated_at();

-- RLS Policies
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver apenas serviços da sua empresa
CREATE POLICY "Users can view services from their empresa"
  ON services FOR SELECT
  USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas 
      WHERE empresa_id IN (
        SELECT empresa_id FROM user_empresas 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Usuários podem inserir serviços na sua empresa
CREATE POLICY "Users can insert services in their empresa"
  ON services FOR INSERT
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM empresas 
      WHERE empresa_id IN (
        SELECT empresa_id FROM user_empresas 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Usuários podem atualizar serviços da sua empresa
CREATE POLICY "Users can update services in their empresa"
  ON services FOR UPDATE
  USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas 
      WHERE empresa_id IN (
        SELECT empresa_id FROM user_empresas 
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM empresas 
      WHERE empresa_id IN (
        SELECT empresa_id FROM user_empresas 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Usuários podem deletar serviços da sua empresa
CREATE POLICY "Users can delete services from their empresa"
  ON services FOR DELETE
  USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas 
      WHERE empresa_id IN (
        SELECT empresa_id FROM user_empresas 
        WHERE user_id = auth.uid()
      )
    )
  );

