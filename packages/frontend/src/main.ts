import './style.css';
import { config } from './config';
import { getIdToken, handleRedirectCallback, login, logout } from './auth';

const app = document.querySelector<HTMLDivElement>('#app')!;

function render(): void {
  if (!getIdToken()) {
    app.innerHTML = `
      <div class="card">
        <h1>aws-agents-rag — Agente v1</h1>
        <p>Entre com o Cognito para conversar com o agente.</p>
        <button id="login">Entrar com Cognito</button>
      </div>`;
    document.querySelector('#login')!.addEventListener('click', () => void login());
    return;
  }

  app.innerHTML = `
    <header class="topbar">
      <strong>Agente v1</strong>
      <button id="logout" class="ghost">Sair</button>
    </header>
    <div id="messages" class="messages"></div>
    <form id="chat" class="chat">
      <input id="msg" placeholder="Ex.: quanto é 12*9? / que horas são?" autocomplete="off" />
      <button type="submit">Enviar</button>
    </form>`;
  document.querySelector('#logout')!.addEventListener('click', () => logout());
  document.querySelector('#chat')!.addEventListener('submit', onSend);
}

function addMessage(role: 'user' | 'agent' | 'error', text: string): void {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  const box = document.querySelector('#messages')!;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

async function onSend(event: Event): Promise<void> {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>('#msg')!;
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  addMessage('user', message);

  try {
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getIdToken()}`,
      },
      body: JSON.stringify({ message }),
    });
    if (res.status === 401) {
      addMessage('error', 'Sessão expirada — faça login novamente.');
      logout();
      return;
    }
    const data = await res.json();
    addMessage('agent', data.reply ?? data.error ?? '(sem resposta)');
  } catch (err) {
    addMessage('error', `Erro de rede: ${(err as Error).message}`);
  }
}

// Ao carregar: processa a volta do login (se houver) e renderiza.
handleRedirectCallback()
  .then(render)
  .catch((err) => {
    app.innerHTML = `<pre class="card">Erro no login: ${(err as Error).message}</pre>`;
  });
