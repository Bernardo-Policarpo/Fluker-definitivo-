/* ========================================
   VARIÁVEIS GLOBAIS E ESTADO
   ======================================== */

// Estado do chat DM (controle de abertura)
let CHAT = {
  open: false,
};

/* ========================================
   INICIALIZAÇÃO
   ======================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Começo no feed por padrão
  showSection("inicio");

  // Configuro os listeners do modal de notificações
  setupNotificationModalListeners();
});

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
  const isHidden = box.classList.contains("hidden");

  if (isHidden) {
    // mostrar
    box.classList.remove("hidden", "hiding");
    void box.offsetWidth; // reflow para transição
    box.classList.add("show");

    // foca no input e desce para o fim após a animação
    setTimeout(() => {
      document.getElementById("chat-input")?.focus();
      const container = document.querySelector("#dm-chat-root .chat-messages");
      if (container) container.scrollTop = container.scrollHeight;
    }, 200);
  } else {
    // esconder
    box.classList.remove("show");
    box.classList.add("hiding");
    setTimeout(() => {
      box.classList.add("hidden");
      box.classList.remove("hiding");
    }, 160);
  }
}

/* ========================================
   NOTIFICAÇÕES - AÇÕES
   ======================================== */
// Busca e renderiza notificações (chamada pelo React)
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
    list.appendChild(more);
  }
}

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
   EXPLORAÇÃO DE USUÁRIOS - BUSCA
======================================== */

// Variável para controlar o debounce da busca
let searchTimeout = null;

/**
 * Inicializa a funcionalidade de busca de usuários
 * Chame esta função no DOMContentLoaded
 */
function initUserSearch() {
  const searchInput = document.getElementById("user-search-input");
  const resultsContainer = document.getElementById("search-results");

  if (!searchInput || !resultsContainer) return;

  // Evento de input com debounce
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();

    // Limpa o timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Se o campo está vazio, esconde os resultados
    if (query.length === 0) {
      resultsContainer.classList.add("hidden");
      resultsContainer.innerHTML = "";
      return;
    }

    // Mostra loading
    resultsContainer.classList.remove("hidden");
    resultsContainer.innerHTML =
      '<div class="search-loading">Buscando...</div>';

    // Busca com delay de 300ms
    searchTimeout = setTimeout(() => {
      searchUsers(query);
    }, 300);
  });

  // Fecha os resultados ao clicar fora
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      resultsContainer.classList.add("hidden");
    }
  });

  // Reabre resultados ao focar no input (se houver resultados)
  searchInput.addEventListener("focus", () => {
    if (resultsContainer.innerHTML && searchInput.value.trim()) {
      resultsContainer.classList.remove("hidden");
    }
  });
}

/**
 * Busca usuários na API
 * @param {string} query - Termo de busca
 */
async function searchUsers(query) {
  const resultsContainer = document.getElementById("search-results");
  if (!resultsContainer) return;

  try {
    const response = await fetch("/api/users");
    if (!response.ok) throw new Error("Erro ao buscar usuários");

    const data = await response.json();
    const allUsers = data.users || [];

    // Filtra os usuários cujo username contém o termo buscado
    const filtered = allUsers.filter((user) =>
      user.username.toLowerCase().includes(query.toLowerCase())
    );

    renderSearchResults(filtered);
  } catch (error) {
    console.error("Erro na busca de usuários:", error);
    resultsContainer.innerHTML =
      '<div class="no-results">Erro ao buscar usuários. Tente novamente.</div>';
  }
}

/**
 * Renderiza os resultados da busca
 * @param {Array} users - Lista de usuários encontrados
 */
function renderSearchResults(users) {
  const resultsContainer = document.getElementById("search-results");
  if (!resultsContainer) return;

  // Se não encontrou ninguém
  if (users.length === 0) {
    resultsContainer.innerHTML =
      '<div class="no-results">Nenhum usuário encontrado</div>';
    return;
  }

  // Limpa o container
  resultsContainer.innerHTML = "";

  // Renderiza cada usuário
  users.forEach((user) => {
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
  const item = document.createElement("div");
  item.className = "user-result-item";

  item.innerHTML = `
    <div class="user-result-info">
      <div class="user-result-name">@${escapeHtml(user.username)}</div>
    </div>
  `;

  item.addEventListener("click", () => {
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
