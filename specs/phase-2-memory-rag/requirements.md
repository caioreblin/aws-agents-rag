# Fase 2 — Memória + RAG · `requirements.md`

**Objetivo:** dar ao agente (a) **memória de conversa** persistente por usuário e
(b) **RAG com citações** sobre um corpus de documentos (os docs deste projeto),
mantendo o padrão de ferramentas via MCP.

## Critérios de aceite (EARS)

- **R1 — Memória persistente:** QUANDO um turno de conversa acontece, O SISTEMA DEVE gravar a mensagem do usuário e a resposta do agente no DynamoDB (`PK=SESSION#<...>`, `SK=MSG#<timestamp>`), e recuperá-las em turnos seguintes; sessões antigas DEVEM expirar por **TTL**.
- **R2 — Isolamento por usuário:** A memória DEVE ser escopada ao usuário autenticado (Cognito `sub`); um usuário NÃO DEVE acessar a sessão de outro.
- **R3 — Contexto no loop:** QUANDO o agente responde, ele DEVE considerar o histórico recente da mesma sessão (continuidade entre turnos).
- **R4 — RAG com citações:** QUANDO o usuário pergunta sobre o corpus indexado, O SISTEMA DEVE responder de forma fundamentada **citando as fontes** (trecho/arquivo), via uma tool `search_knowledge_base`.
- **R5 — Ingestão:** Documentos no S3 DEVEM poder ser indexados na Bedrock Knowledge Base (sync); a busca DEVE retornar trechos + localização da fonte.
- **R6 — MCP mantido:** A busca RAG DEVE ser exposta como **tool MCP**; o núcleo do agente NÃO DEVE mudar (apenas ganha mais uma tool).
- **R7 — Custo:** Vector store **S3 Vectors** (pay-per-use, nada always-on) e DynamoDB **on-demand**; idle ≈ US$ 0.

## Dependências / fora de escopo
- **Dependência de cota Bedrock:** a ingestão e a consulta usam o **modelo de
  embeddings** (Titan Text Embeddings V2) — sujeito à mesma trava de cota de conta
  nova. A **memória (DynamoDB) é independente** e funciona já; o **RAG "acende"**
  quando a cota liberar. Construímos tudo antes (como na Fase 1).
- Ingestão **event-driven** (S3→KB via EventBridge) e Step Functions ficam para a
  **Fase 3** — aqui o sync pode ser manual/sob demanda.

## Corpus
Docs do próprio repositório: `PLAN.md`, `README.md`, `docs/*.md` (ADRs). Permite
testar "pergunte sobre o projeto" com citações verificáveis.

## Critério de "pronto"
R1–R7 satisfeitos: o agente mantém contexto entre turnos (por usuário) e responde
uma pergunta sobre o corpus com citação verificável; adicionar o RAG não alterou o
núcleo. Ao fechar, gerar o spec da **Fase 3**.
