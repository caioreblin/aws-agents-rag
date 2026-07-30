# Fase 0 — Fundação · `design.md`

Decisões arquiteturais da fase. Cada uma referencia o(s) requisito(s) que atende.

## Decisões

- **Identidade — IAM Identity Center (SSO)** em vez de usuário IAM com access key.
  `aws configure sso` gera credenciais temporárias no terminal; nada de segredo
  estático no disco. *(R2)*
- **Custo — AWS Budgets** com dois thresholds (US$ 5 e US$ 10) + alerta de free
  tier. **Nenhuma VPC/NAT nesta fase** (NAT Gateway custa ~US$ 32/mês). *(R3)*
- **IaC — AWS CDK v2 (TypeScript).** Uma `foundation-stack` mínima (OIDC provider
  + role de deploy) e uma Lambda "hello" atrás de **API Gateway HTTP API** (mais
  barato/simples que REST API para o objetivo). *(R5, R7)*
- **CI/CD — GitHub OIDC.** Provider OIDC do GitHub na conta + IAM role com **trust
  policy escopada** a `repo:<owner>/<repo>:ref:refs/heads/main`. Permissões de
  deploy restritas ao necessário (idealmente reutilizando o mecanismo de roles do
  CDK bootstrap). *(R6)*
- **Bedrock — solicitar acesso cedo.** A aprovação de acesso a modelo pode não ser
  instantânea; sem custo até a primeira invocação (que só ocorre na Fase 1). *(R4)*
- **Runtime Lambda — Python 3.12**, alinhado ao ambiente local, para evitar
  divergência de dependências.

## Trade-offs aceitos

- A `foundation-stack` inicial pode conceder **permissões de deploy amplas** para
  destravar a Fase 0. Apertar por serviço nas fases seguintes. → **Registrar ADR.**
- HTTP API não tem alguns recursos do REST API (ex.: usage plans/API keys nativos),
  irrelevantes agora; se necessário no futuro, reavaliar.

## Diagrama (textual)

```
GitHub Actions --(OIDC assume-role, sem chaves)--> IAM Role de deploy
      --> CloudFormation / CDK --> [ Lambda "hello" + API Gateway HTTP API ]

Transversais: AWS Budgets (alertas), CloudTrail (auditoria), Cost Explorer.
```

## Serviços AWS tocados

IAM Identity Center, IAM (OIDC provider + roles), AWS Budgets, CloudTrail, Cost
Explorer, Amazon Bedrock (apenas concessão de acesso), CloudFormation (via CDK),
AWS Lambda, API Gateway (HTTP API), CloudWatch Logs.

## Riscos da fase e mitigação

- Chaves AWS vazando no GitHub → **OIDC**, nunca chaves. *(R6)*
- Trust policy do OIDC larga demais (qualquer repo assume a role) → escopar a
  `repo:<owner>/<repo>:ref:refs/heads/main`. *(R6)*
- Logs CloudWatch com retenção infinita → definir retenção 7–14 dias.
- Uso acidental do root → MFA + parar de usar após setup. *(R1)*
