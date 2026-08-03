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
      <span class="spacer"></span>
      <button id="new" class="ghost">Nova conversa</button>
      <button id="logout" class="ghost">Sair</button>
    </header>
    <div id="messages" class="messages"></div>
    <form id="chat" class="chat">
      <input id="msg" placeholder="Ex.: quanto é 12*9? / que horas são?" autocomplete="off" />
      <button type="submit">Enviar</button>
    </form>`;
  document.querySelector('#logout')!.addEventListener('click', () => logout());
  document.querySelector('#new')!.addEventListener('click', newConversation);
  document.querySelector('#chat')!.addEventListener('submit', onSend);
}

/** Id da conversa atual (persistido), para a memória do agente separar sessões. */
function conversationId(): string {
  let id = localStorage.getItem('conversationId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('conversationId', id);
  }
  return id;
}

/** Começa uma conversa nova: novo id e limpa a tela. */
function newConversation(): void {
  localStorage.setItem('conversationId', crypto.randomUUID());
  const box = document.querySelector('#messages');
  if (box) box.innerHTML = '';
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
      body: JSON.stringify({ message, conversationId: conversationId() }),
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
