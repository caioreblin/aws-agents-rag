# services/ingestion/ — Ingestão S3 → Knowledge Base (Python)

Lambda disparada por **EventBridge** quando um novo documento chega ao bucket S3,
acionando o **sync incremental** da Bedrock Knowledge Base.

**Vazio por enquanto** — implementado na Fase 3 (orquestração + eventos).

## Cuidados

- Sync **incremental/idempotente** para não re-gerar embeddings pagos à toa.
- Tratamento de erro com DLQ quando fizer sentido.
