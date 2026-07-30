# Fase 0 — Fundação · `tasks.md`

Execução **item por item**. Marque conforme concluir. "Motivação" aparece onde a
decisão não é óbvia. Entre `( )` o requisito atendido (ver `requirements.md`).

> ⚠️ Muitos itens são **ações na sua conta AWS** (console/CLI) que só você pode
> executar. Confirme cada uma antes de prosseguir.

- [ ] **0.1 — Criar conta AWS e proteger o root.** Criar a conta com o e-mail dedicado; ativar **MFA no usuário root**; anotar dados de billing. *Motivação:* o root é o único principal que não dá pra restringir por IAM; comprometê-lo compromete tudo — por isso MFA e uso zero depois. *(R1)*
- [ ] **0.2 — Habilitar IAM Identity Center e criar admin.** Ativar Identity Center em `us-east-1`; criar um usuário administrativo com MFA e um permission set de administração. *Motivação:* trabalhar como admin federado com credenciais temporárias, nunca com access keys estáticas. *(R2)*
- [ ] **0.3 — Configurar CLI com SSO.** Rodar `aws configure sso` apontando para o Identity Center; validar com `aws sts get-caller-identity`. *Motivação:* credenciais de curta duração no terminal, alinhado a least-privilege. *(R2)*
- [ ] **0.4 — Criar Budgets e alertas.** AWS Budgets: budget de custo mensal com alertas em **US$ 5** e **US$ 10**; habilitar alerta de **free tier**. *Motivação:* iniciante em AWS + serviços pay-per-use → detectar gasto antes de virar susto na fatura. *(R3)*
- [ ] **0.5 — Habilitar CloudTrail e Cost Explorer.** Ativar CloudTrail (management events, grátis) e Cost Explorer. *Motivação:* auditoria de "quem fez o quê" e visibilidade de custo por serviço desde o dia 1. *(R8)*
- [ ] **0.6 — Solicitar acesso aos modelos Bedrock.** No console Bedrock (`us-east-1`), pedir acesso a **Claude Haiku**, **Claude Sonnet** e um **modelo de embeddings**. *Motivação:* aprovação pode não ser instantânea; sem acesso, toda chamada falha com AccessDenied — por isso é a primeira coisa "de LLM" a resolver. Sem custo até invocar. *(R4)*
- [ ] **0.7 — Instalar toolchain e verificar versões.** Node 20, AWS CLI v2, CDK v2, Python 3.12, uv, Docker. Conferir com os comandos `-v`/`--version`. *Motivação:* alinhar versões evita divergência entre local e Lambda runtime.
- [ ] **0.8 — Inicializar o monorepo e o projeto CDK.** Estrutura de pastas já criada; em `infra/`, rodar `cdk init app --language typescript`. Commit inicial. *Motivação:* fixar a fronteira TS×Python e ter IaC versionada desde o começo.
- [ ] **0.9 — Bootstrap do CDK.** `cdk bootstrap aws://<account-id>/us-east-1`. *Motivação:* cria o toolkit stack (bucket de assets, roles) que o CDK precisa para deployar; pré-requisito de qualquer `cdk deploy`.
- [ ] **0.10 — Criar o GitHub OIDC provider na conta.** Adicionar o provedor OIDC do GitHub (`token.actions.githubusercontent.com`) na IAM (via `foundation-stack`). *Motivação:* base para o Actions assumir role sem chaves. *(R6)*
- [ ] **0.11 — Criar a IAM role de deploy com trust escopada.** Role assumível **apenas** por `repo:<owner>/<repo>:ref:refs/heads/main`, com permissões de deploy (CloudFormation + o necessário). *Motivação:* escopar ao repo/branch evita que qualquer workflow de terceiros assuma a role; least-privilege no CI. *(R6)*
- [ ] **0.12 — Implementar `foundation-stack` + Lambda "hello" + API Gateway.** Stack com OIDC provider (0.10), role de deploy (0.11), uma Lambda Python "hello world" e um **HTTP API** na frente. *Motivação:* HTTP API é mais barato/simples que REST API para o objetivo; a Lambda é a prova viva da pipeline. *(R5, R7)*
- [ ] **0.13 — `cdk deploy` local e testar.** Deployar da máquina; `curl` na URL do API Gateway deve retornar 200. *Motivação:* validar a stack antes de automatizar reduz variáveis quando o CI falhar.
- [ ] **0.14 — Criar o workflow GitHub Actions com OIDC.** `.github/workflows/deploy.yml`: no push para `main`, `permissions: id-token: write`, assume a role via OIDC, roda `cdk deploy`. *Motivação:* fecha o loop de CI/CD sem segredos de longa duração. *(R6)*
- [ ] **0.15 — Provar ponta a ponta pelo CI.** Fazer um commit que altere a resposta da Lambda; confirmar deploy automático e novo `curl` 200. *Motivação:* é o critério de "pronto" da fase — a pipeline inteira funcionando de fato. *(R7)*
- [ ] **0.16 — Definir retenção de logs e registrar ADRs.** Retenção CloudWatch 7–14 dias; escrever ADRs das decisões (SSO, CDK, OIDC, HTTP API) em `docs/`. *Motivação:* evitar crescimento silencioso de custo de logs e deixar rastro das decisões para estudo.

## Critério de "pronto" da Fase 0

R1–R8 satisfeitos — um push no GitHub deploya a Lambda e `curl` no API Gateway
retorna 200, **sem nenhuma AWS access key no repositório**, com budget e CloudTrail
ativos. Ao fechar, gerar o spec (trio) da **Fase 1**.
