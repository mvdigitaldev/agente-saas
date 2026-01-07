# Correção: Configuração Redis Cloud SSL

## Problema

Erro SSL na API NestJS:
```
ERR_SSL_WRONG_VERSION_NUMBER
```

## Causa

O Redis Cloud requer SSL (`rediss://`), mas a configuração TLS não estava completa.

## Solução

### ✅ URL CORRETA

Use **exatamente** esta URL (com `rediss://` e `default:password`):

```
rediss://default:iwBfObDwEPfqsMBxTKTrOShDR8Dq5Nl0@redis-16157.crce216.sa-east-1-2.ec2.cloud.redislabs.com:16157
```

**IMPORTANTE:**
- ✅ `rediss://` (com 2 S) = SSL/TLS obrigatório
- ✅ `default:` como username (Redis Cloud padrão)
- ✅ Porta: `16157` (porta SSL do Redis Cloud)
- ❌ NÃO use `redis://` (sem SSL) - vai dar erro

### Configuração Aplicada

A configuração agora inclui:
- `servername` para SNI (Server Name Indication)
- `checkServerIdentity: () => undefined` para aceitar certificado
- `rejectUnauthorized: false` para certificados auto-assinados

## Webhook UAZAPI

### ✅ URL CORRETA

```
https://agente-saas-api.onrender.com/webhook/uazapi?instance_id=r184feffa4f9a60
```

**IMPORTANTE:**
- ✅ Use `https://` (Render fornece SSL automático)
- ✅ Substitua `instance_id` pelo ID real da instância
- ✅ A rota `/webhook/uazapi` deve estar configurada no NestJS

## Checklist

### API NestJS

- [ ] `REDIS_URL` configurada com `rediss://default:password@host:port`
- [ ] Formato exato: `rediss://default:IwBfObDwEPfqsMBxTKTrOShDR8Dq5Nl0@redis-16157.crce216.sa-east-1-2.ec2.cloud.redislabs.com:16157`
- [ ] Verificar logs - não deve mais aparecer erro SSL

### Worker Node.js

- [ ] `REDIS_URL` **idêntica** à da API
- [ ] Mesmo formato: `rediss://default:password@host:port`
- [ ] Verificar logs - deve conectar sem erros

### Webhook UAZAPI

- [ ] URL completa: `https://agente-saas-api.onrender.com/webhook/uazapi?instance_id=XXX`
- [ ] Substituir `XXX` pelo `instance_id` real
- [ ] Verificar que a rota `/webhook/uazapi` existe no NestJS

## Teste

1. **API NestJS:**
   - Verificar logs - não deve aparecer erro SSL
   - Testar health check: `https://agente-saas-api.onrender.com/health`

2. **Worker:**
   - Verificar logs - deve mostrar `✅ Redis conectado`
   - Deve mostrar `✅ Redis pronto para uso`

3. **Webhook:**
   - Enviar mensagem via WhatsApp
   - Verificar logs da API - deve receber webhook
   - Verificar logs do Worker - deve processar job

