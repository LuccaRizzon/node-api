# API de Gerenciamento de Vendas

API REST desenvolvida em Node.js com TypeScript para gerenciamento de vendas, incluindo criação, listagem, atualização e exclusão de vendas com seus respectivos itens.

## Tecnologias Utilizadas

- **Node.js** com **TypeScript**
- **Express.js** - Framework web
- **TypeORM** - ORM para banco de dados
- **MySQL** - Banco de dados relacional
- **Jest** - Framework de testes
- **Supertest** - Testes de integração
- **express-validator** - Validação e sanitização de entrada

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
DB_DATABASE=comercio
MYSQL_DATA_DIR=./mysqldata

# Configuração do Cache de Produtos
# TTL do cache em milissegundos (padrão: 300000 = 5 minutos)
PRODUCT_CACHE_TTL_MS=300000
```

### 4. Crie o banco de dados

#### Via Docker

```bash
docker-compose up -d
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

## Estrutura do Projeto

```
node-api/
├── src/
│   ├── __tests__/          # Testes automatizados (funcionais e de segurança)
│   ├── config/             # Configurações
│   ├── controller/         # Controladores (lógica de requisições)
│   ├── entity/             # Entidades do banco de dados
│   ├── middleware/         # Middlewares (validação)
│   ├── migration/          # Migrações do banco de dados
│   ├── routes/             # Rotas da API
│   ├── service/            # Lógica de negócio
│   ├── utils/              # Utilitários
│   └── validation/         # Regras de validação
├── .env.example            # Exemplo de variáveis de ambiente
├── docker-compose.yml      # Configuração Docker
├── jest.config.js          # Configuração Jest
├── package.json            # Dependências do projeto
└── tsconfig.json           # Configuração TypeScript
```

## Endpoints da API no postman collection de exemplo

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
- **Concluída**: Venda finalizada (não pode ser atualizada ou excluída)
- **Cancelada**: Venda cancelada

### Busca por Valor

- O endpoint `GET /vendas` suporta busca por valor através do parâmetro `search`
- A busca é realizada nos campos `codigo`, `nomeCliente` e `status` (case-insensitive)
- Exemplo: `GET /vendas?search=abc` busca por "abc" em qualquer um dos campos mencionados

## Segurança e OWASP

### Sobre OWASP

OWASP (Open Web Application Security Project) é uma organização sem fins lucrativos dedicada a melhorar a segurança de aplicações web. O projeto mantém o **OWASP Top 10**, uma lista dos 10 principais riscos de segurança em aplicações web, atualizada periodicamente.

Esta API implementa práticas de segurança baseadas no OWASP Top 10 2021, garantindo proteção contra vulnerabilidades comuns.

### Práticas de Segurança Implementadas

#### 1. Proteção contra Injeção (A03:2021 - Injection)

- **SQL Injection**: Validação de entrada com whitelist de caracteres, impedindo caracteres especiais SQL (`'`, `;`, `--`, etc.)
- **NoSQL Injection**: Validação rigorosa de tipos, impedindo objetos maliciosos em campos numéricos
- **Command Injection**: Rejeição de caracteres de shell (`|`, `&`, `;`, `` ` ``, `$()`)

#### 2. Controle de Acesso Quebrado (A01:2021 - Broken Access Control)

- Validação de IDs de parâmetros (apenas inteiros positivos válidos)
- Validação de status da venda (apenas valores permitidos: "Aberta", "Concluída", "Cancelada")
- Proteção contra acesso a recursos inexistentes ou inválidos

#### 3. Exposição de Dados Sensíveis (A03:2021 - Data Exposure)

- **Proteção contra Integer Overflow**: Validação de valores inteiros dentro do limite do MySQL INT (2,147,483,647)
- **Precisão Decimal**: Limitação de decimais a 2 casas para valores monetários
- Validação de limites de tamanho para strings

#### 4. Falhas de Identificação e Autenticação (A07:2021)

- Validação rigorosa de comprimento de strings:
  - `codigo`: máximo 50 caracteres
  - `nomeCliente`: máximo 100 caracteres
  - `search`: máximo 255 caracteres
- Validação de tipos de dados (string, integer, float)

#### 5. Proteção contra XSS (A03:2021 - Cross-Site Scripting)

- Rejeição de payloads XSS comuns (`<script>`, `javascript:`, `<img onerror>`, etc.)
- Whitelist de caracteres permitidos em campos de texto
- Sanitização automática de entrada

#### 6. Configuração Incorreta de Segurança (A05:2021)

- Validação de tipos de dados em todos os campos
- Validação de limites (boundary value testing)
- Rejeição de valores negativos onde não aplicável

#### 7. Falhas de Integridade de Software e Dados (A08:2021)

- Validação de arrays (tipo e conteúdo)
- Validação de parâmetros de query (datas ISO 8601, paginação)
- Validação de formato de datas

#### 8. Design Inseguro (A04:2021)

- **Sanitização de Entrada**: Remoção automática de espaços em branco no início e fim (trim)
- Rejeição de strings contendo apenas espaços em branco
- Normalização de dados antes do processamento

### Sanitização Aplicada

A API utiliza **express-validator** para sanitização e validação de entrada. As seguintes práticas são aplicadas:

1. **Trim Automático**: Espaços em branco são removidos automaticamente do início e fim de strings
2. **Whitelist de Caracteres**: Apenas caracteres alfanuméricos, espaços, hífens, underscores, pontos, vírgulas e acentos são permitidos em campos de texto
3. **Validação de Tipo**: Conversão e validação de tipos (string, integer, float) antes do processamento
4. **Limites de Tamanho**: Validação de comprimento máximo e mínimo para todos os campos
5. **Validação de Formato**: Datas devem estar no formato ISO 8601 (YYYY-MM-DD)
6. **Proteção de Overflow**: Validação de valores inteiros dentro dos limites do banco de dados

### Exemplo de Validação

```typescript
// Campos de string são automaticamente sanitizados:
"  VND-001  " → "VND-001" (trim aplicado)

// Caracteres inválidos são rejeitados:
"'; DROP TABLE vendas; --" → 400 Bad Request (caracteres SQL rejeitados)

// Valores fora dos limites são rejeitados:
produtoId: 2147483648 → 400 Bad Request (excede MySQL INT max)
```

## Testes

O projeto possui dois conjuntos de testes:

### Testes Funcionais

Testes que validam a funcionalidade da API, incluindo:
- Criação, listagem, atualização e exclusão de vendas
- Cálculo de totais e descontos
- Validações de regras de negócio
- Busca por valor
- Proteção contra atualização/exclusão de vendas concluídas

### Testes de Segurança (OWASP)

Suite completa de testes baseada nas práticas OWASP Top 10 2021, cobrindo:

- **A03:2021 - Injection**: Testes de SQL Injection, NoSQL Injection e Command Injection
- **A01:2021 - Broken Access Control**: Validação de IDs e parâmetros
- **A03:2021 - Data Exposure**: Proteção contra integer overflow e validação de precisão decimal
- **A07:2021 - Identification and Authentication Failures**: Validação de comprimento de strings
- **A03:2021 - XSS**: Rejeição de payloads XSS
- **A05:2021 - Security Misconfiguration**: Validação de tipos e boundary values
- **A08:2021 - Software and Data Integrity Failures**: Validação de arrays e parâmetros de query
- **A04:2021 - Insecure Design**: Testes de sanitização de entrada

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

Os testes de segurança estão localizados em `src/__tests__/venda.security.test.ts` e podem ser executados isoladamente para validação de segurança.

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
- `400` - Requisição inválida (validação de entrada)
- `404` - Recurso não encontrado
- `422` - Entidade não processável (regras de negócio, ex: venda concluída)
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
- Validação robusta de entrada com mensagens detalhadas usando `express-validator`
- Tratamento centralizado de erros
- Testes automatizados abrangentes (funcionais e de segurança)
- Suporte a transações no banco de dados
- Endpoints adicionais para atualização e exclusão de vendas
- Busca por valor em campos varchar
- Proteção contra atualização/exclusão de vendas concluídas
- Implementação de práticas OWASP Top 10 2021
- Sanitização automática de entrada
- Proteção contra SQL Injection, XSS, Command Injection e Integer Overflow
- Graceful shutdown para fechamento adequado de conexões

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
