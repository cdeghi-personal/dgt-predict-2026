# DGT Predict 2026 — Contexto do Projeto

## O que é este projeto

App web (Next.js) de bolão da Copa do Mundo FIFA 2026 para os funcionários da **DGT Consultoria**.
Backend: plataforma BPM **SYDLE ONE** — expõe REST API para todos os dados.
Deploy: **Vercel** (conectado ao GitHub, deploy automático no push para `main`).

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** — utilitários; paleta customizada em `tailwind.config.ts`
- **date-fns** — formatação de datas (locale `ptBR`)
- **clsx** — composição de classes condicionais

## Integração SYDLE ONE

### Endpoint padrão

Autenticação via GET com Basic auth; chamadas de negócio via POST:

```
GET  https://<org>.sydle.one/api/1/<app>/sys/auth/signIn
POST https://<org>.sydle.one/api/1/<app>/<pacote>/<classe>/<metodo>
```

### Headers obrigatórios

```
Authorization: Bearer <token>          ← chamadas de negócio
Authorization: Basic base64(login:pwd) ← signIn
X-Explorer-Account-Token: <org>
Content-Type: application/json
```

### `_update` — método preferido para escrita

Usar `_update` com o objeto completo para todas as atualizações:

```ts
sydleCall(pkg, cls, '_update', {
  _id: objectId,
  field1: value1,
  field2: value2,
  // todos os campos necessários
}, token)
```

**Atenção:** `_patch` aceita a requisição e retorna 200 mas **não persiste** os dados de forma confiável nesta aplicação. Todo código novo deve usar `_update` com busca prévia do objeto quando necessário. Nunca enviar campos diretos em `_patch` sem `_operationsList`, e mesmo com `_operationsList` preferir `_update`.

### Identificador da aplicação

`dgtPredict` — deve estar criado no painel SYDLE ONE do org configurado.
Se não existir, todas as chamadas retornam 401 (inclusive login).

### Classes SYDLE em uso

| Pacote | Classe | Descrição |
|---|---|---|
| `predict2026` | `paises` | Países com bandeira |
| `predict2026` | `game` | Jogos (partidas) |
| `predict2026` | `results` | Resultados reais |
| `predict2026` | `guesses` | Palpites dos usuários |

### Variáveis de ambiente (obrigatórias)

```env
SYDLE_ORG=dgt-consultoria          # org de produção
SYDLE_APP=dgtPredict               # identificador da aplicação
SYDLE_PACKAGE=predict2026          # pacote das classes
ADMIN_LOGINS=login@dgt.com.br      # logins admin separados por vírgula
```

Arquivo local: `.env.local` (não versionado).
**No Vercel**: configurar em Settings → Environment Variables + fazer Redeploy.

### Respostas de busca

Padrão Elasticsearch. Acessar via `parseSearch<T>(raw)` ou manualmente:
```ts
json['hits']['hits'][i]['_source']
```

## Autenticação

Fluxo: `GET /sys/auth/signIn` → token JWT → armazenado em `localStorage` via `AuthContext`.
- `AuthContext` provê `user`, `login()`, `logout()`, `isAuthenticated`
- `user.isAdmin` baseado em `ADMIN_LOGINS`
- Token expirado → redirect para `/login`

## Design System

### Paleta de cores (tailwind.config.ts)

```
primary    = #FCB017  amarelo — botões principais, destaques
secondary  = #FED402  amarelo secundário
dark       = #3A3A3A  headers, textos principais
mid-gray   = #787878  subtítulos, labels secundários
light-gray = #D3D3D3  bordas, placeholders
background = #F5F5F5  fundo geral
surface    = #FFFFFF  cards
```

### Logo DGT

Arquivos em `/public/`:
- `/logo-dgt.png` — versão padrão (fundo claro)
- `/logo-dgt-dark.png` — versão para fundo escuro

**NUNCA usar `/assets/logo-dgt.png`** — esse caminho não existe.

### Botão primário

```tsx
<Button variant="primary">   // fundo #FCB017, texto dark
<Button variant="secondary"> // outline escuro
```

## Componentes chave

### `MatchCard` (`src/components/features/MatchCard.tsx`)

- `guess` existente + jogo não finalizado → link discreto `✏️ alterar` dentro da coluna central (abaixo de "seu palpite"), **não** botão full-width no rodapé
- Jogo sem palpite → botão amarelo `⚽ Dar Palpite` full-width
- `onViewGuesses?: () => void` — quando fornecido e `isGuessingClosed`, exibe botão "👥 Ver palpites dos participantes" abaixo do CTA principal
- **Atenção**: `guess.points` é `null` por padrão (não vem do SYDLE). Calcular antes de passar:

```tsx
const raw = guessMap.get(match.id) ?? null
const guess = raw && match.status === 'FINISHED' && match.scoreCountry1 != null && match.scoreCountry2 != null
  ? { ...raw, points: calculatePoints(raw.result1, raw.result2, match.scoreCountry1, match.scoreCountry2).points }
  : raw
```

Aplicar isso em **todas as páginas** que renderizam `MatchCard` (jogos, dashboard).
O badge `+N pts` só aparece quando `guess.points != null && isFinished`.

### `GuessForm` (`src/components/features/GuessForm.tsx`)

Formulário modal para registrar/alterar palpite. Recebe `match` + `existingGuess`.
Campos de placar iniciam **vazios (null)** para novos palpites — validação impede submit com campos em branco.

### `MatchGuessesModal` (`src/components/features/MatchGuessesModal.tsx`)

Bottom sheet (mobile) / modal centralizado (desktop) que exibe os palpites de todos os participantes de uma partida após o fechamento do jogo. Recebe `match`, `isOpen`, `onClose`. Busca via `GET /api/matches/[id]/guesses`. Exibe avatar especial + badge "IA DGT" para a Daisy. Se o jogo ainda não fechou, mostra estado bloqueado (não faz a chamada).

### `RankingTable` (`src/components/features/RankingTable.tsx`)

Tabela de ranking com medalhas para top 3. `topOnly` limita o número de linhas.

### `LastGamesDots` (classificacao/page.tsx)

**Total fixo = 3** (fase de grupos tem 3 jogos por time). Não alterar para 5.

## Scoring (`src/lib/utils/scoring.ts`)

```ts
calculatePoints(guess1, guess2, actual1, actual2): ScoreResult
// Placar exato: 10 pts | Resultado correto: 5 pts | Errou: 0 pts
```

## Tipos principais (`src/lib/types.ts`)

### `MatchPhase`
```ts
type MatchPhase = 'grupos' | 'oitavas' | 'quartas' | 'semifinais' | 'finais'
```

### `Match`
- `status: 'SCHEDULED' | 'FINISHED'` — FINISHED quando `resultId != null`
- `scoreCountry1/2: number | null` — null = sem resultado ainda
- `group: string` — vazio em mata-mata

### `Guess`
- `points: number | null` — **não vem do SYDLE**, calcular em runtime

## Tela de Classificação (`src/app/(app)/classificacao/page.tsx`)

Suporta **dois modos automáticos**:

1. **Fase de grupos** — tabela de classificação por grupo (quando há jogos com `phase === 'grupos'`)
2. **Fase eliminatória** — cards de confronto por fase (oitavas → quartas → semifinais → finais), renderizados automaticamente quando jogos dessas fases existirem no SYDLE

Nenhuma mudança de código necessária para ativar a fase eliminatória — basta cadastrar os jogos no SYDLE com o `phase` correto.

## Estrutura de pastas

```
src/
  app/
    login/page.tsx                      # Tela de login (fundo dark, logo DGT)
    (app)/
      layout.tsx                        # Shell com BottomNav
      dashboard/page.tsx                # Hero + próximos jogos + card Daisy + ranking
      jogos/page.tsx                    # Lista de jogos com filtro de fase
      meus-palpites/page.tsx            # Histórico de palpites do usuário
      classificacao/page.tsx            # Grupos + fase eliminatória
      ranking/page.tsx                  # Ranking completo (Daisy em roxo)
      perfil/page.tsx                   # Perfil do usuário
      regras/page.tsx                   # Regras do bolão
      daisy/
        page.tsx                        # Lista de entradas do Diário da Daisy
        [id]/page.tsx                   # Leitura de uma entrada do diário
      admin/
        resultados/page.tsx             # Admin: lançar resultados
        auditoria/page.tsx              # Admin: histórico de alterações
        daisy/page.tsx                  # Admin: gerar e gerenciar diário da Daisy
  api/
    daisy/
      diary/route.ts                    # GET → lista entradas ativas (autenticado)
      diary/[id]/route.ts               # GET → entrada por ID
    admin/
      daisy/route.ts                    # GET (todos) / PATCH (toggle ativo) — admin
      daisy/test-ai/route.ts            # POST — testa conexão OpenAI, retorna DaisyAITestResult
      daisy/generate-diary/route.ts     # POST — gera diário completo, retorna GenerateDiaryResult
  components/
    features/
      MatchCard.tsx                     # Card de jogo (com/sem palpite, com botão "Ver palpites" pós-fechamento)
      GuessForm.tsx                     # Formulário de palpite (placar inicia vazio, valida antes de enviar)
      MatchGuessesModal.tsx             # Modal de palpites dos participantes (bloqueado se jogo aberto)
      CountryFlag.tsx                   # Bandeira do país
      RankingTable.tsx                  # Tabela de ranking (Daisy destacada em roxo)
    layout/
      AppLayout.tsx
      BottomNav.tsx                     # Navegação inferior mobile (inclui /daisy)
      Sidebar.tsx                       # Sidebar desktop (inclui /daisy e /admin/daisy)
    ui/                                 # Primitivos: Button, Card, Badge, Input...
  hooks/
    useMatches.ts                       # useMatches, useTodayMatches, useTomorrowMatches
    useGuesses.ts                       # useMyGuesses
    useRanking.ts
  lib/
    types.ts                            # Todos os tipos TypeScript (inclui DaisyDiary, SydleDaisyPrompt)
    mappers.ts                          # SydleGame → Match, SydleGuess → Guess
    standings.ts                        # calculateGroupStandings()
    sydle/
      client.ts                         # sydleSignIn, sydleCall, parseSearch
      constants.ts                      # SYDLE_BASE_URL, SYDLE_CLASS (+daisyPrompt/daisyDiary), DAISY_PACKAGE
    utils/
      dates.ts                          # formatMatchDate, PHASE_LABELS, isGuessingClosed
      scoring.ts                        # calculatePoints, OUTCOME_COLORS
    daisy/
      constants.ts                      # DAISY_USER_ID, DAISY_USER_NAME, DAISY_PROMPT_IDENTIFIERS
      aiClient.ts                       # callOpenAI() via OpenAI API (server-side only)
      promptRepository.ts               # getAllPrompts, getPromptByIdentifier — SYDLE daisyPrompt
      diaryRepository.ts                # getActiveDiaries, getMostRecentDiaries, createDiary, toggleDiaryActive, deleteDiary
      guessService.ts                   # saveDaisyGuesses — cria/atualiza palpites via _update
      newsService.ts                    # fetchAndSummarizeNews (5 fontes fixas), buildNewsContext
      matchAnalysisService.ts           # analyzeUpcomingMatches — análise intermediária por jogo (DAISY_MATCH_ANALYSIS)
      diaryService.ts                   # generateDailyDiary — orquestra geração + injeta últimos 3 posts como contexto
      guessGenerationService.ts         # generateAndSaveDaisyGuesses — geração autônoma de palpites (4 fases)
  contexts/
    AuthContext.tsx                     # useAuth, login/logout
```

## Rotas

```
/login                     → LoginPage (fundo dark)
/dashboard                 → DashboardPage (inclui card do Diário da Daisy)
/jogos                     → JogosPage (filtro por fase)
/meus-palpites             → MeusPalpitesPage
/classificacao             → ClassificacaoPage
/ranking                   → RankingPage (Daisy destacada em roxo)
/daisy                     → DaisyPage — lista de entradas do diário
/daisy/[id]                → DaisyEntryPage — leitura completa de uma entrada
/perfil                    → PerfilPage
/regras                    → RegrasPage
/admin/resultados          → Admin: lançar resultados
/admin/auditoria           → Admin: histórico
/admin/daisy               → Admin: gerar diário + gerenciar entradas
```

## Regras de prazo de palpite

`isGuessingClosed(matchDate, matchTime)` retorna `true` quando o horário de início do jogo passou.
Palpites fecham exatamente no kickoff.

**Timezone:** o SYDLE armazena timestamps em UTC. `parseSydleDate` em `mappers.ts` converte para **Brasília (UTC-3)** antes de extrair `matchDate` e `matchTime`. `isGuessingClosed` usa offset `-03:00` ao construir a ISO string para comparação. Nunca usar `Z` (UTC) nessas funções — os valores de `matchDate`/`matchTime` no objeto `Match` são sempre BRT.

O mesmo se aplica à rota server-side `GET /api/matches/[id]/guesses` — usa `parseSydleGameDate` com a mesma conversão BRT.

## Fase de grupos — labels

```ts
PHASE_LABELS = {
  grupos: 'Fase de Grupos',
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semifinais: 'Semifinal',
  finais: 'Final',
}
```

## Diário da Daisy — Visão Geral

Funcionalidade de IA que gera entradas diárias de diário com análises da Copa, palpites automáticos e ranking, usando a API OpenAI (gpt-4.1).

### Variáveis de ambiente adicionais

```env
OPENAI_API_KEY=sk-...              # Chave da API OpenAI (obrigatória para geração — somente server-side)
DAISY_PACKAGE=predict2026          # Pacote SYDLE das classes Daisy (padrão: predict2026)
```

**Segurança:** `OPENAI_API_KEY` nunca deve ser exposta no client. Usar sempre `process.env.OPENAI_API_KEY` em API routes e libs server-side. Nunca usar `NEXT_PUBLIC_OPENAI_API_KEY`.

### Classes SYDLE — Daisy

| Pacote | Classe | Descrição |
|---|---|---|
| `predict2026` (ou `DAISY_PACKAGE`) | `daisyPrompt` | Prompts de IA armazenados no SYDLE |
| `predict2026` (ou `DAISY_PACKAGE`) | `daisyDiary` | Entradas do diário geradas |

#### Campos `daisyPrompt` (atenção: capitalizações SYDLE)
- `identifier` — chave do prompt (ex: `DAISY_SYSTEM_PERSONA`)
- `Prompt` — texto do prompt (P maiúsculo)
- `Active` — ativo/inativo (A maiúsculo)
- `Version` — versão (V maiúsculo)
- `temperature`, `model` — parâmetros opcionais

#### Campos `daisyDiary` (atenção: typos SYDLE intencionais)
- `tytle` — título (typo: não é "title")
- `subtytle` — subtítulo (typo: não é "subtitle")
- `content` — conteúdo da entrada
- `active` — ativo/inativo (**a minúsculo** — diferente de `daisyPrompt.Active`)
- `date` — data de referência da edição (campo opcional, formato ISO)

Entradas são criadas com `active: false` — o admin revisa e ativa manualmente.

### Identificadores de prompts SYDLE

```ts
DAISY_PROMPT_IDENTIFIERS = {
  persona:       'DAISY_SYSTEM_PERSONA',   // Personalidade da Daisy
  diary:         'DAISY_DAILY_DIARY',      // Prompt de geração do diário
  guesses:       'DAISY_DAILY_GUESSES',    // Prompt de geração de palpites
  newsSummary:   'DAISY_NEWS_SUMMARY',     // Prompt de resumo de notícias
  matchAnalysis: 'DAISY_MATCH_ANALYSIS',   // Análise intermediária por jogo (etapa entre notícias e palpites)
}
```

### Usuário Daisy no sistema

```ts
DAISY_USER_ID   = '6a2a86ee9238442e1de757ac'
DAISY_USER_NAME = 'Daisy IA'
```

Os palpites da Daisy são salvos na classe `predict2026.guesses` com `user._id = DAISY_USER_ID`, igual a qualquer outro usuário. No ranking, a linha da Daisy é destacada em roxo (`bg-violet-50`, avatar 🤖).

### Fluxo de geração do diário (admin)

1. Admin acessa `/admin/daisy` e clica em "Gerar Diário"
2. POST `/api/admin/daisy/generate-diary` → `generateDailyDiary()` em `lib/daisy/diaryService.ts`
3. Busca paralela no SYDLE + fontes externas:
   - Todos os jogos (até 200, `game`) — base do gameMap e dos próximos jogos
   - Todos os resultados (até 200, `results`) — detecta jogos encerrados recentemente
   - Todos os palpites (até 1000, `guesses`) — calcula ranking top 10
   - Últimos 3 diários gerados (`getMostRecentDiaries(3)`) — referência editorial para evitar repetição
   - Mapa de países (`fetchCountryMap`) — resolve nomes a partir de IDs
   - Todos os prompts SYDLE (`getAllPrompts`) — persona, diary, guesses, análise de jogos, resumo de notícias
   - Notícias externas → `fetchAndSummarizeNews()` → resumidas com `DAISY_NEWS_SUMMARY`

4. **Janela de resultados recentes** — define quais jogos encerrados são "novidade":
   - Janela = desde a data do último diário gerado, ou últimas 48h (o que for mais amplo)
   - Itera pelos **resultados** (não pelos jogos) e cruza com o gameMap — garante cobertura de todos os 200 jogos
   - Jogos com `date > now` (futuros) são excluídos mesmo que tenham resultado cadastrado

5. **Montagem do prompt** — contextos injetados na user message do OpenAI:
   - Se há resultados recentes: bloco `⚠️ JOGOS ENCERRADOS RECENTEMENTE` com instrução obrigatória de comentar no início do post
   - Jogos já acontecidos sem resultado no sistema (para Daisy comentar via notícias)
   - Histórico de até 10 resultados anteriores como referência
   - Próximos jogos: filtro client-side `date > now`, top 15 por ordem cronológica
   - Top 10 ranking: calculado em runtime somando pontos de todos os palpites vs resultados
   - Resumo de notícias externas
   - Excertos dos 3 últimos diários (300 chars cada) com instrução "use apenas como referência editorial"

6. OpenAI gera JSON `{ title, subtitle, content }` usando `personaPrompt` como system + contexto montado como user message

7. **Validação obrigatória** — se havia resultados recentes, verifica se a IA mencionou ao menos um dos times no conteúdo gerado. Se não mencionou: **não salva e retorna erro** com `validationError` no response

8. Diário salvo em `daisyDiary` via `_create` com `active: false`

9. Como etapa bônus (não-fatal), gera palpites da Daisy para os próximos jogos usando `DAISY_MATCH_ANALYSIS` + `DAISY_DAILY_GUESSES`

10. Admin revisa, faz preview e ativa manualmente — ou exclui se necessário

### Fluxo de geração de palpites autônomos (admin)

Separado do diário — pode ser acionado independentemente:

1. POST `/api/admin/daisy/generate-guesses` → `generateAndSaveDaisyGuesses()`
2. Fase 1 (paralelo): prompts + jogos próximas 24h + todos jogos/resultados + countryMap
3. Fase 2: notícias → `fetchAndSummarizeNews()` → summary
4. Fase 3: `analyzeUpcomingMatches()` com prompt `DAISY_MATCH_ANALYSIS` → análise por jogo
5. Fase 4: OpenAI (prompt `DAISY_DAILY_GUESSES`) com contexto de análises + notícias → palpites
6. Palpites salvos via `saveDaisyGuesses()` (cria ou atualiza com `_update`)

### Rotas administrativas

| Rota | Método | Descrição |
|---|---|---|
| `/api/admin/daisy` | GET | Lista todos os diários (inclusive inativos) |
| `/api/admin/daisy` | PATCH | Alterna ativo/inativo de uma entrada |
| `/api/admin/daisy` | DELETE | Exclui entrada **inativa** (rejeita com 422 se ativa) |
| `/api/admin/daisy/test-ai` | POST | Testa conexão com OpenAI — retorna `DaisyAITestResult` |
| `/api/admin/daisy/generate-diary` | POST | Gera nova entrada do diário — retorna `GenerateDiaryResult` |
| `/api/admin/daisy/generate-guesses` | POST | Gera palpites autônomos para as próximas 24h — retorna `GenerateGuessesResult` |

### Rota pública de palpites por jogo

| Rota | Método | Descrição |
|---|---|---|
| `/api/matches/[id]/guesses` | GET | Retorna palpites de todos os participantes de uma partida. **403** se o jogo ainda não fechou. Inclui `isDaisy`, `outcome` e `points` calculados. |

### aiClient — uso correto

```ts
// SOMENTE server-side (API routes, server components, lib/daisy/)
import { callOpenAI, parseJsonFromText } from '@/lib/daisy/aiClient'

const raw = await callOpenAI(systemPrompt, userMessage, { maxTokens: 2048, temperature: 0.8, model: 'gpt-4.1' })
const data = parseJsonFromText<{ title: string }>(raw)
```

`parseJsonFromText` extrai o primeiro bloco JSON do texto (suporta markdown code fences).

### Segurança

- `OPENAI_API_KEY` nunca exposta ao client — toda chamada à IA é server-side via `process.env.OPENAI_API_KEY`
- Nunca usar `NEXT_PUBLIC_OPENAI_API_KEY`
- Rotas `/api/admin/daisy/*` validam admin via `X-User-Login` header
- Conteúdo gerado é sanitizado (strip HTML/scripts) antes de salvar
- Página `/admin/daisy` redireciona para `/dashboard` se `!user.isAdmin`

### RankingTable — exibição da Daisy

```tsx
const isDaisy = entry.userId === DAISY_USER_ID
// Linha: bg-violet-50 | avatar: 🤖 bg-violet-600 | nome: text-violet-700
```

### Dashboard — card da Daisy

O componente `DaisyCard` no dashboard mostra a entrada mais recente do diário (via `useLatestDiary`). Só aparece quando houver pelo menos uma entrada ativa.

## Como rodar localmente

```bash
npm install
# Criar .env.local com as variáveis acima (incluindo ANTHROPIC_API_KEY)
npm run dev
```

## Deploy (Vercel)

- Conectado ao repositório GitHub `cdeghi-personal/dgt-predict-2026`
- Branch `main` → deploy automático
- Variáveis de ambiente configuradas no dashboard do Vercel
- Org de produção: `dgt-consultoria`
- **Adicionar ao Vercel**: `OPENAI_API_KEY` e `DAISY_PACKAGE` (se necessário)
