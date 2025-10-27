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
