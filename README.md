# Agente SaaS - WhatsApp IA para Salões de Beleza

SaaS multi-tenant com agente de IA no WhatsApp para salões de beleza.

## Arquitetura

- **Frontend**: Next.js (dashboard de configuração)
- **Backend**: NestJS (API + orquestração)
- **Agente IA**: Python (processamento de mensagens + memória)
- **Banco**: Supabase (Postgres + Auth + Storage)
- **Fila**: Redis/BullMQ (Upstash em produção)
- **WhatsApp**: Uazapi

## Estrutura do Monorepo

```
apps/
  web/          # Next.js Dashboard
  api/          # NestJS Backend
  agent/        # Python Agent

packages/
  shared/       # Types compartilhados
```

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar tudo (Docker Compose)
docker-compose up

# Ou rodar individualmente
npm run dev
```

## Variáveis de Ambiente

Ver `.env.example` em cada app para configurações necessárias.

