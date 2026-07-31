# ADR 0006 — Strands Agents como framework do agente

**Status:** Aceito · **Data:** 2026-07-31 · **Fase:** 1

## Contexto
Precisávamos de um framework para o loop agêntico (think→act→observe) sobre o
Bedrock, com boa integração a ferramentas. Candidatos: Strands Agents (AWS) e
LangGraph.

## Decisão
Usar **Strands Agents SDK (Python)**. Nativo AWS, model-driven com pouco
boilerplate, `BedrockModel` first-class, **cliente MCP nativo** (`MCPClient` +
`stdio_client`) e hooks para caps de segurança.

## Consequências
- **Positivo:** integração MCP e Bedrock quase sem código; empacota bem na Lambda.
- **Caps de iteração:** feitos por **hook** (`BeforeToolCallEvent`), não por um
  parâmetro único — ver `MaxToolCalls` em `services/agent/src/agent/loop.py`.
- **Orquestração complexa** fica no Step Functions (Fase 3), não no processo do
  agente — por isso não precisamos do motor de grafos do LangGraph.
- Reavaliar LangGraph só se surgir necessidade de branching determinístico
  complexo in-process; o contrato MCP protege a troca.
