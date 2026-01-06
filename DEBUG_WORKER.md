# Debug: Worker não está processando jobs

## Problemas Possíveis

### 1. Worker não está recebendo jobs

**Verificar:**
- Logs do worker mostram `🔄 Job X ativado`?
- Se não, o problema está na conexão Redis ou na fila

### 2. API não está enfileirando jobs

**Verificar:**
- Logs da API mostram que `enqueueProcessMessage` foi chamado?
- Verificar logs da API quando mensagem chega

### 3. Redis Cloud - Configuração

**IMPORTANTE:** No Redis Cloud, você NÃO precisa fazer nada especial. O BullMQ funciona automaticamente.

**Verificar:**
- `REDIS_URL` está correta no Worker?
- `REDIS_URL` está correta na API?
- Mesma `REDIS_URL` em ambos?

### 4. Nome da fila

**Verificar:**
- API enfileira em: `process-inbound-message` ✅
- Worker escuta: `process-inbound-message` ✅
- Ambos devem ser **idênticos**

## Como Debuggar

### Passo 1: Verificar logs do Worker

Quando você manda uma mensagem, verifique os logs do `agente-saas-worker`:

**Se aparecer:**
```
🔄 Job X ativado - começando processamento
```
→ Worker está recebendo jobs ✅

**Se NÃO aparecer nada:**
→ Worker não está recebendo jobs ❌
→ Problema: Redis ou fila

### Passo 2: Verificar logs da API

Quando você manda uma mensagem, verifique os logs da `agente-saas-api`:

**Deve aparecer:**
- Log de webhook recebido
- Log de `enqueueProcessMessage` chamado
- Sem erros relacionados a BullMQ

### Passo 3: Verificar Redis Cloud

1. Acesse seu Redis Cloud
2. Use o Redis CLI ou interface web
3. Verifique se há chaves com prefixo `bull:process-inbound-message:`
4. Se houver chaves, os jobs estão sendo enfileirados ✅
5. Se não houver, a API não está enfileirando ❌

### Passo 4: Testar conexão Redis no Worker

O worker agora tem logs mais detalhados:
- `✅ Redis conectado`
- `✅ Redis pronto para uso`

Se aparecer `❌ Erro Redis`, o problema é a conexão.

## Comandos Úteis

### Verificar jobs na fila (Redis CLI)

```bash
# Conectar ao Redis
redis-cli -u YOUR_REDIS_URL

# Listar chaves do BullMQ
KEYS bull:process-inbound-message:*

# Ver jobs na fila de espera
LRANGE bull:process-inbound-message:wait 0 -1

# Ver jobs ativos
LRANGE bull:process-inbound-message:active 0 -1
```

## Próximos Passos

1. **Adicionar logs na API** para confirmar que está enfileirando
2. **Verificar logs do worker** quando mensagem chega
3. **Verificar Redis Cloud** para ver se jobs estão sendo criados
4. **Comparar REDIS_URL** entre API e Worker (devem ser idênticos)

