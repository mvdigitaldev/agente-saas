# Configuração Upstash Redis - Documentação Oficial

## Formato Correto (Conforme Documentação)

Segundo a documentação oficial do Upstash:
- https://upstash.com/docs/redis/integrations/bullmq
- https://upstash.com/docs/redis/howto/connectclient

### Para BullMQ/ioredis:

```javascript
{
  host: "UPSTASH_REDIS_ENDPOINT",
  port: 6379,
  password: "UPSTASH_REDIS_PASSWORD",
  tls: {} // Obrigatório - objeto vazio
}
```

### Para URL string (ioredis):

```
rediss://:PASSWORD@HOST:PORT
```

**IMPORTANTE:**
- ❌ **NÃO** usar username
- ✅ **APENAS** password, host, port e tls
- ✅ Formato URL: `rediss://:TOKEN@host:6379` (dois pontos antes do password, sem username)

## Sua URL Atual

Você tem:
```
rediss://default:TOKEN@host:6379
```

**Problema:** O "default" não deve ser usado como username.

## Solução

O código agora:
1. Extrai apenas o password (ignora username "default")
2. Usa host, port, password e tls: {}
3. Não inclui username na configuração

## Verificação

Após reiniciar, os logs devem mostrar:
```
Redis config (Upstash - oficial): {
  host: 'fun-warthog-16886.upstash.io',
  port: 6379,
  hasPassword: true,
  passwordLength: 64,
  hasTLS: true
}
```

**Sem campo username!**

## Referências

- https://upstash.com/docs/redis/integrations/bullmq
- https://upstash.com/docs/redis/howto/connectclient
- https://github.com/context7/upstash-redis/blob/main/integrations/bullmq.md

