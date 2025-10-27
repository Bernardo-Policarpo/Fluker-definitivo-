// ========================================
// SCRIPT PRINCIPAL DA APLICAÇÃO
// ========================================
// Controla navegação, modais, chat e interações gerais

// ========================================
// INICIALIZAÇÃO
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  // Define seção inicial baseada na URL
  const currentPath = window.location.pathname;
  
  if (currentPath.startsWith("/perfil/")) {
    showSection("perfil");
  } else {
    showSection("inicio");
  }
  
  // Configura listeners dos modais
  setupNotificationModalListeners();
  setupUserSearchModalListeners();
});

// Fecha dropdown ao clicar fora
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("user-dropdown");
  const avatar = document.querySelector(".perfil-topo");

  if (dropdown && !dropdown.classList.contains("hidden")) {
    if (!dropdown.contains(e.target) && !avatar.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  }
});

// ========================================
// NAVEGAÇÃO ENTRE SEÇÕES
// ========================================

function showSection(id) {
  /**
   * Mostra uma seção específica e esconde as demais
   * @param {string} id - ID da seção a ser exibida
   */
  const sections = document.querySelectorAll(".content");
  sections.forEach((sec) => sec.classList.remove("active"));

  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

// ========================================
// MENU DO USUÁRIO
// ========================================

function toggleUserMenu() {
  /**
   * Abre/fecha o dropdown do menu do usuário
   */
  const menu = document.getElementById("user-dropdown");
  if (!menu) return;
  
  menu.classList.toggle("hidden");
}

function logout() {
  /**
   * Faz logout e redireciona para a página inicial
   */
  try {
    event?.preventDefault?.();
  } catch (_) {}
  
  window.location.href = "/logout";
}

// ========================================
// CHAT DM - CONTROLE DE VISIBILIDADE
// ========================================

function toggleChat() {
  /**
   * Abre/fecha a caixa de chat com animação
   */
  const box = document.getElementById("chat-box");
  const isHidden = box.classList.contains("hidden");

  if (isHidden) {
    // Mostra o chat
    box.classList.remove("hidden", "hiding");
    void box.offsetWidth; // Force reflow para animação
    box.classList.add("show");

    // Foca no input e rola para o fim
    setTimeout(() => {
      document.getElementById("chat-input")?.focus();
      const container = document.querySelector("#dm-chat-root .chat-messages");
      if (container) container.scrollTop = container.scrollHeight;
    }, 200);
  } else {
    // Esconde o chat
    box.classList.remove("show");
    box.classList.add("hiding");
    
    setTimeout(() => {
      box.classList.add("hidden");
      box.classList.remove("hiding");
    }, 160);
  }
}

// ========================================
// NOTIFICAÇÕES - CONTROLE DO BADGE
// ========================================

function updateNotificationBadge(count) {
  /**
   * Atualiza o badge de notificações não lidas
   * @param {number} count - Número de notificações não lidas
   */
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

// ========================================
// NOTIFICAÇÕES - AÇÕES
// ========================================

async function markAllRead() {
  /**
   * Marca todas as notificações como lidas
   */
  const btn = document.getElementById("mark-all-read");
  if (btn) btn.disabled = true;

  try {
    const res = await fetch("/api/notifications/mark_all_read", {
      method: "POST",
      credentials: "same-origin",
    });
    
    if (!res.ok) {
      console.error("Falha ao marcar como lidas");
      return;
    }

    // Atualização otimista da UI
    updateNotificationBadge(0);

    // Limpa estado global se existir
    if (window.NOTIF_STATE) {
      window.NOTIF_STATE.unread = 0;
      window.NOTIF_STATE.items = [];
      if (typeof window.NOTIF_STATE.makeKey === "function") {
        window.NOTIF_STATE.lastKey = window.NOTIF_STATE.makeKey([]);
      }
    }

    // Dispara evento para o React atualizar
    window.dispatchEvent(new Event("notifications-updated"));
  } catch (e) {
    console.error("Erro ao marcar notificações como lidas:", e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ========================================
// MODAL DE NOTIFICAÇÕES
// ========================================

function openNotificationsModal() {
  /**
   * Abre o modal de notificações
   */
  const modal = document.getElementById("notifications-modal");
  if (!modal) return;

  modal.classList.remove("hidden");

  // Foca no botão de fechar para acessibilidade
  const closeBtn = document.getElementById("notifications-modal-close");
  closeBtn?.focus();
}

function closeNotificationsModal() {
  /**
   * Fecha o modal de notificações
   */
  const modal = document.getElementById("notifications-modal");
  if (!modal) return;

  modal.classList.add("hidden");
}

function setupNotificationModalListeners() {
  /**
   * Configura todos os listeners do modal de notificações
   */
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

// ========================================
// BUSCA DE USUÁRIOS - VARIÁVEIS
// ========================================

let searchTimeout = null; // Controle de debounce

// ========================================
// BUSCA DE USUÁRIOS - INICIALIZAÇÃO
// ========================================

function initUserSearch() {
  /**
   * Inicializa a funcionalidade de busca de usuários
   */
  const searchInput = document.getElementById("user-search-input");
  const resultsContainer = document.getElementById("search-results");

  if (!searchInput || !resultsContainer) return;

  // Evento de input com debounce
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();

    // Limpa timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Se vazio, esconde resultados
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

  // Fecha resultados ao clicar fora
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      resultsContainer.classList.add("hidden");
    }
  });

  // Reabre resultados ao focar no input
  searchInput.addEventListener("focus", () => {
    if (resultsContainer.innerHTML && searchInput.value.trim()) {
      resultsContainer.classList.remove("hidden");
    }
  });
}

// ========================================
// BUSCA DE USUÁRIOS - BUSCA
// ========================================

async function searchUsers(query) {
  /**
   * Busca usuários na API e renderiza resultados
   * @param {string} query - Termo de busca
   */
  const resultsContainer = document.getElementById("search-results");
  if (!resultsContainer) return;

  try {
    const response = await fetch("/api/users", { credentials: "same-origin" });
    
    if (!response.ok) throw new Error("Erro ao buscar usuários");

    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      console.warn(
        "Resposta não-JSON (possível redirect). Status:",
        response.status
      );
      return;
    }

    const data = await response.json();
    const allUsers = data.users || [];

    // Filtra por username OU email
    const q = query.toLowerCase();
    const filtered = allUsers.filter((user) => {
      const u = (user.username || "").toLowerCase();
      const e = (user.email || "").toLowerCase();
      return u.includes(q) || e.includes(q);
    });

    renderSearchResults(filtered);
  } catch (error) {
    console.error("Erro na busca de usuários:", error);
    resultsContainer.innerHTML =
      '<div class="no-results">Erro ao buscar usuários. Tente novamente.</div>';
  }
}

function renderSearchResults(users) {
  /**
   * Renderiza os resultados da busca
   * @param {Array} users - Lista de usuários encontrados
   */
  const resultsContainer = document.getElementById("search-results");
  if (!resultsContainer) return;

  // Se não encontrou ninguém
  if (users.length === 0) {
    resultsContainer.innerHTML =
      '<div class="no-results">Nenhum usuário encontrado</div>';
    return;
  }

  // Limpa container
  resultsContainer.innerHTML = "";

  // Renderiza cada usuário
  users.forEach((user) => {
    const userItem = createUserResultItem(user);
    resultsContainer.appendChild(userItem);
  });
}

function createUserResultItem(user) {
  /**
   * Cria um elemento HTML para um usuário nos resultados
   * @param {Object} user - Dados do usuário
   * @returns {HTMLElement}
   */
  const item = document.createElement("div");
  item.className = "user-result-item";
  
  item.innerHTML = `
    <div class="user-result-info">
      <div class="user-result-name">@${escapeHtml(user.username)}</div>
      <div class="user-result-email">${escapeHtml(user.email)}</div>
    </div>
  `;

  // Ao clicar, vai para o perfil
  item.addEventListener("click", () => {
    closeUserSearchModal();
    goToUserProfile(user.id);
  });

  return item;
}

// ========================================
// MODAL DE BUSCA DE USUÁRIOS
// ========================================

function openUserSearchModal() {
  /**
   * Abre o modal de busca de usuários
   */
  const modal = document.getElementById("user-search-modal");
  if (!modal) return;
  
  modal.classList.remove("hidden");
  initUserSearch();
  
  document.getElementById("user-search-close")?.focus();
}

function closeUserSearchModal() {
  /**
   * Fecha o modal de busca de usuários
   */
  const modal = document.getElementById("user-search-modal");
  if (!modal) return;
  
  modal.classList.add("hidden");
}

function setupUserSearchModalListeners() {
  /**
   * Configura listeners do modal de busca
   */
  const closeBtn = document.getElementById("user-search-close");
  const backdrop = document.getElementById("user-search-backdrop");
  const content = document.getElementById("user-search-content");

  closeBtn?.addEventListener("click", closeUserSearchModal);
  backdrop?.addEventListener("click", closeUserSearchModal);
  content?.addEventListener("click", (e) => e.stopPropagation());

  // Fecha com ESC
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("user-search-modal");
    const isOpen = modal && !modal.classList.contains("hidden");
    
    if (isOpen && e.key === "Escape") {
      closeUserSearchModal();
    }
  });
}

// ========================================
// NAVEGAÇÃO DE PERFIS
// ========================================

function goToMyProfile() {
  /**
   * Redireciona para o próprio perfil
   */
  window.location.href = "/perfil";
}

function goToUserProfile(userId) {
  /**
   * Redireciona para o perfil de um usuário específico
   * @param {number|string} userId - ID do usuário
   */
  window.location.href = `/perfil/${userId}`;
}

// ========================================
// UTILITÁRIOS
// ========================================

function escapeHtml(str) {
  /**
   * Sanitiza texto para evitar XSS
   * @param {string} str - Texto a ser sanitizado
   * @returns {string} Texto seguro
   */
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}