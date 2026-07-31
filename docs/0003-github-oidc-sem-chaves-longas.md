# ADR 0003 — CI/CD com GitHub OIDC, sem chaves de longa duração

**Status:** Aceito · **Data:** 2026-07-30 · **Fase:** 0

## Contexto
O GitHub Actions precisa deployar na AWS. A abordagem tradicional guarda uma AWS
access key/secret como secret do repositório — credencial de longa duração que, se
vazar, dá acesso persistente à conta.

## Decisão
Usar **OpenID Connect (OIDC)**: um OIDC provider do GitHub na conta
(`token.actions.githubusercontent.com`) e uma IAM role assumida via
`sts:AssumeRoleWithWebIdentity`. O workflow declara `permissions: id-token: write`
e usa `aws-actions/configure-aws-credentials@v4`. Nenhuma access key é armazenada.

A role de deploy só tem permissão de `sts:AssumeRole` sobre as roles `cdk-*` do
bootstrap — o CDK CLI faz o resto por essas roles (least-privilege no CI).

## Consequências
- **Positivo:** zero segredos de longa duração; credenciais efêmeras por execução;
  trust escopada a repo + branch `main`.
- **Negativo:** o formato do `sub` do token do GitHub tem sutilezas que quebram a
  trust policy na primeira configuração — ver [ADR 0005](0005-oidc-immutable-subject-claim.md).
- **Custo:** ~zero.
