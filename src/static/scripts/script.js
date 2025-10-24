/* ========================================
   VARIÁVEIS GLOBAIS E ESTADO
   ======================================== */

// Estado do chat DM (uso simples para controlar abertura, parceiro e polling)
let CHAT = {
  open: false,
  partnerId: null,
  lastMsgId: 0,
  pollTimer: null,
};

// Timers de sincronização (likes em tempo real e notificações)
let likesSyncTimer = null;
let notifTimer = null;

/* ========================================
   INICIALIZAÇÃO
   ======================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Começo no feed por padrão
  showSection("inicio");

  // Liga a sincronização de likes (polling leve)
  startLikesSync();

  // Liga o polling de notificações (badge e modal)
  startNotifPolling();

  // Configuro a delegação de eventos do sistema de curtidas
  setupLikeListeners();

  // Configuro os listeners do modal de notificações
  setupNotificationModalListeners();

  document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("user-dropdown");
  const avatar = document.querySelector(".perfil-topo");

  // Se o dropdown estiver visível e o clique for fora dele e fora do avatar
  if (dropdown && !dropdown.classList.contains("hidden")) {
    if (!dropdown.contains(e.target) && !avatar.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  }
});
});

/* ========================================
   NAVEGAÇÃO ENTRE SEÇÕES
   ======================================== */
// Mostra uma seção do app e esconde as demais
function showSection(id) {
  const sections = document.querySelectorAll(".content");
  sections.forEach((sec) => sec.classList.remove("active"));

  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

/* ========================================
   MENU DO USUÁRIO
   ======================================== */
// Abre/fecha o dropdown do usuário
function toggleUserMenu() {
  const menu = document.getElementById("user-dropdown");
  if (!menu) return;
  menu.classList.toggle("hidden");
}

// Força logout via redirecionamento (previne envio de form, se houver)
function logout() {
  try {
    event?.preventDefault?.();
  } catch (_) {}
  window.location.href = "/logout";
}

/* ========================================
   CHAT DM - CONTROLE PRINCIPAL
   ======================================== */
// Abre/fecha a caixa de chat
function toggleChat() {
  const box = document.getElementById("chat-box");
  if (!box) return;

  CHAT.open = !CHAT.open;

  if (CHAT.open) {
    box.classList.remove("hidden");
    initChat();
  } else {
    box.classList.add("hidden");
    stopPolling();
  }
}

// Inicializa chat: carrega usuários, define parceiro inicial e listeners
async function initChat() {
  await loadUsers();

  const sel = document.getElementById("chat-partner");
  if (!sel) return;

  // Se já tenho usuários, escolho um parceiro padrão e começo o polling
  if (sel.options.length > 0) {
    if (!CHAT.partnerId) CHAT.partnerId = sel.value;

    await loadMessages(true); // primeira carga é full
    startPolling();
  }

  // Troca de parceiro atualiza histórico
  sel.addEventListener("change", async (e) => {
    CHAT.partnerId = e.target.value;
    CHAT.lastMsgId = 0;
    await loadMessages(true);
  });

  // Envio de mensagem (clique e Enter) com proteção contra spam
  const sendBtn = document.getElementById("chat-send");
  const input = document.getElementById("chat-input");

  let lastSendAt = 0;
  const GAP_MS = 1500;

  function canSendNow() {
    const now = Date.now();
    if (now - lastSendAt < GAP_MS) return false;
    lastSendAt = now;
    return true;
  }

  // Clique no botão
  sendBtn?.addEventListener("click", () => {
    if (!canSendNow()) return;
    sendMessage();
  });

  // Enter no input
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!canSendNow()) return;
      sendMessage();
    }
  });
}

/* ========================================
   CHAT DM - POLLING DE MENSAGENS
   ======================================== */
// Inicia polling de novas mensagens (leve, somente delta)
function startPolling() {
  stopPolling();
  CHAT.pollTimer = setInterval(async () => {
    if (CHAT.partnerId) {
      await loadMessages(false);
    }
  }, 3000);
}

// Para o polling do chat
function stopPolling() {
  if (CHAT.pollTimer) {
    clearInterval(CHAT.pollTimer);
    CHAT.pollTimer = null;
  }
}

/* ========================================
   CHAT DM - CARREGAMENTO DE DADOS
   ======================================== */
// Busca a lista de usuários disponíveis para DM
async function loadUsers() {
  try {
    const res = await fetch("/api/users");
    if (!res.ok) throw new Error("Falha ao buscar usuários");

    const data = await res.json();
    const sel = document.getElementById("chat-partner");
    if (!sel) return;

    sel.innerHTML = "";

    (data.users || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.username || u.email || `user_${u.id}`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("Erro ao carregar usuários", e);
  }
}

// Carrega mensagens do parceiro atual (full ou somente novas)
async function loadMessages(fullReload) {
  if (!CHAT.partnerId) return;

  try {
    const url = new URL(window.location.origin + "/api/messages");
    url.searchParams.set("partner_id", CHAT.partnerId);
    if (!fullReload && CHAT.lastMsgId > 0) {
      url.searchParams.set("since_id", CHAT.lastMsgId);
    }

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("Falha ao buscar mensagens");

    const data = await res.json();
    const container = document.getElementById("chat-messages");
    if (!container) return;

    if (fullReload) {
      container.innerHTML = "";
      CHAT.lastMsgId = 0;
    }

    // Renderizo apenas o delta (mensagens com id > lastMsgId)
    let added = 0;
    (data.messages || []).forEach((m) => {
      if (m.id > CHAT.lastMsgId) CHAT.lastMsgId = m.id;
      container.appendChild(renderMessage(m));
      added++;
    });

    // Auto-scroll no primeiro load e quando chegam novas
    if (fullReload || added > 0) {
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) {
    console.error("Erro ao carregar mensagens", e);
  }
}

// Monta um elemento visual para uma mensagem
function renderMessage(m) {
  const wrap = document.createElement("div");
  wrap.className = "msg-line";

  // Formato HH:MM amigável
  let hhmm = "";
  try {
    const d = new Date(m.timestamp);
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    hhmm = `${h}:${min}`;
  } catch {
    hhmm = "";
  }

  // Destaque visual se a mensagem é minha ou do parceiro
  const who = m.sender_id === window.CURRENT_USER_ID ? "me" : "partner";

  // textContent para evitar XSS
  wrap.textContent = `[${hhmm}] <${who}>: ${m.content}`;
  wrap.dataset.msgId = m.id;
  wrap.classList.add(who === "me" ? "msg-me" : "msg-partner");

  return wrap;
}

/* ========================================
   CHAT DM - ENVIO DE MENSAGENS
   ======================================== */
// Envia a mensagem atual e busca o delta
async function sendMessage() {
  const input = document.getElementById("chat-input");
  if (!input) return;

  const text = (input.value || "").trim();
  if (!text || !CHAT.partnerId) return;

  try {
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner_id: CHAT.partnerId, content: text }),
    });

    const data = await res.json();
    if (data?.ok) {
      input.value = "";
      await loadMessages(false);
    }
  } catch (e) {
    console.error("Erro ao enviar", e);
  }
}

/* ========================================
   SISTEMA DE CURTIDAS - CONFIGURAÇÃO
   ======================================== */
// Configura delegação de eventos para curtir/descurtir
function setupLikeListeners() {
  const postsContainer = document.querySelector(".posts");
  if (!postsContainer) return;

  postsContainer.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;

    const action = form.getAttribute("action") || "";
    if (!/\/curtir\/\d+/.test(action)) return;

    e.preventDefault();
    await handleLikeSubmit(form);
  });
}

// Trata o submit de curtida com atualização otimista
async function handleLikeSubmit(form) {
  const btn = form.querySelector("button");
  if (!btn) return;

  const currentLabel = (btn.textContent || "").trim();
  const match = currentLabel.match(/\((\d+)\)\s*$/);
  const currentCount = match ? parseInt(match[1], 10) : 0;
  const isLikedNow = currentLabel.startsWith("Remover");

  // UI otimista: atualizo label e contador imediatamente
  const newCount = isLikedNow ? Math.max(0, currentCount - 1) : currentCount + 1;
  const newLabel = (isLikedNow ? "Curtir" : "Remover curtida") + ` (${newCount})`;

  btn.disabled = true;
  btn.textContent = newLabel;

  try {
    const res = await fetch(form.getAttribute("action"), {
      method: "POST",
      headers: { "X-Requested-With": "fetch" },
    });

    // Se o servidor não confirmou, volto para o estado anterior
    if (!res.ok) {
      btn.textContent = currentLabel;
    }
  } catch (err) {
    console.error("Erro ao curtir:", err);
    btn.textContent = currentLabel;
  } finally {
    btn.disabled = false;
  }
}

/* ========================================
   SISTEMA DE CURTIDAS - ÍCONE
   ======================================== */
// Alterna o estado visual do coração (e contador) com fallback em caso de erro
function toggleCurtida(btn) {
  const form = btn.closest("form.like-form");
  if (!form) return;

  const action = form.getAttribute("action") || "";
  const img = btn.querySelector(".heart-icon");
  const countEl = form.querySelector(".like-count");

  if (!img) return;

  const match = action.match(/\/curtir\/(\d+)/);
  if (!match) return;

  const isLiked = img.src.includes("redheart.png");

  // UI otimista: troca o ícone imediatamente
  const newIcon = isLiked ? "coracao.png" : "redheart.png";
  const oldIcon = isLiked ? "redheart.png" : "coracao.png";
  img.src = img.src.replace(oldIcon, newIcon);

  // UI otimista: ajusta contador
  let currentCount = parseInt((countEl?.textContent || "0").trim(), 10);
  if (Number.isNaN(currentCount)) currentCount = 0;

  const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
  if (countEl) countEl.textContent = String(newCount);

  btn.disabled = true;

  fetch(action, {
    method: "POST",
    headers: { "X-Requested-With": "fetch" },
  })
    .then((res) => {
      if (!res.ok) {
        // Se falhou, volto ícone e contador
        img.src = img.src.replace(newIcon, oldIcon);
        if (countEl) countEl.textContent = String(currentCount);
      }
    })
    .catch((err) => {
      console.error("Erro ao curtir:", err);
      img.src = img.src.replace(newIcon, oldIcon);
      if (countEl) countEl.textContent = String(currentCount);
    })
    .finally(() => {
      btn.disabled = false;
    });
}

/* ========================================
   SINCRONIZAÇÃO DE CURTIDAS EM TEMPO REAL
   ======================================== */
// Inicia polling para alinhar ícones/contadores com o servidor
function startLikesSync() {
  stopLikesSync();
  likesSyncTimer = setInterval(syncLikesFromServer, 2000);
}

// Para a sincronização de likes
function stopLikesSync() {
  if (likesSyncTimer) {
    clearInterval(likesSyncTimer);
    likesSyncTimer = null;
  }
}

// Puxa do servidor o estado atual de likes e reflete na UI
async function syncLikesFromServer() {
  try {
    const res = await fetch("/api/post_likes");
    if (!res.ok) return;

    const data = await res.json();

    document.querySelectorAll(".posts .post").forEach((postEl) => {
      const form = postEl.querySelector('form.like-form[action^="/curtir/"]');
      if (!form) return;

      const btn = form.querySelector(".heart-btn");
      const img = form.querySelector(".heart-icon");
      const countEl = form.querySelector(".like-count");
      if (!btn || !img) return;

      const action = form.getAttribute("action") || "";
      const match = action.match(/\/curtir\/(\d+)/);
      if (!match) return;

      const postId = match[1];
      const serverInfo = data[postId];
      if (!serverInfo) return;

      // Alinho ícone conforme se eu curti ou não
      const likesBy = String(serverInfo.likes_by || "")
        .split(";")
        .filter(Boolean);
      const amILiked = likesBy.includes(String(window.CURRENT_USER_ID));
      const desiredIcon = amILiked ? "redheart.png" : "coracao.png";
      const currentIcon = img.src.includes("redheart.png")
        ? "redheart.png"
        : "coracao.png";

      if (currentIcon !== desiredIcon) {
        img.src = img.src.replace(currentIcon, desiredIcon);
      }

      // Alinho contador
      const likes = parseInt(serverInfo.likes || 0, 10) || 0;
      if (countEl && countEl.textContent.trim() !== String(likes)) {
        countEl.textContent = String(likes);
      }
    });
  } catch (_) {
    // Sem logs aqui para não poluir o console em caso de timeouts esporádicos
  }
}

/* ========================================
   NOTIFICAÇÕES - POLLING
   ======================================== */
// Inicia o polling das notificações (badge + lista do modal)
function startNotifPolling() {
  stopNotifPolling();
  fetchAndRenderNotifications(); // primeira carga
  notifTimer = setInterval(fetchAndRenderNotifications, 5000);
}

// Para o polling de notificações
function stopNotifPolling() {
  if (notifTimer) {
    clearInterval(notifTimer);
    notifTimer = null;
  }
}

// Busca notificações e atualiza badge e lista
async function fetchAndRenderNotifications() {
  try {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;

    const data = await res.json();

    updateNotificationBadge(data.unread || 0);
    renderNotificationList(data.items || []);
  } catch (e) {
    // Silencioso para não atrapalhar o uso
  }
}

// Mostra/esconde o badge de não lidas
function updateNotificationBadge(count) {
  const badge = document.getElementById("notif-badge");
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.add("show");
  } else {
    badge.textContent = "";
    badge.classList.remove("show");
  }
}

// Renderiza a lista do modal (limito às 3 mais recentes)
function renderNotificationList(items) {
  const list = document.getElementById("notifications-list");
  if (!list) return;

  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML = '<p class="empty">Não há notificações.</p>';
    return;
  }

  const visible = items.slice(0, 3);
  visible.forEach((n) => {
    const div = document.createElement("div");
    div.className = "notificacao";

    const isUnread = n.read === "0";
    div.style.fontWeight = isUnread ? "600" : "400";

    const ts = n.timestamp || "";
    const text = escapeHtml(n.text || "Nova mensagem");

    div.innerHTML = `<p>${text} <small style="opacity:.7">${ts}</small></p>`;
    list.appendChild(div);
  });

  // Se tiver mais que 3, posso mostrar um indicador simples (opcional)
  if (items.length > 3) {
    const more = document.createElement("div");
    more.style.textAlign = "center";
    more.style.padding = "6px 0 0";
    // Poderia adicionar um link "Ver todas" aqui futuramente
    list.appendChild(more);
  }
}

/* ========================================
   NOTIFICAÇÕES - AÇÕES
   ======================================== */
// Marca todas as notificações como lidas e atualiza UI
async function markAllRead() {
  const btn = document.getElementById("mark-all-read");
  if (btn) btn.disabled = true;

  try {
    const res = await fetch("/api/notifications/mark_all_read", {
      method: "POST",
    });
    if (!res.ok) {
      console.error("Falha ao marcar como lidas");
      return;
    }

    await fetchAndRenderNotifications();

    // Zera badge visualmente para dar feedback imediato
    const badge = document.getElementById("notif-badge");
    if (badge) {
      badge.textContent = "";
      badge.classList.remove("show");
    }
  } catch (e) {
    console.error("Erro ao marcar notificações como lidas:", e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ========================================
   MODAL DE NOTIFICAÇÕES
   ======================================== */
// Abre o modal e foca no botão de fechar para acessibilidade
function openNotificationsModal() {
  const modal = document.getElementById("notifications-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  fetchAndRenderNotifications();

  const closeBtn = document.getElementById("notifications-modal-close");
  closeBtn?.focus();
}

// Fecha o modal
function closeNotificationsModal() {
  const modal = document.getElementById("notifications-modal");
  if (!modal) return;

  modal.classList.add("hidden");
}

// Configura interações do modal (fechar, backdrop, ESC, etc.)
function setupNotificationModalListeners() {
  const backdrop = document.getElementById("notifications-modal-backdrop");
  const closeBtn = document.getElementById("notifications-modal-close");
  const content = document.getElementById("notifications-modal-content");
  const markBtn = document.getElementById("mark-all-read");

  // Botão "Marcar todas como lidas"
  if (markBtn) {
    markBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      markAllRead();
    });
  }

  // Fecha clicando no backdrop
  backdrop?.addEventListener("click", closeNotificationsModal);

  // Fecha no X
  closeBtn?.addEventListener("click", closeNotificationsModal);

  // Fecha com ESC
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("notifications-modal");
    const isOpen = modal && !modal.classList.contains("hidden");
    if (isOpen && e.key === "Escape") {
      closeNotificationsModal();
    }
  });

  // Cliques dentro do conteúdo não fecham o modal
  content?.addEventListener("click", (e) => e.stopPropagation());
}

/* ========================================
   UTILITÁRIOS
   ======================================== */
// Sanitiza texto para evitar XSS básico em inserções de HTML
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ========================================
   EXPLORAÇÃO DE USUÁRIOS - BUSCA
======================================== */

// Variável para controlar o debounce da busca
let searchTimeout = null;

/**
 * Inicializa a funcionalidade de busca de usuários
 * Chame esta função no DOMContentLoaded
 */
function initUserSearch() {
  const searchInput = document.getElementById('user-search-input');
  const resultsContainer = document.getElementById('search-results');
  
  if (!searchInput || !resultsContainer) return;
  
  // Evento de input com debounce
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Limpa o timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Se o campo está vazio, esconde os resultados
    if (query.length === 0) {
      resultsContainer.classList.add('hidden');
      resultsContainer.innerHTML = '';
      return;
    }
    
    // Mostra loading
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = '<div class="search-loading">Buscando...</div>';
    
    // Busca com delay de 300ms
    searchTimeout = setTimeout(() => {
      searchUsers(query);
    }, 300);
  });
  
  // Fecha os resultados ao clicar fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      resultsContainer.classList.add('hidden');
    }
  });
  
  // Reabre resultados ao focar no input (se houver resultados)
  searchInput.addEventListener('focus', () => {
    if (resultsContainer.innerHTML && searchInput.value.trim()) {
      resultsContainer.classList.remove('hidden');
    }
  });
}

/**
 * Busca usuários na API
 * @param {string} query - Termo de busca
 */
async function searchUsers(query) {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;

  try {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Erro ao buscar usuários');

    const data = await response.json();
    const allUsers = data.users || [];

    // Filtra os usuários cujo username contém o termo buscado
    const filtered = allUsers.filter(user =>
      user.username.toLowerCase().includes(query.toLowerCase())
    );

    renderSearchResults(filtered);

  } catch (error) {
    console.error('Erro na busca de usuários:', error);
    resultsContainer.innerHTML = '<div class="no-results">Erro ao buscar usuários. Tente novamente.</div>';
  }
}


/**
 * Renderiza os resultados da busca
 * @param {Array} users - Lista de usuários encontrados
 */
function renderSearchResults(users) {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;
  
  // Se não encontrou ninguém
  if (users.length === 0) {
    resultsContainer.innerHTML = '<div class="no-results">Nenhum usuário encontrado</div>';
    return;
  }
  
  // Limpa o container
  resultsContainer.innerHTML = '';
  
  // Renderiza cada usuário
  users.forEach(user => {
    const userItem = createUserResultItem(user);
    resultsContainer.appendChild(userItem);
  });
}

/**
 * Cria um elemento HTML para um usuário nos resultados
 * @param {Object} user - Dados do usuário
 * @returns {HTMLElement}
 */
function createUserResultItem(user) {
  const item = document.createElement('div');
  item.className = 'user-result-item';

  item.innerHTML = `
    <div class="user-result-info">
      <div class="user-result-name">@${escapeHtml(user.username)}</div>
    </div>
  `;

  item.addEventListener('click', () => {
    goToUserProfile(user.id);
  });

  return item;
}


/**
 * Navega para o perfil de um usuário
 * @param {number} userId - ID do usuáriopython app.py
 * 
 */
function goToUserProfile(userId) {
  // Redireciona para a página de perfil do usuário
  // Ajuste a rota conforme seu backend
  window.location.href = `/perfil/${userId}`;
}

function openUserSearchModal() {
  const modal = document.getElementById("user-search-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  initUserSearch();
  document.getElementById("user-search-close")?.focus();
}

function closeUserSearchModal() {
  const modal = document.getElementById("user-search-modal");
  if (!modal) return;
  modal.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("user-search-close");
  const backdrop = document.getElementById("user-search-backdrop");
  const content = document.getElementById("user-search-content");

  closeBtn?.addEventListener("click", closeUserSearchModal);
  backdrop?.addEventListener("click", closeUserSearchModal);
  content?.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("user-search-modal");
    const isOpen = modal && !modal.classList.contains("hidden");
    if (isOpen && e.key === "Escape") closeUserSearchModal();
  });
});