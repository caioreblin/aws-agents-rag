# ADR 0005 — Trust policy do OIDC e o "immutable subject claim" do GitHub

**Status:** Aceito · **Data:** 2026-07-30 · **Fase:** 0

## Contexto
Ao configurar o CI/CD com OIDC (ADR 0003), o primeiro deploy pelo GitHub Actions
falhou repetidamente no passo de credenciais com:
`Not authorized to perform sts:AssumeRoleWithWebIdentity`.

Provider, `aud` e ARN da role estavam corretos. A causa era o **formato do `sub`**.
A documentação clássica mostra:
```
repo:<owner>/<repo>:ref:refs/heads/<branch>
```
Mas o GitHub está adotando o **immutable subject claim**, que embute os **IDs
numéricos imutáveis** do dono e do repositório:
```
repo:caioreblin@42477120/aws-agents-rag@1317309414:ref:refs/heads/main
              └ owner_id                 └ repo_id
```
Nossa condição esperava o formato antigo, então o `StringLike` do `sub` nunca casava
e o STS negava a federação.

Detalhe que atrapalhou o diagnóstico: um token OIDC pedido via `curl` cru vem em
formato diferente do que a action `configure-aws-credentials` realmente usa. A fonte
da verdade foi a API do GitHub:
`gh api repos/<owner>/<repo>/actions/oidc/customization/sub` → campo `sub_claim_prefix`.

## Decisão
Na trust policy (`foundation-stack.ts`), aceitar o `sub` no **formato imutável com os
IDs** de owner e repo, mais o formato clássico como fallback, sempre restrito à branch
`main`. Pinar pelos IDs (únicos e à prova de rename) é mais seguro do que usar
wildcard amplo.

Também aprendido: a IAM **exige** condição de `sub` (ou `job_workflow_ref`) para
providers do GitHub — não aceita trust policy escopada só por `aud`.

## Consequências
- **Positivo:** trust segura e determinística; documentado para não custar tempo de
  novo.
- **Manutenção:** se o repositório for recriado, os IDs mudam — atualizar
  `GITHUB_OWNER_ID`/`GITHUB_REPO_ID` no `foundation-stack.ts`.
- **Método reaproveitável:** diante de erro opaco, isolar com acesso read-only à
  conta (ler trust/provider) e buscar a fonte da verdade (API do IdP) em vez de
  chutar.
