# Mudanças no Deploy - Refatoração BullMQ

## Resumo das Mudanças

Após a refatoração da arquitetura, **o deploy mudou significativamente**:

### ❌ ANTES (Errado)
- **Python Agent**: Background Worker (consumia BullMQ diretamente)
- **Problema**: Python não conseguia consumir BullMQ corretamente

### ✅ AGORA (Correto)
- **Python Agent**: Web Service (HTTP FastAPI) - **MUDOU DE TIPO**
- **Node.js Worker**: Background Worker (consome BullMQ) - **NOVO SERVIÇO**

---

## Mudanças por Serviço

### 1️⃣ Python Agent (`agente-saas-agent`)

#### ❌ REMOVER / ❌ MUDAR

**Tipo de serviço:**
- **ANTES**: `type: worker` (Background Worker)
- **AGORA**: `type: web` (Web Service HTTP)

**Start Command:**
- **ANTES**: `python -m app.main`
- **AGORA**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

**Health Check:**
- **NOVO**: Adicionar `healthCheckPath: /api/health`

**Variáveis de Ambiente:**
- ❌ **REMOVER**: `REDIS_URL` (Python não usa Redis mais)
- ✅ **MANTER**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, etc.

#### ✅ O QUE PERMANECE IGUAL

- Root Directory: `apps/agent`
- Build Command: `pip install --upgrade pip setuptools wheel && pip install -r requirements.txt`
- Python Version: `3.11.11`

---

### 2️⃣ Node.js Worker (`agente-saas-worker`) - **NOVO**

#### ➕ CRIAR NOVO SERVIÇO

**Tipo:** `type: worker` (Background Worker)

**Configuração:**
- Root Directory: `apps/agent-worker`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

**Variáveis de Ambiente:**
- ✅ `REDIS_URL` (obrigatório - para BullMQ)
- ✅ `AGENT_PYTHON_URL` (obrigatório - URL do serviço Python, ex: `https://agente-saas-agent.onrender.com`)

**Plano Render:**
- Starter ($7/mês) - Background Workers são mais baratos

---

### 3️⃣ NestJS API (`agente-saas-api`)

#### ✅ NENHUMA MUDANÇA

- Tipo: `type: web` (permanece igual)
- Configurações: Todas permanecem iguais
- Variáveis: Todas permanecem iguais

**OBSERVAÇÃO IMPORTANTE:**
- A API **continua produzindo jobs no BullMQ** como antes
- A única diferença é que agora o **Worker Node.js** consome (não mais o Python)

---

## Configuração Completa do `render.yaml`

```yaml
services:
  # Backend NestJS (sem mudanças)
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
      # ... outras variáveis

  # Python Agent (MUDOU: worker → web)
  - type: web  # ⚠️ MUDOU DE worker PARA web
    name: agente-saas-agent
    env: python
    rootDir: apps/agent
    buildCommand: pip install --upgrade pip setuptools wheel && pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT  # ⚠️ MUDOU
    healthCheckPath: /api/health  # ⚠️ NOVO
    envVars:
      - key: PYTHON_VERSION
        value: "3.11.11"
      - key: PORT
        value: "8000"  # ⚠️ NOVO
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      # ❌ REDIS_URL REMOVIDO

  # Node.js BullMQ Worker (NOVO SERVIÇO)
  - type: worker  # ⚠️ NOVO
    name: agente-saas-worker
    env: node
    rootDir: apps/agent-worker
    buildCommand: npm install && npm run build
    startCommand: npm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: REDIS_URL
        sync: false  # ⚠️ Mesma REDIS_URL da API
      - key: AGENT_PYTHON_URL
        value: https://agente-saas-agent.onrender.com  # ⚠️ URL do Python Agent
```

---

## Passo a Passo para Atualizar o Deploy no Render

### Passo 1: Atualizar Python Agent (Mudar de Worker para Web Service)

1. Acesse o Dashboard do Render
2. Encontre o serviço `agente-saas-agent`
3. Vá em **Settings** → **Service Details**
4. **Mudar tipo:**
   - Se for possível mudar no Dashboard: mude de "Background Worker" para "Web Service"
   - Se não for possível: **DELETE o serviço antigo** e crie um novo

5. **Atualizar configurações:**
   - **Start Command**: Mude para `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: Adicione `/api/health`
   - **Port**: Adicione variável `PORT=8000`

6. **Variáveis de Ambiente:**
   - ❌ **REMOVER**: `REDIS_URL` (se existir)
   - ✅ **MANTER**: Todas as outras variáveis

7. **Salvar e fazer deploy**

### Passo 2: Criar Novo Worker Node.js

1. No Dashboard do Render, clique em **"New"** → **"Background Worker"**
2. Configure:
   - **Name**: `agente-saas-worker`
   - **Environment**: Node
   - **Root Directory**: `apps/agent-worker`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`

3. **Variáveis de Ambiente:**
   - `REDIS_URL`: Mesma URL usada pela API NestJS
   - `AGENT_PYTHON_URL`: URL do Python Agent (ex: `https://agente-saas-agent.onrender.com`)

4. **Salvar e fazer deploy**

### Passo 3: Verificar Deploy

1. **Python Agent (Web Service):**
   - ✅ Verificar que está rodando como Web Service
   - ✅ Testar: `https://agente-saas-agent.onrender.com/api/health`
   - ✅ Deve retornar: `{"status": "ok", "service": "agent"}`

2. **Node.js Worker:**
   - ✅ Verificar logs - deve mostrar: `🟢 Agent Worker iniciado`
   - ✅ Verificar que está conectado ao Redis
   - ✅ Verificar que está consumindo fila `process-inbound-message`

3. **NestJS API:**
   - ✅ Sem mudanças - deve continuar funcionando normalmente

---

## Variáveis de Ambiente - Resumo

### Python Agent (Web Service)

```bash
# OBRIGATÓRIAS
PYTHON_VERSION=3.11.11
PORT=8000
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...

# OPCIONAIS
NEST_API_URL=https://agente-saas-api.onrender.com
AGENT_API_KEY=...
LOG_LEVEL=INFO

# ❌ REMOVER (não usa mais)
# REDIS_URL  <-- REMOVER ESTA
```

### Node.js Worker (Background Worker)

```bash
# OBRIGATÓRIAS
NODE_ENV=production
REDIS_URL=rediss://...  # Mesma da API NestJS
AGENT_PYTHON_URL=https://agente-saas-agent.onrender.com  # URL do Python Agent
```

### NestJS API (sem mudanças)

```bash
# Todas permanecem iguais
# REDIS_URL continua sendo usada para BullMQ (produz jobs)
```

---

## Fluxo de Deploy Final

```
1. Render detecta push para main
   ↓
2. Build Python Agent (FastAPI) → Web Service
   ↓
3. Build Node.js Worker (BullMQ) → Background Worker
   ↓
4. Build NestJS API → Web Service
   ↓
5. Todos os serviços rodando:
   - Python Agent (HTTP): https://agente-saas-agent.onrender.com
   - Node Worker (Background): Consome BullMQ
   - NestJS API (HTTP): https://agente-saas-api.onrender.com
```

---

## Checklist de Deploy

### Python Agent (Mudar para Web Service)

- [ ] Mudar tipo de serviço: `worker` → `web`
- [ ] Atualizar Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] Adicionar Health Check: `/api/health`
- [ ] Adicionar variável `PORT=8000`
- [ ] **REMOVER** variável `REDIS_URL`
- [ ] Fazer deploy e testar: `https://agente-saas-agent.onrender.com/api/health`

### Node.js Worker (Criar Novo)

- [ ] Criar novo Background Worker
- [ ] Configurar Root Directory: `apps/agent-worker`
- [ ] Configurar Build Command: `npm install && npm run build`
- [ ] Configurar Start Command: `npm run start`
- [ ] Adicionar variável `REDIS_URL` (mesma da API)
- [ ] Adicionar variável `AGENT_PYTHON_URL` (URL do Python Agent)
- [ ] Fazer deploy e verificar logs

### Verificações Finais

- [ ] Python Agent responde em `/api/health`
- [ ] Node.js Worker está rodando e conectado ao Redis
- [ ] Node.js Worker consome fila `process-inbound-message`
- [ ] Fluxo completo funciona: API → BullMQ → Worker → Python

---

## Custos Estimados (Render)

### Antes
- NestJS API: $7/mês (Web Service)
- Python Worker: $7/mês (Background Worker)
- **Total: $14/mês**

### Agora
- NestJS API: $7/mês (Web Service)
- Python Agent: $7/mês (Web Service) - **mudou de worker para web**
- Node.js Worker: $7/mês (Background Worker) - **novo**
- **Total: $21/mês**

**Aumento:** +$7/mês (um novo serviço)

---

## Troubleshooting

### Python Agent não inicia

- Verificar que Start Command está correto: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Verificar variável `PORT` está configurada
- Verificar logs para erros de importação

### Node.js Worker não conecta ao Redis

- Verificar `REDIS_URL` está correta (mesma da API)
- Verificar formato: `rediss://...` para Upstash
- Verificar logs de conexão Redis

### Node.js Worker não consome jobs

- Verificar nome da fila: `process-inbound-message`
- Verificar que API está produzindo jobs
- Verificar logs do worker

### Worker não consegue chamar Python

- Verificar `AGENT_PYTHON_URL` está correta
- Verificar que Python Agent está rodando (Web Service)
- Testar manualmente: `curl https://agente-saas-agent.onrender.com/api/health`

---

## Notas Importantes

1. **Python não é mais Background Worker**: Agora é Web Service HTTP (FastAPI)
2. **Worker Node.js é novo**: Precisa ser criado do zero
3. **REDIS_URL removido do Python**: Python não conhece Redis mais
4. **AGENT_PYTHON_URL obrigatória**: Worker precisa saber onde está o Python
5. **Custos aumentam**: +$7/mês por causa do novo worker

