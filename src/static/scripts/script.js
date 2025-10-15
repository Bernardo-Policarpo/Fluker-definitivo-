// ====== NAVEGAÇÃO ENTRE SEÇÕES ======
function showSection(id) {
  const sections = document.querySelectorAll('.content');
  sections.forEach(sec => sec.classList.remove('active'));

  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

// ====== MENU DO USUÁRIO ======
function toggleUserMenu() {
  const menu = document.getElementById("user-dropdown");
  menu.classList.toggle("hidden");
}

function logout() {
  // Evita comportamento padrão se for chamado a partir de um link/botão
  try { event?.preventDefault?.(); } catch(_) {}
  window.location.href = '/logout';
}

// ====== INICIALIZAÇÃO ======
document.addEventListener("DOMContentLoaded", () => {
  // Começa no feed ("inicio") por padrão
  showSection("inicio");
});

// ====== CHAT DM ======
// Estado simples do chat. Mantemos o parceiro atual, o último ID de mensagem
// visto (para polling incremental) e o timer do polling.
let CHAT = {
  open: false,
  partnerId: null,
  lastMsgId: 0,
  pollTimer: null,
};

function toggleChat() {
  const box = document.getElementById('chat-box');
  CHAT.open = !CHAT.open;
  if (CHAT.open) {
    box.classList.remove('hidden');
    initChat();        // carrega usuários, mensagens e inicia polling
  } else {
    box.classList.add('hidden');
    stopPolling();     // para o polling quando o chat fecha
  }
}

async function initChat() {
  // 1) Preenche o <select> com usuários (exceto o atual)
  await loadUsers();

  const sel = document.getElementById('chat-partner');

  // Se já temos usuários, define partner atual (mantém se já existir)
  if (sel.options.length > 0) {
    if (!CHAT.partnerId) CHAT.partnerId = sel.value;

    // 2) Carrega histórico inicial por completo e 3) inicia o polling
    await loadMessages(true);
    startPolling();
  }

  // Troca de parceiro: resetamos lastMsgId para recarregar do zero
  document.getElementById('chat-partner').addEventListener('change', async (e) => {
    CHAT.partnerId = e.target.value;
    CHAT.lastMsgId = 0;
    await loadMessages(true);
  });

  // Envio por clique e tecla Enter
  document.getElementById('chat-send').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

function startPolling() {
  stopPolling(); // evita duplicar timers
  // Polling leve a cada 3s buscando só mensagens novas (since_id)
  CHAT.pollTimer = setInterval(async () => {
    if (CHAT.partnerId) {
      await loadMessages(false);
    }
  }, 3000);
}

function stopPolling() {
  if (CHAT.pollTimer) {
    clearInterval(CHAT.pollTimer);
    CHAT.pollTimer = null;
  }
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    const sel = document.getElementById('chat-partner');
    sel.innerHTML = '';

    // Preenche com username (fallback para email ou um label genérico)
    data.users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.username || u.email || `user_${u.id}`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error('Erro ao carregar usuários', e);
  }
}

async function loadMessages(fullReload) {
  if (!CHAT.partnerId) return;
  try {
    // Monta a URL com partner_id e since_id (quando não for reload total)
    const url = new URL(window.location.origin + '/api/messages');
    url.searchParams.set('partner_id', CHAT.partnerId);
    if (!fullReload && CHAT.lastMsgId > 0) {
      url.searchParams.set('since_id', CHAT.lastMsgId);
    }

    const res = await fetch(url.toString());
    const data = await res.json();
    const container = document.getElementById('chat-messages');

    // Reload total limpa a lista e reseta o último ID
    if (fullReload) {
      container.innerHTML = '';
      CHAT.lastMsgId = 0;
    }

    // Renderiza apenas mensagens novas (servidor já filtra por since_id)
    let added = 0;
    (data.messages || []).forEach(m => {
      if (m.id > CHAT.lastMsgId) CHAT.lastMsgId = m.id;
      container.appendChild(renderMessage(m));
      added++;
    });

    // Auto-scroll para o final ao carregar inicial ou quando chegam novas
    if (fullReload || added > 0) {
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) {
    console.error('Erro ao carregar mensagens', e);
  }
}

function renderMessage(m) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-line';

  // Formata HH:MM do timestamp ISO recebido do backend
  let hhmm = '';
  try {
    const d = new Date(m.timestamp);
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    hhmm = `${h}:${min}`;
  } catch { hhmm = ''; }

  // Define lado/estilo com base no remetente
  const who = (m.sender_id === window.CURRENT_USER_ID) ? 'me' : 'partner';

  // Observação: conteúdo é texto, não usamos innerHTML para evitar XSS
  wrap.textContent = `[${hhmm}] <${who}>: ${m.content}`;
  wrap.dataset.msgId = m.id;
  wrap.classList.add(who === 'me' ? 'msg-me' : 'msg-partner');
  return wrap;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = (input.value || '').trim();
  if (!text || !CHAT.partnerId) return;

  try {
    // Envia JSON para /api/send; servidor grava no CSV e retorna ok + timestamp
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: CHAT.partnerId, content: text }),
    });
    const data = await res.json();
    if (data && data.ok) {
      input.value = '';
      // Não força reload completo: busca só o delta via since_id
      await loadMessages(false);
    }
  } catch (e) {
    console.error('Erro ao enviar', e);
  }
}

// ====== LIKE AJAX (toggle sem reload) ======
document.addEventListener('DOMContentLoaded', () => {
  // Delegação de evento: pega submits nos forms dentro da lista de posts
  const postsContainer = document.querySelector('.posts');
  if (!postsContainer) return;

  postsContainer.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;

    // Só intercepta os forms de curtir (rota /curtir/<id>)
    const action = form.getAttribute('action') || '';
    if (!/\/curtir\/\d+/.test(action)) return;

    e.preventDefault();

    // Acha o botão dentro do form
    const btn = form.querySelector('button');
    if (!btn) return;

    // Pega estado atual do botão e contador exibido
    const currentLabel = btn.textContent.trim();
    // Extrai número entre parênteses: "Curtir (3)" -> 3
    const match = currentLabel.match(/\((\d+)\)\s*$/);
    const currentCount = match ? parseInt(match[1], 10) : 0;
    const isLikedNow = currentLabel.startsWith('Remover');

    // Otimista: atualiza UI antes da resposta
    const newCount = isLikedNow ? Math.max(0, currentCount - 1) : currentCount + 1;
    const newLabel = (isLikedNow ? 'Curtir' : 'Remover curtida') + ` (${newCount})`;
    btn.disabled = true;
    btn.textContent = newLabel;

    try {
      // Faz o POST para a mesma rota (mantendo compatibilidade)
      const res = await fetch(action, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'fetch' // só para distinguir server-side se quiser no futuro
        }
      });

      // Se deu erro no backend, reverte UI
      if (!res.ok) {
        btn.textContent = currentLabel;
      }
    } catch (err) {
      console.error('Erro ao curtir:', err);
      // Reverte UI se der erro de rede
      btn.textContent = currentLabel;
    } finally {
      btn.disabled = false;
    }
  });
});

// ====== SINCRONIZAÇÃO DE LIKES EM TEMPO QUASE REAL ======
let likesSyncTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  startLikesSync();
});

function startLikesSync() {
  stopLikesSync();
  // Ajuste o intervalo: 2000–5000ms é um bom começo
  likesSyncTimer = setInterval(syncLikesFromServer, 2000);
}

function stopLikesSync() {
  if (likesSyncTimer) {
    clearInterval(likesSyncTimer);
    likesSyncTimer = null;
  }
}

async function syncLikesFromServer() {
  try {
    const res = await fetch('/api/post_likes');
    if (!res.ok) return;
    const data = await res.json();
    // Para cada post visível no feed, atualizamos o botão conforme o servidor
    document.querySelectorAll('.posts .post').forEach(postEl => {
      const form = postEl.querySelector('form[action^="/curtir/"]');
      const btn = form?.querySelector('button');
      if (!form || !btn) return;

      const action = form.getAttribute('action') || '';
      const match = action.match(/\/curtir\/(\d+)/);
      if (!match) return;
      const postId = match[1];

      const serverInfo = data[postId];
      if (!serverInfo) return;

      const likes = serverInfo.likes || 0;
      const likesBy = (serverInfo.likes_by || '').split(';').filter(Boolean);
      const amILiked = likesBy.includes(String(window.CURRENT_USER_ID));

      const desiredLabel = (amILiked ? 'Remover curtida' : 'Curtir') + ` (${likes})`;
      if (btn.textContent.trim() !== desiredLabel) {
        btn.textContent = desiredLabel;
      }
    });
  } catch (e) {
    // silencioso; não precisa logar toda hora
  }
}