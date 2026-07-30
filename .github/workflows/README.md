# .github/workflows/ — CI/CD

Workflows do GitHub Actions.

- `deploy.yml` — (task **0.14**) no push para `main`, autentica na AWS via **OIDC**
  (`permissions: id-token: write`), assume a role de deploy e roda `cdk deploy`.
  **Sem AWS access keys** armazenadas no GitHub.
- Fases futuras: testes (Jest/pytest) e **evals** com gating (Fase 5).

**Vazio por enquanto** — criado na Fase 0.
