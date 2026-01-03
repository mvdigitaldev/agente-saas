# Exemplo Completo: Toggle ask_for_pix

Este documento demonstra o fluxo completo do toggle `ask_for_pix` quando está ON vs OFF.

## 1. Banco de Dados

A tabela `agent_features` armazena o estado do toggle:

```sql
SELECT ask_for_pix FROM agent_features WHERE empresa_id = 'xxx';
```

- `true`: Agente deve oferecer link Pix após agendamento
- `false`: Agente confirma agendamento sem cobrança

## 2. Frontend (Next.js)

**Arquivo:** `apps/web/app/(dashboard)/configuracao/page.tsx`

O usuário pode ativar/desativar o toggle:

```typescript
<label>
  <input
    type="checkbox"
    checked={features.ask_for_pix}
    onChange={(e) => handleToggleFeature('ask_for_pix', e.target.checked)}
  />
  Pedir Pix após agendamento
</label>
```

Quando o toggle é alterado, chama:
```
PATCH /agent-config/{empresa_id}/features
Body: { ask_for_pix: true/false }
```

## 3. Backend (NestJS)

**Arquivo:** `apps/api/src/modules/scheduling/scheduling.service.ts`

O endpoint `/tools/payment-link` verifica o toggle antes de criar o link:

```typescript
async createPaymentLink(dto: PaymentLinkDto) {
  // Verificar se ask_for_pix está habilitado
  const { data: features } = await db
    .from('agent_features')
    .select('ask_for_pix')
    .eq('empresa_id', dto.empresa_id)
    .single();

  if (!features?.ask_for_pix) {
    throw new BadRequestException('ask_for_pix está desabilitado para esta empresa');
  }

  // Criar link de pagamento...
}
```

## 4. Agente Python

**Arquivo:** `apps/agent/app/agent/router.py`

O agente carrega as features e adapta o comportamento:

### 4.1 System Prompt

```python
def _build_system_prompt(self, config: dict, features: dict, summary: str, lt_memory: list):
    prompt = f"""...
Features habilitadas:
- ask_for_pix: {features.get('ask_for_pix', False)}

IMPORTANTE: Se ask_for_pix estiver False, NUNCA chame create_payment_link. 
Apenas confirme o agendamento sem cobrança.
"""
```

### 4.2 Tool Execution

```python
async def _execute_tool(self, tool_name: str, args: dict, ...):
    if tool_name == "create_appointment":
        result = await nest_client.create_appointment(...)
        
        # Se ask_for_pix estiver ON, criar link de pagamento
        if features.get("ask_for_pix") and result.get("appointment_id"):
            payment_link = await nest_client.create_payment_link(...)
            result["payment_link"] = payment_link
        
        return result
    
    elif tool_name == "create_payment_link":
        # Verificar se ask_for_pix está habilitado
        if not features.get("ask_for_pix"):
            return {"error": "ask_for_pix está desabilitado"}
        # ...
```

## 5. Fluxo Completo

### Cenário 1: ask_for_pix = ON

1. Cliente: "Quero agendar corte de cabelo amanhã às 14h"
2. Agente processa mensagem
3. Agente identifica intenção: scheduling
4. Agente chama `get_available_slots`
5. Agente chama `create_appointment`
6. **Como ask_for_pix = ON:**
   - Agente chama `create_payment_link`
   - Link Pix é criado
7. Agente responde: "Agendado! Seu link Pix: https://payment.example.com/link/123"

### Cenário 2: ask_for_pix = OFF

1. Cliente: "Quero agendar corte de cabelo amanhã às 14h"
2. Agente processa mensagem
3. Agente identifica intenção: scheduling
4. Agente chama `get_available_slots`
5. Agente chama `create_appointment`
6. **Como ask_for_pix = OFF:**
   - Agente NÃO chama `create_payment_link`
   - LLM recebe instrução no system prompt para não oferecer Pix
7. Agente responde: "Agendado para amanhã às 14h! Te vejo lá!"

## 6. Validação

Para testar:

1. **Frontend:** Ativar/desativar toggle em `/dashboard/configuracao`
2. **Banco:** Verificar `agent_features.ask_for_pix`
3. **Agente:** Enviar mensagem de agendamento via WhatsApp
4. **Resultado:** Verificar se link Pix é oferecido ou não conforme o toggle

## 7. Segurança

- Backend valida toggle antes de criar link (não confia apenas no agente)
- Agente lê toggle do banco a cada mensagem (não cacheia)
- RLS garante que apenas usuários da empresa podem alterar o toggle

