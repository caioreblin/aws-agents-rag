/** Configuração vinda das variáveis de ambiente do Vite (`.env.local`). */
export const config = {
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN as string,
  clientId: import.meta.env.VITE_CLIENT_ID as string,
  apiUrl: import.meta.env.VITE_API_URL as string,
  redirectUri: import.meta.env.VITE_REDIRECT_URI as string,
};
