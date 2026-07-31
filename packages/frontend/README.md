# frontend — cliente mínimo do Agente v1

App Vite + TypeScript (vanilla) que loga no **Hosted UI do Cognito** (OAuth2
Authorization Code + PKCE) e conversa com o agente via `POST /chat`.

## Rodar

```bash
cd packages/frontend
npm install
npm run dev          # http://localhost:5173
```

A config vem de `.env.local` (já preenchido com os outputs do `AgentStack`; use
`.env.example` como referência).

## Primeiro acesso

1. Abra http://localhost:5173 e clique em **Entrar com Cognito**.
2. No Hosted UI, use **Sign up** para criar um usuário (e-mail + senha), confirme
   pelo código enviado por e-mail e faça login.
3. De volta ao app, mande uma pergunta (ex.: `quanto é 12*9?`).

> Enquanto `BEDROCK_MOCK=true` na Lambda, a resposta vem em **modo mock** (ex.:
> "[MOCK] Usei a ferramenta `calculator` ... 108"). Quando a cota do Bedrock
> liberar, viramos a flag e vem a resposta do Claude.

## Notas
- Usamos o **id_token** no header `Authorization: Bearer` (é o que o JWT
  authorizer do API Gateway valida).
- O `redirect_uri` (`http://localhost:5173`) deve bater com o callback
  registrado no App Client do Cognito.
