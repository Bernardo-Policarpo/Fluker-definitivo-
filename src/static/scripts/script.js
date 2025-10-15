function showSection(id) {
  const sections = document.querySelectorAll('.content');
  sections.forEach(sec => sec.classList.remove('active'));

  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

function toggleChat() {
  const chatBox = document.getElementById('chat-box');
  chatBox.classList.toggle('hidden');
}

const posts = [
  {
    usuario: "Fluker",
    imagem: "img/perfil.jpg",
    descricao: "FLUKER logo post",
    comentarios: []
  },
  {
    usuario: "Bernardo.Policarpo",
    imagem: "img/perfil.jpg",
    descricao: "Post sobre o projeto Fluker",
    comentarios: []
  },
  {
    usuario: "Lucas.Gabriel",
    imagem: "img/perfil.jpg",
    descricao: "Comentário sobre a plataforma",
    comentarios: []
  }
];

function carregarFeed() {
  const container = document.querySelector("#inicio .posts");
  if (!container) return;

  container.innerHTML = "";

  posts.forEach((post, index) => {
    const div = document.createElement("div");
    div.className = "post";

    div.innerHTML = `
      <div class="post-content">
        <div class="post-main">
          <div class="post-header">
            <img src="${post.imagem}" alt="${post.usuario}" class="post-avatar" />
            <h3>${post.usuario}</h3>
          </div>
          <p>${post.descricao}</p>
          <div class="post-actions">
            <button onclick="curtir(${index})">❤️ Curtir</button>
            <button onclick="comentar(${index})">💬 Comentar</button>
            <button onclick="compartilhar(${index})">🔄 Compartilhar</button>
          </div>
        </div>

        <div class="post-side">
          <div class="comentarios-laterais" id="comentarios-${index}">
            <h4>Comentários</h4>
            ${post.comentarios.map((c, ci) => `
              <div class="comentario">
                <p><strong>${c.autor}:</strong> ${c.texto}</p>
                <div class="comentario-actions">
                  <button onclick="responder(${index}, ${ci})">↩️</button>
                  <button onclick="curtirComentario(${index}, ${ci})">❤️ ${c.likes || 0}</button>
                </div>
                ${c.respostas?.map(r => `<p class="resposta"><strong>${r.autor}:</strong> ${r.texto}</p>`).join("") || ""}
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

function curtir(index) {
  alert(`Você curtiu o post de ${posts[index].usuario}`);
}

function comentar(index) {
  const comentario = prompt(`Digite seu comentário para ${posts[index].usuario}:`);
  if (comentario) {
    posts[index].comentarios.push({ autor: "Você", texto: comentario, likes: 0, respostas: [] });
    carregarFeed();
  }
}

function compartilhar(index) {
  alert(`Você compartilhou o post de ${posts[index].usuario}`);
}

function responder(postIndex, comentarioIndex) {
  const resposta = prompt("Digite sua resposta:");
  if (resposta) {
    const comentario = posts[postIndex].comentarios[comentarioIndex];
    if (!comentario.respostas) comentario.respostas = [];
    comentario.respostas.push({ autor: "Você", texto: resposta });
    carregarFeed();
  }
}

function curtirComentario(postIndex, comentarioIndex) {
  posts[postIndex].comentarios[comentarioIndex].likes =
    (posts[postIndex].comentarios[comentarioIndex].likes || 0) + 1;
  carregarFeed();
}

document.addEventListener("DOMContentLoaded", () => {
  showSection("inicio"); // mostra a seção "inicio" ao carregar
  carregarFeed();        // carrega os posts na seção "inicio"
});

function toggleUserMenu() {
  const menu = document.getElementById("user-dropdown");
  menu.classList.toggle("hidden");
}

function logout() {
  // Navega para a rota Flask que limpa a sessão
  try { event?.preventDefault?.(); } catch(_) {}
  window.location.href = '/logout';
}

document.addEventListener("DOMContentLoaded", () => {
  showSection("inicio");
  carregarFeed();
});

// ====== CHAT DM BASICO ======
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
    initChat();
  } else {
    box.classList.add('hidden');
    stopPolling();
  }
}

async function initChat() {
  await loadUsers();
  const sel = document.getElementById('chat-partner');
  if (sel.options.length > 0) {
    if (!CHAT.partnerId) CHAT.partnerId = sel.value;
    await loadMessages(true);
    startPolling();
  }

  document.getElementById('chat-partner').addEventListener('change', async (e) => {
    CHAT.partnerId = e.target.value;
    CHAT.lastMsgId = 0;
    await loadMessages(true);
  });

  document.getElementById('chat-send').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

function startPolling() {
  stopPolling();
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
    const url = new URL(window.location.origin + '/api/messages');
    url.searchParams.set('partner_id', CHAT.partnerId);
    if (!fullReload && CHAT.lastMsgId > 0) {
      url.searchParams.set('since_id', CHAT.lastMsgId);
    }
    const res = await fetch(url.toString());
    const data = await res.json();
    const container = document.getElementById('chat-messages');

    if (fullReload) {
      container.innerHTML = '';
      CHAT.lastMsgId = 0;
    }

    let added = 0;
    (data.messages || []).forEach(m => {
      if (m.id > CHAT.lastMsgId) CHAT.lastMsgId = m.id;
      container.appendChild(renderMessage(m));
      added++;
    });

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

  // timestamp curto
  let hhmm = '';
  try {
    const d = new Date(m.timestamp);
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    hhmm = `${h}:${min}`;
  } catch { hhmm = ''; }

  const who = (m.sender_id === window.CURRENT_USER_ID) ? 'me' : 'partner';

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
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: CHAT.partnerId, content: text }),
    });
    const data = await res.json();
    if (data && data.ok) {
      input.value = '';
      await loadMessages(false);
    }
  } catch (e) {
    console.error('Erro ao enviar', e);
  }
}