# Mudanças no Deploy - Migração Python para NestJS

## Resumo das Mudanças

Após a migração completa do agente Python para NestJS, **o deploy mudou significativamente**:

### ❌ ANTES
- **Python Agent**: Web Service (HTTP FastAPI) - serviço separado
- **Node.js Worker**: Background Worker (consumia BullMQ e chamava Python Agent via HTTP)
- **Problema**: Arquitetura complexa com múltiplos serviços e chamadas HTTP internas

### ✅ AGORA
- **NestJS API**: Web Service com Agent IA integrado - **TUDO EM UM**
- **AgentProcessor**: Processa jobs do BullMQ diretamente no NestJS
- **Benefícios**: Menos serviços, menos latência, arquitetura mais simples

---

## Mudanças por Serviço

### 1️⃣ NestJS API (`agente-saas-api`)

#### ✅ MUDANÇAS

**Variáveis de Ambiente:**
- ✅ **ADICIONAR**: `OPENAI_API_KEY` (obrigatória para o Agent IA)
- ✅ **ADICIONAR**: `OPENAI_MODEL` (opcional, padrão: `gpt-4.1-mini`)

**Funcionalidades:**
- ✅ Agora inclui Agent IA integrado
- ✅ Processa jobs do BullMQ internamente via `AgentProcessor`
- ✅ Tool calling interno (não precisa chamar endpoints HTTP)

#### ✅ O QUE PERMANECE IGUAL

- Tipo: `type: web` (Web Service)
- Root Directory: `apps/api`
- Build Command: `cd apps/api && npm install && npm run build`
- Start Command: `cd apps/api && npm run start`
- Port: `10000`

---

### 2️⃣ Python Agent (`agente-saas-agent`) - **REMOVIDO**

#### ❌ REMOVER COMPLETAMENTE

- Serviço removido do Render
- Não é mais necessário
- Funcionalidade migrada para NestJS

---

### 3️⃣ Node.js Worker (`agente-saas-worker`) - **REMOVIDO**

#### ❌ REMOVER COMPLETAMENTE

- Worker removido do Render
- Não é mais necessário
- Processamento agora é feito pelo `AgentProcessor` dentro do NestJS API

---

## Configuração Completa do `render.yaml`

```yaml
services:
  # Backend NestJS (com Agent IA integrado)
  - type: web
    name: agente-saas-api
    env: node
    buildCommand: cd apps/api && npm install && npm run build
    startCommand: cd apps/api && npm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: REDIS_URL
        sync: false
      - key: AGENT_API_KEY
        sync: false
      - key: FRONTEND_URL
        value: https://agente-saas-web.vercel.app
      - key: WEBHOOK_BASE_URL
        value: https://agente-saas-api.onrender.com
      - key: UAZAPI_BASE_URL
        sync: false
      - key: UAZAPI_ADMIN_TOKEN
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: OPENAI_MODEL
        value: gpt-4.1-mini
```

---

## Passo a Passo para Atualizar o Deploy no Render

### Passo 1: Atualizar NestJS API

1. Acesse o Dashboard do Render
2. Encontre o serviço `agente-saas-api`
3. Vá em **Settings** → **Environment**
4. **Adicionar variáveis:**
   - `OPENAI_API_KEY`: Sua chave da OpenAI
   - `OPENAI_MODEL`: `gpt-4.1-mini` (opcional, mas recomendado)

5. **Salvar e fazer deploy**

### Passo 2: Remover Serviços Antigos

1. No Dashboard do Render:
   - Encontre `agente-saas-agent` (Python Agent)
   - Clique em **Settings** → **Delete Service**
   - Confirme a remoção

2. Encontre `agente-saas-worker` (Node.js Worker)
   - Clique em **Settings** → **Delete Service**
   - Confirme a remoção

### Passo 3: Verificar Deploy

1. **NestJS API:**
   - ✅ Verificar logs - deve mostrar: `AgentModule` carregado
   - ✅ Verificar que `AgentProcessor` está consumindo fila `process-inbound-message`
   - ✅ Testar endpoint de health: `https://agente-saas-api.onrender.com/health`

2. **Fluxo completo:**
   - ✅ WhatsApp webhook recebe mensagem
   - ✅ NestJS enfileira job no BullMQ
   - ✅ `AgentProcessor` processa job
   - ✅ Agent IA gera resposta
   - ✅ Resposta enviada via WhatsApp

---

## Variáveis de Ambiente - Resumo

### NestJS API (único serviço)

```bash
# OBRIGATÓRIAS
NODE_ENV=production
PORT=10000
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=rediss://...
OPENAI_API_KEY=...

# OPCIONAIS
OPENAI_MODEL=gpt-4.1-mini  # Padrão: gpt-4.1-mini
AGENT_API_KEY=...           # Se usar autenticação
FRONTEND_URL=https://...
WEBHOOK_BASE_URL=https://...
UAZAPI_BASE_URL=...
UAZAPI_ADMIN_TOKEN=...
```

---

## Custos Estimados (Render)

### Antes
- NestJS API: $7/mês (Web Service)
- Python Agent: $7/mês (Web Service)
- Node.js Worker: $7/mês (Background Worker)
- **Total: $21/mês**

### Agora
- NestJS API: $7/mês (Web Service) - **único serviço**
- **Total: $7/mês**

**Economia:** -$14/mês (66% de redução)

---

## Troubleshooting

### Agent não processa mensagens

- Verificar `OPENAI_API_KEY` está configurada
- Verificar logs do `AgentProcessor`
- Verificar que fila `process-inbound-message` está configurada no BullMQ

### Erro ao chamar OpenAI

- Verificar `OPENAI_API_KEY` é válida
- Verificar créditos da conta OpenAI
- Verificar logs para erros específicos da API

### Tools não funcionam

- Verificar que `SchedulingModule`, `ConversationsModule`, `WhatsappModule` estão importados no `AgentModule`
- Verificar logs de execução de tools no `ToolExecutorService`

---

## Notas Importantes

1. **Python completamente removido**: Não há mais dependências Python
2. **Worker integrado**: `AgentProcessor` roda na mesma instância do NestJS
3. **Chamadas internas**: Tools são executadas via serviços NestJS, não HTTP
4. **Custos reduzidos**: De 3 serviços para 1 serviço
5. **Arquitetura simplificada**: Menos pontos de falha, mais fácil de debugar
