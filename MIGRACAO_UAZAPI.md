# Migração SQL - Atualização WhatsApp Instances

## Resumo

Esta migração atualiza a tabela `whatsapp_instances` para suportar a nova implementação do Uazapi baseada em **token** ao invés de `apikey`.

## Campos Adicionados/Atualizados

### Novos Campos (se não existirem)

1. **`instance_name`** (VARCHAR(255))
   - Nome sanitizado da instância no Uazapi
   - Baseado no nome da empresa
   - Deve ser único

2. **`uazapi_instance_id`** (VARCHAR(255))
   - ID da instância no Uazapi
   - Retornado pelo `initInstance()`

3. **`uazapi_token`** (TEXT)
   - Token retornado pelo `initInstance()`
   - Usado em todas as chamadas da API (exceto `initInstance`)
   - **IMPORTANTE**: Substitui o uso de `uazapi_apikey`

4. **`qr_code_url`** (TEXT)
   - QR code em base64
   - Obtido do `connectInstance()`

5. **`qr_code_expires_at`** (TIMESTAMPTZ)
   - Data de expiração do QR code
   - 2 minutos após geração

6. **`connected_at`** (TIMESTAMPTZ)
   - Data/hora da conexão bem-sucedida

7. **`webhook_url`** (TEXT)
   - URL do webhook configurada automaticamente
   - Formato: `{WEBHOOK_BASE_URL}/webhook/uazapi?instance_id={uazapi_instance_id}`

8. **`last_sync_at`** (TIMESTAMPTZ)
   - Última sincronização de status com Uazapi

### Campos Mantidos (compatibilidade)

- **`uazapi_apikey`** (TEXT)
  - Mantido por compatibilidade
  - Pode ser removido no futuro

## Como Aplicar

### Opção 1: Via Supabase Dashboard

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `migrations/update_whatsapp_instances.sql`
4. Execute a query

### Opção 2: Via CLI do Supabase

```bash
supabase db push
```

### Opção 3: Via Migração do NestJS (se configurado)

Se você tiver um sistema de migrações no NestJS, adicione o arquivo SQL na pasta de migrações.

## Verificação

Após aplicar a migração, verifique se os campos foram criados:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'whatsapp_instances'
ORDER BY ordinal_position;
```

## Rollback (se necessário)

Se precisar reverter a migração:

```sql
-- Remover campos novos (CUIDADO: isso apagará dados!)
ALTER TABLE whatsapp_instances 
  DROP COLUMN IF EXISTS instance_name,
  DROP COLUMN IF EXISTS uazapi_instance_id,
  DROP COLUMN IF EXISTS uazapi_token,
  DROP COLUMN IF EXISTS qr_code_url,
  DROP COLUMN IF EXISTS qr_code_expires_at,
  DROP COLUMN IF EXISTS connected_at,
  DROP COLUMN IF EXISTS webhook_url,
  DROP COLUMN IF EXISTS last_sync_at;

-- Remover índices
DROP INDEX IF EXISTS idx_whatsapp_instances_uazapi_instance_id;
DROP INDEX IF EXISTS idx_whatsapp_instances_instance_name;
DROP INDEX IF EXISTS idx_whatsapp_instances_instance_name_unique;
DROP INDEX IF EXISTS idx_whatsapp_instances_empresa_active;
```

## Notas Importantes

1. **Segurança**: A migração mantém RLS (Row Level Security) habilitado
2. **Compatibilidade**: Campos antigos (`uazapi_apikey`) são mantidos temporariamente
3. **Índices**: Índices são criados para melhorar performance de queries
4. **Constraints**: 
   - Uma empresa pode ter apenas uma instância ativa (connected ou connecting)
   - `instance_name` deve ser único
5. **Triggers**: Trigger automático para atualizar `updated_at`

## Próximos Passos

Após aplicar a migração:

1. Configure as variáveis de ambiente (veja `UAZAPI_CONFIG.md`)
2. Teste a criação de uma nova instância
3. Verifique se o QR code é gerado corretamente
4. Teste a conexão e verificação de status
5. Teste o envio de mensagens

