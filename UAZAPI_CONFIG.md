# Configuração Uazapi

## Variáveis de Ambiente Necessárias

### Backend (NestJS)

Adicione as seguintes variáveis no arquivo `.env` do backend (`apps/api/.env`):

```env
# Uazapi - Configuração
UAZAPI_ADMIN_TOKEN=seu_token_admin_aqui
UAZAPI_BASE_URL=https://iagenda.uazapi.com
WEBHOOK_BASE_URL=https://sua-api-producao.com
```

### Descrição das Variáveis

#### `UAZAPI_ADMIN_TOKEN` (Obrigatório)
- **Descrição**: Token admin da Uazapi usado para criar novas instâncias
- **Uso**: Header `admintoken` no endpoint `POST /instance/init`
- **Onde obter**: Dashboard da Uazapi → Configurações → Tokens
- **Exemplo**: `Ia05Uj1qfJBgoEgHdzguVDPJL59omoNPqxj7ZrtN88ivv8122W`

#### `UAZAPI_BASE_URL` (Opcional)
- **Descrição**: URL base da API Uazapi
- **Padrão**: `https://iagenda.uazapi.com`
- **Uso**: Base URL para todas as chamadas da API Uazapi
- **Exemplo**: `https://iagenda.uazapi.com`

#### `WEBHOOK_BASE_URL` (Obrigatório)
- **Descrição**: URL base do seu backend em produção onde os webhooks serão recebidos
- **Uso**: Gerar URL completa do webhook para configurar nas instâncias
- **Formato**: `https://sua-api-producao.com`
- **Exemplo**: `https://api.agente-saas.com`

## Fluxo de Integração

### 1. Criar Instância
- Endpoint: `POST /instance/init`
- Header: `admintoken: {UAZAPI_ADMIN_TOKEN}`
- Body: `{ name: "nome-instancia" }`
- Retorna: `{ token, instance: { id } }`

### 2. Conectar Instância (Gerar QR Code)
- Endpoint: `POST /instance/connect`
- Header: `token: {token_da_instancia}`
- Body: `{}` (vazio para gerar QR code)
- Retorna: `{ qrcode, instance: { id, status } }`

### 3. Verificar Status
- Endpoint: `GET /instance/status`
- Header: `token: {token_da_instancia}`
- Retorna: `{ status: { connected, loggedIn, jid: { user } } }`

### 4. Configurar Webhook
- Endpoint: `POST /instance/webhook`
- Header: `token: {token_da_instancia}`
- Body: `{ webhookUrl: "{WEBHOOK_BASE_URL}/webhook/uazapi?instance_id={instance_id}" }`

### 5. Enviar Mensagem
- Endpoint: `POST /send/text`
- Header: `token: {token_da_instancia}`
- Body: `{ number: "5511999999999", text: "Mensagem", buttons?: [...] }`

### 6. Desconectar
- Endpoint: `POST /instance/disconnect`
- Header: `token: {token_da_instancia}`

### 7. Deletar Instância
- Endpoint: `DELETE /instance`
- Header: `token: {token_da_instancia}`

## Estrutura de Dados no Banco

A tabela `whatsapp_instances` deve conter:

- `instance_id` (UUID) - ID interno da instância
- `empresa_id` (UUID) - ID da empresa (multi-tenancy)
- `uazapi_instance_id` (string) - ID da instância no Uazapi
- `uazapi_token` (string) - Token retornado pelo `initInstance()` (usado em todas as chamadas)
- `instance_name` (string) - Nome da instância (sanitizado)
- `status` (enum) - `disconnected` | `connecting` | `connected`
- `phone_number` (string, nullable) - Número de telefone quando conectado
- `qr_code_url` (text, nullable) - QR code em base64
- `qr_code_expires_at` (timestamp, nullable) - Data de expiração do QR code
- `webhook_url` (text, nullable) - URL do webhook configurada
- `connected_at` (timestamp, nullable) - Data de conexão
- `last_sync_at` (timestamp, nullable) - Última sincronização

## Tratamento de Erros

### Erros 404/401
Quando uma instância não existe mais no Uazapi (404) ou o token é inválido (401):
- O sistema atualiza o status local para `disconnected`
- Não lança erro fatal, apenas loga como warning
- Permite que o usuário crie uma nova instância

### Webhook
- Sempre retorna `200 OK` mesmo em caso de erro
- Erros são logados mas não interrompem o processamento
- Webhook recebe `instance_id` via query param: `?instance_id={uazapi_instance_id}`

## Exemplo de Uso

```typescript
// 1. Criar instância
const initResponse = await uazapiService.initInstance('minha-empresa');
const token = initResponse.token;

// 2. Conectar (gerar QR code)
const connectResponse = await uazapiService.connectInstance(token);
const qrcode = connectResponse.instance.qrcode;

// 3. Verificar status (polling)
const statusResponse = await uazapiService.getInstanceStatus(token);
const isConnected = statusResponse.status?.connected && statusResponse.status?.loggedIn;
const phoneNumber = statusResponse.status?.jid?.user; // Número quando conectado

// 4. Configurar webhook quando conectar
if (isConnected) {
  const webhookUrl = `${WEBHOOK_BASE_URL}/webhook/uazapi?instance_id=${initResponse.instance.id}`;
  await uazapiService.setWebhook(token, webhookUrl);
}

// 5. Enviar mensagem
await uazapiService.sendMessage(token, '5511999999999', 'Olá!');
```

## Notas Importantes

1. **Token vs Apikey**: A API Uazapi usa `token` (retornado pelo `initInstance`), não `apikey`
2. **QR Code**: Vem diretamente no `connectInstance`, não precisa de endpoint separado
3. **Número de Telefone**: Extraído de `status.jid.user` quando conectado (pode ser objeto ou string)
4. **Webhook**: Deve ser configurado automaticamente quando a instância conectar
5. **Timeout QR Code**: QR code expira em 2 minutos, após isso deve ser gerado novo

