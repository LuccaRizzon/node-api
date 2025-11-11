# API de Gerenciamento de Vendas

API REST desenvolvida em Node.js com TypeScript para gerenciamento de vendas, incluindo criação, listagem, atualização e exclusão de vendas com seus respectivos itens.

## Tecnologias Utilizadas

- **Node.js** com **TypeScript**
- **Express.js** - Framework web
- **TypeORM** - ORM para banco de dados
- **MySQL** - Banco de dados relacional
- **Jest** - Framework de testes
- **Supertest** - Testes de integração

## Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn
- MySQL ou MariaDB (versão 5.7 ou superior)
- Git

## Instalação

### 1. Clone o repositório

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Configuração do Banco de Dados
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=sua_senha
DB_DATABASE=lucca

# Configuração do Cache de Produtos
# TTL do cache em milissegundos (padrão: 300000 = 5 minutos)
PRODUCT_CACHE_TTL_MS=300000
```

### 4. Crie o banco de dados

Crie o banco de dados MySQL:

```sql
CREATE DATABASE lucca;
```

### 5. Execute as migrações

Execute as migrações para criar as tabelas:

```bash
npm run migration:run
```

### 6. Popule o banco com dados iniciais (opcional)

Execute o seed para criar produtos iniciais para testes:

```bash
npm run seed
```

Isso criará 10 produtos de exemplo na tabela `produtos` que você pode usar para testar a criação de vendas.

## Executando o Projeto

### Modo Desenvolvimento

```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3001`

### Modo Produção

```bash
npm start
```

## Executando com Docker

### 1. Inicie o banco de dados MySQL

```bash
docker-compose up -d
```

### 2. Execute as migrações

```bash
npm run migration:run
```

### 3. Popule o banco com dados iniciais (opcional)

```bash
npm run seed
```

### 4. Inicie a aplicação

```bash
npm run dev
```

## Estrutura do Projeto

```
node-api/
├── src/
│   ├── __tests__/          # Testes automatizados
│   ├── config/             # Configurações
│   ├── controller/         # Controladores (lógica de requisições)
│   ├── entity/             # Entidades do banco de dados
│   ├── migration/          # Migrações do banco de dados
│   ├── routes/             # Rotas da API
│   ├── service/             # Lógica de negócio
│   └── utils/              # Utilitários
├── .env.example            # Exemplo de variáveis de ambiente
├── docker-compose.yml      # Configuração Docker
├── jest.config.js          # Configuração Jest
├── package.json            # Dependências do projeto
└── tsconfig.json           # Configuração TypeScript
```

## Endpoints da API

### Base URL

```
http://localhost:3001/vendas
```

### 1. Criar Venda

**POST** `/vendas`

Cria uma nova venda com seus itens.

**Body:**
```json
{
  "codigo": "VND-001",
  "nomeCliente": "João Silva",
  "descontoVenda": 50.00,
  "status": "Aberta",
  "itens": [
    {
      "produtoId": 1,
      "quantidade": 2,
      "precoUnitario": 100.00,
      "descontoItem": 0
    }
  ]
}
```

**Resposta (201):**
```json
{
  "id": 1,
  "codigo": "VND-001",
  "dataHora": "2024-01-15T10:30:00.000Z",
  "nomeCliente": "João Silva",
  "descontoVenda": 50.00,
  "valorTotal": 150.00,
  "status": "Aberta",
  "itens": [...]
}
```

### 2. Listar Vendas

**GET** `/vendas`

Lista vendas com filtros opcionais e paginação.

**Query Parameters:**
- `dataInicio` (opcional): Data inicial no formato YYYY-MM-DD
- `dataFim` (opcional): Data final no formato YYYY-MM-DD
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 10)

**Exemplo:**
```
GET /vendas?dataInicio=2024-01-01&dataFim=2024-01-31&page=1&limit=10
```

**Resposta (200):**
```json
{
  "vendas": [...],
  "paginacao": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  },
  "totalizadores": {
    "valorTotal": 50000.00,
    "numeroVendas": 50,
    "quantidadeItens": 150
  }
}
```

### 3. Buscar Venda por ID

**GET** `/vendas/:id`

Retorna uma venda específica pelo ID.

**Resposta (200):**
```json
{
  "id": 1,
  "codigo": "VND-001",
  "dataHora": "2024-01-15T10:30:00.000Z",
  "nomeCliente": "João Silva",
  "descontoVenda": 50.00,
  "valorTotal": 150.00,
  "status": "Aberta",
  "itens": [...]
}
```

### 4. Atualizar Venda

**PUT** `/vendas/:id`

Atualiza uma venda existente.

**Body:**
```json
{
  "codigo": "VND-001-UPDATED",
  "nomeCliente": "João Silva Atualizado",
  "status": "Concluída",
  "itens": [...]
}
```

**Resposta (200):**
```json
{
  "id": 1,
  "codigo": "VND-001-UPDATED",
  ...
}
```

### 5. Deletar Venda

**DELETE** `/vendas/:id`

Remove uma venda do sistema.

**Resposta (204):** Sem conteúdo

## Regras de Negócio

### Cálculo de Totais

- O sistema calcula automaticamente os totais da venda e dos itens
- O valor total de cada item é calculado como: `(quantidade * precoUnitario) - descontoItem`
- O valor total da venda é a soma dos valores totais dos itens

### Lógica de Desconto

- **Desconto na Venda**: Se informado `descontoVenda`, o valor é rateado proporcionalmente entre os itens baseado no valor de cada item
- **Desconto nos Itens**: Se informado `descontoItem` nos itens, o `descontoVenda` é calculado como a soma dos descontos dos itens

### Validações

- O código da venda deve ser único
- O ID do produto deve existir no banco de dados
- Campos obrigatórios: `codigo`, `nomeCliente`, `itens`
- Cada item deve ter: `produtoId`, `quantidade`, `precoUnitario`

### Status da Venda

- **Aberta**: Venda em andamento
- **Concluída**: Venda finalizada
- **Cancelada**: Venda cancelada

## Testes

Execute os testes com:

```bash
npm test
```

Execute os testes em modo watch:

```bash
npm run test:watch
```

Execute os testes com cobertura:

```bash
npm run test:coverage
```

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor em modo desenvolvimento com hot-reload
- `npm start` - Inicia o servidor em modo produção
- `npm test` - Executa os testes
- `npm run test:watch` - Executa os testes em modo watch
- `npm run test:coverage` - Executa os testes com relatório de cobertura
- `npm run migration:generate` - Gera uma nova migração
- `npm run migration:run` - Executa as migrações pendentes
- `npm run migration:revert` - Reverte a última migração
- `npm run migration:show` - Mostra o status das migrações
- `npm run seed` - Popula o banco de dados com produtos iniciais para testes

## Códigos de Status HTTP

- `200` - Sucesso (GET, PUT)
- `201` - Criado com sucesso (POST)
- `204` - Sem conteúdo (DELETE)
- `400` - Requisição inválida
- `404` - Recurso não encontrado
- `500` - Erro interno do servidor

## Mensagens de Erro

Todas as mensagens de erro são retornadas em inglês no seguinte formato:

```json
{
  "error": "Mensagem de erro descritiva"
}
```

## Melhorias Implementadas

- Sistema de cache para produtos com TTL configurável
- Validação robusta de entrada com mensagens detalhadas
- Tratamento centralizado de erros
- Testes automatizados abrangentes
- Suporte a transações no banco de dados
- Endpoints adicionais para atualização e exclusão de vendas

## Estrutura do Banco de Dados

### Tabela: vendas
- `id` (PK, auto-incremento)
- `codigo` (único, indexado)
- `dataHora` (timestamp automático)
- `nomeCliente`
- `descontoVenda`
- `valorTotal`
- `status` (enum: Aberta, Concluída, Cancelada)

### Tabela: venda_itens
- `id` (PK, auto-incremento)
- `venda_id` (FK para vendas, CASCADE)
- `produto_id` (FK para produtos, RESTRICT)
- `quantidade`
- `precoUnitario`
- `descontoItem`
- `valorTotal`

### Tabela: produtos
- `id` (PK, auto-incremento)
- `nome`
- `preco`

## Suporte

Para dúvidas ou problemas, entre em contato através do email: patrick@domagestao.com.br

## Licença

Este projeto foi desenvolvido como teste técnico.
