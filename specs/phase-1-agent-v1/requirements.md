# Fase 1 — Agente v1 · `requirements.md`

**Objetivo:** um agente que conversa via Bedrock (Claude), decide usar ferramentas
para responder, e expõe essas ferramentas **atrás de MCP** desde já — com login por
Cognito e um frontend mínimo para interagir.

## Critérios de aceite (EARS)

- **R1 — Auth:** QUANDO uma requisição chega ao endpoint do agente sem um JWT válido do Cognito, O SISTEMA DEVE responder 401; COM token válido, DEVE processar a mensagem.
- **R2 — Loop agêntico:** QUANDO o usuário faz uma pergunta que exige uma ferramenta (ex.: "que horas são?"), O SISTEMA DEVE decidir chamar a ferramenta, observar o resultado e produzir a resposta final (padrão think→act→observe, via Strands + Claude).
- **R3 — Tools via MCP (o requisito central):** As ferramentas DEVEM ser expostas por um **servidor MCP**; o núcleo do agente DEVE **descobri-las (list) e invocá-las (call) via cliente MCP**, sem hardcode. QUANDO uma ferramenta é adicionada/removida no servidor MCP, o núcleo do agente NÃO DEVE precisar de alteração.
- **R4 — Caps de segurança:** O loop DEVE ter limite máximo de iterações e `max_tokens` no Bedrock; a Lambda DEVE ter timeout; entradas inválidas DEVEM retornar erro tratado (não 500 cru).
- **R5 — Observabilidade:** Cada requisição DEVE emitir logs estruturados JSON com `correlationId`; erros DEVEM ser logados com contexto (sem vazar dados sensíveis).
- **R6 — Frontend mínimo:** O SISTEMA DEVE oferecer uma página que permita **login via Cognito**, enviar uma mensagem ao agente e exibir a resposta.
- **R7 — Custo:** O loop DEVE usar **Claude Haiku**; nada always-on; idle ≈ US$ 0.

## Ferramentas da v1 (conteúdo é secundário/trocável)
- `get_current_time` — retorna a hora atual (opcional: timezone).
- `calculator` — avalia uma expressão aritmética simples de forma segura.
- `echo_note` — devolve/registra uma nota curta (placeholder de "ação").

## Fora de escopo (Fase 1)
- Memória persistente e RAG (Fase 2), Step Functions/EventBridge (Fase 3),
  servidor MCP como deployable separado (Fase 4), guardrails/evals (Fase 5).
- Hospedagem do frontend (roda local apontando para o API; callback em localhost).

## Critério de "pronto"
R1–R7 satisfeitos: usuário loga no frontend, manda uma pergunta que dispara uma tool
via MCP, e recebe a resposta correta com citação de qual ferramenta foi usada;
adicionar uma 4ª tool no servidor MCP não exige mexer no núcleo do agente.
