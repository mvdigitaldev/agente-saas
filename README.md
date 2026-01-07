# Agente SaaS - WhatsApp IA para Salões de Beleza

SaaS multi-tenant com agente de IA no WhatsApp para salões de beleza.

## Arquitetura

- **Frontend**: Next.js (dashboard de configuração)
- **Backend**: NestJS (API + Agent IA integrado)
- **Banco**: Supabase (Postgres + Auth + Storage)
- **Fila**: Redis/BullMQ (Upstash em produção)
- **WhatsApp**: Uazapi
- **LLM**: OpenAI (GPT-4 via API)

## Estrutura do Monorepo

```
apps/
  web/          # Next.js Dashboard
  api/          # NestJS Backend (inclui Agent IA)

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

