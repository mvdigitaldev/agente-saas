# Guia de Testes - Deploy Completo

Este documento descreve como testar os 3 serviços após o deploy:
1. **Frontend (Next.js)** - Vercel
2. **API (NestJS)** - Render
3. **Agent (Python)** - Render

---

## 📋 Checklist Pré-Teste

Antes de começar, verifique:

- [ ] Frontend está acessível na Vercel
- [ ] API está acessível no Render
- [ ] Agent está rodando no Render (Background Worker)
- [ ] Todas as variáveis de ambiente estão configuradas
- [ ] URLs estão atualizadas (FRONTEND_URL na API, NEXT_PUBLIC_API_URL no frontend)

---

## 1. Teste do Frontend (Vercel)

### 1.1 Acessar o Frontend

1. Abra a URL do frontend: `https://[seu-projeto].vercel.app`
2. Verifique se a página carrega sem erros
3. Abra o Console do navegador (F12) e verifique se não há erros

### 1.2 Teste de Autenticação

1. **Criar Conta:**
   - Acesse `/signup`
   - Preencha os dados:
     - Nome
     - Email
     - Senha (mínimo 6 caracteres)
     - Nome da Empresa
     - CNPJ (opcional)
   - Clique em "Criar Conta"
   - ✅ Verificar: Deve redirecionar para `/dashboard` ou mostrar mensagem de sucesso

2. **Login:**
   - Acesse `/login`
   - Digite email e senha
   - Clique em "Fazer login"
   - ✅ Verificar: Deve redirecionar para `/dashboard`

### 1.3 Teste do Dashboard

1. **Acessar Dashboard:**
   - Após login, verifique se o dashboard carrega
   - ✅ Verificar: Sidebar com menus, topbar com informações do usuário

2. **Navegação:**
   - Teste cada aba do menu:
     - Dashboard (página inicial)
     - Configuração
     - Integração (WhatsApp)
     - Serviços
     - Bloqueios

---

## 2. Teste da API (Render)

### 2.1 Health Check

```bash
# No terminal ou Postman/Insomnia
GET https://agente-saas-api.onrender.com/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-05T..."
}
```

✅ **Verificar:** Status 200 e resposta JSON válida

### 2.2 Teste de Autenticação (API)

```bash
# Criar conta
POST https://agente-saas-api.onrender.com/auth/signup
Content-Type: application/json

{
  "nome": "Teste User",
  "email": "teste@example.com",
  "password": "senha123",
  "empresa_nome": "Empresa Teste",
  "empresa_cnpj": "12.345.678/0001-90"
}
```

✅ **Verificar:** Status 201 ou 200, retorna `session` com tokens

```bash
# Login
POST https://agente-saas-api.onrender.com/auth/login
Content-Type: application/json

{
  "email": "teste@example.com",
  "password": "senha123"
}
```

✅ **Verificar:** Status 200, retorna `session` com tokens

### 2.3 Teste de Serviços (API)

```bash
# Listar serviços (precisa de token de autenticação)
GET https://agente-saas-api.onrender.com/services?empresa_id=SEU_EMPRESA_ID
Authorization: Bearer SEU_TOKEN_AQUI
```

✅ **Verificar:** Status 200, retorna array de serviços

```bash
# Criar serviço
POST https://agente-saas-api.onrender.com/services?empresa_id=SEU_EMPRESA_ID
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
  "nome": "Corte de Cabelo",
  "descricao": "Corte moderno",
  "preco": 50.00,
  "duracao_minutos": 30,
  "ativo": true,
  "available_online": true,
  "show_price_online": true,
  "fixed_price": true
}
```

✅ **Verificar:** Status 201, retorna serviço criado

### 2.4 Teste de Tools (API)

```bash
# Verificar se as tools estão acessíveis (precisa de X-Agent-API-Key)
GET https://agente-saas-api.onrender.com/scheduling/tools/list-staff?empresa_id=SEU_EMPRESA_ID
X-Agent-API-Key: SEU_AGENT_API_KEY
```

✅ **Verificar:** Status 200, retorna lista de funcionários

---

## 3. Teste do Agent (Render)

### 3.1 Verificar Status do Worker

1. No Dashboard do Render:
   - Acesse o serviço `agente-saas-agent`
   - Verifique os logs em tempo real
   - ✅ **Verificar:** Worker está rodando, sem erros críticos

### 3.2 Teste de Conexão com API

O agent deve conseguir se comunicar com a API. Verifique nos logs:

```
✅ Conexão com API estabelecida
✅ Redis conectado
✅ Supabase conectado
```

### 3.3 Teste de Processamento de Mensagens

1. **Enviar mensagem via WhatsApp:**
   - Use o WhatsApp conectado
   - Envie uma mensagem para o número do bot
   - ✅ **Verificar:** Mensagem aparece nos logs do agent

2. **Verificar processamento:**
   - Nos logs do agent, procure por:
     - "Processing message"
     - "Tool called: [nome da tool]"
     - "Response generated"
   - ✅ **Verificar:** Agent processa a mensagem e gera resposta

### 3.4 Teste de Tool Calling

Envie mensagens que acionem tools:

1. **Listar serviços:**
   ```
   "Quais serviços vocês oferecem?"
   ```
   - ✅ **Verificar:** Agent chama `list_services` e retorna lista

2. **Agendar:**
   ```
   "Quero agendar um corte de cabelo para amanhã às 14h"
   ```
   - ✅ **Verificar:** Agent chama `create_appointment` e confirma agendamento

3. **Verificar pagamento:**
   ```
   "Qual o status do pagamento da reserva X?"
   ```
   - ✅ **Verificar:** Agent chama `check_payment_status` e retorna status

---

## 4. Teste de Integração Completa

### 4.1 Fluxo Completo: Criar Serviço → Agendar → Verificar

1. **No Frontend:**
   - Login
   - Ir em "Serviços"
   - Criar um novo serviço
   - ✅ **Verificar:** Serviço aparece na lista

2. **Via WhatsApp:**
   - Enviar: "Quais serviços vocês têm?"
   - ✅ **Verificar:** Bot responde com o serviço criado

3. **Agendar:**
   - Enviar: "Quero agendar [nome do serviço] para amanhã às 15h"
   - ✅ **Verificar:** Bot confirma agendamento

4. **Verificar no Frontend:**
   - Ir em "Agendamentos" (se houver)
   - ✅ **Verificar:** Agendamento aparece na lista

### 4.2 Teste de Upload de Imagens

1. **No Frontend:**
   - Editar um serviço
   - Fazer upload de imagens
   - ✅ **Verificar:** Imagens aparecem no preview
   - Salvar
   - ✅ **Verificar:** Imagens são salvas e aparecem no serviço

2. **Verificar Storage:**
   - As imagens devem estar no Supabase Storage
   - ✅ **Verificar:** URLs das imagens são válidas e acessíveis

---

## 5. Teste de Erros e Edge Cases

### 5.1 Teste de CORS

```bash
# No navegador, abra o Console (F12)
# Tente fazer uma requisição direta para a API
fetch('https://agente-saas-api.onrender.com/health')
```

✅ **Verificar:** Requisição funciona (CORS configurado corretamente)

### 5.2 Teste de Autenticação Inválida

```bash
GET https://agente-saas-api.onrender.com/services?empresa_id=123
# Sem token
```

✅ **Verificar:** Status 401 (Unauthorized)

### 5.3 Teste de Agent API Key Inválida

```bash
GET https://agente-saas-api.onrender.com/scheduling/tools/list-staff?empresa_id=123
X-Agent-API-Key: token-invalido
```

✅ **Verificar:** Status 401 (Unauthorized)

### 5.4 Teste de Timeout

- Envie uma mensagem muito longa ou complexa
- ✅ **Verificar:** Agent responde dentro do tempo limite (ou retorna erro apropriado)

---

## 6. Verificação de Logs

### 6.1 Logs do Frontend (Vercel)

1. Acesse o Dashboard da Vercel
2. Vá em "Deployments" → Selecione o último deploy
3. Clique em "View Function Logs"
4. ✅ **Verificar:** Sem erros críticos

### 6.2 Logs da API (Render)

1. No Dashboard do Render
2. Acesse o serviço `agente-saas-api`
3. Vá em "Logs"
4. ✅ **Verificar:** 
   - Health check respondendo
   - Requisições sendo processadas
   - Sem erros 500

### 6.3 Logs do Agent (Render)

1. No Dashboard do Render
2. Acesse o serviço `agente-saas-agent`
3. Vá em "Logs"
4. ✅ **Verificar:**
   - Worker iniciado com sucesso
   - Conexões estabelecidas (Redis, Supabase, API)
   - Mensagens sendo processadas
   - Tools sendo chamadas corretamente

---

## 7. Teste de Performance

### 7.1 Tempo de Resposta da API

```bash
# Teste com curl ou ferramenta similar
time curl https://agente-saas-api.onrender.com/health
```

✅ **Verificar:** Resposta em menos de 2 segundos (primeira requisição pode ser mais lenta devido ao cold start)

### 7.2 Tempo de Resposta do Frontend

1. Abra o DevTools (F12) → Network
2. Recarregue a página
3. ✅ **Verificar:** Página carrega em menos de 3 segundos

### 7.3 Tempo de Processamento do Agent

- Envie uma mensagem simples
- Meça o tempo até receber resposta
- ✅ **Verificar:** Resposta em menos de 10 segundos (pode variar com complexidade)

---

## 8. Checklist Final

- [ ] Frontend acessível e funcionando
- [ ] Login e Signup funcionando
- [ ] Dashboard carregando corretamente
- [ ] API health check respondendo
- [ ] Autenticação na API funcionando
- [ ] CRUD de serviços funcionando
- [ ] Upload de imagens funcionando
- [ ] Agent rodando e processando mensagens
- [ ] Tools sendo chamadas corretamente
- [ ] Integração WhatsApp funcionando
- [ ] Logs sem erros críticos
- [ ] Performance aceitável

---

## 9. Problemas Comuns e Soluções

### Problema: Frontend não carrega
- **Solução:** Verificar variáveis de ambiente na Vercel, especialmente `NEXT_PUBLIC_API_URL`

### Problema: API retorna 500
- **Solução:** Verificar logs no Render, verificar variáveis de ambiente (Supabase, Redis)

### Problema: Agent não processa mensagens
- **Solução:** Verificar conexão com Redis, verificar `NEST_API_URL` e `AGENT_API_KEY`

### Problema: CORS errors
- **Solução:** Verificar `FRONTEND_URL` na API está correto (deve ser a URL da Vercel)

### Problema: Tools não funcionam
- **Solução:** Verificar `AGENT_API_KEY` está igual na API e no Agent

---

## 10. URLs para Testes Rápidos

Substitua `[seu-projeto]` e `[seu-servico]` pelas URLs reais:

- **Frontend:** `https://[seu-projeto].vercel.app`
- **API Health:** `https://[seu-servico-api].onrender.com/health`
- **API Services:** `https://[seu-servico-api].onrender.com/services?empresa_id=XXX`

---

## 11. Próximos Passos Após Testes

Se todos os testes passarem:

1. ✅ Documentar URLs finais
2. ✅ Configurar domínio customizado (opcional)
3. ✅ Configurar monitoramento (opcional)
4. ✅ Configurar alertas (opcional)
5. ✅ Fazer backup das configurações

---

**Boa sorte com os testes! 🚀**

