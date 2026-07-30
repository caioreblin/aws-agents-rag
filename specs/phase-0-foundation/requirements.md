# Fase 0 — Fundação · `requirements.md`

**Objetivo:** estabelecer uma base AWS segura e uma pipeline IaC que deploya
código automaticamente, sem credenciais de longa duração, com custo controlado.

## Critérios de aceite (EARS)

- **R1 — Conta segura:** QUANDO a conta é criada, O SISTEMA DEVE ter MFA no root e o root não é usado para operação diária.
- **R2 — Acesso administrativo federado:** O SISTEMA DEVE prover login administrativo via IAM Identity Center com MFA, sem uso de access keys de usuário IAM.
- **R3 — Guarda de custo:** QUANDO o gasto projetado atinge US$ 5 ou US$ 10, O SISTEMA DEVE notificar por e-mail; DEVE existir alerta de uso de free tier.
- **R4 — Acesso a modelos:** O SISTEMA DEVE ter acesso concedido aos modelos Bedrock necessários (Claude Haiku, Claude Sonnet, modelo de embeddings) em `us-east-1`.
- **R5 — IaC operante:** O SISTEMA DEVE permitir `cdk deploy`/`cdk destroy` da conta em `us-east-1` a partir de stacks versionadas.
- **R6 — CI/CD sem segredos longos:** QUANDO há push na branch `main`, O SISTEMA DEVE deployar via GitHub Actions usando **OIDC** (role temporária), sem nenhuma AWS access key armazenada no GitHub.
- **R7 — Prova ponta a ponta:** QUANDO a Lambda "hello" está deployada, O SISTEMA DEVE responder HTTP 200 numa URL de API Gateway.
- **R8 — Auditoria:** O SISTEMA DEVE ter CloudTrail (management events) e Cost Explorer habilitados.

## Fora de escopo (Fase 0)

- VPC/NAT, Cognito, Bedrock em runtime, DynamoDB, KB — entram nas fases seguintes.
- Apertar permissões de deploy por serviço (Fase 0 pode usar deploy amplo; registrar ADR e apertar depois).

## Critério de "pronto"

R1–R8 satisfeitos — em especial, um push no GitHub deploya a Lambda e `curl` no
API Gateway retorna 200, **sem nenhuma AWS access key no repositório**, com budget
e CloudTrail ativos.
