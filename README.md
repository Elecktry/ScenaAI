# SCENA.AI

Aplicação Next.js para criação de projetos cinematográficos e geração/transformação de vídeos.

## Requisitos

- Node.js compatível com o projeto (Node 20.9+; Node 22 LTS é uma boa opção).
- PostgreSQL instalado e em execução localmente.
- npm.

## Configurar o PostgreSQL local

1. Instale o PostgreSQL para Windows pelo instalador oficial e anote a senha definida para o usuário `postgres`.
2. Abra o **SQL Shell (psql)** ou pgAdmin e crie o banco:

   ```sql
   CREATE DATABASE scena_ai;
   ```

   Se o banco já existir, não é necessário criá-lo novamente.

3. Na raiz do projeto, crie `.env.local` copiando `.env.example`.
4. Edite `DATABASE_URL` com os dados da sua instalação. Exemplo:

   ```env
   DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/scena_ai?schema=public"
   ```

   Substitua `SUA_SENHA` pela senha local. Se sua senha tiver caracteres especiais como `@`, `#`, `/` ou `:`, faça URL-encode desses caracteres.
5. Instale as dependências e gere o cliente Prisma:

   ```bash
   npm install
   npx prisma generate
   ```

6. Crie as tabelas pela primeira migração:

   ```bash
   npm run db:migrate -- --name init
   ```

7. Inicie o projeto:

   ```bash
   npm run dev
   ```

8. Para visualizar e editar registros durante o desenvolvimento:

   ```bash
   npm run db:studio
   ```

   O Prisma Studio abrirá uma interface local no navegador.

## Comandos Prisma

- `npm run db:generate` — gera o cliente TypeScript do Prisma.
- `npm run db:migrate -- --name nome_da_migracao` — cria e aplica uma migração de desenvolvimento.
- `npm run db:studio` — abre o Prisma Studio.

## Estrutura de dados inicial

- `Character`: nome, aparência, cabelo, roupas, personalidade, estilo visual e descrição visual para IA.
- `CharacterImage`: metadados e referência para imagens associadas ao personagem. O arquivo de imagem em si precisa ser salvo por uma camada de armazenamento; esta migração inicial guarda a referência/URL e os metadados.
- `User`: estrutura mínima reservada para futura autenticação. A aplicação ainda não implementa login; por isso, os personagens criados pela API ainda não são isolados por usuário.

## API de personagens (estrutura inicial)

- `GET /api/characters` — lista personagens e imagens associadas.
- `POST /api/characters` — cria um personagem. Envie JSON com `name` e, opcionalmente, `summary`, `appearance`, `hair`, `outfit`, `personality`, `visualStyle` e `visualPrompt`.
- `GET /api/characters/:id` — consulta um personagem.
- `PATCH /api/characters/:id` — atualiza campos de texto.
- `DELETE /api/characters/:id` — exclui um personagem e suas referências de imagem no banco.

Exemplo de criação:

```json
{
  "name": "Nico Vale",
  "appearance": "Personagem original, cabelo castanho ondulado e olhos verdes",
  "outfit": "Jaqueta azul-marinho, camiseta creme e calça cargo bege",
  "personality": "Curioso, inventivo e bem-humorado",
  "visualStyle": "Animação 3D cinematográfica"
}
```

## Segurança

- Nunca envie `.env.local` ou credenciais reais para o Git ou em arquivos compartilhados.
- `.env.local` é ignorado pelo Git.
- A estrutura `User` é preparatória: antes de disponibilizar a aplicação para várias pessoas, implemente autenticação e aplique autorização por usuário em todas as rotas de personagens.
- Não exponha `DATABASE_URL` no código executado pelo navegador.

## Observações

Esta etapa adiciona a base de dados e os endpoints de personagens. A interface do Character Studio, upload persistente de imagens e geração de imagens por IA são etapas seguintes; ainda não estão conectados a esses endpoints.
