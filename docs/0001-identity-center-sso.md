# ADR 0001 — IAM Identity Center (SSO) em vez de usuário IAM com access key

**Status:** Aceito · **Data:** 2026-07-30 · **Fase:** 0

## Contexto
Precisamos de acesso administrativo à conta AWS para operar e deployar. As opções
comuns são: (a) usuário IAM com access key de longa duração no `~/.aws/credentials`,
ou (b) IAM Identity Center (SSO) com credenciais temporárias.

## Decisão
Usar **IAM Identity Center** com um usuário administrativo + MFA. A CLI é configurada
com `aws configure sso` (profile `poc`), que obtém credenciais temporárias via login
no navegador.

## Consequências
- **Positivo:** nenhuma credencial estática no disco; MFA obrigatório; alinhado a
  least-privilege; o root fica intocado após o setup.
- **Negativo/custo:** a sessão SSO expira (algumas horas) e exige `aws sso login
  --profile poc` para renovar — trade-off aceitável pela segurança.
- Exigiu habilitar uma AWS Organization (requisito do Identity Center); a conta
  segue sendo a única (management account).
