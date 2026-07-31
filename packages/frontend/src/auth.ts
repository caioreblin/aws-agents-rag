/**
 * Fluxo OAuth2 Authorization Code + PKCE com o Hosted UI do Cognito.
 *
 * Sem biblioteca de auth (didático): geramos o `code_verifier`/`code_challenge`,
 * redirecionamos para o Hosted UI, e na volta trocamos o `code` por tokens no
 * endpoint /oauth2/token. Usamos o **id_token** para chamar a API (é ele que tem
 * o claim `aud` = client id que o JWT authorizer do API Gateway valida).
 */
import { config } from './config';

const VERIFIER_KEY = 'pkce_verifier';
const TOKEN_KEY = 'id_token';

function base64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes.buffer);
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(digest);
}

/** Inicia o login: gera PKCE e redireciona para o Hosted UI. */
export async function login(): Promise<void> {
  const verifier = randomVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await challengeFor(verifier);
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: config.redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.assign(`${config.cognitoDomain}/oauth2/authorize?${params}`);
}

/** Na volta do Hosted UI, troca o `code` por tokens e guarda o id_token. */
export async function handleRedirectCallback(): Promise<void> {
  const code = new URL(window.location.href).searchParams.get('code');
  if (!code) return;
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) return;

  const res = await fetch(`${config.cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao trocar código por token (${res.status})`);
  }
  const data = await res.json();
  sessionStorage.setItem(TOKEN_KEY, data.id_token);
  sessionStorage.removeItem(VERIFIER_KEY);
  window.history.replaceState({}, document.title, '/'); // limpa o ?code= da URL
}

export function getIdToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

/** Logout: limpa o token local e encerra a sessão no Hosted UI. */
export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.redirectUri,
  });
  window.location.assign(`${config.cognitoDomain}/logout?${params}`);
}
