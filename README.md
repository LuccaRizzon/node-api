# API de Vendas

Pequena API em Node.js/TypeScript para cadastrar vendas, seus itens e totais já calculados. Tudo roda com MySQL + TypeORM, cacheia produtos no Redis e expõe respostas no formato RFC 7807.

## Conteúdo
- Node.js, Express, TypeORM e MySQL
- Redis para cache de produtos (LRU + TTL, com fallback in-memory)
- `big.js` para dinheiro com floats
- Helmet, rate limiting e validações com `express-validator`
- Testes com Jest + Supertest (funcionais e de segurança)

## Como rodar
```bash
git clone ...
cd node-api
npm install
cp env.example .env         # ajuste suas variáveis
docker-compose up -d db redis  # ou a sua infra
npm run setup-db            # migra + seeds
npm run dev                 # http://localhost:3001
```

Scripts úteis:
- `npm run setup-db`: migrações + seed em um passo
- `npm run dev` / `npm start`: dev vs produção
- `npm test`: roda toda a suíte de testes (inclui cenários OWASP)

## Variáveis de ambiente
`env.example` lista tudo que a app lê. Principais:
- `PORT`, `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- `REDIS_URL` (ou `REDIS_DISABLED=true` nos testes)
- `PRODUCT_CACHE_TTL_MS`, `PRODUCT_CACHE_MAX_SIZE`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`

## Endpoints básicos
- `POST /vendas`: cria venda (código único, itens obrigatórios). Totais e descontos são recalculados automaticamente.
- `GET /vendas`: lista com filtros de período, busca full-text e paginação.
- `GET /vendas/:id`, `PUT /vendas/:id`, `DELETE /vendas/:id` (com regras para status).

Erros seguem RFC 7807. Duplicidade retorna `409 SALE_CODE_EXISTS`, validações falham com `400` ou `422`, e regras de negócio quebradas também respondem 422.

## Segurança e performance (resumo mesmo)
- Helmet, rate limiting e validação agressiva em toda entrada
- Nada de stack trace em produção
- Pool de conexões configurado no TypeORM
- Cache de produto com `ProductCache.getMany` evita N+1 em vendas grandes
- Índices de busca (`dataHora`, `status`, `codigo` e full-text) já migrados

## Testes
```bash
npm test              # tudo
npm run test:watch    # modo watch
```
Os testes checam cálculos monetários, regras de status, busca, duplicidade e payloads maliciosos (SQLi, XSS etc.).

---
Projeto feito para o desafio de backend de Vendas.
