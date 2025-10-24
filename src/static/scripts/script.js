/* ========================================
   VARIÁVEIS GLOBAIS E ESTADO
   ======================================== */

// Estado do chat DM
let CHAT = {
  open: false,
  partnerId: null,
  lastMsgId: 0,
  pollTimer: null,
};

// Timers de sincronização
let likesSyncTimer = null;
let notifTimer = null;

/* ========================================
   NAVEGAÇÃO ENTRE SEÇÕES
   ======================================== */
function showSection(id) {
  const sections = document.querySelectorAll(".content");
  sections.forEach((sec) => sec.classList.remove("active"));

  const target = document.getElementById(id);
  if (target) target.classList.add("active");
  
  // Fechar dropdown do usuário quando mudar de seção
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

/* ========================================
   PERFIL E NAVEGAÇÃO
   ======================================== */
function goToMyProfile() {
  // Redireciona para a rota do próprio perfil
  window.location.href = "/perfil";
}

function goToUserProfile(userId) {
  // Redireciona para o perfil do usuário específico
  window.location.href = `/perfil/${userId}`;
}

/* ========================================
   BUSCA DE USUÁRIOS - CORRIGIDA
   ======================================== */
function createUserResultItem(user) {
  const item = document.createElement('div');
  item.className = 'user-result-item';
  item.innerHTML = `
    <div class="user-result-info">
      <div class="user-result-name">@${escapeHtml(user.username)}</div>
      <div class="user-result-email">${escapeHtml(user.email)}</div>
    </div>
  `;

  item.addEventListener('click', () => {
    closeUserSearchModal();
    goToUserProfile(user.id);
  });

  return item;
}

/* ========================================
   INICIALIZAÇÃO MELHORADA
   ======================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Verifica se estamos em uma página de perfil específica
  const currentPath = window.location.pathname;
  if (currentPath.startsWith('/perfil/')) {
    showSection('perfil');
  } else {
    showSection("inicio");
  }
  
  startLikesSync();
  startNotifPolling();
  setupNotificationModalListeners();
});

/* ========================================
   MENU DO USUÁRIO
   ======================================== */
function toggleUserMenu() {
  const menu = document.getElementById("user-dropdown");
  if (!menu) return;
  menu.classList.toggle("hidden");
}

function logout() {
  try {
    event?.preventDefault?.();
  } catch (_) {}
  window.location.href = "/logout";
}

/* ========================================
   CHAT DM - CONTROLE PRINCIPAL
   ======================================== */
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

async function initChat() {
  await loadUsers();

  const sel = document.getElementById("chat-partner");
  if (!sel) return;

  if (sel.options.length > 0) {
    if (!CHAT.partnerId) CHAT.partnerId = sel.value;
    await loadMessages(true);
    startPolling();
  } else {
    const chatRoot = document.getElementById("chat-messages");
    if (chatRoot) {
      chatRoot.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <p>💬 Para usar o chat, você precisa ter amigos mútuos.</p>
        </div>
      `;
    }
  }

  sel.addEventListener("change", async (e) => {
    CHAT.partnerId = e.target.value;
    CHAT.lastMsgId = 0;
    await loadMessages(true);
  });

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

  sendBtn?.addEventListener("click", () => {
    if (!canSendNow()) return;
    sendMessage();
  });

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

/* ========================================
   CHAT DM - CARREGAMENTO DE DADOS
   ======================================== */
async function loadUsers() {
  try {
    const res = await fetch("/api/users");
    if (!res.ok) throw new Error("Falha ao buscar usuários");

    const data = await res.json();
    const sel = document.getElementById("chat-partner");
    if (!sel) return;

    sel.innerHTML = '<option value="">Selecione um amigo...</option>';
    
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

async function loadMessages(fullReload) {
  if (!CHAT.partnerId) return;

  try {
    const url = new URL(window.location.origin + "/api/messages");
    url.searchParams.set("partner_id", CHAT.partnerId);
    if (!fullReload && CHAT.lastMsgId > 0) {
      url.searchParams.set("since_id", CHAT.lastMsgId);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      if (res.status === 400) {
        stopPolling();
        const messagesContainer = document.getElementById("chat-messages");
        if (messagesContainer) {
          messagesContainer.innerHTML = "<p>❌ Vocês não são mais amigos. Chat desativado.</p>";
        }
        return;
      }
      throw new Error("Falha ao buscar mensagens");
    }

    const data = await res.json();
    const container = document.getElementById("chat-messages");
    if (!container) return;

    if (fullReload) {
      container.innerHTML = "";
      CHAT.lastMsgId = 0;
    }

    let added = 0;
    (data.messages || []).forEach((m) => {
      if (m.id > CHAT.lastMsgId) CHAT.lastMsgId = m.id;
      container.appendChild(renderMessage(m));
      added++;
    });

    if (fullReload || added > 0) {
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) {
    console.error("Erro ao carregar mensagens", e);
  }
}

function renderMessage(m) {
  const wrap = document.createElement("div");
  wrap.className = "msg-line";

  let hhmm = "";
  try {
    const d = new Date(m.timestamp);
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    hhmm = `${h}:${min}`;
  } catch {
    hhmm = "";
  }

  const who = m.sender_id === window.CURRENT_USER_ID ? "me" : "partner";
  wrap.textContent = `[${hhmm}] ${who === 'me' ? 'Você' : 'Amigo'}: ${m.content}`;
  wrap.dataset.msgId = m.id;
  wrap.classList.add(who === "me" ? "msg-me" : "msg-partner");

  return wrap;
}

/* ========================================
   CHAT DM - ENVIO DE MENSAGENS
   ======================================== */
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
    } else if (data?.error) {
      alert("Erro: " + data.error);
    }
  } catch (e) {
    console.error("Erro ao enviar", e);
  }
}

/* ========================================
   SISTEMA DE CURTIDAS - AJAX
   ======================================== */
async function toggleCurtida(btn, postId) {
  const img = btn.querySelector(".heart-icon");
  const countEl = btn.querySelector(".like-count");

  if (!img || !countEl) return;

  const isLiked = img.src.includes("redheart.png");
  const newIcon = isLiked ? "coracao.png" : "redheart.png";
  const oldIcon = isLiked ? "redheart.png" : "coracao.png";
  
  // UI otimista
  img.src = img.src.replace(oldIcon, newIcon);
  
  let currentCount = parseInt(countEl.textContent, 10) || 0;
  const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
  countEl.textContent = String(newCount);

  btn.disabled = true;

  try {
    const res = await fetch(`/curtir/${postId}`, {
      method: "POST",
      headers: { 
        "X-Requested-With": "fetch",
        "Content-Type": "application/json"
      }
    });

    const data = await res.json();
    
    if (!data.success) {
      // Revert if failed
      img.src = img.src.replace(newIcon, oldIcon);
      countEl.textContent = String(currentCount);
    } else {
      // Update with server data
      countEl.textContent = String(data.likes);
      if (data.liked !== !isLiked) {
        img.src = img.src.replace(newIcon, oldIcon);
      }
    }
  } catch (err) {
    console.error("Erro ao curtir:", err);
    img.src = img.src.replace(newIcon, oldIcon);
    countEl.textContent = String(currentCount);
  } finally {
    btn.disabled = false;
  }
}

/* ========================================
   SINCRONIZAÇÃO DE CURTIDAS EM TEMPO REAL
   ======================================== */
function startLikesSync() {
  stopLikesSync();
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
    const res = await fetch("/api/post_likes");
    if (!res.ok) return;

    const data = await res.json();

    document.querySelectorAll(".posts .post").forEach((postEl) => {
      const btn = postEl.querySelector(".heart-btn");
      const img = postEl.querySelector(".heart-icon");
      const countEl = postEl.querySelector(".like-count");
      if (!btn || !img || !countEl) return;

      const postId = btn.onclick.toString().match(/toggleCurtida\(this, (\d+)\)/)?.[1];
      if (!postId) return;

      const serverInfo = data[postId];
      if (!serverInfo) return;

      const likesBy = String(serverInfo.likes_by || "").split(";").filter(Boolean);
      const amILiked = likesBy.includes(String(window.CURRENT_USER_ID));
      const desiredIcon = amILiked ? "redheart.png" : "coracao.png";
      const currentIcon = img.src.includes("redheart.png") ? "redheart.png" : "coracao.png";

      if (currentIcon !== desiredIcon) {
        img.src = img.src.replace(currentIcon, desiredIcon);
      }

      const likes = parseInt(serverInfo.likes || 0, 10) || 0;
      if (countEl.textContent.trim() !== String(likes)) {
        countEl.textContent = String(likes);
      }
    });
  } catch (_) {
    // Silencioso
  }
}

/* ========================================
   NOTIFICAÇÕES - POLLING
   ======================================== */
function startNotifPolling() {
  stopNotifPolling();
  fetchAndRenderNotifications();
  notifTimer = setInterval(fetchAndRenderNotifications, 5000);
}

function stopNotifPolling() {
  if (notifTimer) {
    clearInterval(notifTimer);
    notifTimer = null;
  }
}

async function fetchAndRenderNotifications() {
  try {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;

    const data = await res.json();
    updateNotificationBadge(data.unread || 0);
    renderNotificationList(data.items || []);
  } catch (e) {
    // Silencioso
  }
}

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
    const text = escapeHtml(n.text || "Nova notificação");

    div.innerHTML = `<p>${text} <small style="opacity:.7">${ts}</small></p>`;
    list.appendChild(div);
  });

  if (items.length > 3) {
    const more = document.createElement("div");
    more.style.textAlign = "center";
    more.style.padding = "6px 0 0";
    more.textContent = `... e mais ${items.length - 3} notificações`;
    list.appendChild(more);
  }
}

/* ========================================
   NOTIFICAÇÕES - AÇÕES
   ======================================== */
async function markAllRead() {
  const btn = document.getElementById("mark-all-read");
  if (btn) btn.disabled = true;

  try {
    const res = await fetch("/api/notifications/mark_all_read", {
      method: "POST",
    });
    if (!res.ok) return;

    await fetchAndRenderNotifications();
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
function openNotificationsModal() {
  const modal = document.getElementById("notifications-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  fetchAndRenderNotifications();
  document.getElementById("notifications-modal-close")?.focus();
}

function closeNotificationsModal() {
  const modal = document.getElementById("notifications-modal");
  if (!modal) return;
  modal.classList.add("hidden");
}

function setupNotificationModalListeners() {
  const backdrop = document.getElementById("notifications-modal-backdrop");
  const closeBtn = document.getElementById("notifications-modal-close");
  const content = document.getElementById("notifications-modal-content");
  const markBtn = document.getElementById("mark-all-read");

  if (markBtn) {
    markBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      markAllRead();
    });
  }

  backdrop?.addEventListener("click", closeNotificationsModal);
  closeBtn?.addEventListener("click", closeNotificationsModal);

  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("notifications-modal");
    const isOpen = modal && !modal.classList.contains("hidden");
    if (isOpen && e.key === "Escape") {
      closeNotificationsModal();
    }
  });

  content?.addEventListener("click", (e) => e.stopPropagation());
}

/* ========================================
   BUSCA DE USUÁRIOS
   ======================================== */
let searchTimeout = null;

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

function initUserSearch() {
  const searchInput = document.getElementById('user-search-input');
  const resultsContainer = document.getElementById('search-results');
  
  if (!searchInput || !resultsContainer) return;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (query.length === 0) {
      resultsContainer.innerHTML = '';
      return;
    }
    
    resultsContainer.innerHTML = '<div class="search-loading">Buscando...</div>';
    
    searchTimeout = setTimeout(() => {
      searchUsers(query);
    }, 300);
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      const resultsContainer = document.getElementById('search-results');
      if (resultsContainer) resultsContainer.innerHTML = '';
    }
  });
}

async function searchUsers(query) {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;

  try {
    const response = await fetch('/api/all_users');
    if (!response.ok) throw new Error('Erro ao buscar usuários');

    const data = await response.json();
    const allUsers = data.users || [];

    const filtered = allUsers.filter(user =>
      user.username.toLowerCase().includes(query.toLowerCase())
    );

    renderSearchResults(filtered);
  } catch (error) {
    console.error('Erro na busca de usuários:', error);
    resultsContainer.innerHTML = '<div class="no-results">Erro ao buscar usuários.</div>';
  }
}

function renderSearchResults(users) {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;
  
  if (users.length === 0) {
    resultsContainer.innerHTML = '<div class="no-results">Nenhum usuário encontrado</div>';
    return;
  }
  
  resultsContainer.innerHTML = '';
  
  users.forEach(user => {
    const userItem = createUserResultItem(user);
    resultsContainer.appendChild(userItem);
  });
}

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

function goToUserProfile(userId) {
  window.location.href = `/perfil/${userId}`;
}

// Configura modal de busca
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

/* ========================================
   UTILITÁRIOS
   ======================================== */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}