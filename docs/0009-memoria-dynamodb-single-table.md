# ADR 0009 — Memória de conversa com DynamoDB single-table

**Status:** Aceito · **Data:** 2026-08-03 · **Fase:** 2

## Contexto
O agente precisa manter contexto entre turnos da mesma conversa, isolado por
usuário, sem introduzir custo always-on (orçamento < US$ 10/mês) nem manutenção
de banco relacional. A carga é chave-valor simples: "as últimas N mensagens
desta sessão".

## Decisão
Uma **tabela DynamoDB única (single-table design)**, on-demand, com TTL:
- `PK = SESSION#<cognitoSub>#<conversationId>` — o `sub` vem **dos claims do
  JWT**, nunca do corpo (isolamento por usuário); o `conversationId` vem do
  frontend (localStorage).
- `SK = MSG#<isoTs>#<rand>` — o prefixo ISO ordena cronologicamente; o sufixo
  aleatório evita colisão de duas mensagens no mesmo instante.
- Atributos `role` (`user`/`assistant`), `content`, `ttl` (epoch, ~30 dias).

A persistência fica encapsulada num **repositório** (`services/agent/src/agent/
memory/`): o loop só pede "grava turno" e "histórico recente", sem conhecer
DynamoDB. O handler carrega as últimas N mensagens e o loop as injeta como
histórico do `Agent` (Strands). A memória é **best-effort**: se falhar, loga
warning e não quebra a resposta.

## Consequências
- **Positivo:** billing on-demand + TTL = custo ~zero e sem limpeza manual;
  isolamento por usuário garantido pela PK derivada do token.
- **Positivo (provado 2026-08-03):** contra a Lambda + tabela reais, dois turnos
  acumulam 4 itens em ordem; o turno 2 carrega `history=2`; um segundo usuário
  com a mesma `conversationId` fica isolado (`history=0`).
- **Custo/limite:** injeta só as últimas N mensagens (cap de tokens/custo);
  conversas mais longas perdem o início — aceitável para estudo.
- **Independência:** a memória não depende do Bedrock — funciona mesmo com o
  agente em modo mock (a cota do Bedrock não bloqueia esta parte).
